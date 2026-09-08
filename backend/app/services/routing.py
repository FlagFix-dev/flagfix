"""
Step 7: decide which department a problem goes to. Deterministic first —
the org's own ProblemCategory.default_department_id mapping — with the
LLM's suggestion used only when no mapping exists yet for that category.
Keeping routing deterministic-by-default is what makes an admin trust the
system: the same category always goes to the same team unless they
configure it otherwise.
"""
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.catalog import ProblemCategory
from app.models.tenancy import Department


async def resolve_department(
    session: AsyncSession, *, org_id: uuid.UUID, category_id: uuid.UUID | None, suggested_department_name: str
) -> uuid.UUID | None:
    if category_id is not None:
        category = await session.get(ProblemCategory, category_id)
        if category is not None and category.default_department_id is not None:
            return category.default_department_id

    # Fallback: try to match the LLM's free-text suggestion against this
    # org's actual department names (case-insensitive). If nothing matches,
    # leave department_id unset — an admin assigns it manually. We never
    # invent a department that doesn't exist in this org's configuration.
    stmt = select(Department).where(Department.org_id == org_id)
    departments = (await session.execute(stmt)).scalars().all()
    for dept in departments:
        if dept.name.strip().lower() == suggested_department_name.strip().lower():
            return dept.id
    return None
