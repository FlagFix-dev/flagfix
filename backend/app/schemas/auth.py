import uuid

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import UserRole


class SignupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    org_slug: str
    role: UserRole = UserRole.reporter


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
    role: UserRole
    org_id: uuid.UUID

    class Config:
        from_attributes = True
