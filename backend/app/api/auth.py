import secrets
import uuid
from datetime import datetime, timezone

import anyio.to_thread
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.deps import CurrentUser, get_current_user
from app.models.enums import UserRole
from app.models.tenancy import Organization, User, UserOrgRole
from app.schemas.auth import (
    LoginRequest,
    ProfileUpdateRequest,
    RefreshRequest,
    SignupRequest,
    TokenResponse,
    UserProfile,
)
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
        # compare_digest rather than `!=` so the comparison time doesn't
        # depend on how many leading characters matched.
        if not expected_code or not secrets.compare_digest(submitted_code, expected_code):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "That staff code doesn't match this institution. Check with your admin for the correct code.",
            )

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=await anyio.to_thread.run_sync(hash_password, payload.password),
    )
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
    # bcrypt verification is deliberately slow (~250ms). Left on the event
    # loop it blocks every other request on this worker for that whole
    # time, so a burst of logins would stall the entire API.
    password_ok = (
        user is not None
        and user.password_hash is not None
        and await anyio.to_thread.run_sync(verify_password, payload.password, user.password_hash)
    )
    if not password_ok:
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


@router.get("/me", response_model=UserProfile)
async def get_my_profile(
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UserProfile:
    """The signed-in person's own profile, for the account menu."""
    row = (
        await session.execute(
            select(User, Organization)
            .join(UserOrgRole, UserOrgRole.user_id == User.id)
            .join(Organization, Organization.id == UserOrgRole.org_id)
            .where(User.id == current_user.user_id, UserOrgRole.org_id == current_user.org_id)
        )
    ).first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found.")

    user, org = row
    return UserProfile(
        id=user.id,
        name=user.name,
        email=user.email,
        phone=user.phone,
        # Role comes from the verified token, which get_current_user has
        # already decoded — no need for a second lookup.
        role=current_user.role,
        org_id=org.id,
        org_name=org.name,
        org_slug=org.slug,
        created_at=user.created_at,
    )


@router.patch("/me", response_model=UserProfile)
async def update_my_profile(
    payload: ProfileUpdateRequest,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UserProfile:
    """
    Updates only the fields a person is allowed to change about themselves
    (see ProfileUpdateRequest). Scoped to `current_user.user_id` from the
    verified token, never to an id supplied by the client — so this cannot
    be turned into "edit anyone's profile".
    """
    user = await session.get(User, current_user.user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found.")

    phone = (payload.phone or "").strip() or None
    if phone is not None:
        # `users.phone` is globally unique, so a collision must be a clean
        # 409 rather than an unhandled IntegrityError 500.
        clash = (
            await session.execute(select(User).where(User.phone == phone, User.id != user.id))
        ).scalars().first()
        if clash is not None:
            raise HTTPException(
                status.HTTP_409_CONFLICT, "That phone number is already in use by another account."
            )

    user.name = payload.name.strip()
    user.phone = phone
    await session.commit()

    org = await session.get(Organization, current_user.org_id)
    return UserProfile(
        id=user.id,
        name=user.name,
        email=user.email,
        phone=user.phone,
        role=current_user.role,
        org_id=current_user.org_id,
        org_name=org.name if org else "",
        org_slug=org.slug if org else "",
        created_at=user.created_at,
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

    # `is_active` must be re-checked here, not only at login: a refresh
    # token lives for 30 days and each refresh mints a fresh one, so
    # without this check, deactivating an account never actually cuts off
    # access — the user simply refreshes forever.
    user = await session.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been deactivated.")

    _touch_last_seen(user)
    await session.commit()

    return TokenResponse(
        access_token=create_access_token(user_id=user_id, org_id=org_id, role=role_row.role.value),
        refresh_token=create_refresh_token(user_id=user_id, org_id=org_id),
    )
