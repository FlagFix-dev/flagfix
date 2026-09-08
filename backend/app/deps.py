"""
Shared FastAPI dependencies: DB session with tenant context set, the
current authenticated user, and a role-gate factory. Every problems/admin
route depends on `get_tenant_db` (never the raw session) so RLS is always
in effect — there is no code path that can accidentally query across
organizations.
"""
import uuid
from typing import AsyncIterator

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import AsyncSessionLocal, set_tenant
from app.models.enums import UserRole
from app.models.tenancy import User, UserOrgRole
from app.security import InvalidTokenError, decode_token

_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=True)


class CurrentUser:
    """Lightweight, immutable view of who is making this request and in
    which org's context — this is what every endpoint actually uses."""

    def __init__(self, user_id: uuid.UUID, org_id: uuid.UUID, role: UserRole):
        self.user_id = user_id
        self.org_id = org_id
        self.role = role


async def get_current_user(token: str = Depends(_oauth2_scheme)) -> CurrentUser:
    try:
        payload = decode_token(token, expected_type="access")
    except InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return CurrentUser(
        user_id=uuid.UUID(payload["sub"]),
        org_id=uuid.UUID(payload["org_id"]),
        role=UserRole(payload["role"]),
    )


async def get_tenant_db(
    current_user: CurrentUser = Depends(get_current_user),
) -> AsyncIterator[AsyncSession]:
    """
    The session every tenant-scoped route should depend on. Sets the
    Postgres RLS tenant context for this connection, then yields the
    session for the endpoint to use.

    Deliberately does NOT wrap the endpoint in `session.begin()` — the
    endpoint itself calls `session.commit()` once it's done building up
    the unit of work (SQLAlchemy's session auto-begins a transaction on
    the first statement, which is exactly when `set_tenant`'s `SET LOCAL`
    below runs, so it stays scoped to that same transaction). If the
    endpoint raises before committing, closing the session on exit here
    discards the uncommitted transaction — nothing partial is ever saved.
    """
    async with AsyncSessionLocal() as session:
        await set_tenant(session, str(current_user.org_id))
        yield session


def require_role(*allowed_roles: UserRole):
    """Dependency factory: `Depends(require_role(UserRole.admin, UserRole.owner))`
    on a route rejects anyone whose role isn't in the allowed set, with a
    clear 403 rather than a confusing downstream failure."""

    async def _checker(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This action requires one of: {[r.value for r in allowed_roles]}",
            )
        return current_user

    return _checker
