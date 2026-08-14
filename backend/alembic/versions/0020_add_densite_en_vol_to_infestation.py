"""add densite_en_vol to prospection_infestation

Revision ID: 0020
Revises: 0019
Create Date: 2026-08-14

"""

import sqlalchemy as sa

from alembic import op

revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "prospection_infestation", sa.Column("densite_en_vol", sa.Numeric(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("prospection_infestation", "densite_en_vol")
