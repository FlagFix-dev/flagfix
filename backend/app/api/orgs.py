"""
Organization creation and configuration (locations, departments,
categories). Org creation itself is intentionally open/unauthenticated —
it IS the "sign up my institution" flow, the same way creating a new
Slack workspace doesn't require you to already have an account. Every
other write in this file requires an authenticated admin/owner of that
specific org.

Note on tenant scoping here: organizations/locations/departments/categories
are NOT behind Postgres RLS (unlike problems/clusters/etc — see
alembic/versions/0001_initial.py for the full reasoning). They're
configuration data, not complaint content, and login needs to read them
before a JWT/org-context even exists. Isolation for these tables is
enforced in the queries below by an explicit `.where(org_id == ...)`
instead — reviewed carefully precisely because it's the exception, not
the default.
"""
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import anyio.to_thread
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.deps import CurrentUser, get_current_user, get_tenant_db, require_role
from app.models.catalog import ProblemCategory
from app.models.enums import ProblemStatus, UserRole
from app.models.problem import Problem
from app.models.tenancy import Department, Location, Organization, User, UserOrgRole
from app.schemas.auth import TokenResponse
from app.schemas.org import (
    CategoryCreateRequest,
    CategoryResponse,
    DepartmentCreateRequest,
    DepartmentResponse,
    LocationCreateRequest,
    LocationResponse,
    MemberListResponse,
    MemberResponse,
    OrgCreateRequest,
    OrgProfileResponse,
    OrgStatsResponse,
)
from app.security import create_access_token, create_refresh_token, hash_password

router = APIRouter(prefix="/api/orgs", tags=["organizations"])

# Seeded for every new institution so category-based routing and "how long
# does this usually take" estimates work from day one, without an admin
# having to configure anything first. Hours are rough MVP heuristics, not
# promises — an admin can adjust them later via a future settings screen.
# Matches the fixed category enum the AI extraction step uses (see
# services/ai_extraction.py) so a report's AI-detected category always has
# a matching row to attach to.
_DEFAULT_CATEGORIES: list[tuple[str, int]] = [
    ("IT", 2),
    ("Electrical", 6),
    ("Cleanliness", 4),
    ("Security", 3),
    ("Plumbing", 24),
    ("Hostel/Residence", 24),
    ("Infrastructure", 48),
    ("Other", 24),
]


def _generate_staff_code() -> str:
    return secrets.token_hex(4).upper()  # 8 hex chars, e.g. "A1B2C3D4"


@router.post("", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(
    payload: OrgCreateRequest, session: AsyncSession = Depends(get_session)
) -> TokenResponse:
    existing = await session.execute(select(Organization).where(Organization.slug == payload.org_slug))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "That workspace URL is already taken.")

    # Ids are generated here rather than left to the column default, which
    # SQLAlchemy only evaluates during flush — `org.id` would still be None
    # at the point the rows below need to reference it.
    org_id = uuid.uuid4()
    owner_id = uuid.uuid4()

    org = Organization(
        id=org_id,
        name=payload.org_name,
        slug=payload.org_slug,
        type=payload.org_type,
        address=payload.address,
        city=payload.city,
        state=payload.state,
        num_blocks=payload.num_blocks,
        staff_code=_generate_staff_code(),
    )
    owner = User(
        id=owner_id,
        name=payload.owner_name,
        email=payload.owner_email,
        # bcrypt is intentionally slow (~250ms). Run it off the event loop
        # so one signup doesn't freeze every other request on the worker.
        password_hash=await anyio.to_thread.run_sync(hash_password, payload.owner_password),
    )
    # The organization row MUST be written before anything that references
    # it. SQLAlchemy orders inserts within a flush using the dependency
    # graph it builds from relationship() declarations — and there is no
    # relationship between Organization and ProblemCategory/UserOrgRole,
    # only a plain ForeignKey column. So batching all of these into a
    # single flush let the category inserts run FIRST and fail with
    # "org_id is not present in table organizations", which broke
    # institution signup completely.
    #
    # Hence: one flush for the organization, then everything that points at
    # it. Still fewer round trips than a row-at-a-time approach, and this
    # ordering is explicit rather than dependent on SQLAlchemy inferring an
    # order it has no way to infer. Covered by
    # tests/test_org_creation.py::test_creating_an_organization_seeds_its_categories.
    session.add(org)
    await session.flush()

    session.add_all(
        [
            owner,
            UserOrgRole(user_id=owner_id, org_id=org_id, role=UserRole.owner),
            *(
                ProblemCategory(org_id=org_id, name=name, typical_resolution_hours=hours)
                for name, hours in _DEFAULT_CATEGORIES
            ),
        ]
    )
    await session.commit()

    return TokenResponse(
        access_token=create_access_token(user_id=owner.id, org_id=org.id, role=UserRole.owner.value),
        refresh_token=create_refresh_token(user_id=owner.id, org_id=org.id),
    )


