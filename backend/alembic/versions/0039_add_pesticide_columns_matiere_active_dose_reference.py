"""add pesticide column dose_reference

`matiere_active` n'est pas ajoutee ici : la migration 0010 la cree deja
(`op.add_column("pesticide", sa.Column("matiere_active", ...))`, revue PR #55).
La rajouter faisait echouer `alembic upgrade head` sur toute base ayant rejoue
la chaine complete :

    DuplicateColumnError: column "matiere_active" of relation "pesticide"
    already exists

Seule `dose_reference` est nouvelle.

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
        sa.Column("dose_reference", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("pesticide", "dose_reference")
