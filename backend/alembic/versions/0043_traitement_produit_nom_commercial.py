"""traitement : nom commercial du produit, dérivé côté client à la saisie

`traitement_rotation` (Aérien) et `traitement_produit_utilise` (Terrestre)
référencent déjà le produit via `produit_id` (FK vers `pesticide.id`), mais ne
portent aucun libellé lisible propre à la fiche — le nom commercial est
maintenant dérivé côté mobile du nom complet du pesticide sélectionné (texte
avant le premier chiffre, ex. "Fyfanon 440 ULV" -> "Fyfanon") et doit être
persisté tel quel avec la fiche.

Valeur figée à la saisie, pas recalculée à la lecture : si le nom du pesticide
change plus tard dans le référentiel, les fiches déjà enregistrées gardent le
nom commercial tel qu'il était au moment de la saisie — même principe déjà
appliqué à `prospection.pesticide_nom_commercial` (saisie libre, usage
différent — pesticides embarqués en mode aérien extensif — sans lien avec
cette colonne).

Revision ID: 0043
Revises: 0042
Create Date: 2026-09-03

"""

import sqlalchemy as sa

from alembic import op

revision = "0043"
down_revision = "0042"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "traitement_rotation", sa.Column("nom_commercial", sa.Text(), nullable=True)
    )
    op.add_column(
        "traitement_produit_utilise", sa.Column("nom_commercial", sa.Text(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("traitement_produit_utilise", "nom_commercial")
    op.drop_column("traitement_rotation", "nom_commercial")
