import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.base import TimestampMixin, UUIDPKMixin
from app.models.enums import NotificationType, PriorityBucket


class SLARule(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "sla_rules"

    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    priority_bucket: Mapped[PriorityBucket] = mapped_column(nullable=False)
    target_hours: Mapped[int] = mapped_column(Integer, nullable=False)


class Feedback(Base, UUIDPKMixin):
    __tablename__ = "feedback"

    problem_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("problems.id"), nullable=False, index=True)
    resolved_confirmed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 1-5, optional
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class Notification(Base, UUIDPKMixin):
    __tablename__ = "notifications"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    type: Mapped[NotificationType] = mapped_column(nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class AuditLog(Base, UUIDPKMixin):
    """
    Every admin override (priority change, department reassignment, manual
    status change) is written here with before/after values. This is a
    trust + accountability feature, not just a debugging aid — see
    Section 11 of the implementation plan.
    """
    __tablename__ = "audit_logs"

    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    actor_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(120), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(80), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    before: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    after: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
