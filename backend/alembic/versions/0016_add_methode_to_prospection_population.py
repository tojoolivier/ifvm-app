"""add methode to prospection_population

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
    op.add_column("prospection_population", sa.Column("methode", sa.Text(), nullable=True))
    op.execute(
        """
        COMMENT ON COLUMN prospection_population.methode
        IS 'Methode de comptage: visuel, comptage_direct'
        """
    )
    op.create_check_constraint(
        "ck_prospection_population_methode",
        "prospection_population",
        "methode IN ('visuel','comptage_direct')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_prospection_population_methode", "prospection_population", type_="check")
    op.drop_column("prospection_population", "methode")