@router.post("/locations", response_model=LocationResponse, status_code=status.HTTP_201_CREATED)
async def create_location(
    payload: LocationCreateRequest,
    current_user: CurrentUser = Depends(require_role(UserRole.admin, UserRole.owner)),
    session: AsyncSession = Depends(get_session),
) -> LocationResponse:
    path = payload.name
    if payload.parent_location_id is not None:
        parent = await session.get(Location, payload.parent_location_id)
        if parent is None or parent.org_id != current_user.org_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid parent location.")
        path = f"{parent.path} / {payload.name}"

    location = Location(
        org_id=current_user.org_id,
        parent_location_id=payload.parent_location_id,
        name=payload.name,
        type=payload.type,
        path=path,
    )
    session.add(location)
    await session.commit()
    return LocationResponse.model_validate(location)


@router.get("/locations", response_model=list[LocationResponse])
async def list_locations(
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[LocationResponse]:
    stmt = select(Location).where(Location.org_id == current_user.org_id).order_by(Location.path)
    rows = (await session.execute(stmt)).scalars().all()
    return [LocationResponse.model_validate(r) for r in rows]


@router.post("/departments", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
async def create_department(
    payload: DepartmentCreateRequest,
    current_user: CurrentUser = Depends(require_role(UserRole.admin, UserRole.owner)),
    session: AsyncSession = Depends(get_session),
) -> DepartmentResponse:
    dept = Department(org_id=current_user.org_id, name=payload.name)
    session.add(dept)
    await session.commit()
    return DepartmentResponse.model_validate(dept)


@router.get("/departments", response_model=list[DepartmentResponse])
async def list_departments(
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[DepartmentResponse]:
    stmt = select(Department).where(Department.org_id == current_user.org_id).order_by(Department.name)
    rows = (await session.execute(stmt)).scalars().all()
    return [DepartmentResponse.model_validate(r) for r in rows]


@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: CategoryCreateRequest,
    current_user: CurrentUser = Depends(require_role(UserRole.admin, UserRole.owner)),
    session: AsyncSession = Depends(get_session),
) -> CategoryResponse:
    if payload.default_department_id is not None:
        dept = await session.get(Department, payload.default_department_id)
        if dept is None or dept.org_id != current_user.org_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid department.")

    # Duplicate category names are not merely untidy: report intake looks a
    # category up by name, so a second "Other" (or "other") in the same org
    # would break report submission for the whole institution. Rejected at
    # the door, case-insensitively.
    duplicate = (
        await session.execute(
            select(ProblemCategory).where(
                ProblemCategory.org_id == current_user.org_id,
                ProblemCategory.name.ilike(payload.name.strip()),
            )
        )
    ).scalars().first()
    if duplicate is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"A category called '{duplicate.name}' already exists."
        )

    category = ProblemCategory(
        org_id=current_user.org_id,
        name=payload.name.strip(),
        default_department_id=payload.default_department_id,
    )
    session.add(category)
    await session.commit()
    return CategoryResponse.model_validate(category)


@router.get("/categories", response_model=list[CategoryResponse])
async def list_categories(
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[CategoryResponse]:
    stmt = select(ProblemCategory).where(ProblemCategory.org_id == current_user.org_id).order_by(ProblemCategory.name)
    rows = (await session.execute(stmt)).scalars().all()
    return [CategoryResponse.model_validate(r) for r in rows]


async def _get_own_org(session: AsyncSession, current_user: CurrentUser) -> Organization:
    org = await session.get(Organization, current_user.org_id)
    if org is None:
        # Shouldn't happen for a validly-issued token, but never trust a
        # JWT's org_id as proof the row still exists.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found.")
    return org


@router.get("/me", response_model=OrgProfileResponse)
async def get_my_organization(
    current_user: CurrentUser = Depends(require_role(UserRole.admin, UserRole.owner)),
    session: AsyncSession = Depends(get_session),
) -> OrgProfileResponse:
    org = await _get_own_org(session, current_user)
    return OrgProfileResponse.model_validate(org)


@router.post("/me/regenerate-staff-code", response_model=OrgProfileResponse)
async def regenerate_staff_code(
    current_user: CurrentUser = Depends(require_role(UserRole.owner)),
    session: AsyncSession = Depends(get_session),
) -> OrgProfileResponse:
    """Owner-only (not admin) — rotating the staff code invalidates it for
    anyone who had it, including any admin who leaked it, so only the
    owner can trigger that."""
    org = await _get_own_org(session, current_user)
    org.staff_code = _generate_staff_code()
    await session.commit()
    return OrgProfileResponse.model_validate(org)


@router.get("/members", response_model=MemberListResponse)
async def list_members(
    current_user: CurrentUser = Depends(require_role(UserRole.admin, UserRole.owner)),
    session: AsyncSession = Depends(get_session),
) -> MemberListResponse:
    """
    Everyone who has joined this institution's workspace, with who is
    currently around.

    "Online" is a best-effort signal, not true presence: it means the
    person's session was active within the last 15 minutes (see
    User.last_seen_at, touched on login, token refresh, and staff queue
    loads). Real-time presence would need websockets; this is honest about
    being an approximation and is labelled that way in the UI.
    """
    online_cutoff = datetime.now(timezone.utc) - timedelta(minutes=15)

    rows = (
        await session.execute(
            select(User, UserOrgRole)
            .join(UserOrgRole, UserOrgRole.user_id == User.id)
            .where(UserOrgRole.org_id == current_user.org_id)
            .order_by(User.name)
        )
    ).all()

    members: list[MemberResponse] = []
    total_students = total_staff = students_online = staff_online = 0

    for user, role_row in rows:
        is_online = user.last_seen_at is not None and user.last_seen_at >= online_cutoff
        is_student = role_row.role == UserRole.reporter

        if is_student:
            total_students += 1
            students_online += 1 if is_online else 0
        else:
            total_staff += 1
            staff_online += 1 if is_online else 0

        members.append(
            MemberResponse(
                id=user.id,
                name=user.name,
                email=user.email,
                role=role_row.role,
                is_active=user.is_active,
                last_seen_at=user.last_seen_at,
                is_online=is_online,
                joined_at=role_row.created_at,
            )
        )

    return MemberListResponse(
        total_students=total_students,
        total_staff=total_staff,
        students_online=students_online,
        staff_online=staff_online,
        members=members,
    )


@router.get("/stats", response_model=OrgStatsResponse)
async def get_org_stats(
    current_user: CurrentUser = Depends(require_role(UserRole.admin, UserRole.owner)),
    session: AsyncSession = Depends(get_tenant_db),
) -> OrgStatsResponse:
    """Powers the admin/owner operations dashboard: how much staff are
    around, how much work is done vs. waiting vs. actively being worked.
    Problem counts go through get_tenant_db (RLS-scoped); staff headcount
    and presence come from UserOrgRole/User directly, filtered by org_id
    explicitly since those tables aren't RLS-protected (see this file's
    module docstring)."""
    online_cutoff = datetime.now(timezone.utc) - timedelta(minutes=15)

    # One pass over `problems` with conditional aggregates, rather than five
    # separate COUNT queries. On a database in another region — which is the
    # normal deployment shape here — each query is a separate round trip of
    # 150-250ms, so collapsing five into one is the difference between a
    # dashboard that feels instant and one that visibly hangs. This endpoint
    # is also polled every 45 seconds, which multiplies the saving.
    problem_counts = (
        await session.execute(
            select(
                func.count().label("total"),
                func.count()
                .filter(Problem.status.in_([ProblemStatus.reported, ProblemStatus.verified]))
                .label("pending"),
                func.count()
                .filter(
                    Problem.status.in_(
                        [ProblemStatus.assigned, ProblemStatus.in_progress, ProblemStatus.reopened]
                    )
                )
                .label("accepted"),
                func.count().filter(Problem.status == ProblemStatus.resolved).label("resolved"),
                func.count().filter(Problem.status == ProblemStatus.closed).label("closed"),
            ).where(Problem.org_id == current_user.org_id)
        )
    ).one()

    # Likewise: staff headcount and "seen recently" headcount in one query.
    staff_counts = (
        await session.execute(
            select(
                func.count().label("total_staff"),
                func.count()
                .filter(User.last_seen_at.is_not(None), User.last_seen_at >= online_cutoff)
                .label("online"),
            )
            .select_from(UserOrgRole)
            .join(User, User.id == UserOrgRole.user_id)
            .where(
                UserOrgRole.org_id == current_user.org_id,
                UserOrgRole.role.in_([UserRole.resolver, UserRole.admin, UserRole.owner]),
            )
        )
    ).one()

    return OrgStatsResponse(
        total_staff=staff_counts.total_staff,
        staff_online=staff_counts.online,
        total_reports=problem_counts.total,
        pending=problem_counts.pending,
        accepted=problem_counts.accepted,
        resolved=problem_counts.resolved,
        closed=problem_counts.closed,
    )
