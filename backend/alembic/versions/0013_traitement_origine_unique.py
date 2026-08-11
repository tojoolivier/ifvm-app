"""traitement_terrestre.traitement_origine_id unique (chaine lineaire, garantie DB)

Revision ID: 0013
Revises: 0012
Create Date: 2026-08-12

"""

from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "uq_traitement_terrestre_origine_id",
        "traitement_terrestre",
        ["traitement_origine_id"],
        unique=True,
        postgresql_where="traitement_origine_id IS NOT NULL",
    )


def downgrade() -> None:
    op.drop_index("uq_traitement_terrestre_origine_id", table_name="traitement_terrestre")
