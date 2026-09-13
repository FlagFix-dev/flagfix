"""
Integration test for the exact scenario the product exists to solve:
"before Room 303 there's a broken tile" and "beside Room 303 a tile is
broken" are different words for the same problem, and the clustering
engine (services/similarity.py) must merge them into one cluster instead
of leaving two disconnected tickets.

This runs against a REAL Postgres + pgvector database (not a mock) —
set DATABASE_URL to a real local database before running, e.g.:

    DATABASE_URL=postgresql+asyncpg://flagfix:flagfix@localhost:5432/flagfix \
        pytest tests/test_similarity_clustering.py -v

We don't call the real Voyage API here (that needs a live API key and
network access) — instead we hand-construct two vectors that are ~0.95
cosine-similar to stand in for what two paraphrases of the same sentence
would actually produce, and two dissimilar vectors to prove unrelated
reports do NOT get merged. The pgvector query, the threshold logic, and
the cluster bookkeeping are all the real production code.
"""
import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import AsyncSessionLocal, set_tenant
from app.models.enums import ClusterStatus, LocationType, OrgType, ProblemStatus
from app.models.problem import EMBEDDING_DIM, Problem, ProblemEmbedding
from app.models.tenancy import Location, Organization, User
from app.services import similarity


def _close_vector(base: list[float], noise: float) -> list[float]:
    """A vector that points in almost the same direction as `base`, the way
    two different sentences describing the same real-world problem would
    embed close together even with very different wording."""
    import random

    rng = random.Random(42)
    return [b + rng.uniform(-noise, noise) for b in base]


def _random_unit_vector(seed: int) -> list[float]:
    import random

    rng = random.Random(seed)
    return [rng.uniform(-1, 1) for _ in range(EMBEDDING_DIM)]


@pytest_asyncio.fixture
async def org_and_location():
    async with AsyncSessionLocal() as session:
        org = Organization(name="Test Org", slug=f"test-{uuid.uuid4().hex[:8]}", type=OrgType.hostel)
        session.add(org)
        await session.flush()
        user = User(name="Reporter", email=f"{uuid.uuid4().hex[:8]}@example.com")
        session.add(user)
        await session.flush()
        location = Location(org_id=org.id, name="Room 303", type=LocationType.room, path="Room 303")
        session.add(location)
        await session.flush()
        await session.commit()
        yield org.id, user.id, location.id


async def _create_problem_with_embedding(
    session: AsyncSession, *, org_id, user_id, location_id, title: str, vector: list[float]
) -> Problem:
    problem = Problem(
        org_id=org_id,
        reporter_id=user_id,
        title=title,
        description=title,
        location_id=location_id,
        severity=50,
        urgency=50,
        safety_flag=False,
        status=ProblemStatus.reported,
        priority_score=0,
        priority_reasons={},
    )
    session.add(problem)
    await session.flush()
    session.add(ProblemEmbedding(problem_id=problem.id, embedding=vector, model_version="test-fixture"))
    await session.flush()
    return problem


@pytest.mark.asyncio
async def test_paraphrased_reports_of_the_same_problem_are_clustered_together(org_and_location):
    org_id, user_id, location_id = org_and_location
    base_vector = _random_unit_vector(seed=1)

    async with AsyncSessionLocal() as session:
        await set_tenant(session, str(org_id))

        # Report 1: "before Room 303 there's a broken tile"
        p1 = await _create_problem_with_embedding(
            session, org_id=org_id, user_id=user_id, location_id=location_id,
            title="Before Room 303 there is a broken tile", vector=base_vector,
        )
        await session.commit()

    async with AsyncSessionLocal() as session:
        await set_tenant(session, str(org_id))

        # Report 2: "beside Room 303 a tile is broken" — different wording,
        # same real-world problem, so its vector is very close to report 1's.
        paraphrase_vector = _close_vector(base_vector, noise=0.02)
        p2 = await _create_problem_with_embedding(
            session, org_id=org_id, user_id=user_id, location_id=location_id,
            title="Beside Room 303 a tile is broken", vector=paraphrase_vector,
        )

        matches = await similarity.find_similar(session, org_id=org_id, new_embedding=paraphrase_vector)
        matches = [m for m in matches if m.problem.id != p2.id]
        assert matches, "expected the paraphrase to match report 1"
        assert matches[0].similarity >= similarity.auto_match_threshold(), (
            f"expected a confident match, got similarity={matches[0].similarity}"
        )

        cluster = await similarity.attach_to_cluster_or_create(
            session, org_id=org_id, problem=p2, matches=matches
        )
        await session.commit()

        assert cluster is not None, "the two paraphrases of the same problem should form a cluster"
        assert cluster.report_count == 2
        assert p2.cluster_id == cluster.id

        # Confirm report 1 was retroactively attached to the same cluster too.
        p1_reloaded = await session.get(Problem, p1.id)
        assert p1_reloaded.cluster_id == cluster.id


