import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import ProblemStatus


class ProblemCreateRequest(BaseModel):
    description: str = Field(min_length=5, max_length=3000)
    location_id: uuid.UUID
    landmark: str | None = Field(default=None, max_length=300)
    # Attachment upload is a separate endpoint (multipart) in Phase 1 polish;
    # for the MVP slice, attachment_urls lets the client hand us URLs it has
    # already uploaded directly to object storage via a pre-signed URL.
    attachment_urls: list[str] = Field(default_factory=list)


class ProblemResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    landmark: str | None
    location_id: uuid.UUID
    category_id: uuid.UUID | None
    department_id: uuid.UUID | None
    status: ProblemStatus
    severity: int
    urgency: int
    safety_flag: bool
    priority_score: int
    priority_reasons: dict
    cluster_id: uuid.UUID | None
    sla_due_at: datetime | None
    sla_breached: bool
    created_at: datetime
    resolved_at: datetime | None

    class Config:
        from_attributes = True


class StatusChangeRequest(BaseModel):
    to_status: ProblemStatus
    note: str | None = Field(default=None, max_length=1000)


class FeedbackRequest(BaseModel):
    resolved_confirmed: bool
    rating: int | None = Field(default=None, ge=1, le=5)
    comment: str | None = Field(default=None, max_length=1000)
