"""Event bus abstraction for inter-service communication.

Module 4: Arena - Pod Beta.
Follows strict zero em dash rule: only hyphens (-) or colons (:).

Topics:
- Published: engagement.lifecycle and campaign.updated
- Consumed: mod2.outcome and mod1.playbook
Every event includes a unique correlation key for end-to-end tracing.
"""

from __future__ import annotations

import uuid
import json
import os
import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional
from pydantic import BaseModel, Field
from app.core.database import Base, SessionLocal, engine
from app.core.db_models import ArenaEventOutboxModel

Base.metadata.create_all(bind=engine)


class BusMessage(BaseModel):
    """Standard event message envelope."""
    topic: str
    event_id: str
    correlation_key: str
    event_type: str
    payload: Dict[str, Any]
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class EventBus:
    """In-memory event bus managing message pub/sub across topics."""

    TOPIC_ENGAGEMENT_LIFECYCLE = "engagement.lifecycle"
    TOPIC_CAMPAIGN_UPDATED = "campaign.updated"
    TOPIC_MOD2_OUTCOME = "mod2.outcome"
    TOPIC_MOD1_PLAYBOOK = "mod1.playbook"
    logger = logging.getLogger(__name__)

    def __init__(self):
        self._published_events: List[BusMessage] = []
        self._producer = None
        self._delivery_task = None
        self._subscribers: Dict[str, List[Callable[[BusMessage], Any]]] = {
            self.TOPIC_ENGAGEMENT_LIFECYCLE: [],
            self.TOPIC_CAMPAIGN_UPDATED: [],
            self.TOPIC_MOD2_OUTCOME: [],
            self.TOPIC_MOD1_PLAYBOOK: [],
        }

    async def start(self) -> None:
        if os.getenv("KAFKA_ENABLE", "false").lower() not in {"1", "true", "yes"}:
            return
        from aiokafka import AIOKafkaProducer
        self._producer = AIOKafkaProducer(
            bootstrap_servers=os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:19092"),
            value_serializer=lambda value: json.dumps(value, default=str).encode("utf-8"),
        )
        await self._producer.start()
        self._delivery_task = asyncio.create_task(self._deliver_pending_forever())

    async def stop(self) -> None:
        if self._delivery_task is not None:
            self._delivery_task.cancel()
            try:
                await self._delivery_task
            except asyncio.CancelledError:
                pass
            self._delivery_task = None
        if self._producer is not None:
            await self._producer.stop()
            self._producer = None

    async def _deliver_pending_forever(self) -> None:
        while self._producer is not None:
            with SessionLocal() as db:
                pending = db.query(ArenaEventOutboxModel).filter(
                    ArenaEventOutboxModel.delivered_at.is_(None)
                ).order_by(ArenaEventOutboxModel.created_at.asc()).limit(100).all()
                batch = [(row.event_id, row.topic, row.payload) for row in pending]
            if batch:
                for event_id, topic, payload in batch:
                    try:
                        await self._producer.send_and_wait(topic, payload)
                    except Exception:
                        self.logger.exception("Kafka delivery failed for outbox event %s", event_id)
                        break
                    with SessionLocal() as db:
                        row = db.get(ArenaEventOutboxModel, event_id)
                        if row is not None and row.delivered_at is None:
                            row.delivered_at = datetime.now(timezone.utc).replace(tzinfo=None)
                            db.commit()
            await asyncio.sleep(2 if batch else 5)

    @staticmethod
    def generate_correlation_key(prefix: str = "mod4") -> str:
        """Generate a traceable correlation key."""
        return f"{prefix}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:8]}"

    async def publish(
        self,
        topic: str,
        event_type: str,
        payload: Dict[str, Any],
        correlation_key: Optional[str] = None,
    ) -> BusMessage:
        """Publish an event to a specified topic.

        Enforces inclusion of a correlation key for tracing.
        """
        corr_key = correlation_key or self.generate_correlation_key()
        event_id = f"evt-{uuid.uuid4().hex[:12]}"

        message = BusMessage(
            topic=topic,
            event_id=event_id,
            correlation_key=corr_key,
            event_type=event_type,
            payload=payload,
        )

        self._published_events.append(message)
        with SessionLocal() as db:
            db.add(ArenaEventOutboxModel(
                event_id=event_id,
                topic=topic,
                payload=message.model_dump(mode="json"),
            ))
            db.commit()

        # Notify any subscribed listeners
        for handler in self._subscribers.get(topic, []):
            try:
                res = handler(message)
                if hasattr(res, "__await__"):
                    await res
            except Exception:
                # Retain decoupling
                pass

        return message

    async def publish_engagement_lifecycle(
        self,
        event_type: str,
        engagement_id: str,
        tenant_id: str,
        state: str,
        engagement_type: str,
        details: Optional[Dict[str, Any]] = None,
        correlation_key: Optional[str] = None,
    ) -> BusMessage:
        """Convenience method to emit an engagement.lifecycle event."""
        payload = {
            "engagement_id": engagement_id,
            "tenant_id": tenant_id,
            "state": state,
            "engagement_type": engagement_type,
            "details": details or {},
        }
        return await self.publish(
            topic=self.TOPIC_ENGAGEMENT_LIFECYCLE,
            event_type=event_type,
            payload=payload,
            correlation_key=correlation_key,
        )

    def subscribe(self, topic: str, handler: Callable[[BusMessage], Any]) -> None:
        """Register a subscriber callback for a topic."""
        if topic not in self._subscribers:
            self._subscribers[topic] = []
        self._subscribers[topic].append(handler)

    def get_published_events(self, topic: Optional[str] = None) -> List[BusMessage]:
        """Retrieve recorded published events, optionally filtered by topic."""
        if topic:
            return [e for e in self._published_events if e.topic == topic]
        return list(self._published_events)

    def clear(self) -> None:
        """Clear published event history."""
        self._published_events.clear()
        with SessionLocal() as db:
            db.query(ArenaEventOutboxModel).delete()
            db.commit()
