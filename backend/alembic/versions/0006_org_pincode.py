"""institution pincode captured during onboarding

Revision ID: 0006
Revises: 0005
Create Date: 2026-09-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0006'
down_revision: Union[str, None] = '0005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nullable, and deliberately so: every institution created before this
    # migration has no pincode, and backfilling a placeholder would be
    # worse than an honest empty value. The onboarding form is what makes
    # it required going forward (see schemas/org.py).
    #
    # String rather than integer — an Indian PIN can begin with a digit
    # that an integer column would silently eat, and the value is never
    # arithmetic. The same reasoning applies to any postal code format the
    # product might meet later.
    op.add_column('organizations', sa.Column('pincode', sa.String(length=12), nullable=True))


def downgrade() -> None:
    op.drop_column('organizations', 'pincode')
