import uuid
from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.models.enums import ClusterStatus, ProblemStatus


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
    # Either pick one of the org's configured locations...
    location_id: uuid.UUID | None = None
    # ...or, when none of them fit, describe the exact spot yourself. The
    # validator below guarantees exactly one of these two arrives — the
    # server never has to guess where a problem is.
    custom_location: str | None = Field(default=None, max_length=300)
    landmark: str | None = Field(default=None, max_length=300)
    attachments: list[AttachmentInput] = Field(default_factory=list, max_length=5)

    @model_validator(mode="after")
    def _require_exactly_one_location(self) -> "ProblemCreateRequest":
        custom = (self.custom_location or "").strip()
        if self.location_id is None and not custom:
            raise ValueError(
                "Tell us where this is: either pick a location, or describe the exact spot."
            )
        if self.location_id is not None and custom:
            raise ValueError(
                "Give a picked location or a written one, not both."
            )
        # A one-word custom location ("there", "block") is worse than useless
        # for the staff member who has to go and find it. 12 characters is
        # roughly "2nd floor gym" — short, but it names a place.
        if custom and len(custom) < 12:
            raise ValueError(
                "Please describe the exact spot in more detail — include the building, "
                "floor, or a nearby landmark so staff can find it."
            )
        self.custom_location = custom or None
        return self


class ProblemResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    landmark: str | None
    location_id: uuid.UUID | None
    custom_location: str | None
    category_id: uuid.UUID | None
    department_id: uuid.UUID | None
    assigned_to_user_id: uuid.UUID | None
    status: ProblemStatus
    severity: int
    urgency: int
    safety_flag: bool
    ai_reasoning: str | None
    ai_low_confidence: bool
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


class ClusterMemberResponse(BaseModel):
    """One individual report inside a cluster — deliberately trimmed down to
    what the "these are all the same problem" view needs to show."""
    id: uuid.UUID
    title: str
    description: str
    created_at: datetime
    status: ProblemStatus
    location_id: uuid.UUID | None
    custom_location: str | None

    class Config:
        from_attributes = True


class ClusterResponse(BaseModel):
    """The owner-facing answer to "how many of these are actually the same
    thing?" — N separate reports collapsed into one underlying problem,
    with the evidence (the member reports) attached so the grouping can be
    checked rather than trusted blindly."""
    id: uuid.UUID
    canonical_title: str
    status: ClusterStatus
    report_count: int
    affected_users_estimate: int
    recurrence_count: int
    first_reported_at: datetime
    last_reported_at: datetime
    category_id: uuid.UUID | None
    location_id: uuid.UUID | None
    # Highest priority score among the reports in this cluster — a cluster
    # is only as urgent as its most urgent member.
    top_priority_score: int
    members: list[ClusterMemberResponse]

    class Config:
        from_attributes = True


class AiStatusResponse(BaseModel):
    """Lets the UI say plainly whether the AI pipeline is actually running
    or whether reports are going through the rule-based fallback — so
    nobody mistakes fallback output for real AI analysis.

    Reports the provider as well as the model, because FlagFix can run
    either half on more than one vendor and "which one am I actually
    paying?" is the first question when a bill or a quality change shows
    up. Never exposes the keys themselves.
    """
    extraction_enabled: bool
    similarity_enabled: bool
    extraction_provider: str | None  # "gemini" | "anthropic" | None
    embedding_provider: str | None  # "gemini" | "voyage" | None
    extraction_model: str | None
    embedding_model: str | None


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
