"""
CyBreach Module 4: Arena - Campaign API

FastAPI endpoints for Campaign Library catalog search, hash-pinning verification,
multi-stage boss fights, and recurring continuous validation scheduling.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Dict, List, Optional
import uuid
from sqlalchemy import inspect, text

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

from app.campaign.models import (
    CampaignDefinition,
    BossFightSession,
    BossFightStageResult,
)
from app.campaign.hash_checker import (
    Module1PlaybookRegistry,
    verify_campaign_hashes,
    compute_canonical_content_hash,
)
from app.campaign.scheduler import (
    ValidationSchedulerEngine,
    ValidationSchedule,
    ScheduleExecutionRecord,
)
from app.core.security import Principal, current_principal, require_tenant
from app.core.database import Base, SessionLocal, engine
from app.core.db_models import (
    BossFightSessionModel,
    CampaignDefinitionModel,
    CampaignScheduleStateModel,
)

Base.metadata.create_all(bind=engine)
if "definition" not in {column["name"] for column in inspect(engine).get_columns("campaign_definition")}:
    with engine.begin() as connection:
        connection.execute(text('ALTER TABLE campaign_definition ADD COLUMN "definition" JSON'))

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["Campaigns"])


class CampaignCatalogService:
    """Service managing loaded campaigns and Module 1 fixture registry."""

    def __init__(
        self,
        fixtures_dir: Optional[Path] = None,
        playbooks_fixture: Optional[Path] = None,
    ):
        base_dir = Path(__file__).parent.parent.parent
        self.fixtures_dir = fixtures_dir or (base_dir / "fixtures" / "campaigns")
        self.playbooks_fixture = playbooks_fixture or (base_dir / "fixtures" / "playbooks" / "module1_catalog.json")

        self.campaigns: Dict[str, CampaignDefinition] = {}
        self.registry = Module1PlaybookRegistry()
        self.boss_sessions: Dict[str, BossFightSession] = {}

        self.reload_all()

    def reload_all(self) -> None:
        """Reload playbooks and campaigns from static JSON fixtures."""
        self.campaigns.clear()
        self.boss_sessions.clear()

        # Load Module 1 playbooks fixture
        if self.playbooks_fixture.exists():
            self.registry = Module1PlaybookRegistry.load_from_fixture(self.playbooks_fixture)
        else:
            self.registry = Module1PlaybookRegistry()

        # Load campaign fixtures
        if self.fixtures_dir.exists():
            for json_file in sorted(self.fixtures_dir.glob("*.json")):
                try:
                    with open(json_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    camp = CampaignDefinition(**data)
                    camp.compute_difficulty()
                    if not camp.content_hash:
                        camp.content_hash = compute_canonical_content_hash(camp.model_dump())
                    self.campaigns[camp.campaign_id] = camp
                except Exception as exc:
                    logger.error("Failed to load campaign fixture %s: %s", json_file, exc)

        # Database definitions override fixtures so API-created campaigns survive restarts.
        with SessionLocal() as db:
            for row in db.query(CampaignDefinitionModel).filter(CampaignDefinitionModel.definition.isnot(None)).all():
                try:
                    self.campaigns[row.campaign_id] = CampaignDefinition(**row.definition)
                except Exception as exc:
                    logger.error("Failed to load persisted campaign %s: %s", row.campaign_id, exc)
            for row in db.query(BossFightSessionModel).all():
                try:
                    self.boss_sessions[row.session_id] = BossFightSession(**row.session)
                except Exception as exc:
                    logger.error("Failed to load boss-fight session %s: %s", row.session_id, exc)

    def save_boss_session(self, session: BossFightSession) -> None:
        """Persist session creation and each stage transition before responding."""
        with SessionLocal() as db:
            row = db.get(BossFightSessionModel, session.session_id)
            if row is None:
                row = BossFightSessionModel(
                    session_id=session.session_id,
                    tenant_id=session.tenant_id,
                    campaign_id=session.campaign_id,
                    session=session.model_dump(mode="json"),
                )
                db.add(row)
            else:
                row.tenant_id = session.tenant_id
                row.campaign_id = session.campaign_id
                row.session = session.model_dump(mode="json")
            db.commit()
        self.boss_sessions[session.session_id] = session

    def get_boss_session(self, session_id: str) -> Optional[BossFightSession]:
        """Read the database as the source of truth, including across workers."""
        with SessionLocal() as db:
            row = db.get(BossFightSessionModel, session_id)
            if row is None:
                self.boss_sessions.pop(session_id, None)
                return None
            session = BossFightSession(**row.session)
        self.boss_sessions[session_id] = session
        return session

    def get_campaign(self, campaign_id: str, check_hashes: bool = True) -> Optional[CampaignDefinition]:
        """Fetch campaign by ID and optionally verify hashes."""
        camp = self.campaigns.get(campaign_id)
        if not camp:
            return None
        camp_copy = camp.model_copy(deep=True)
        if check_hashes:
            verify_campaign_hashes(camp_copy, self.registry)
        camp_copy.compute_difficulty()
        return camp_copy

    def add_or_update(self, camp: CampaignDefinition) -> CampaignDefinition:
        """Add or update campaign definition."""
        camp.compute_difficulty()
        if not camp.content_hash:
            camp.content_hash = compute_canonical_content_hash(camp.model_dump())
        self.campaigns[camp.campaign_id] = camp
        with SessionLocal() as db:
            row = db.get(CampaignDefinitionModel, camp.campaign_id)
            payload = camp.model_dump(mode="json")
            if row is None:
                row = CampaignDefinitionModel(
                    campaign_id=camp.campaign_id,
                    title=camp.title,
                    tier=camp.tier,
                    playbook_hashes=camp.playbook_hashes,
                    regions=camp.regions,
                    techniques=camp.techniques,
                    credit_cost=camp.credit_cost,
                    content_hash=camp.content_hash,
                )
                db.add(row)
            row.title = camp.title
            row.tier = camp.tier
            row.playbook_hashes = camp.playbook_hashes
            row.regions = camp.regions
            row.techniques = camp.techniques
            row.credit_cost = camp.credit_cost
            row.content_hash = camp.content_hash
            row.definition = payload
            db.commit()
        return camp


# Global catalog service and continuous validation scheduler engine
catalog_service = CampaignCatalogService()
scheduler_engine = ValidationSchedulerEngine(auto_start=False)


def _save_schedule_state(schedule: ValidationSchedule, history: Optional[list[dict]] = None) -> None:
    with SessionLocal() as db:
        row = db.get(CampaignScheduleStateModel, schedule.schedule_id)
        if row is None:
            row = CampaignScheduleStateModel(schedule_id=schedule.schedule_id, tenant_id=schedule.tenant_id)
            db.add(row)
        row.tenant_id = schedule.tenant_id
        row.schedule = schedule.model_dump(mode="json")
        if history is not None:
            row.history = [item.model_dump(mode="json") if isinstance(item, ScheduleExecutionRecord) else item for item in history]
        db.commit()


scheduler_engine._state_callback = _save_schedule_state


def _restore_schedules() -> None:
    with SessionLocal() as db:
        rows = db.query(CampaignScheduleStateModel).all()
    for row in rows:
        try:
            schedule = ValidationSchedule(**row.schedule)
            scheduler_engine.add_schedule(schedule)
            records = [ScheduleExecutionRecord(**item) for item in (row.history or [])]
            scheduler_engine._history.extend(records)
            if not schedule.is_active:
                scheduler_engine.pause_schedule(schedule.schedule_id)
        except Exception as exc:
            logger.error("Could not restore schedule %s: %s", row.schedule_id, exc)


_restore_schedules()


# Request schemas
class CreateCampaignRequest(BaseModel):
    campaign_id: str = Field(..., description="Unique campaign ID")
    title: str = Field(..., description="Title")
    description: str = Field("", description="Description")
    playbook_hashes: List[str] = Field(..., description="Pinned SHA-256 hashes")
    tier: str = Field(..., description="quick_scan, guided, audit, boss_fight, continuous")
    regions: List[str] = Field(default_factory=lambda: ["global"])
    techniques: List[str] = Field(default_factory=list)
    regulations: List[str] = Field(default_factory=list)
    credit_cost: int = Field(..., ge=0)
    asset_criticality: str = Field(default="medium")
    estimated_score_impact: float = Field(default=5.0)
    stages: List[dict] = Field(default_factory=list)


class StartBossFightRequest(BaseModel):
    tenant_id: str = Field(..., description="Tenant ID starting boss fight")


class SubmitStageResultRequest(BaseModel):
    stage_id: str = Field(..., description="Stage ID being evaluated")
    verdict: str = Field(..., description="Detected, Missed, Partial, or NoData")
    score: float = Field(..., ge=0.0, le=100.0, description="Stage score")
    evidence_ref: Optional[str] = Field(None, description="Reference link to evidence")


class ScheduleRequest(BaseModel):
    tenant_id: str
    campaign_id: str
    cadence: str
    cron_expression: Optional[str] = None
    interval_seconds: Optional[int] = None
    hour: int = 2
    minute: int = 0
    day_of_week: Optional[str] = "mon"
    day_of_month: Optional[int] = 1


# 1. Catalog Collection Endpoints
@router.get("/campaigns", response_model=List[CampaignDefinition])
async def list_campaigns(
    tier: Optional[str] = Query(None, description="Filter by tier: quick_scan, guided, audit, boss_fight, continuous"),
    region: Optional[str] = Query(None, description="Filter by region: global, eu, na, apac, latam, mea"),
    technique: Optional[str] = Query(None, description="Filter by MITRE ATT&CK technique ID"),
    regulation: Optional[str] = Query(None, description="Filter by compliance framework: NIST, ISO27001, PCI-DSS, GDPR"),
    asset_criticality: Optional[str] = Query(None, description="Filter by asset criticality: low, medium, high, critical"),
    search: Optional[str] = Query(None, description="Search keyword in title or description"),
    check_hashes: bool = Query(False, description="Run real-time hash verification against Module 1 catalog"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """
    Multi-axis catalog search for campaigns.
    Supports filtering by tier, region (with global fallback), techniques, and regulations.
    """
    results: List[CampaignDefinition] = []

    for camp in catalog_service.campaigns.values():
        if camp.archived:
            continue

        # Tier filter
        if tier and camp.tier.lower() != tier.lower():
            continue

        # Region filter: matches if region matches or if campaign is tagged 'global'
        if region:
            req_region = region.lower()
            camp_regions = [r.lower() for r in camp.regions]
            if req_region not in camp_regions and "global" not in camp_regions:
                continue

        # MITRE ATT&CK technique filter
        if technique:
            req_tech = technique.upper()
            all_techs = {t.upper() for t in camp.techniques}
            for st in camp.stages:
                all_techs.update(t.upper() for t in st.techniques)
            if req_tech not in all_techs:
                continue

        # Regulatory framework filter
        if regulation:
            req_reg = regulation.upper()
            camp_regs = {r.upper() for r in camp.regulations}
            if req_reg not in camp_regs:
                continue

        # Criticality filter
        if asset_criticality and camp.asset_criticality.lower() != asset_criticality.lower():
            continue

        # Keyword search
        if search:
            kw = search.lower()
            if kw not in camp.title.lower() and kw not in camp.description.lower():
                continue

        # Make copy for safe return
        item = camp.model_copy(deep=True)
        if check_hashes:
            verify_campaign_hashes(item, catalog_service.registry)
        item.compute_difficulty()
        results.append(item)

    return results[offset : offset + limit]


@router.post("/campaigns", response_model=CampaignDefinition, status_code=201)
async def create_campaign(req: CreateCampaignRequest, principal: Principal = Depends(current_principal)):
    """
    Register a new content-addressed campaign definition.
    Enforces SHA-256 hash formatting and computes canonical content hash.
    """
    if principal.role not in {"admin", "service"}:
        raise HTTPException(status_code=403, detail="Administrator role is required")
    if req.campaign_id in catalog_service.campaigns:
        raise HTTPException(
            status_code=409,
            detail=f"Campaign '{req.campaign_id}' already exists",
        )

    try:
        camp = CampaignDefinition(**req.model_dump())
        camp.compute_difficulty()
        camp.content_hash = compute_canonical_content_hash(camp.model_dump())
        verify_campaign_hashes(camp, catalog_service.registry)
        catalog_service.add_or_update(camp)
        return camp
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


# 2. Scheduler Endpoints (Defined before /{campaign_id} to avoid route conflicts)
@router.post("/campaigns/schedule", response_model=ValidationSchedule, status_code=201)
async def create_schedule(req: ScheduleRequest, principal: Principal = Depends(current_principal)):
    """Register a new recurring continuous validation schedule using APScheduler."""
    require_tenant(principal, req.tenant_id)
    camp = catalog_service.get_campaign(req.campaign_id, check_hashes=False)
    if not camp:
        raise HTTPException(status_code=404, detail=f"Campaign '{req.campaign_id}' not found")

    schedule = ValidationSchedule(
        tenant_id=req.tenant_id,
        campaign_id=req.campaign_id,
        cadence=req.cadence,
        cron_expression=req.cron_expression,
        interval_seconds=req.interval_seconds,
        hour=req.hour,
        minute=req.minute,
        day_of_week=req.day_of_week,
        day_of_month=req.day_of_month,
    )

    try:
        created = scheduler_engine.add_schedule(schedule)
        _save_schedule_state(created)
        return created
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@router.get("/campaigns/schedules", response_model=List[ValidationSchedule])
async def list_schedules(tenant_id: Optional[str] = Query(None), principal: Principal = Depends(current_principal)):
    """List recurring validation schedules, optionally filtered by tenant."""
    tenant_id = tenant_id or principal.tenant_id
    require_tenant(principal, tenant_id)
    return scheduler_engine.list_schedules(tenant_id=tenant_id)


@router.get("/campaigns/schedules/{schedule_id}", response_model=ValidationSchedule)
async def get_schedule_endpoint(schedule_id: str, principal: Principal = Depends(current_principal)):
    """Get schedule details by ID."""
    sched = scheduler_engine.get_schedule(schedule_id)
    if not sched:
        raise HTTPException(status_code=404, detail=f"Schedule '{schedule_id}' not found")
    require_tenant(principal, sched.tenant_id)
    return sched


@router.post("/campaigns/schedules/{schedule_id}/pause", response_model=ValidationSchedule)
async def pause_schedule_endpoint(schedule_id: str, principal: Principal = Depends(current_principal)):
    """Pause an active recurring schedule."""
    sched = scheduler_engine.get_schedule(schedule_id)
    if not sched:
        raise HTTPException(status_code=404, detail=f"Schedule '{schedule_id}' not found")
    require_tenant(principal, sched.tenant_id)
    try:
        paused = scheduler_engine.pause_schedule(schedule_id)
        _save_schedule_state(paused)
        return paused
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Schedule '{schedule_id}' not found")


@router.post("/campaigns/schedules/{schedule_id}/resume", response_model=ValidationSchedule)
async def resume_schedule_endpoint(schedule_id: str, principal: Principal = Depends(current_principal)):
    """Resume a paused schedule."""
    sched = scheduler_engine.get_schedule(schedule_id)
    if not sched:
        raise HTTPException(status_code=404, detail=f"Schedule '{schedule_id}' not found")
    require_tenant(principal, sched.tenant_id)
    try:
        resumed = scheduler_engine.resume_schedule(schedule_id)
        _save_schedule_state(resumed)
        return resumed
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Schedule '{schedule_id}' not found")


@router.delete("/campaigns/schedules/{schedule_id}")
async def delete_schedule_endpoint(schedule_id: str, principal: Principal = Depends(current_principal)):
    """Remove a recurring validation schedule."""
    sched = scheduler_engine.get_schedule(schedule_id)
    if not sched:
        raise HTTPException(status_code=404, detail=f"Schedule '{schedule_id}' not found")
    require_tenant(principal, sched.tenant_id)
    success = scheduler_engine.remove_schedule(schedule_id)
    if success:
        with SessionLocal() as db:
            db.query(CampaignScheduleStateModel).filter_by(schedule_id=schedule_id).delete()
            db.commit()
    if not success:
        raise HTTPException(status_code=404, detail=f"Schedule '{schedule_id}' not found")
    return {"status": "deleted", "schedule_id": schedule_id}


@router.post("/campaigns/schedules/{schedule_id}/trigger", response_model=ScheduleExecutionRecord)
async def trigger_schedule_now_endpoint(schedule_id: str, principal: Principal = Depends(current_principal)):
    """Manually trigger immediate execution of a scheduled campaign."""
    sched = scheduler_engine.get_schedule(schedule_id)
    if not sched:
        raise HTTPException(status_code=404, detail=f"Schedule '{schedule_id}' not found")
    require_tenant(principal, sched.tenant_id)
    try:
        record = scheduler_engine.trigger_now(schedule_id)
        schedule = scheduler_engine.get_schedule(schedule_id)
        if schedule:
            _save_schedule_state(schedule, [item.model_dump(mode="json") for item in scheduler_engine.get_execution_history(schedule_id=schedule_id)])
        return record
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Schedule '{schedule_id}' not found")


@router.get("/campaigns/schedules/{schedule_id}/history", response_model=List[ScheduleExecutionRecord])
async def get_schedule_history(schedule_id: str, principal: Principal = Depends(current_principal)):
    """Get execution history for a schedule."""
    sched = scheduler_engine.get_schedule(schedule_id)
    if not sched:
        raise HTTPException(status_code=404, detail=f"Schedule '{schedule_id}' not found")
    require_tenant(principal, sched.tenant_id)
    return scheduler_engine.get_execution_history(schedule_id=schedule_id)


# 3. Boss Fight Global Session Query
@router.get("/campaigns/boss-fight/{session_id}", response_model=BossFightSession)
async def get_boss_fight_session(session_id: str, principal: Principal = Depends(current_principal)):
    """Get state of a boss fight session."""
    session = catalog_service.get_boss_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Boss fight session '{session_id}' not found")
    require_tenant(principal, session.tenant_id)
    return session


# 4. Individual Campaign Endpoints
@router.get("/campaigns/{campaign_id}", response_model=CampaignDefinition)
async def get_campaign(campaign_id: str):
    """
    Retrieve single campaign by ID.
    Performs content-addressed hash verification against Module 1 playbooks,
    flagging hash_mismatch and needs_review if upstream hashes changed.
    """
    camp = catalog_service.get_campaign(campaign_id, check_hashes=True)
    if not camp:
        raise HTTPException(status_code=404, detail=f"Campaign '{campaign_id}' not found")
    return camp


@router.post("/campaigns/{campaign_id}/verify-hashes", response_model=CampaignDefinition)
async def verify_hashes_endpoint(campaign_id: str):
    """Explicitly re-check campaign hashes against Module 1 registry."""
    camp = catalog_service.get_campaign(campaign_id, check_hashes=True)
    if not camp:
        raise HTTPException(status_code=404, detail=f"Campaign '{campaign_id}' not found")
    return camp


@router.post("/campaigns/{campaign_id}/boss-fight/start", response_model=BossFightSession)
async def start_boss_fight(campaign_id: str, req: StartBossFightRequest, principal: Principal = Depends(current_principal)):
    """Start an interactive multi-stage boss fight session."""
    require_tenant(principal, req.tenant_id)
    camp = catalog_service.get_campaign(campaign_id, check_hashes=False)
    if not camp:
        raise HTTPException(status_code=404, detail=f"Campaign '{campaign_id}' not found")

    if camp.tier.lower() != "boss_fight":
        raise HTTPException(
            status_code=400,
            detail=f"Campaign '{campaign_id}' is not a boss_fight tier (tier is '{camp.tier}')",
        )

    if not camp.stages:
        raise HTTPException(
            status_code=400,
            detail="Boss fight campaign has no defined stages",
        )

    session_id = f"boss-{uuid.uuid4().hex[:10]}"
    session = BossFightSession(
        session_id=session_id,
        campaign_id=campaign_id,
        tenant_id=req.tenant_id,
        total_stages=len(camp.stages),
    )
    catalog_service.boss_sessions[session_id] = session
    catalog_service.save_boss_session(session)
    return session


@router.post("/campaigns/{campaign_id}/boss-fight/{session_id}/stage", response_model=BossFightSession)
async def submit_boss_fight_stage(
    campaign_id: str,
    session_id: str,
    req: SubmitStageResultRequest,
    principal: Principal = Depends(current_principal),
):
    """
    Submit outcome for a boss fight stage.
    Enforces sequential progression, prerequisite completion, and composite scoring.
    """
    session = catalog_service.get_boss_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Boss fight session '{session_id}' not found")
    require_tenant(principal, session.tenant_id)

    if session.campaign_id != campaign_id:
        raise HTTPException(status_code=400, detail="Session does not match campaign ID")

    camp = catalog_service.get_campaign(campaign_id, check_hashes=False)
    if not camp:
        raise HTTPException(status_code=404, detail=f"Campaign '{campaign_id}' not found")

    target_stage = next((s for s in camp.stages if s.stage_id == req.stage_id), None)
    if not target_stage:
        raise HTTPException(status_code=404, detail=f"Stage '{req.stage_id}' not found in campaign")

    try:
        session.submit_stage(
            stage=target_stage,
            verdict=req.verdict,
            score=req.score,
            evidence_ref=req.evidence_ref,
        )
        catalog_service.save_boss_session(session)
        return session
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


app = FastAPI(title="CyBreach Campaign Catalog API", version="2.0.0", dependencies=[Depends(current_principal)])
app.include_router(router)


@app.on_event("startup")
async def start_scheduler() -> None:
    scheduler_engine.start()


@app.on_event("shutdown")
async def stop_scheduler() -> None:
    scheduler_engine.shutdown(wait=False)


@app.get("/", include_in_schema=False)
async def root():
    """Redirect root path to interactive Swagger documentation."""
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/docs")

