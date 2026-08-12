"""traitement_terrestre.motif_surface_restante_abandonnee (texte libre, CDG §9)

Revision ID: 0014
Revises: 0013
Create Date: 2026-08-12

"""

import sqlalchemy as sa

from alembic import op

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "traitement_terrestre",
        sa.Column("motif_surface_restante_abandonnee", sa.Text(), nullable=True),
    )
    op.execute(
        """
        COMMENT ON COLUMN traitement_terrestre.motif_surface_restante_abandonnee
        IS 'Obligatoire a la validation si surface_restante_abandonnee=true (CDG section 12,
        critere CDG §9) - non verifiable par un CHECK, applique par Traitement.valider()'
        """
    )


def downgrade() -> None:
    op.drop_column("traitement_terrestre", "motif_surface_restante_abandonnee")
