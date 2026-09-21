"""traitement_terrestre.pesticide_unite : unité (L/kg) de la section "Produits utilisés"

Demande utilisateur : les champs "Pesticides consommés", "Total pesticide",
"Stock initial", "Approvisionnement", "Stock Final" de la section "Produits
utilisés" (fiche de traitement Terrestre) sont aujourd'hui toujours en litres.
Ajoute un choix d'unité (L ou kg) pour l'ensemble de la section — un seul
choix par fiche, pas par produit comme `rotation.unite` (Aérien, où chaque
rotation garde son unité propre et deux totaux séparés sont maintenus sans
jamais être additionnés). Les colonnes historiques (`quantite_l`,
`total_pesticide_l`, `pesticide_recu_l`, `stock_initial_l`,
`pesticide_stock_restant_l`) gardent leur nom : ce sont de simples stockages
numériques, la conversion d'affichage/libellé se fait à la lecture selon
`pesticide_unite`.

Revision ID: 0077
Revises: 0076
Create Date: 2026-09-22

"""

import sqlalchemy as sa

from alembic import op

revision = "0077"
down_revision = "0076"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "traitement_terrestre",
        sa.Column("pesticide_unite", sa.String(length=2), nullable=False, server_default="L"),
    )
    op.create_check_constraint(
        "ck_traitement_terrestre_pesticide_unite",
        "traitement_terrestre",
        "pesticide_unite IN ('L','kg')",
    )
    # Le défaut serveur n'a servi qu'au backfill des lignes existantes — les
    # écritures suivantes passent toujours une valeur explicite (comme
    # `rotation.unite`, qui n'a pas de défaut serveur du tout).
    op.alter_column("traitement_terrestre", "pesticide_unite", server_default=None)


def downgrade() -> None:
    op.drop_constraint("ck_traitement_terrestre_pesticide_unite", "traitement_terrestre", type_="check")
    op.drop_column("traitement_terrestre", "pesticide_unite")
