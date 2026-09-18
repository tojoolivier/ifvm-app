"""campagne : actif (désactivation logique, remplace le DELETE physique — #137)

Revision ID: 0071
Revises: 0070
Create Date: 2026-09-17

"""

import sqlalchemy as sa

from alembic import op

revision = "0071"
down_revision = "0070"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "campagne",
        sa.Column("actif", sa.Boolean(), nullable=False, server_default="true"),
    )


def downgrade() -> None:
    op.drop_column("campagne", "actif")
