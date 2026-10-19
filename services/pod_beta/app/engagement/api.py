"""FastAPI application for Engagement Manager service.

Module 4: Arena - Pod Beta.
Follows strict zero em dash rule: only hyphens (-) or colons (:).

Endpoints:
- POST  /engagement/create
- PATCH /engagement/{id}/scope
- POST  /engagement/{id}/execute
- POST  /engagement/{id}/complete
- POST  /engagement/{id}/archive
"""

from __future__ import annotations

import uuid
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import Depends, FastAPI, HTTPException, status
from pydantic import BaseModel, Field

from app.engagement.models import (
    CreateEngagementRequest,
    Engagement,
    EngagementResponse,
    EngagementState,
    LaunchTier,
    TIER_CREDIT_COSTS,
    UpdateScopeRequest,
    CompleteEngagementRequest,
    RevalidationRequest,
    RevalidationResponse,
    parse_launch_tier,
)
from pathlib import Path
from app.engagement.state_machine import (
    EngagementStateMachine,
    InvalidStateTransitionError,
    TerminalStateError,
)
from app.engagement.guardrails import (
    BudgetValidator,
    CooldownChecker,
    CooldownViolationError,
    InsufficientCreditsError,
    ScopeDriftDetector,
    ScopeDriftError,
)
from app.engagement.report_generator import ReportGenerator, SummaryReport
from app.engagement.mock_wallet import MockWalletClient, WalletInsufficientCreditsError
from app.engagement.event_bus import EventBus
from app.engagement.recommendations import RecommendationEngine, RecommendationResponse
from app.engagement.wallet_service_client import WalletServiceClient, WalletServiceError
from app.core.database import Base, SessionLocal, engine
from app.core.db_models import EngagementSessionModel
from app.core.security import Principal, current_principal, require_tenant
from sqlalchemy import inspect, text

# Ensure the declared persistence schema exists before serving requests.
Base.metadata.create_all(bind=engine)

# create_all does not add columns to tables created by older Arena versions.
_engagement_columns = {
    "original_scope": "JSON",
    "credit_cost": "INTEGER",
    "updated_at": "TIMESTAMP",
    "archived_at": "TIMESTAMP",
    "report": "JSON",
    "metadata": "JSON",
}
with engine.begin() as _connection:
    _existing_columns = {
        column["name"]
        for column in inspect(engine).get_columns("engagement_session")
    }
    for _name, _type in _engagement_columns.items():
        if _name not in _existing_columns:
            _connection.execute(
                text(f'ALTER TABLE engagement_session ADD COLUMN "{_name}" {_type}')
            )


class EngagementRepository:
    """Database-backed engagement storage for Pod Beta service."""

    @staticmethod
    def _aware(value: Optional[datetime]) -> Optional[datetime]:
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value

    @staticmethod
    def _to_entity(row: EngagementSessionModel) -> Engagement:
        return Engagement(
            engagement_id=row.engagement_id,
            tenant_id=row.tenant_id,
            state=row.state,
            engagement_type=row.engagement_type,
            scope=row.scope or {},
            original_scope=row.original_scope or {},
            credit_cost=row.credit_cost or 0,
            created_at=EngagementRepository._aware(row.created_at),
            updated_at=EngagementRepository._aware(row.updated_at or row.created_at),
            completed_at=EngagementRepository._aware(row.completed_at),
            archived_at=EngagementRepository._aware(row.archived_at),
            report=row.report,
            metadata=row.metadata_json or {},
        )

    def get(self, engagement_id: str) -> Optional[Engagement]:
        with SessionLocal() as db:
            row = db.get(EngagementSessionModel, engagement_id)
            return self._to_entity(row) if row else None

    def save(self, engagement: Engagement) -> None:
        with SessionLocal() as db:
            row = db.get(EngagementSessionModel, engagement.engagement_id)
            if row is None:
                row = EngagementSessionModel(engagement_id=engagement.engagement_id)
                db.add(row)
            row.tenant_id = engagement.tenant_id
            row.state = engagement.state.value
            row.engagement_type = engagement.engagement_type.value
            row.scope = engagement.scope
            row.original_scope = engagement.original_scope
            row.credit_cost = engagement.credit_cost
            row.created_at = engagement.created_at
            row.updated_at = engagement.updated_at
            row.completed_at = engagement.completed_at
            row.archived_at = engagement.archived_at
            row.report = engagement.report
            row.metadata_json = engagement.metadata
            db.commit()

    def list_by_tenant(self, tenant_id: str) -> List[Engagement]:
        with SessionLocal() as db:
            rows = db.query(EngagementSessionModel).filter(
                EngagementSessionModel.tenant_id == tenant_id
            ).all()
            return [self._to_entity(row) for row in rows]

    def latest_for_tier(self, tenant_id: str, tier: LaunchTier) -> Optional[Engagement]:
        with SessionLocal() as db:
            row = db.query(EngagementSessionModel).filter(
                EngagementSessionModel.tenant_id == tenant_id,
                EngagementSessionModel.engagement_type == tier.value,
            ).order_by(EngagementSessionModel.created_at.desc()).first()
            return self._to_entity(row) if row else None

    def clear(self) -> None:
        with SessionLocal() as db:
            db.query(EngagementSessionModel).delete()
            db.commit()


