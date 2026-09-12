"""custom "other" locations, plus persisted AI reasoning/confidence

Revision ID: 0005
Revises: 0004
Create Date: 2026-09-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0005'
down_revision: Union[str, None] = '0004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # A reporter can now pick "Somewhere else — not in this list" and type
    # the exact spot instead of choosing a configured location, so
    # location_id becomes optional and custom_location carries their words.
    op.alter_column('problems', 'location_id', existing_type=sa.UUID(), nullable=True)
    op.add_column('problems', sa.Column('custom_location', sa.Text(), nullable=True))

    # The AI's own justification + confidence, previously computed during
    # extraction and then thrown away. Persisting them is what makes the
    # AI's decisions auditable in the UI instead of a black box.
    op.add_column('problems', sa.Column('ai_reasoning', sa.Text(), nullable=True))
    op.add_column(
        'problems',
        sa.Column(
            'ai_low_confidence',
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column('problems', 'ai_low_confidence')
    op.drop_column('problems', 'ai_reasoning')
    op.drop_column('problems', 'custom_location')
    # Rows created with a custom location have no location_id, so they must
    # be removed before the column can go back to NOT NULL — otherwise this
    # downgrade would fail partway and leave the schema inconsistent.
    op.execute("DELETE FROM problems WHERE location_id IS NULL")
    op.alter_column('problems', 'location_id', existing_type=sa.UUID(), nullable=False)
