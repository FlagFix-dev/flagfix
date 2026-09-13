"""
End-to-end tests for institution signup — the very first thing anyone does
with FlagFix, and therefore the one path that must never be broken.

These exist because it WAS broken: an optimisation batched the
organization, its owner, the owner's role and the seeded categories into a
single flush. SQLAlchemy orders inserts within a flush from the dependency
graph it derives from relationship() declarations, and Organization has no
relationship to ProblemCategory — only a ForeignKey column, which that
graph doesn't see. So the category inserts were emitted first and the
database rejected them with a foreign-key violation, returning a 500 for
every attempt to create an institution.

The lesson encoded here: assert on the RESPONSE and on what actually
landed in the database, never just on timing. The change that broke this
was "verified" with a timing measurement that discarded the status code.

Runs against a real Postgres (same requirement as
test_similarity_clustering.py).
"""
import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.db import AsyncSessionLocal
from app.main import app
from app.models.catalog import ProblemCategory
from app.models.tenancy import Organization, User, UserOrgRole


def _payload(**overrides):
    unique = uuid.uuid4().hex[:8]
    body = {
        "org_name": f"Test Institution {unique}",
        "org_slug": f"test-inst-{unique}",
        "org_type": "college",
        "address": "12 Example Road",
        "city": "Hyderabad",
        "state": "Telangana",
        "num_blocks": 3,
        "owner_name": "Owner Person",
        "owner_email": f"owner-{unique}@example.com",
        "owner_password": "password123",
    }
    body.update(overrides)
    return body


async def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
async def test_creating_an_organization_seeds_its_categories():
    """The regression test for the foreign-key ordering bug.

    Asserts the status code first — the broken version returned 500 here
    while still "succeeding" under a timing-only check — then confirms
    every row that signup is supposed to create actually exists.
    """
    body = _payload()

    async with await _client() as client:
        response = await client.post("/api/orgs", json=body)

    assert response.status_code == 201, f"signup failed: {response.status_code} {response.text}"
    tokens = response.json()
    assert tokens["access_token"] and tokens["refresh_token"]

    async with AsyncSessionLocal() as session:
        org = (
            await session.execute(select(Organization).where(Organization.slug == body["org_slug"]))
        ).scalar_one()

        # A staff code must be generated at creation, or staff can never
        # sign up for this institution.
        assert org.staff_code, "every new organization needs a staff code"
        assert org.address == body["address"]
        assert org.num_blocks == body["num_blocks"]

        categories = (
            await session.execute(
                select(ProblemCategory).where(ProblemCategory.org_id == org.id)
            )
        ).scalars().all()
        assert len(categories) == 8, (
            "a new institution should start with the 8 default categories — "
            f"found {len(categories)}"
        )
        # Without these the AI's category can't be matched to anything, and
        # the quick-fix/bigger-job split has no data to work from.
        assert {c.name for c in categories} >= {"IT", "Plumbing", "Other"}
        assert all(c.typical_resolution_hours is not None for c in categories)

        owner = (
            await session.execute(select(User).where(User.email == body["owner_email"]))
        ).scalar_one()
        assert owner.password_hash and owner.password_hash != body["owner_password"], (
            "the password must be stored hashed, never in plain text"
        )

        role_row = (
            await session.execute(
                select(UserOrgRole).where(
                    UserOrgRole.user_id == owner.id, UserOrgRole.org_id == org.id
                )
            )
        ).scalar_one()
        assert role_row.role.value == "owner"


@pytest.mark.asyncio
async def test_every_institution_type_can_be_created():
    """The report came in as "I can't create the PG institution", so each
    type is exercised rather than just the default one."""
    for org_type in ("school", "college", "university", "hostel", "pg"):
        async with await _client() as client:
            response = await client.post("/api/orgs", json=_payload(org_type=org_type))
        assert response.status_code == 201, (
            f"could not create a '{org_type}' institution: "
            f"{response.status_code} {response.text}"
        )


@pytest.mark.asyncio
async def test_duplicate_workspace_url_is_rejected_cleanly():
    """A taken slug must be a clear 409, not a database-level 500."""
    body = _payload()

    async with await _client() as client:
        first = await client.post("/api/orgs", json=body)
        assert first.status_code == 201

        second = await client.post(
            "/api/orgs", json=_payload(org_slug=body["org_slug"])
        )

    assert second.status_code == 409
    assert "already taken" in second.json()["detail"].lower()