# Initialize FastAPI app
app = FastAPI(
    title="Engagement Manager",
    description="CyBreach Module 4: Arena - Engagement and Lifecycle Management Service",
    version="2.0.0",
    dependencies=[Depends(current_principal)],
)

# Service singletons
repo = EngagementRepository()
wallet = MockWalletClient(seed_tenants=True)
cooldown = CooldownChecker()
event_bus = EventBus()
wallet_service = WalletServiceClient()
wallet_mode = os.getenv("BETA_WALLET_MODE", "service").lower()
campaigns_dir = Path(__file__).resolve().parent.parent.parent / "fixtures" / "campaigns"
recommendation_engine = RecommendationEngine(campaigns_dir=campaigns_dir)


@app.on_event("startup")
async def start_event_delivery() -> None:
    await event_bus.start()


@app.on_event("shutdown")
async def stop_event_delivery() -> None:
    await event_bus.stop()


def _wallet_client():
    if wallet_mode == "service":
        return wallet_service
    if wallet_mode != "mock":
        raise WalletServiceError(503, "BETA_WALLET_MODE must be 'service' or 'mock'")
    return wallet


@app.post("/engagement/create", response_model=EngagementResponse, status_code=status.HTTP_201_CREATED)
async def create_engagement(req: CreateEngagementRequest, principal: Principal = Depends(current_principal)):
    """Create a new engagement in CREATED state.

    1. Parses and validates launch tier.
    2. Validates tenant cooldown to prevent rapid cycling.
    3. Enforces idempotency key format: mod4:{engagement_id}.
    4. Debits wallet; aborts with HTTP 402 if balance is insufficient.
    5. Transitions engagement to CREATED state.
    6. Emits engagement.lifecycle event.
    """
    try:
        require_tenant(principal, req.tenant_id)
        tier = parse_launch_tier(req.engagement_type)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # Guardrail: Check cooldown period between engagements of the same type
    try:
        latest = repo.latest_for_tier(req.tenant_id, tier)
        if latest:
            cooldown.record_engagement(req.tenant_id, tier, timestamp=latest.created_at)
        cooldown.assert_not_in_cooldown(req.tenant_id, tier)
    except CooldownViolationError as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(e),
        )

    # Determine credit cost
    credit_cost = TIER_CREDIT_COSTS[tier]
    engagement_id = f"eng-{uuid.uuid4().hex[:12]}"

    # Enforce Idempotency Key format: mod4:{engagement_id}
    idempotency_key = f"mod4:{req.tenant_id}:{engagement_id}:debit"

    # Wallet debit operation
    if credit_cost > 0:
        try:
            await _wallet_client().debit(
                tenant_id=req.tenant_id,
                amount=credit_cost,
                idempotency_key=idempotency_key,
                reason=f"Engagement creation: {tier.value}",
                module_source="mod4",
            )
        except WalletInsufficientCreditsError as e:
            # Abort engagement creation per cross-pod requirement
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"Need {e.cost} credits, have {e.balance}",
            )
        except WalletServiceError as e:
            raise HTTPException(status_code=e.status_code, detail=e.detail) from e
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Wallet debit failed: {str(e)}",
            )

    # Record engagement for cooldown tracking
    cooldown.record_engagement(req.tenant_id, tier)

    now = datetime.now(timezone.utc)
    initial_scope = req.scope or {}
    engagement = Engagement(
        engagement_id=engagement_id,
        tenant_id=req.tenant_id,
        state=EngagementState.CREATED,
        engagement_type=tier,
        scope=initial_scope,
        original_scope=initial_scope,
        credit_cost=credit_cost,
        created_at=now,
        updated_at=now,
        metadata=req.metadata or {},
    )

    repo.save(engagement)

    # Publish engagement.lifecycle event
    await event_bus.publish_engagement_lifecycle(
        event_type="engagement.created",
        engagement_id=engagement_id,
        tenant_id=req.tenant_id,
        state=engagement.state.value,
        engagement_type=tier.value,
        details={"credit_cost": credit_cost, "scope": initial_scope},
    )

    return EngagementResponse(
        engagement_id=engagement.engagement_id,
        tenant_id=engagement.tenant_id,
        state=engagement.state,
        engagement_type=engagement.engagement_type.value,
        credit_cost=engagement.credit_cost,
        scope=engagement.scope,
        created_at=engagement.created_at,
        updated_at=engagement.updated_at,
        completed_at=engagement.completed_at,
        archived_at=engagement.archived_at,
        report=engagement.report,
    )


