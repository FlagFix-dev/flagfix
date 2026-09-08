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
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.deps import CurrentUser, get_current_user, require_role
from app.models.catalog import ProblemCategory
from app.models.enums import UserRole
from app.models.tenancy import Department, Location, Organization, User, UserOrgRole
from app.schemas.auth import TokenResponse
from app.schemas.org import (
    CategoryCreateRequest,
    CategoryResponse,
    DepartmentCreateRequest,
    DepartmentResponse,
    LocationCreateRequest,
    LocationResponse,
    OrgCreateRequest,
)
from app.security import create_access_token, create_refresh_token, hash_password

router = APIRouter(prefix="/api/orgs", tags=["organizations"])


@router.post("", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(
    payload: OrgCreateRequest, session: AsyncSession = Depends(get_session)
) -> TokenResponse:
    existing = await session.execute(select(Organization).where(Organization.slug == payload.org_slug))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "That workspace URL is already taken.")

    org = Organization(name=payload.org_name, slug=payload.org_slug, type=payload.org_type)
    session.add(org)
    await session.flush()

    owner = User(name=payload.owner_name, email=payload.owner_email, password_hash=hash_password(payload.owner_password))
    session.add(owner)
    await session.flush()

    session.add(UserOrgRole(user_id=owner.id, org_id=org.id, role=UserRole.owner))
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

    category = ProblemCategory(
        org_id=current_user.org_id, name=payload.name, default_department_id=payload.default_department_id
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
