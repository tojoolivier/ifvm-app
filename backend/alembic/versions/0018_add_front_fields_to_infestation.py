"""add stade_dominant/taille_groupe_m2/front fields to prospection_infestation

Revision ID: 0018
Revises: 0017
Create Date: 2026-08-14

"""

import sqlalchemy as sa

from alembic import op

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("prospection_infestation", sa.Column("stade_dominant", sa.Text(), nullable=True))
    op.add_column(
        "prospection_infestation", sa.Column("taille_groupe_m2", sa.Numeric(), nullable=True)
    )
    op.add_column(
        "prospection_infestation", sa.Column("front_longueur_m", sa.Numeric(), nullable=True)
    )
    op.add_column(
        "prospection_infestation", sa.Column("front_largeur_m", sa.Numeric(), nullable=True)
    )
    op.add_column(
        "prospection_infestation", sa.Column("densite_max_front", sa.Numeric(), nullable=True)
    )
    op.add_column(
        "prospection_infestation",
        sa.Column("densite_moy_arriere_front", sa.Numeric(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("prospection_infestation", "densite_moy_arriere_front")
    op.drop_column("prospection_infestation", "densite_max_front")
    op.drop_column("prospection_infestation", "front_largeur_m")
    op.drop_column("prospection_infestation", "front_longueur_m")
    op.drop_column("prospection_infestation", "taille_groupe_m2")
    op.drop_column("prospection_infestation", "stade_dominant")
