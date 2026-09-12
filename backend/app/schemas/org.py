import uuid

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import LocationType, OrgType


class OrgCreateRequest(BaseModel):
    """The very first step of onboarding: an institution creates its
    FlagFix workspace and its own account in one step, becoming the org's
    `owner`. Every later user joins this org via /auth/signup."""
    org_name: str = Field(min_length=2, max_length=200)
    org_slug: str = Field(min_length=3, max_length=80, pattern=r"^[a-z0-9-]+$")
    org_type: OrgType
    address: str = Field(min_length=3, max_length=300)
    city: str = Field(min_length=1, max_length=100)
    state: str = Field(min_length=1, max_length=100)
    # Descriptive only (see Organization.num_blocks) — how many blocks,
    # buildings, or hostel wings the institution has, before they name each
    # one individually on the Locations screen after signup.
    num_blocks: int | None = Field(default=None, ge=0, le=500)
    owner_name: str = Field(min_length=1, max_length=150)
    owner_email: EmailStr
    owner_password: str = Field(min_length=8, max_length=128)


class LocationCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    type: LocationType
    parent_location_id: uuid.UUID | None = None


class LocationResponse(BaseModel):
    id: uuid.UUID
    name: str
    type: LocationType
    parent_location_id: uuid.UUID | None
    path: str

    class Config:
        from_attributes = True


class DepartmentCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class DepartmentResponse(BaseModel):
    id: uuid.UUID
    name: str

    class Config:
        from_attributes = True


class CategoryCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    default_department_id: uuid.UUID | None = None


class CategoryResponse(BaseModel):
    id: uuid.UUID
    name: str
    default_department_id: uuid.UUID | None
    typical_resolution_hours: int | None

    class Config:
        from_attributes = True


class OrgProfileResponse(BaseModel):
    """Returned by GET /api/orgs/me — an admin/owner-only view of the org's
    own settings, including the staff invite code (never exposed to
    reporters/resolvers, and never returned from the public signup/login
    endpoints)."""
    id: uuid.UUID
    name: str
    slug: str
    type: OrgType
    address: str | None
    city: str | None
    state: str | None
    num_blocks: int | None
    staff_code: str | None

    class Config:
        from_attributes = True


class OrgStatsResponse(BaseModel):
    """Powers the admin/owner operations dashboard — see api/orgs.py's
    GET /stats. `staff_online` is a best-effort "seen recently" heuristic
    (last_seen_at touched at login/refresh and staff queue loads), not true
    real-time presence."""
    total_staff: int
    staff_online: int
    total_reports: int
    pending: int  # reported/verified — nobody has accepted it yet
    accepted: int  # assigned/in_progress/reopened — someone is actively on it
    resolved: int
    closed: int
