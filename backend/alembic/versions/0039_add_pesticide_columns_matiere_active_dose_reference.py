"""add pesticide columns matiere_active and dose_reference

Revision ID: 0039
Revises: 0038
Create Date: 2026-09-01

"""

import sqlalchemy as sa

from alembic import op

revision = "0039"
down_revision = "0038"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pesticide",
        sa.Column("matiere_active", sa.Text(), nullable=True),
    )
    op.add_column(
        "pesticide",
        sa.Column("dose_reference", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("pesticide", "dose_reference")
    op.drop_column("pesticide", "matiere_active")
