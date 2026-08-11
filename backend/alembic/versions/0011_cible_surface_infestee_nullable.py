"""cible.surface_infestee_ha nullable (distinguer 0 ha de non renseigné)

Revision ID: 0011
Revises: 0010
Create Date: 2026-08-11

"""

import sqlalchemy as sa

from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("cible", "surface_infestee_ha", existing_type=sa.Numeric(10, 2), nullable=True)


def downgrade() -> None:
    op.alter_column("cible", "surface_infestee_ha", existing_type=sa.Numeric(10, 2), nullable=False)
