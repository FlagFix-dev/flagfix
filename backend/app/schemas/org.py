import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import LocationType, OrgType, UserRole


class BlockInput(BaseModel):
    """One block/building/wing, named by the owner during onboarding.

    `floors` is asked only of the institution types where it is genuinely
    useful (hostels and PGs, where "2nd floor" is how residents describe
    where they are). When given, the block is created with that many Floor
    locations underneath it, so a reporter can pick a floor on day one
    rather than an admin having to add them later.
    """
    name: str = Field(min_length=1, max_length=150)
    floors: int | None = Field(default=None, ge=0, le=100)


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
    # Optional at the API level even though the form asks for it: an
    # institution abroad, or one in an area without a postal code, must
    # still be able to sign up.
    pincode: str | None = Field(default=None, max_length=12)
    # Descriptive only (see Organization.num_blocks) — how many blocks,
    # buildings, or hostel wings the institution has. When `blocks` below
    # is supplied this is derived from it rather than trusted from the
    # client, so the count can never disagree with the named list.
    num_blocks: int | None = Field(default=None, ge=0, le=500)
    # The named blocks themselves, created as Location rows. Empty is
    # fine — the onboarding wizard lets the owner skip this step and name
    # their blocks later on the Locations screen.
    #
    # Capped at 200 because this arrives unauthenticated: without a bound,
    # one request could ask the server to insert an unlimited number of
    # rows before any account exists to hold accountable.
    blocks: list[BlockInput] = Field(default_factory=list, max_length=200)
    owner_name: str = Field(min_length=1, max_length=150)
    owner_email: EmailStr
    # Capped at 72 to match SignupRequest: bcrypt ignores everything past
    # 72 bytes, so a longer value only creates a false sense of security.
    owner_password: str = Field(min_length=8, max_length=72)


class OrgCreateResponse(BaseModel):
    """Everything the "your workspace is ready" screen needs, returned by
    the same call that creates the institution.

    The tokens log the owner straight in; the rest is what they must be
    able to copy before leaving that screen. The staff code is included
    here — and only here among the unauthenticated endpoints — because
    this response is only ever produced for the person who just created
    the organisation.
    """
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

    org_id: uuid.UUID
    org_name: str
    org_slug: str
    org_type: OrgType
    staff_code: str | None
    blocks_created: int


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
    pincode: str | None
    num_blocks: int | None
    staff_code: str | None

    class Config:
        from_attributes = True


class MemberResponse(BaseModel):
    """One person in the institution, for the admin People view."""
    id: uuid.UUID
    name: str
    email: str | None
    role: UserRole
    is_active: bool
    last_seen_at: datetime | None
    # Derived server-side from last_seen_at so every client agrees on what
    # "online" means, rather than each one picking its own cutoff.
    is_online: bool
    joined_at: datetime


class MemberListResponse(BaseModel):
    total_students: int
    total_staff: int
    students_online: int
    staff_online: int
    members: list[MemberResponse]


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
