"""
Database engine/session setup.

Multi-tenancy note: every tenant-scoped table has Postgres Row-Level
Security (RLS) enabled (see alembic/versions/0001_initial.py). RLS reads a
per-connection setting, `app.current_org_id`, and refuses to return rows
belonging to any other organization — enforced by the database itself, not
just by application code. `set_tenant()` below is how a request tells the
database which organization it's allowed to see, and it MUST be called
before any tenant-scoped query runs. `deps.get_db` (see deps.py) does this
automatically for every authenticated request, so individual endpoints
never have to remember to call it.
"""
from typing import AsyncIterator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    pool_size=10,
    max_overflow=10,
    pool_pre_ping=True,  # avoids using a stale/dropped connection after idle periods
    echo=False,
)

AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)


class Base(DeclarativeBase):
    """Shared declarative base for every ORM model in the app."""
    pass


async def get_session() -> AsyncIterator[AsyncSession]:
    """Plain session, no tenant context — only for un-scoped tables (e.g. during
    login, before we know which org's data the user is even allowed to touch)."""
    async with AsyncSessionLocal() as session:
        yield session


async def set_tenant(session: AsyncSession, org_id: str) -> None:
    """
    Pin every subsequent query on this connection to a single organization.
    Postgres RLS policies check `current_setting('app.current_org_id')`
    against each row's org_id — this is what populates that setting.

    Uses `set_config(..., is_local=true)` rather than a literal `SET LOCAL`
    statement: `SET LOCAL` does not accept a bound parameter (Postgres's
    wire protocol only allows parameters in regular DML, not in `SET`
    statements), whereas `set_config` is an ordinary function call and
    accepts one safely — this is what keeps org_id parameterized instead
    of string-formatted into the SQL. `is_local=true` still scopes it to
    the current transaction only, so it can never leak across requests
    even if connections are pooled/reused.
    """
    await session.execute(
        text("SELECT set_config('app.current_org_id', :org_id, true)"), {"org_id": org_id}
    )
