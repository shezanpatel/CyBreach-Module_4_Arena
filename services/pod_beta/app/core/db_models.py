from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, JSON
from app.core.database import Base


class EngagementSessionModel(Base):
    __tablename__ = "engagement_session"

    engagement_id = Column(String, primary_key=True, index=True)
    tenant_id = Column(String, nullable=False, index=True)
    state = Column(String, nullable=False, index=True)
    engagement_type = Column(String, nullable=False)
    scope = Column(JSON, default=dict)
    original_scope = Column(JSON, default=dict, nullable=False)
    credit_cost = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    archived_at = Column(DateTime, nullable=True)
    report = Column(JSON, nullable=True)
    metadata_json = Column("metadata", JSON, default=dict, nullable=False)


class CampaignDefinitionModel(Base):
    __tablename__ = "campaign_definition"

    campaign_id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    tier = Column(String, nullable=False, index=True)
    playbook_hashes = Column(JSON, nullable=False)
    regions = Column(JSON, nullable=False)
    techniques = Column(JSON, nullable=False)
    credit_cost = Column(Integer, nullable=False)
    content_hash = Column(String, nullable=False, index=True)
    definition = Column(JSON, nullable=True)


class CampaignScheduleStateModel(Base):
    __tablename__ = "campaign_schedule_state"

    schedule_id = Column(String, primary_key=True)
    tenant_id = Column(String, nullable=False, index=True)
    schedule = Column(JSON, nullable=False)
    history = Column(JSON, default=list, nullable=False)


class BossFightSessionModel(Base):
    """Durable tenant-owned state for a multi-stage boss-fight run."""

    __tablename__ = "boss_fight_session"

    session_id = Column(String, primary_key=True)
    tenant_id = Column(String, nullable=False, index=True)
    campaign_id = Column(String, nullable=False, index=True)
    session = Column(JSON, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class ArenaEventOutboxModel(Base):
    __tablename__ = "arena_event_outbox"

    event_id = Column(String, primary_key=True)
    topic = Column(String, nullable=False, index=True)
    payload = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    delivered_at = Column(DateTime, nullable=True)
