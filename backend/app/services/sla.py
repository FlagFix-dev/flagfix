"""Step 8: compute a report's SLA due time from the org's configured rules
for its priority bucket, falling back to sensible defaults if the org
hasn't configured its own SLA rules yet."""
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import PriorityBucket
from app.models.ops import SLARule

_DEFAULT_TARGET_HOURS: dict[PriorityBucket, int] = {
    PriorityBucket.critical: 1,
    PriorityBucket.high: 4,
    PriorityBucket.medium: 24,
    PriorityBucket.low: 72,
}


async def compute_sla_due_at(
    session: AsyncSession, *, org_id: uuid.UUID, bucket: PriorityBucket
) -> datetime:
    # `.first()` rather than one-or-none on purpose: nothing in the schema
    # stops an org from ending up with two rules for the same bucket, and
    # this runs on every single report submission — a raised
    # MultipleResultsFound here would break intake for the whole
    # institution. Extra rules are ignored, the earliest one wins.
    stmt = (
        select(SLARule)
        .where(SLARule.org_id == org_id, SLARule.priority_bucket == bucket)
        .order_by(SLARule.created_at)
        .limit(1)
    )
    rule = (await session.execute(stmt)).scalars().first()
    target_hours = rule.target_hours if rule is not None else _DEFAULT_TARGET_HOURS[bucket]
    return datetime.now(timezone.utc) + timedelta(hours=target_hours)
