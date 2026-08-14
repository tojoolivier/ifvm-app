"""add heure_observation to prospection_infestation

Revision ID: 0019
Revises: 0018
Create Date: 2026-08-14

"""

import sqlalchemy as sa

from alembic import op

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "prospection_infestation", sa.Column("heure_observation", sa.Text(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("prospection_infestation", "heure_observation")
