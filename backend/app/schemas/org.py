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

    class Config:
        from_attributes = True
