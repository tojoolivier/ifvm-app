"""add missing prospection.verdissement and prospection.hauteur_strate columns

Revision ID: 0007
Revises: 0006
Create Date: 2026-08-03

"""

import sqlalchemy as sa

from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("prospection", sa.Column("verdissement", sa.Numeric(), nullable=True))
    op.add_column("prospection", sa.Column("hauteur_strate", sa.Numeric(), nullable=True))


def downgrade() -> None:
    op.drop_column("prospection", "hauteur_strate")
    op.drop_column("prospection", "verdissement")