@app.patch("/engagement/{id}/scope", response_model=EngagementResponse)
async def update_engagement_scope(id: str, req: UpdateScopeRequest, principal: Principal = Depends(current_principal)):
    """Update engagement scope and advance state to SCOPED.

    1. Checks if engagement exists.
    2. Validates forward-only progression (only CREATED or SCOPED may update scope).
    3. Evaluates scope drift: flags if expansion exceeds 120% without confirmation.
    4. Transitions state to SCOPED.
    5. Emits engagement.lifecycle event.
    """
    engagement = repo.get(id)
    if not engagement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Engagement '{id}' not found",
        )
    require_tenant(principal, engagement.tenant_id)

    # Verify state permits scope update
    if engagement.state in (EngagementState.EXECUTING, EngagementState.COMPLETED, EngagementState.ARCHIVED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot update scope for engagement in state '{engagement.state.value}'. "
                f"Scope can only be set or modified prior to execution."
            ),
        )

    # Guardrail: Scope drift detection (> 120% of original scope)
    baseline_scope = engagement.original_scope
    if not baseline_scope and engagement.scope:
        baseline_scope = engagement.scope

    try:
        drift_report = ScopeDriftDetector.assert_no_unconfirmed_drift(
            original_scope=baseline_scope,
            new_scope=req.scope_manifest,
            confirmed=req.confirmed,
        )
    except ScopeDriftError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # Transition state to SCOPED if currently CREATED
    if engagement.state == EngagementState.CREATED:
        try:
            EngagementStateMachine.transition_to_scoped(engagement)
        except InvalidStateTransitionError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # If original_scope was empty, record this initial scope as baseline
    if not engagement.original_scope:
        engagement.original_scope = req.scope_manifest

    engagement.scope = req.scope_manifest
    engagement.updated_at = datetime.now(timezone.utc)
    repo.save(engagement)

    # Publish lifecycle event
    await event_bus.publish_engagement_lifecycle(
        event_type="engagement.scoped",
        engagement_id=engagement.engagement_id,
        tenant_id=engagement.tenant_id,
        state=engagement.state.value,
        engagement_type=engagement.engagement_type.value,
        details={
            "scope": engagement.scope,
            "drift_detected": drift_report.drift_detected,
            "expansion_percentage": drift_report.expansion_percentage,
        },
    )

    return EngagementResponse(
        engagement_id=engagement.engagement_id,
        tenant_id=engagement.tenant_id,
        state=engagement.state,
        engagement_type=engagement.engagement_type.value,
        credit_cost=engagement.credit_cost,
        scope=engagement.scope,
        created_at=engagement.created_at,
        updated_at=engagement.updated_at,
        completed_at=engagement.completed_at,
        archived_at=engagement.archived_at,
        report=engagement.report,
        warning=drift_report.warning,
    )


