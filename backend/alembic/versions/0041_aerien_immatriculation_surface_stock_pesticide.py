"""traitement_aerien : immatriculation aéronef, surface traitée/restante, stock pesticide

Champs présents sur la fiche de traitement papier mais absents du modèle :

- `immatricule_aeronef` — immatriculation de l'hélicoptère, déjà modélisée côté
  `prospection` (mode aérien) mais jamais reprise côté `traitement_aerien`.
- `surface_traitee_ha`/`surface_restante_ha` — le Terrestre les a déjà (dérivées
  de 3 surfaces par équipement au sol) ; l'Aérien n'a pas d'équivalent équipement
  à décomposer, donc `surface_traitee_ha` est une saisie directe unique par
  fiche, et `surface_restante_ha` s'en déduit (`cible.surface_infestee_ha -
  surface_traitee_ha`, plancher 0 — CDG §9). Pas de chaînage de reprise côté
  Aérien (contrairement à Terrestre/`traitement_origine_id`) : le reste se
  calcule fiche par fiche, sans cumul inter-fiches.
- `pesticide_recu_l`/`pesticide_stock_restant_l` — suivi du stock de pesticide
  par fiche (« reçu » saisi, « consommé » = `total_pesticide_l` déjà dérivé des
  rotations, « reste en stock » = reçu − consommé, plancher 0). Absent aussi
  bien côté `traitement_aerien` que `traitement_terrestre` : ajouté aux deux
  pour ne pas introduire d'asymétrie entre les deux spécialisations.

Revision ID: 0041
Revises: 0040
Create Date: 2026-09-01

"""

import sqlalchemy as sa

from alembic import op

revision = "0041"
down_revision = "0040"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "traitement_aerien", sa.Column("immatricule_aeronef", sa.Text(), nullable=True)
    )
    op.add_column(
        "traitement_aerien", sa.Column("surface_traitee_ha", sa.Numeric(10, 2), nullable=True)
    )
    op.add_column(
        "traitement_aerien", sa.Column("surface_restante_ha", sa.Numeric(10, 2), nullable=True)
    )
    op.add_column(
        "traitement_aerien", sa.Column("pesticide_recu_l", sa.Numeric(10, 2), nullable=True)
    )
    op.add_column(
        "traitement_aerien",
        sa.Column("pesticide_stock_restant_l", sa.Numeric(10, 2), nullable=True),
    )

    op.add_column(
        "traitement_terrestre", sa.Column("pesticide_recu_l", sa.Numeric(10, 2), nullable=True)
    )
    op.add_column(
        "traitement_terrestre",
        sa.Column("pesticide_stock_restant_l", sa.Numeric(10, 2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("traitement_terrestre", "pesticide_stock_restant_l")
    op.drop_column("traitement_terrestre", "pesticide_recu_l")

    op.drop_column("traitement_aerien", "pesticide_stock_restant_l")
    op.drop_column("traitement_aerien", "pesticide_recu_l")
    op.drop_column("traitement_aerien", "surface_restante_ha")
    op.drop_column("traitement_aerien", "surface_traitee_ha")
    op.drop_column("traitement_aerien", "immatricule_aeronef")
