"""traitement.observations (texte libre, écran Impacts & risque)

Revision ID: 0015
Revises: 0014
Create Date: 2026-08-12

"""

import sqlalchemy as sa

from alembic import op

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "traitement",
        sa.Column("observations", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("traitement", "observations")