@app.post("/engagement/{id}/execute", response_model=EngagementResponse)
async def execute_engagement(id: str, principal: Principal = Depends(current_principal)):
    """Transition engagement from SCOPED to EXECUTING.

    Enforces:
    - Tenant cannot execute an engagement before scoping it.
    - Forward-only state transition: SCOPED -> EXECUTING.
    - Emits engagement.lifecycle event.
    """
    engagement = repo.get(id)
    if not engagement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Engagement '{id}' not found",
        )
    require_tenant(principal, engagement.tenant_id)

    if engagement.state == EngagementState.CREATED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot execute an engagement before scoping it. Please define scope first.",
        )

    try:
        EngagementStateMachine.transition_to_executing(engagement)
    except (InvalidStateTransitionError, TerminalStateError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    repo.save(engagement)

    await event_bus.publish_engagement_lifecycle(
        event_type="engagement.executing",
        engagement_id=engagement.engagement_id,
        tenant_id=engagement.tenant_id,
        state=engagement.state.value,
        engagement_type=engagement.engagement_type.value,
        details={"scope": engagement.scope},
    )

    return EngagementResponse(
        engagement_id=engagement.engagement_id,
        tenant_id=engagement.tenant_id,
        state=engagement.state,
        engagement_type=engagement.engagement_type.value,
        credit_cost=engagement.credit_cost,
        scope=engagement.scope,
        created_at=engagement.created_at,
        updated_at=engagement.updated_at,
        completed_at=engagement.completed_at,
        archived_at=engagement.archived_at,
        report=engagement.report,
    )


@app.post("/engagement/{id}/complete", response_model=EngagementResponse)
async def complete_engagement(id: str, req: CompleteEngagementRequest, principal: Principal = Depends(current_principal)):
    """Mark engagement as completed with Module 2 results.

    Enforces:
    - Tenant cannot complete an engagement before executing it.
    - Forward-only state transition: EXECUTING -> COMPLETED.
    - Compiles Module 2 outcomes (Detected, Missed, Partial, NoData).
    - Flags NoData for refund eligibility and credits back wallet if eligible.
    - Emits engagement.lifecycle event.
    """
    engagement = repo.get(id)
    if not engagement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Engagement '{id}' not found",
        )
    require_tenant(principal, engagement.tenant_id)

    if engagement.state != EngagementState.EXECUTING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot complete an engagement before executing it. "
                f"Current state: '{engagement.state.value}'."
            ),
        )

    # Generate summary report from Module 2 outcomes
    report = ReportGenerator.generate_report(
        engagement_id=engagement.engagement_id,
        tenant_id=engagement.tenant_id,
        engagement_type=engagement.engagement_type.value,
        outcomes=req.results,
        debited_credits=engagement.credit_cost,
    )

    # If NoData outcomes resulted in refund eligibility, trigger automatic refund
    if report.refund.eligible and report.refund.refund_amount > 0:
        try:
            await _wallet_client().credit(
                tenant_id=engagement.tenant_id,
                amount=report.refund.refund_amount,
                idempotency_key=report.refund.refund_idempotency_key,
                reason=report.refund.reason or "Automatic refund for inconclusive (NoData) verdicts",
                module_source="mod4",
            )
        except WalletServiceError as e:
            raise HTTPException(status_code=e.status_code, detail=e.detail) from e

    try:
        EngagementStateMachine.transition_to_completed(engagement)
    except (InvalidStateTransitionError, TerminalStateError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    engagement.report = report.to_dict()
    if req.metadata:
        engagement.metadata.update(req.metadata)
    repo.save(engagement)

    await event_bus.publish_engagement_lifecycle(
        event_type="engagement.completed",
        engagement_id=engagement.engagement_id,
        tenant_id=engagement.tenant_id,
        state=engagement.state.value,
        engagement_type=engagement.engagement_type.value,
        details={
            "detection_rate": report.executive_summary.detection_rate_percentage,
            "refund_eligible": report.refund.eligible,
            "refund_amount": report.refund.refund_amount,
        },
    )

    return EngagementResponse(
        engagement_id=engagement.engagement_id,
        tenant_id=engagement.tenant_id,
        state=engagement.state,
        engagement_type=engagement.engagement_type.value,
        credit_cost=engagement.credit_cost,
        scope=engagement.scope,
        created_at=engagement.created_at,
        updated_at=engagement.updated_at,
        completed_at=engagement.completed_at,
        archived_at=engagement.archived_at,
        report=engagement.report,
    )


@app.post("/engagement/{id}/archive", response_model=EngagementResponse)
async def archive_engagement(id: str, principal: Principal = Depends(current_principal)):
    """Transition engagement from COMPLETED to ARCHIVED (terminal state).

    Enforces:
    - Forward-only state transition: COMPLETED -> ARCHIVED.
    - No transitions permitted after ARCHIVED.
    - Emits engagement.lifecycle event.
    """
    engagement = repo.get(id)
    if not engagement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Engagement '{id}' not found",
        )
    require_tenant(principal, engagement.tenant_id)

    try:
        EngagementStateMachine.transition_to_archived(engagement)
    except (InvalidStateTransitionError, TerminalStateError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    repo.save(engagement)

    await event_bus.publish_engagement_lifecycle(
        event_type="engagement.archived",
        engagement_id=engagement.engagement_id,
        tenant_id=engagement.tenant_id,
        state=engagement.state.value,
        engagement_type=engagement.engagement_type.value,
    )

    return EngagementResponse(
        engagement_id=engagement.engagement_id,
        tenant_id=engagement.tenant_id,
        state=engagement.state,
        engagement_type=engagement.engagement_type.value,
        credit_cost=engagement.credit_cost,
        scope=engagement.scope,
        created_at=engagement.created_at,
        updated_at=engagement.updated_at,
        completed_at=engagement.completed_at,
        archived_at=engagement.archived_at,
        report=engagement.report,
    )


@app.get("/engagement")
async def list_engagements(principal: Principal = Depends(current_principal)):
    """List only the caller's engagements so clients can restore saved reports."""
    engagements = sorted(
        repo.list_by_tenant(principal.tenant_id),
        key=lambda item: item.created_at,
        reverse=True,
    )
    return [
        {
            "engagement_id": item.engagement_id,
            "tenant_id": item.tenant_id,
            "state": item.state.value,
            "engagement_type": item.engagement_type.value,
            "credit_cost": item.credit_cost,
            "scope": item.scope,
            "metadata": item.metadata,
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "completed_at": item.completed_at.isoformat() if item.completed_at else None,
            "report": item.report,
        }
        for item in engagements
    ]


@app.get("/engagement/{id}", response_model=EngagementResponse)
async def get_engagement(id: str, principal: Principal = Depends(current_principal)):
    """Retrieve an engagement by ID."""
    engagement = repo.get(id)
    if not engagement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Engagement '{id}' not found",
        )
    require_tenant(principal, engagement.tenant_id)
    return EngagementResponse(
        engagement_id=engagement.engagement_id,
        tenant_id=engagement.tenant_id,
        state=engagement.state,
        engagement_type=engagement.engagement_type.value,
        credit_cost=engagement.credit_cost,
        scope=engagement.scope,
        created_at=engagement.created_at,
        updated_at=engagement.updated_at,
        completed_at=engagement.completed_at,
        archived_at=engagement.archived_at,
        report=engagement.report,
    )


