"""row level security for tenant-scoped tables

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-08 19:00:00.000000

Enables Postgres RLS on every table that holds actual complaint content
and workflow state, so a bug in application code can never leak one
organization's problem data into another's request — the database
itself refuses the row.

Deliberately NOT applied to: organizations, users, user_org_roles,
locations, departments, problem_categories. Those are configuration/
directory data (not complaint content), and login needs to query some of
them (users, user_org_roles, organizations) before a JWT — and therefore
an org context — exists at all. Isolation for those is enforced by an
explicit `.where(org_id == ...)` in application code instead (see
app/api/orgs.py's module docstring for the full reasoning). Revisit this
if a future enterprise customer requires it for every table without
exception.
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Tables with a direct org_id column.
_DIRECT_TABLES = ["problems", "problem_clusters", "sla_rules", "audit_logs"]

# Tables scoped through a parent problem/user (no org_id column of their
# own) — isolated via a subquery against `problems`/`users` instead.
_VIA_PROBLEM_TABLES = ["problem_embeddings", "attachments", "status_history", "assignments", "feedback"]


def upgrade() -> None:
    for table in _DIRECT_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"""
            CREATE POLICY tenant_isolation ON {table}
            USING (org_id = current_setting('app.current_org_id', true)::uuid)
            WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid)
            """
        )

    for table in _VIA_PROBLEM_TABLES:
        fk_col = "problem_id"
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"""
            CREATE POLICY tenant_isolation ON {table}
            USING (
                {fk_col} IN (
                    SELECT id FROM problems
                    WHERE org_id = current_setting('app.current_org_id', true)::uuid
                )
            )
            """
        )

    # problem_relationships references two problems directly, both of which
    # already belong to the same org by construction — scope via either side.
    op.execute("ALTER TABLE problem_relationships ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE problem_relationships FORCE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON problem_relationships
        USING (
            problem_a_id IN (
                SELECT id FROM problems
                WHERE org_id = current_setting('app.current_org_id', true)::uuid
            )
        )
        """
    )

    # notifications are scoped to a user, not an org directly, so isolation
    # here relies on the application only ever querying a user's own
    # notifications (enforced by always filtering on the authenticated
    # user_id) rather than RLS — there is no single org_id to check against
    # since a user's notification can originate from any org they belong to.


def downgrade() -> None:
    for table in _DIRECT_TABLES + _VIA_PROBLEM_TABLES + ["problem_relationships"]:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
