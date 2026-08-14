"""add dimension_ha to prospection_infestation

Revision ID: 0021
Revises: 0020
Create Date: 2026-08-14

"""

import sqlalchemy as sa

from alembic import op

revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("prospection_infestation", sa.Column("dimension_ha", sa.Numeric(), nullable=True))


def downgrade() -> None:
    op.drop_column("prospection_infestation", "dimension_ha")
