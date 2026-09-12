"""
Steps 4-5 of the AI pipeline: given a new report's embedding, find whether
it's actually the same underlying problem as something already reported,
and if so, attach it to that cluster instead of letting it sit as a
separate, isolated ticket.

Why this isn't filtered strictly by location:
Two reporters describing the exact same broken tile will often pick
slightly different location nodes — one says "corridor near Room 303",
another says "beside Room 303" as a landmark on the Room 303 node itself.
If we required an exact location_id match before even comparing text, we'd
miss real duplicates like that. So the match is driven by MEANING
(the embedding) first, org-wide; location is used only as a supporting
signal shown to the admin ("3 reports, all within Block A / Floor 3"),
never as a hard pre-filter that could hide a real duplicate.

Thresholds (tune these based on real pilot data, not guesswork forever):
  >= AUTO_MATCH_THRESHOLD   -> confidently the same problem: auto-attach to
                                cluster (or create one with the earlier report)
  >= REVIEW_THRESHOLD       -> plausibly related: recorded as a `related`
                                relationship for an admin to see, NOT auto-merged
  below REVIEW_THRESHOLD    -> treated as an unrelated, standalone report
"""
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.problem import Problem, ProblemCluster, ProblemEmbedding, ProblemRelationship
from app.models.enums import ClusterStatus, ProblemStatus, RelationshipType

AUTO_MATCH_THRESHOLD = 0.82
REVIEW_THRESHOLD = 0.70
LOOKBACK_DAYS = 90  # ignore matches against very old reports; a 2-year-old
                     # fixed issue shouldn't silently reopen for an unrelated new one


class SimilarityMatch:
    def __init__(self, problem: Problem, similarity: float):
        self.problem = problem
        self.similarity = similarity


