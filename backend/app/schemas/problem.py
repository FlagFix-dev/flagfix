import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import ProblemStatus


class AttachmentInput(BaseModel):
    """A file the client already uploaded via POST /api/problems/attachments
    (see that endpoint + services/storage.py) — the report-creation call
    below just links the resulting URLs to the new problem."""
    url: str = Field(max_length=1000)
    content_type: str = Field(max_length=100)


class AttachmentResponse(BaseModel):
    id: uuid.UUID
    url: str
    content_type: str

    class Config:
        from_attributes = True


class ProblemCreateRequest(BaseModel):
    description: str = Field(min_length=5, max_length=3000)
    location_id: uuid.UUID
    landmark: str | None = Field(default=None, max_length=300)
    attachments: list[AttachmentInput] = Field(default_factory=list, max_length=5)


class ProblemResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    landmark: str | None
    location_id: uuid.UUID
    category_id: uuid.UUID | None
    department_id: uuid.UUID | None
    assigned_to_user_id: uuid.UUID | None
    status: ProblemStatus
    severity: int
    urgency: int
    safety_flag: bool
    priority_score: int
    priority_reasons: dict
    cluster_id: uuid.UUID | None
    estimated_resolution_hours: int | None
    latest_update: str | None
    latest_update_at: datetime | None
    attachments: list[AttachmentResponse]
    sla_due_at: datetime | None
    sla_breached: bool
    created_at: datetime
    resolved_at: datetime | None

    class Config:
        from_attributes = True


class StatusChangeRequest(BaseModel):
    to_status: ProblemStatus
    note: str | None = Field(default=None, max_length=1000)


class ProgressUpdateRequest(BaseModel):
    """A quick, informal "here's what's happening right now" note staff can
    post without changing the formal status — e.g. "Technician on the way,
    ETA 30 minutes" while the problem stays `in_progress`. See Problem.
    latest_update / api/problems.py's POST /{id}/progress."""
    message: str = Field(min_length=1, max_length=300)


class FeedbackRequest(BaseModel):
    resolved_confirmed: bool
    rating: int | None = Field(default=None, ge=1, le=5)
    comment: str | None = Field(default=None, max_length=1000)
