"""traitement_terrestre : "Atomiseur" -> "Atomiseur à dos" + ULVAmast -> "Atomiseur autoporté"

Renomme le choix affiché « Atomiseur » en « Atomiseur à dos » (colonne
`surface_atomiseur_ha` inchangée, pur renommage côté saisie) et remplace
« ULVAmast » par « Atomiseur autoporté » : nouvelle colonne
`surface_atomiseur_autoporte_ha`.

Décision produit : les lignes déjà enregistrées avec une surface ULVAmast
sont remappées vers la nouvelle colonne avant que l'ancienne ne soit
supprimée — aucune perte de donnée, l'historique ULVAmast est traité comme
de l'« Atomiseur autoporté » (même famille d'équipement, motorisé/monté,
plutôt qu'un atomiseur à dos).

`surface_traitee_ha` (dérivée = atomiseur à dos + disque rotatif + atomiseur
autoporté, cf. `TraitementTerrestre.recalculer_surfaces`) n'est pas recalculée
ici : elle est réécrite au premier `recalculer_surfaces()` suivant côté
application (mêmes valeurs numériques, seule la colonne source du 3e terme
change), jamais lue avant ce recalcul.

Downgrade : restaure `surface_ulvamast_ha` (vide, sans backfill — un remap
ULVAmast -> autoporté ne se laisse pas retrancher a posteriori des saisies
faites nativement en autoporté depuis, même irréversibilité déjà acceptée
par d'autres migrations de ce type dans ce dépôt).

Revision ID: 0060
Revises: 0059
Create Date: 2026-09-12

"""

import sqlalchemy as sa

from alembic import op

revision = "0060"
down_revision = "0059"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "traitement_terrestre",
        sa.Column("surface_atomiseur_autoporte_ha", sa.Numeric(10, 2), nullable=True),
    )
    op.execute(
        "UPDATE traitement_terrestre SET surface_atomiseur_autoporte_ha = surface_ulvamast_ha "
        "WHERE surface_ulvamast_ha IS NOT NULL"
    )
    op.drop_column("traitement_terrestre", "surface_ulvamast_ha")


def downgrade() -> None:
    op.add_column(
        "traitement_terrestre", sa.Column("surface_ulvamast_ha", sa.Numeric(10, 2), nullable=True)
    )
    op.drop_column("traitement_terrestre", "surface_atomiseur_autoporte_ha")