async def find_similar(
    session: AsyncSession, *, org_id: uuid.UUID, new_embedding: list[float], limit: int = 5
) -> list[SimilarityMatch]:
    """Top-N most similar existing reports in this org, most similar first.
    Cosine distance (0 = identical direction, 2 = opposite) is converted to
    a 0-1 similarity score (1 = identical) for readability everywhere else."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)

    distance_col = ProblemEmbedding.embedding.cosine_distance(new_embedding)
    stmt = (
        select(Problem, distance_col.label("distance"))
        .join(ProblemEmbedding, ProblemEmbedding.problem_id == Problem.id)
        .where(Problem.org_id == org_id, Problem.created_at >= cutoff)
        .order_by(distance_col)
        .limit(limit)
    )
    rows = (await session.execute(stmt)).all()
    return [SimilarityMatch(problem=row[0], similarity=1 - row[1]) for row in rows]


async def attach_to_cluster_or_create(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    problem: Problem,
    matches: list[SimilarityMatch],
) -> ProblemCluster | None:
    """
    Applies the clustering + recurrence rules described above. Returns the
    cluster the problem now belongs to, or None if it's standalone.
    Also records every match as a ProblemRelationship for auditability,
    regardless of whether it crossed the auto-merge threshold.
    """
    best = matches[0] if matches else None

    for match in matches:
        if match.similarity >= REVIEW_THRESHOLD:
            rel_type = (
                RelationshipType.duplicate
                if match.similarity >= AUTO_MATCH_THRESHOLD
                else RelationshipType.related
            )
            session.add(
                ProblemRelationship(
                    problem_a_id=problem.id,
                    problem_b_id=match.problem.id,
                    similarity_score=match.similarity,
                    relationship_type=rel_type,
                )
            )

    if best is None or best.similarity < AUTO_MATCH_THRESHOLD:
        return None  # no confident match: this report stands alone for now

    now = datetime.now(timezone.utc)

    cluster: ProblemCluster | None = None
    if best.problem.cluster_id is not None:
        cluster = await session.get(ProblemCluster, best.problem.cluster_id)

    # `cluster is None` covers both "the match had no cluster" and the
    # should-never-happen case of a cluster_id pointing at a row that no
    # longer exists — without this second guard that dangling id would
    # crash report submission with an AttributeError further down.
    if cluster is None:
        # The best match is itself a lone report with no cluster yet — this
        # new report is the *second* report of the same issue, so a cluster
        # is born right here.
        cluster = ProblemCluster(
            org_id=org_id,
            canonical_title=best.problem.title,
            category_id=best.problem.category_id,
            location_id=best.problem.location_id,
            status=ClusterStatus.open,
            report_count=1,
            affected_users_estimate=1,
            recurrence_count=0,
            first_reported_at=best.problem.created_at,
            last_reported_at=best.problem.created_at,
        )
        session.add(cluster)
        await session.flush()  # assign cluster.id before we reference it below
        best.problem.cluster_id = cluster.id

    # Recurrence: the matched cluster was already marked resolved and a new,
    # confidently-similar report just arrived — this is the same problem
    # coming back, not a coincidence.
    if cluster.status == ClusterStatus.resolved:
        cluster.status = ClusterStatus.open
        cluster.recurrence_count += 1

    cluster.report_count += 1
    cluster.affected_users_estimate += 1
    cluster.last_reported_at = now
    problem.cluster_id = cluster.id

    return cluster


async def resync_cluster_member_priorities(
    session: AsyncSession, *, cluster: ProblemCluster
) -> None:
    """
    Re-scores every open report in a cluster against the cluster's CURRENT
    counters.

    Priority is otherwise computed once, at insert, from whatever the
    cluster looked like at that instant — so the first person to report a
    problem that 20 people later report keeps a "1 person affected" score
    forever, and sinks to the bottom of a queue sorted by priority. That is
    precisely backwards: the oldest report of a widespread problem has been
    waiting the longest.

    Resolved and closed reports are deliberately left alone — re-prioritising
    finished work would churn history for no benefit.
    """
    # Imported here rather than at module scope: priority imports nothing
    # from this module, but keeping the dependency local documents that
    # similarity owns the clustering, not the scoring rules.
    from app.services import priority as priority_service

    # The session runs with autoflush=False (see db.py), and the caller has
    # usually just assigned cluster_id to the new report and its match
    # in memory. Without an explicit flush this SELECT reads the pre-change
    # database state, finds none of them, and silently re-scores nothing.
    await session.flush()

    members = (
        await session.execute(
            select(Problem).where(
                Problem.cluster_id == cluster.id,
                Problem.status.not_in([ProblemStatus.resolved, ProblemStatus.closed]),
            )
        )
    ).scalars().all()

    for member in members:
        score, _bucket, reasons = priority_service.compute_priority(
            severity=member.severity,
            urgency=member.urgency,
            safety_flag=member.safety_flag,
            affected_users_estimate=cluster.affected_users_estimate,
            recurrence_count=cluster.recurrence_count,
        )
        member.priority_score = score
        member.priority_reasons = reasons


async def sync_cluster_status(session: AsyncSession, *, cluster_id: uuid.UUID | None) -> None:
    """
    Marks a cluster resolved once every report in it is resolved or closed.

    Without this, ClusterStatus.resolved is never set by any code path,
    which quietly disables the entire recurrence feature: the "this problem
    came back" branch in attach_to_cluster_or_create only fires against a
    RESOLVED cluster, so recurrence_count stays 0 forever and the
    "times it came back" figure shown to owners is permanently meaningless.
    """
    if cluster_id is None:
        return

    cluster = await session.get(ProblemCluster, cluster_id)
    if cluster is None:
        return

    # Same autoflush=False concern as resync_cluster_member_priorities: the
    # status change that prompted this call is typically still pending in
    # the session, and the count below must see it.
    await session.flush()

    open_members = (
        await session.execute(
            select(func.count())
            .select_from(Problem)
            .where(
                Problem.cluster_id == cluster_id,
                Problem.status.not_in([ProblemStatus.resolved, ProblemStatus.closed]),
            )
        )
    ).scalar_one()

    cluster.status = ClusterStatus.resolved if open_members == 0 else ClusterStatus.open
