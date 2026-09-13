import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import UserRole


class SignupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    email: EmailStr
    # Capped at 72, not 128: bcrypt silently ignores everything past 72
    # bytes, so allowing longer gives people a false sense of security —
    # a 100-character passphrase would be no stronger than its first 72.
    password: str = Field(min_length=8, max_length=72)
    org_slug: str
    role: UserRole = UserRole.reporter
    # Required only when role == resolver (staff) — the owner's institute
    # staff code, checked in api/auth.py's signup(). Students never see or
    # need this field; the server ignores it entirely for role == reporter.
    staff_code: str | None = Field(default=None, max_length=32)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    org_slug: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserProfile(BaseModel):
    id: uuid.UUID
    name: str
    email: str | None
    phone: str | None
    role: UserRole
    org_id: uuid.UUID
    org_name: str
    org_slug: str
    created_at: datetime

    class Config:
        from_attributes = True


class ProfileUpdateRequest(BaseModel):
    """What a person may change about themselves.

    Deliberately excludes email: it is the login identity and is unique
    across the whole system, so letting it be changed without a
    verification step would let someone claim an address they don't own
    (and lock the real owner out of signing up). Changing it belongs
    behind email verification, which is a separate piece of work.
    Role is likewise absent — nobody promotes themselves.
    """
    name: str = Field(min_length=1, max_length=150)
    phone: str | None = Field(default=None, max_length=20)
