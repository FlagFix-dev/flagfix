"""staff invite codes, resolution-time estimates, live progress, presence

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-12 00:00:00.000000

"""
import secrets
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0004'
down_revision: Union[str, None] = '0003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('organizations', sa.Column('staff_code', sa.String(length=12), nullable=True))
    op.add_column('users', sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        'problem_categories', sa.Column('typical_resolution_hours', sa.Integer(), nullable=True)
    )
    op.add_column('problems', sa.Column('estimated_resolution_hours', sa.Integer(), nullable=True))
    op.add_column('problems', sa.Column('latest_update', sa.Text(), nullable=True))
    op.add_column('problems', sa.Column('latest_update_at', sa.DateTime(timezone=True), nullable=True))

    # Backfill: every organization created before this migration has no
    # staff_code yet. Generate one now so existing institutions (not just
    # ones created after this deploy) can immediately start using the
    # staff-code-gated signup flow without an admin having to do anything.
    connection = op.get_bind()
    org_ids = connection.execute(sa.text("SELECT id FROM organizations WHERE staff_code IS NULL")).fetchall()
    for (org_id,) in org_ids:
        code = secrets.token_hex(4).upper()  # 8 hex chars, e.g. "A1B2C3D4"
        connection.execute(
            sa.text("UPDATE organizations SET staff_code = :code WHERE id = :id"),
            {"code": code, "id": org_id},
        )


def downgrade() -> None:
    op.drop_column('problems', 'latest_update_at')
    op.drop_column('problems', 'latest_update')
    op.drop_column('problems', 'estimated_resolution_hours')
    op.drop_column('problem_categories', 'typical_resolution_hours')
    op.drop_column('users', 'last_seen_at')
    op.drop_column('organizations', 'staff_code')
