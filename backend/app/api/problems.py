"""
The heart of the product. POST /api/problems is where every step of the
AI pipeline described in the implementation plan (Section 8) actually
runs, in order, against a real database and real AI provider calls.
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import CurrentUser, get_current_user, get_tenant_db, require_role
from app.models.catalog import ProblemCategory
from app.models.enums import NotificationType, ProblemStatus, UserRole
from app.models.problem import Assignment, Attachment, Problem, ProblemEmbedding, StatusHistory
from app.models.tenancy import Location, User
from app.models.ops import Feedback
from app.schemas.problem import (
    FeedbackRequest,
    ProblemCreateRequest,
    ProblemResponse,
    StatusChangeRequest,
)
from app.services import ai_extraction, embeddings, notifications, priority, routing, sla, similarity
from app.services.workflow import InvalidTransitionError, assert_valid_transition

router = APIRouter(prefix="/api/problems", tags=["problems"])


@router.post("", response_model=ProblemResponse, status_code=status.HTTP_201_CREATED)
async def create_problem(
    payload: ProblemCreateRequest,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_tenant_db),
) -> ProblemResponse:
    # --- Validate the location belongs to this org (defence in depth; the
    # location picker in the UI should already only offer this org's tree) ---
    location = await session.get(Location, payload.location_id)
    if location is None or location.org_id != current_user.org_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid location for this organization.")

    # --- Pipeline step 2: AI extraction (category, severity, urgency, safety) ---
    extraction = ai_extraction.extract(payload.description, payload.landmark)

    category = (
        await session.execute(
            select(ProblemCategory).where(
                ProblemCategory.org_id == current_user.org_id,
                ProblemCategory.name.ilike(extraction.category),
            )
        )
    ).scalar_one_or_none()

    department_id = await routing.resolve_department(
        session,
        org_id=current_user.org_id,
        category_id=category.id if category else None,
        suggested_department_name=extraction.suggested_department,
    )

    problem = Problem(
        org_id=current_user.org_id,
        reporter_id=current_user.user_id,
        title=extraction.title,
        description=payload.description,
        landmark=payload.landmark,
        category_id=category.id if category else None,
        location_id=payload.location_id,
        severity=extraction.severity,
        urgency=extraction.urgency,
        safety_flag=extraction.safety_flag,
        status=ProblemStatus.reported,
        department_id=department_id,
    )
    session.add(problem)
    await session.flush()  # assign problem.id — needed before embedding/clustering below

    for url in payload.attachment_urls:
        session.add(Attachment(problem_id=problem.id, url=url, content_type="image"))

    # --- Pipeline steps 3-5: embed the report, search for similar reports,
    # attach to an existing cluster (or start a new one) if it matches ---
    vector = embeddings.embed(f"{extraction.title}. {payload.description}")
    cluster = None
    if vector is not None:
        session.add(
            ProblemEmbedding(problem_id=problem.id, embedding=vector, model_version=embeddings.model_version())
        )
        matches = await similarity.find_similar(session, org_id=current_user.org_id, new_embedding=vector)
        # Exclude the row we just inserted from matching against itself.
        matches = [m for m in matches if m.problem.id != problem.id]
        cluster = await similarity.attach_to_cluster_or_create(
            session, org_id=current_user.org_id, problem=problem, matches=matches
        )

    # --- Pipeline step 6: explainable priority score ---
    affected_users = cluster.affected_users_estimate if cluster else 1
    recurrence_count = cluster.recurrence_count if cluster else 0
    score, bucket, reasons = priority.compute_priority(
        severity=problem.severity,
        urgency=problem.urgency,
        safety_flag=problem.safety_flag,
        affected_users_estimate=affected_users,
        recurrence_count=recurrence_count,
    )
    problem.priority_score = score
    problem.priority_reasons = reasons

    # --- Pipeline step 8: SLA due time for this priority bucket ---
    problem.sla_due_at = await sla.compute_sla_due_at(session, org_id=current_user.org_id, bucket=bucket)

    session.add(
        StatusHistory(
            problem_id=problem.id,
            from_status=None,
            to_status=ProblemStatus.reported,
            changed_by_user_id=current_user.user_id,
            changed_at=datetime.now(timezone.utc),
        )
    )

    reporter = await session.get(User, current_user.user_id)
    await notifications.notify(
        session,
        user_id=current_user.user_id,
        type=NotificationType.problem_submitted,
        payload={"problem_id": str(problem.id), "message": f"We received your report: {problem.title}"},
        email=reporter.email if reporter else None,
    )

    await session.commit()
    return ProblemResponse.model_validate(problem)


@router.get("/mine", response_model=list[ProblemResponse])
async def list_my_problems(
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_tenant_db),
) -> list[ProblemResponse]:
    stmt = (
        select(Problem)
        .where(Problem.org_id == current_user.org_id, Problem.reporter_id == current_user.user_id)
        .order_by(Problem.created_at.desc())
    )
    rows = (await session.execute(stmt)).scalars().all()
    return [ProblemResponse.model_validate(r) for r in rows]


@router.get("", response_model=list[ProblemResponse])
async def list_problems(
    status_filter: ProblemStatus | None = Query(default=None, alias="status"),
    category_id: uuid.UUID | None = None,
    location_id: uuid.UUID | None = None,
    current_user: CurrentUser = Depends(require_role(UserRole.admin, UserRole.owner, UserRole.resolver)),
    session: AsyncSession = Depends(get_tenant_db),
) -> list[ProblemResponse]:
    stmt = select(Problem).where(Problem.org_id == current_user.org_id)
    if status_filter is not None:
        stmt = stmt.where(Problem.status == status_filter)
    if category_id is not None:
        stmt = stmt.where(Problem.category_id == category_id)
    if location_id is not None:
        stmt = stmt.where(Problem.location_id == location_id)
    stmt = stmt.order_by(Problem.priority_score.desc(), Problem.created_at.desc())

    rows = (await session.execute(stmt)).scalars().all()
    return [ProblemResponse.model_validate(r) for r in rows]


async def _get_owned_or_visible_problem(
    session: AsyncSession, current_user: CurrentUser, problem_id: uuid.UUID
) -> Problem:
    problem = await session.get(Problem, problem_id)
    if problem is None or problem.org_id != current_user.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Problem not found.")
    if current_user.role == UserRole.reporter and problem.reporter_id != current_user.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only view your own reports.")
    return problem


@router.get("/{problem_id}", response_model=ProblemResponse)
async def get_problem(
    problem_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_tenant_db),
) -> ProblemResponse:
    problem = await _get_owned_or_visible_problem(session, current_user, problem_id)
    return ProblemResponse.model_validate(problem)


@router.post("/{problem_id}/assign", response_model=ProblemResponse)
async def assign_problem(
    problem_id: uuid.UUID,
    assigned_to_user_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_role(UserRole.admin, UserRole.owner)),
    session: AsyncSession = Depends(get_tenant_db),
) -> ProblemResponse:
    problem = await _get_owned_or_visible_problem(session, current_user, problem_id)

    target_state = ProblemStatus.assigned
    try:
        assert_valid_transition(problem.status, target_state)
    except InvalidTransitionError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc))

    problem.assigned_to_user_id = assigned_to_user_id
    from_status = problem.status
    problem.status = target_state
    session.add(
        Assignment(
            problem_id=problem.id,
            assigned_to_user_id=assigned_to_user_id,
            assigned_by_user_id=current_user.user_id,
            assigned_at=datetime.now(timezone.utc),
        )
    )
    session.add(
        StatusHistory(
            problem_id=problem.id,
            from_status=from_status,
            to_status=target_state,
            changed_by_user_id=current_user.user_id,
            changed_at=datetime.now(timezone.utc),
        )
    )

    assignee = await session.get(User, assigned_to_user_id)
    await notifications.notify(
        session,
        user_id=assigned_to_user_id,
        type=NotificationType.problem_assigned,
        payload={"problem_id": str(problem.id), "message": f"You've been assigned: {problem.title}"},
        email=assignee.email if assignee else None,
    )

    await session.commit()
    return ProblemResponse.model_validate(problem)


@router.post("/{problem_id}/status", response_model=ProblemResponse)
async def change_status(
    problem_id: uuid.UUID,
    payload: StatusChangeRequest,
    current_user: CurrentUser = Depends(require_role(UserRole.admin, UserRole.owner, UserRole.resolver)),
    session: AsyncSession = Depends(get_tenant_db),
) -> ProblemResponse:
    problem = await _get_owned_or_visible_problem(session, current_user, problem_id)

    try:
        assert_valid_transition(problem.status, payload.to_status)
    except InvalidTransitionError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc))

    from_status = problem.status
    problem.status = payload.to_status
    if payload.to_status == ProblemStatus.resolved:
        problem.resolved_at = datetime.now(timezone.utc)
    if payload.to_status == ProblemStatus.closed:
        problem.closed_at = datetime.now(timezone.utc)

    session.add(
        StatusHistory(
            problem_id=problem.id,
            from_status=from_status,
            to_status=payload.to_status,
            changed_by_user_id=current_user.user_id,
            note=payload.note,
            changed_at=datetime.now(timezone.utc),
        )
    )

    notif_type = {
        ProblemStatus.in_progress: NotificationType.problem_in_progress,
        ProblemStatus.resolved: NotificationType.problem_resolved,
    }.get(payload.to_status)
    if notif_type is not None:
        reporter = await session.get(User, problem.reporter_id)
        await notifications.notify(
            session,
            user_id=problem.reporter_id,
            type=notif_type,
            payload={"problem_id": str(problem.id), "message": f"Update on your report: {problem.title}"},
            email=reporter.email if reporter else None,
        )

    await session.commit()
    return ProblemResponse.model_validate(problem)


@router.post("/{problem_id}/feedback", response_model=ProblemResponse)
async def submit_feedback(
    problem_id: uuid.UUID,
    payload: FeedbackRequest,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_tenant_db),
) -> ProblemResponse:
    """
    The resolution-confirmation loop (Section 9.4): a staff-side "resolved"
    is not the same fact as a reporter-confirmed "actually fixed." A `No`
    reopens the problem for another round.

    MVP simplification: only the single reporting problem reopens on `No`,
    not every problem in its cluster — fanning that out to every reporter in
    a cluster is a fast-follow once we've watched this loop run for real.
    """
    problem = await _get_owned_or_visible_problem(session, current_user, problem_id)
    if problem.reporter_id != current_user.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the original reporter can confirm resolution.")
    if problem.status not in (ProblemStatus.resolved,):
        raise HTTPException(status.HTTP_409_CONFLICT, "This report has not been marked resolved yet.")

    session.add(
        Feedback(
            problem_id=problem.id,
            resolved_confirmed=payload.resolved_confirmed,
            rating=payload.rating,
            comment=payload.comment,
            submitted_at=datetime.now(timezone.utc),
        )
    )

    if not payload.resolved_confirmed:
        from_status = problem.status
        problem.status = ProblemStatus.reopened
        session.add(
            StatusHistory(
                problem_id=problem.id,
                from_status=from_status,
                to_status=ProblemStatus.reopened,
                changed_by_user_id=current_user.user_id,
                note=payload.comment,
                changed_at=datetime.now(timezone.utc),
            )
        )
        await notifications.notify(
            session,
            user_id=current_user.user_id,
            type=NotificationType.problem_reopened,
            payload={"problem_id": str(problem.id), "message": f"Reopened: {problem.title}"},
        )

    await session.commit()
    return ProblemResponse.model_validate(problem)
