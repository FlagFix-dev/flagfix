"""
Shared pytest fixtures. `dispose_engine_pool` is autouse: pytest-asyncio
gives each test function its own fresh event loop, but SQLAlchemy's async
engine (created once, at module import time in app/db.py) pools raw
asyncpg connections that are permanently tied to whichever loop they were
first opened on. Without disposing the pool between tests, test #2 (on a
new loop) would try to reuse test #1's connections and asyncpg would
correctly refuse with "attached to a different loop." Disposing before
and after each test keeps every test's connections scoped to its own loop.
"""
import pytest_asyncio

from app.db import engine


@pytest_asyncio.fixture(autouse=True)
async def dispose_engine_pool():
    await engine.dispose()
    yield
    await engine.dispose()
