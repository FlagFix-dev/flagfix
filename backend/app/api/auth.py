import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models.enums import UserRole
from app.models.tenancy import Organization, User, UserOrgRole
from app.schemas.auth import LoginRequest, RefreshRequest, SignupRequest, TokenResponse
from app.security import (
    InvalidTokenError,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


async def _get_org_by_slug(session: AsyncSession, org_slug: str) -> Organization:
    org = (await session.execute(select(Organization).where(Organization.slug == org_slug))).scalar_one_or_none()
    if org is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown organization.")
    return org


def _touch_last_seen(user: User) -> None:
    """Best-effort presence signal — see User.last_seen_at. Deliberately not
    wrapped in its own try/except: it's a plain attribute set on an object
    already being committed in this same transaction, so it can't fail
    independently of the surrounding request."""
    user.last_seen_at = datetime.now(timezone.utc)


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(payload: SignupRequest, session: AsyncSession = Depends(get_session)) -> TokenResponse:
    org = await _get_org_by_slug(session, payload.org_slug)

    existing = (await session.execute(select(User).where(User.email == payload.email))).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with that email already exists.")

    # Self-signup may only claim `reporter` (student) or `resolver` (staff)
    # — both are "join and use the app" roles with no organization-admin
    # power. `admin`/`owner` are never grantable here, even if the client
    # sends one; those are only created via org creation (owner) or granted
    # later by an existing admin/owner (Phase 2 role-management endpoint).
    role = payload.role if payload.role in (UserRole.reporter, UserRole.resolver) else UserRole.reporter

    # Staff self-signup is gated behind the institution's staff code (shown
    # to the owner on their org settings screen) so a student can't simply
    # pick "Staff" and get the full reports queue + AI analysis. Students
    # never need this — any staff_code they happen to send is ignored.
    if role == UserRole.resolver:
        submitted_code = (payload.staff_code or "").strip().upper()
        expected_code = (org.staff_code or "").strip().upper()
        if not expected_code or submitted_code != expected_code:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "That staff code doesn't match this institution. Check with your admin for the correct code.",
            )

    user = User(name=payload.name, email=payload.email, password_hash=hash_password(payload.password))
    session.add(user)
    await session.flush()
    session.add(UserOrgRole(user_id=user.id, org_id=org.id, role=role))
    _touch_last_seen(user)
    await session.commit()

    return TokenResponse(
        access_token=create_access_token(user_id=user.id, org_id=org.id, role=role.value),
        refresh_token=create_refresh_token(user_id=user.id, org_id=org.id),
    )


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, session: AsyncSession = Depends(get_session)) -> TokenResponse:
    org = await _get_org_by_slug(session, payload.org_slug)

    user = (await session.execute(select(User).where(User.email == payload.email))).scalar_one_or_none()
    if user is None or user.password_hash is None or not verify_password(payload.password, user.password_hash):
        # Same error for "no such user" and "wrong password" — never reveal
        # which one it was, that's an account-enumeration leak.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password.")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been deactivated.")

    role_row = (
        await session.execute(
            select(UserOrgRole).where(UserOrgRole.user_id == user.id, UserOrgRole.org_id == org.id)
        )
    ).scalar_one_or_none()
    if role_row is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account is not a member of that organization.")

    _touch_last_seen(user)
    await session.commit()

    return TokenResponse(
        access_token=create_access_token(user_id=user.id, org_id=org.id, role=role_row.role.value),
        refresh_token=create_refresh_token(user_id=user.id, org_id=org.id),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, session: AsyncSession = Depends(get_session)) -> TokenResponse:
    try:
        decoded = decode_token(payload.refresh_token, expected_type="refresh")
    except InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token.")

    user_id = uuid.UUID(decoded["sub"])
    org_id = uuid.UUID(decoded["org_id"])

    role_row = (
        await session.execute(
            select(UserOrgRole).where(UserOrgRole.user_id == user_id, UserOrgRole.org_id == org_id)
        )
    ).scalar_one_or_none()
    if role_row is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account no longer belongs to that organization.")

    user = await session.get(User, user_id)
    if user is not None:
        _touch_last_seen(user)
        await session.commit()

    return TokenResponse(
        access_token=create_access_token(user_id=user_id, org_id=org_id, role=role_row.role.value),
        refresh_token=create_refresh_token(user_id=user_id, org_id=org_id),
    )
