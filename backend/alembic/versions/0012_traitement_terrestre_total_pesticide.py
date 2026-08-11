"""traitement_terrestre.total_pesticide_l (derive, SUM des produits utilises)

Revision ID: 0012
Revises: 0011
Create Date: 2026-08-11

"""

import sqlalchemy as sa

from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "traitement_terrestre",
        sa.Column("total_pesticide_l", sa.Numeric(10, 2), nullable=True),
    )
    op.execute(
        """
        COMMENT ON COLUMN traitement_terrestre.total_pesticide_l
        IS 'Derive = SUM(traitement_produit_utilise.quantite_l) - alimente par l''application'
        """
    )


def downgrade() -> None:
    op.drop_column("traitement_terrestre", "total_pesticide_l")