@pytest.mark.asyncio
async def test_unrelated_reports_are_not_clustered(org_and_location):
    org_id, user_id, location_id = org_and_location

    async with AsyncSessionLocal() as session:
        await set_tenant(session, str(org_id))
        await _create_problem_with_embedding(
            session, org_id=org_id, user_id=user_id, location_id=location_id,
            title="Broken tile near Room 303", vector=_random_unit_vector(seed=1),
        )
        await session.commit()

    async with AsyncSessionLocal() as session:
        await set_tenant(session, str(org_id))
        unrelated_vector = _random_unit_vector(seed=999)  # a genuinely different direction
        p2 = await _create_problem_with_embedding(
            session, org_id=org_id, user_id=user_id, location_id=location_id,
            title="Wi-Fi is down on the third floor", vector=unrelated_vector,
        )

        matches = await similarity.find_similar(session, org_id=org_id, new_embedding=unrelated_vector)
        matches = [m for m in matches if m.problem.id != p2.id]

        cluster = await similarity.attach_to_cluster_or_create(
            session, org_id=org_id, problem=p2, matches=matches
        )
        await session.commit()

        assert cluster is None, "an unrelated report must not be merged into someone else's cluster"


@pytest.mark.asyncio
async def test_recurrence_reopens_a_resolved_cluster(org_and_location):
    org_id, user_id, location_id = org_and_location
    base_vector = _random_unit_vector(seed=7)

    async with AsyncSessionLocal() as session:
        await set_tenant(session, str(org_id))
        p1 = await _create_problem_with_embedding(
            session, org_id=org_id, user_id=user_id, location_id=location_id,
            title="Leaking pipe in the corridor", vector=base_vector,
        )
        p2_vector = _close_vector(base_vector, noise=0.02)
        p2 = await _create_problem_with_embedding(
            session, org_id=org_id, user_id=user_id, location_id=location_id,
            title="Corridor pipe is leaking again", vector=p2_vector,
        )
        matches = [m for m in await similarity.find_similar(session, org_id=org_id, new_embedding=p2_vector) if m.problem.id != p2.id]
        cluster = await similarity.attach_to_cluster_or_create(session, org_id=org_id, problem=p2, matches=matches)
        cluster.status = ClusterStatus.resolved  # simulate maintenance having fixed it
        await session.commit()
        cluster_id = cluster.id

    async with AsyncSessionLocal() as session:
        await set_tenant(session, str(org_id))
        p3_vector = _close_vector(base_vector, noise=0.02)
        p3 = await _create_problem_with_embedding(
            session, org_id=org_id, user_id=user_id, location_id=location_id,
            title="The corridor pipe is leaking yet again", vector=p3_vector,
        )
        matches = [m for m in await similarity.find_similar(session, org_id=org_id, new_embedding=p3_vector) if m.problem.id != p3.id]
        cluster = await similarity.attach_to_cluster_or_create(session, org_id=org_id, problem=p3, matches=matches)
        await session.commit()

        assert cluster.id == cluster_id
        assert cluster.status == ClusterStatus.open, "a new occurrence must reopen a resolved cluster"
        assert cluster.recurrence_count == 1


