"""add interdistance_min/max/moy to prospection_infestation

Revision ID: 0016
Revises: 0015
Create Date: 2026-08-12

"""

import sqlalchemy as sa

from alembic import op

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "prospection_infestation", sa.Column("interdistance_min", sa.Numeric(), nullable=True)
    )
    op.add_column(
        "prospection_infestation", sa.Column("interdistance_max", sa.Numeric(), nullable=True)
    )
    op.add_column(
        "prospection_infestation", sa.Column("interdistance_moy", sa.Numeric(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("prospection_infestation", "interdistance_moy")
    op.drop_column("prospection_infestation", "interdistance_max")
    op.drop_column("prospection_infestation", "interdistance_min")
