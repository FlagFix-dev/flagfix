"""
The core entities of the product: a Problem (one submitted report), its
embedding (for similarity search), the Cluster it may belong to (the
"these are actually the same underlying problem" grouping), and the
supporting tables for relationships, attachments, status history and
assignment.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, false
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector

from app.db import Base
from app.models.base import TimestampMixin, UUIDPKMixin
from app.models.enums import ClusterStatus, ProblemStatus, RelationshipType

# Must match the embedding model's output dimensionality.
# voyage-3.5-lite outputs 1024-dim vectors; change this + re-embed everything
# if the embedding model is ever swapped (see services/embeddings.py).
EMBEDDING_DIM = 1024


class Problem(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "problems"

    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    reporter_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    title: Mapped[str] = mapped_column(String(200), nullable=False)  # AI-generated short summary
    description: Mapped[str] = mapped_column(Text, nullable=False)  # raw reporter text
    landmark: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)  # e.g. "opposite Room 203"

    category_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("problem_categories.id"), nullable=True, index=True
    )
    location_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("locations.id"), nullable=False, index=True)

    severity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # 0-100, from AI extraction
    urgency: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # 0-100
    safety_flag: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=false())

    status: Mapped[ProblemStatus] = mapped_column(nullable=False, default=ProblemStatus.reported, index=True)

    priority_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0, index=True)
    # Explainability payload shown to the admin/reporter as plain language,
    # e.g. {"safety_risk": true, "similar_reports_48h": 3, "affected_users": 18}
    priority_reasons: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    cluster_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("problem_clusters.id"), nullable=True, index=True
    )
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("departments.id"), nullable=True)
    assigned_to_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)

    sla_due_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    sla_breached: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=false())

    # Snapshot of the category's typical_resolution_hours at the moment this
    # report was filed (see services/ai_extraction.py + api/problems.py) —
    # stored on the problem itself, not just looked up via category, so it
    # stays stable even if an admin later edits the category's estimate.
    estimated_resolution_hours: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # A short, free-text "what's happening right now" note staff can post
    # without necessarily changing the formal status — e.g. "Technician
    # called, arriving in 30 minutes" while status stays `in_progress`.
    # Reporters and admins both see this on the problem detail page as a
    # live-ish progress indicator (see POST /{id}/progress).
    latest_update: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    latest_update_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    embedding: Mapped[Optional["ProblemEmbedding"]] = relationship(
        back_populates="problem", uselist=False, cascade="all, delete-orphan"
    )
    attachments: Mapped[list["Attachment"]] = relationship(back_populates="problem", cascade="all, delete-orphan")
    status_history: Mapped[list["StatusHistory"]] = relationship(back_populates="problem", cascade="all, delete-orphan")


class ProblemEmbedding(Base, UUIDPKMixin):
    """
    One vector per problem, generated from `title + description`. This is
    what makes "before Room 303 there's a broken tile" and "beside Room 303
    a tile is broken" match each other — they're compared as meaning, not
    as exact words. See services/embeddings.py and services/similarity.py.
    """
    __tablename__ = "problem_embeddings"

    problem_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("problems.id"), nullable=False, unique=True, index=True
    )
    embedding: Mapped[list[float]] = mapped_column(Vector(EMBEDDING_DIM), nullable=False)
    model_version: Mapped[str] = mapped_column(String(80), nullable=False)

    problem: Mapped["Problem"] = relationship(back_populates="embedding")


class ProblemCluster(Base, UUIDPKMixin, TimestampMixin):
    """
    A group of Problems that the similarity engine believes describe the
    same underlying issue. This table is the literal implementation of
    "10 complaints can actually be 1 problem."
    """
    __tablename__ = "problem_clusters"

    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    canonical_title: Mapped[str] = mapped_column(String(200), nullable=False)
    category_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("problem_categories.id"), nullable=True)
    location_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("locations.id"), nullable=True)

    status: Mapped[ClusterStatus] = mapped_column(nullable=False, default=ClusterStatus.open, index=True)
    report_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    affected_users_estimate: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    recurrence_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    first_reported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_reported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class ProblemRelationship(Base, UUIDPKMixin):
    """Pairwise link recorded whenever the similarity engine matches two
    reports, kept even after clustering so the "why were these merged?"
    reasoning is always auditable, not just the end result."""
    __tablename__ = "problem_relationships"

    problem_a_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("problems.id"), nullable=False, index=True)
    problem_b_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("problems.id"), nullable=False, index=True)
    similarity_score: Mapped[float] = mapped_column(Float, nullable=False)
    relationship_type: Mapped[RelationshipType] = mapped_column(nullable=False)


class Attachment(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "attachments"

    problem_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("problems.id"), nullable=False, index=True)
    url: Mapped[str] = mapped_column(String(1000), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)

    problem: Mapped["Problem"] = relationship(back_populates="attachments")


class StatusHistory(Base, UUIDPKMixin):
    __tablename__ = "status_history"

    problem_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("problems.id"), nullable=False, index=True)
    from_status: Mapped[Optional[ProblemStatus]] = mapped_column(nullable=True)
    to_status: Mapped[ProblemStatus] = mapped_column(nullable=False)
    changed_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    problem: Mapped["Problem"] = relationship(back_populates="status_history")


class Assignment(Base, UUIDPKMixin):
    __tablename__ = "assignments"

    problem_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("problems.id"), nullable=False, index=True)
    assigned_to_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    assigned_by_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
