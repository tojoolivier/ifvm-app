"""prospection : suppression du pesticide embarqué (extensif aérien)

Une prospection extensive en mode aérien est un vol de reconnaissance — l'aéronef
n'embarque jamais de pesticide pendant son vol, contrairement à un vol de traitement
(épandage). Les 8 champs « Pesticides embarqués » (nom commercial, quantités, fûts),
ajoutés par la migration 0036, décrivaient donc une situation qui ne se présente pas en
pratique côté Prospection ; ils n'ont pas d'équivalent côté Traitement (`traitement`,
`traitement_aerien`) qui reste, lui, inchangé — ces colonnes-là restent légitimes,
l'épandage réel embarque bien du pesticide.

Revision ID: 0085
Revises: 0084
Create Date: 2026-09-22
"""

import sqlalchemy as sa

from alembic import op

revision = "0085"
down_revision = "0084"
branch_labels = None
depends_on = None

_TABLE = "prospection"
_COLUMNS = (
    "pesticides_embarques",
    "pesticide_nom_commercial",
    "pesticide_quantite_disponible",
    "pesticide_quantite_recue",
    "futs_disponible",
    "futs_pleins",
    "futs_vides",
    "futs_recues",
)


def upgrade() -> None:
    for column in _COLUMNS:
        op.drop_column(_TABLE, column)


def downgrade() -> None:
    # Données perdues : les valeurs saisies avant le downgrade ne sont pas restaurées,
    # seules les colonnes le sont (mêmes types qu'avant la migration 0036/cette
    # suppression), même politique que la migration 0080 pour un cas similaire.
    op.add_column(_TABLE, sa.Column("pesticides_embarques", sa.Boolean(), nullable=True))
    op.add_column(_TABLE, sa.Column("pesticide_nom_commercial", sa.Text(), nullable=True))
    op.add_column(
        _TABLE, sa.Column("pesticide_quantite_disponible", sa.Numeric(10, 2), nullable=True)
    )
    op.add_column(
        _TABLE, sa.Column("pesticide_quantite_recue", sa.Numeric(10, 2), nullable=True)
    )
    op.add_column(_TABLE, sa.Column("futs_disponible", sa.Integer(), nullable=True))
    op.add_column(_TABLE, sa.Column("futs_pleins", sa.Integer(), nullable=True))
    op.add_column(_TABLE, sa.Column("futs_vides", sa.Integer(), nullable=True))
    op.add_column(_TABLE, sa.Column("futs_recues", sa.Integer(), nullable=True))