@pytest.mark.asyncio
async def test_earlier_cluster_members_are_rescored_as_more_people_report(org_and_location):
    """
    The first person to report a widespread problem must not keep a
    "1 person affected" priority forever.

    Priority is computed at insert time from the cluster's counters as they
    were at that instant. Without an explicit re-score, the OLDEST report of
    a problem that 20 people later report keeps its original low score — and
    since the staff queue sorts by priority, the report that has been waiting
    longest sinks to the bottom. That is the exact opposite of what should
    happen, and it quietly undermines the product's core claim.
    """
    org_id, user_id, location_id = org_and_location
    base_vector = _random_unit_vector(seed=7)

    async with AsyncSessionLocal() as session:
        await set_tenant(session, str(org_id))
        first = await _create_problem_with_embedding(
            session, org_id=org_id, user_id=user_id, location_id=location_id,
            title="Wifi not working in Block A", vector=base_vector,
        )
        # Score it the way the intake pipeline would: alone, nobody else affected.
        from app.services import priority as priority_service

        score, _bucket, reasons = priority_service.compute_priority(
            severity=50, urgency=50, safety_flag=False,
            affected_users_estimate=1, recurrence_count=0,
        )
        first.priority_score = score
        first.priority_reasons = reasons
        await session.commit()
        first_id, score_when_alone = first.id, first.priority_score

    async with AsyncSessionLocal() as session:
        await set_tenant(session, str(org_id))
        second = await _create_problem_with_embedding(
            session, org_id=org_id, user_id=user_id, location_id=location_id,
            title="Internet is gone on the 2nd floor", vector=_close_vector(base_vector, noise=0.02),
        )
        matches = [
            m
            for m in await similarity.find_similar(
                session, org_id=org_id, new_embedding=_close_vector(base_vector, noise=0.02)
            )
            if m.problem.id != second.id
        ]
        cluster = await similarity.attach_to_cluster_or_create(
            session, org_id=org_id, problem=second, matches=matches
        )
        assert cluster is not None
        await similarity.resync_cluster_member_priorities(session, cluster=cluster)
        await session.commit()

    async with AsyncSessionLocal() as session:
        await set_tenant(session, str(org_id))
        refreshed = await session.get(Problem, first_id)
        assert refreshed.priority_score > score_when_alone, (
            "the first reporter's priority should rise once the problem is confirmed "
            f"by others (was {score_when_alone}, still {refreshed.priority_score})"
        )


@pytest.mark.asyncio
async def test_cluster_is_marked_resolved_only_when_every_report_is(org_and_location):
    """
    Recurrence detection depends entirely on a cluster reaching `resolved`:
    the "this problem came back" branch only fires against a resolved
    cluster. Nothing in the app used to set that status, so recurrence_count
    was structurally always 0 and the owner-facing "times it came back"
    figure was permanently meaningless.
    """
    org_id, user_id, location_id = org_and_location
    base_vector = _random_unit_vector(seed=11)

    async with AsyncSessionLocal() as session:
        await set_tenant(session, str(org_id))
        p1 = await _create_problem_with_embedding(
            session, org_id=org_id, user_id=user_id, location_id=location_id,
            title="Tap leaking in the washroom", vector=base_vector,
        )
        await session.commit()

    async with AsyncSessionLocal() as session:
        await set_tenant(session, str(org_id))
        near = _close_vector(base_vector, noise=0.02)
        p2 = await _create_problem_with_embedding(
            session, org_id=org_id, user_id=user_id, location_id=location_id,
            title="Washroom tap keeps dripping", vector=near,
        )
        matches = [
            m
            for m in await similarity.find_similar(session, org_id=org_id, new_embedding=near)
            if m.problem.id != p2.id
        ]
        cluster = await similarity.attach_to_cluster_or_create(
            session, org_id=org_id, problem=p2, matches=matches
        )
        assert cluster is not None
        await session.commit()
        cluster_id, p1_id, p2_id = cluster.id, p1.id, p2.id

    # Resolving ONE of the two reports must NOT resolve the cluster.
    async with AsyncSessionLocal() as session:
        await set_tenant(session, str(org_id))
        (await session.get(Problem, p1_id)).status = ProblemStatus.resolved
        await session.flush()
        await similarity.sync_cluster_status(session, cluster_id=cluster_id)
        await session.commit()

    async with AsyncSessionLocal() as session:
        await set_tenant(session, str(org_id))
        from app.models.problem import ProblemCluster

        assert (await session.get(ProblemCluster, cluster_id)).status == ClusterStatus.open, (
            "a cluster with one report still open must stay open"
        )

    # Resolving the last one closes the cluster.
    async with AsyncSessionLocal() as session:
        await set_tenant(session, str(org_id))
        (await session.get(Problem, p2_id)).status = ProblemStatus.resolved
        await session.flush()
        await similarity.sync_cluster_status(session, cluster_id=cluster_id)
        await session.commit()

    async with AsyncSessionLocal() as session:
        await set_tenant(session, str(org_id))
        from app.models.problem import ProblemCluster

        assert (await session.get(ProblemCluster, cluster_id)).status == ClusterStatus.resolved
