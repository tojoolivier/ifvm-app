"""traitement_terrestre.stock_initial_l : stock de pesticide avant approvisionnement

Fiche CRT papier, section 5 "Pesticides" : trois valeurs distinctes — « Stock
initial » (déjà présente sur le gabarit PDF, `traitement_pdf.py`, mais jamais
alimentée par aucun champ jusqu'ici), « Approvisionnement » (`pesticide_recu_l`,
déjà modélisé) et « Stock final restant » (`pesticide_stock_restant_l`, déjà
modélisé et calculé). `stock_initial_l` comble ce dernier trou : `_stock_pesticide_restant`
(backend/app/domain/traitement.py) intègre désormais ce troisième terme —
`pesticide_stock_restant_l = stock_initial_l + pesticide_recu_l - total_pesticide_l`
(plancher 0), au lieu de `pesticide_recu_l - total_pesticide_l`.

Terrestre uniquement : contrairement à `pesticide_recu_l`/`pesticide_stock_restant_l`
(migration 0041, ajoutés symétriquement à `traitement_aerien` ET
`traitement_terrestre`), la demande porte spécifiquement sur le formulaire
Terrestre — pas d'ajout côté `traitement_aerien` pour ne pas modéliser un champ
qui n'a pas été demandé côté Aérien.

Revision ID: 0075
Revises: 0074
Create Date: 2026-09-20

"""

import sqlalchemy as sa

from alembic import op

revision = "0075"
down_revision = "0074"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "traitement_terrestre", sa.Column("stock_initial_l", sa.Numeric(10, 2), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("traitement_terrestre", "stock_initial_l")