@app.get("/engagement/{id}/report")
async def get_engagement_report(id: str, principal: Principal = Depends(current_principal)):
    """Retrieve summary report for a completed engagement."""
    engagement = repo.get(id)
    if not engagement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Engagement '{id}' not found",
        )
    require_tenant(principal, engagement.tenant_id)
    if not engagement.report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No report available for engagement '{id}'. State: {engagement.state.value}",
        )
    return engagement.report


@app.post("/engagement/{id}/revalidate", response_model=RevalidationResponse, status_code=status.HTTP_201_CREATED)
async def revalidate_engagement_technique(id: str, req: RevalidationRequest, principal: Principal = Depends(current_principal)):
    """Trigger one-click re-validation for a previously missed technique.

    Week 11 Deliverable (PRD Section 7.2 & 9.1):
    1. Validates parent engagement exists and has completed outcomes.
    2. Verifies the technique was tested and produced a gap (Missed or Partial).
    3. Debits 3 credits from tenant wallet with idempotency key mod4:{reval_eng_id}.
       Aborts with HTTP 402 if balance is insufficient.
    4. Creates a new targeted engagement in SCOPED state ready for execution.
    5. Emits lifecycle event and triggers Module 1 playbook re-run.
    """
    engagement = repo.get(id)
    if not engagement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Parent engagement '{id}' not found",
        )
    require_tenant(principal, engagement.tenant_id)

    if not engagement.report:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Parent engagement '{id}' does not have completed validation outcomes.",
        )

    # Check outcomes for requested technique
    tech_results = engagement.report.get("technique_results", [])
    matched_verdict = None
    matched_playbook = None

    for item in tech_results:
        if item.get("technique_id") == req.technique_id:
            matched_verdict = item.get("verdict")
            matched_playbook = item.get("playbook_hash")
            break

    if not matched_verdict:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Technique '{req.technique_id}' was not tested in parent engagement '{id}'.",
        )

    # Normalization
    v_str = matched_verdict.value if hasattr(matched_verdict, "value") else str(matched_verdict)
    if v_str == "Detected":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Technique '{req.technique_id}' was already validated as Detected. "
                f"Re-validation is only permitted for gap techniques (Missed or Partial)."
            ),
        )

    # Debit wallet: 3 credits per re-validation (PRD Section 9.1)
    reval_cost = 3
    reval_eng_id = f"eng-reval-{uuid.uuid4().hex[:10]}"
    idempotency_key = f"mod4:{engagement.tenant_id}:{reval_eng_id}:debit"

    try:
        await _wallet_client().debit(
            tenant_id=engagement.tenant_id,
            amount=reval_cost,
            idempotency_key=idempotency_key,
            reason=f"One-click re-validation for technique {req.technique_id}",
            module_source="mod4",
        )
    except WalletInsufficientCreditsError as e:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Need {e.cost} credits, have {e.balance}",
        )
    except WalletServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail) from e

    now = datetime.now(timezone.utc)
    reval_scope = {
        "techniques": [req.technique_id],
        "target_count": 1,
        "playbook_hashes": [matched_playbook] if matched_playbook else [],
        "revalidation_of": id,
        "revalidation_target": req.technique_id,
        "notes": req.notes or "",
    }

    # Newly spawned re-validation engagement is directly in SCOPED state
    reval_engagement = Engagement(
        engagement_id=reval_eng_id,
        tenant_id=engagement.tenant_id,
        state=EngagementState.SCOPED,
        engagement_type=LaunchTier.QUICK_SCAN,
        scope=reval_scope,
        original_scope=reval_scope,
        credit_cost=reval_cost,
        created_at=now,
        updated_at=now,
        metadata={"parent_engagement_id": id, "type": "revalidation"},
    )

    repo.save(reval_engagement)

    # Publish lifecycle event and trigger Module 1 re-run playbook
    await event_bus.publish_engagement_lifecycle(
        event_type="engagement.revalidation.created",
        engagement_id=reval_eng_id,
        tenant_id=engagement.tenant_id,
        state=EngagementState.SCOPED.value,
        engagement_type="revalidation",
        details={
            "target_technique": req.technique_id,
            "parent_engagement_id": id,
            "playbook_hash": matched_playbook,
            "credit_cost": reval_cost,
        },
    )

    return RevalidationResponse(
        revalidation_engagement_id=reval_eng_id,
        parent_engagement_id=id,
        tenant_id=engagement.tenant_id,
        target_technique=req.technique_id,
        credit_cost=reval_cost,
        state=reval_engagement.state,
        scope=reval_scope,
        created_at=now,
        message=f"Re-validation engagement initialized and scoped for technique {req.technique_id}.",
    )


@app.get("/engagement/recommendations/{tenant_id}", response_model=RecommendationResponse)
async def get_engagement_recommendations(tenant_id: str, limit: int = 5, principal: Principal = Depends(current_principal)):
    """Suggest most impactful next campaigns based on tenant gap analysis.

    Week 11 Deliverable (PRD Section 7.2):
    Analyzes historical Module 2 outcomes across tenant engagements, discovers unclosed
    gaps (Missed/Partial), and returns ranked campaigns to remediate those gaps.
    """
    require_tenant(principal, tenant_id)
    tenant_engagements = repo.list_by_tenant(tenant_id)
    return recommendation_engine.get_recommendations(
        tenant_id=tenant_id,
        engagements=tenant_engagements,
        limit=limit,
    )

