"""extensive (mode aérien) : motif du divers sur une opération aérienne

Poursuit le mode aérien — ajoute `motif_divers` à `prospection_operation_aerienne`,
seul complément fonctionnel de l'amélioration UX (le champ « Remarques » du
slide D — Observations, lui, réutilise la colonne `prospection.observations`
déjà existante et déjà câblée pour l'intensif — pas de migration nécessaire
pour ce second complément).

Texte libre, nullable, pertinent seulement quand `type_operation = 'divers'` —
aucun CHECK ne le lie à `type_operation` : la même politique que les autres
champs conditionnels de cette fiche (`pesticide_nom_commercial` par exemple),
laissée à l'application plutôt qu'à une contrainte DB rigide.

Revision ID: 0037
Revises: 0036
Create Date: 2026-09-02

"""

import sqlalchemy as sa

from alembic import op

revision = "0037"
down_revision = "0036"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "prospection_operation_aerienne", sa.Column("motif_divers", sa.Text(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("prospection_operation_aerienne", "motif_divers")
