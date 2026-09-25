"""traitement_aerien : surface restante abandonnée (+ motif)

Généralise à l'Aérien la décision déjà prise côté Terrestre (`traitement_terrestre`,
migrations 0014 et suivantes) : quand une fiche laisse une `surface_restante_ha` > 0,
l'agent doit trancher — cette surface est-elle abandonnée (oui/non), et pourquoi ?

Modèle : deux colonnes NULLABLE sur `traitement_aerien`, identiques à celles du Terrestre
(pas de nouvelle table : la cardinalité reste 1 fiche → 0..1 décision, l'information dépend
uniquement de la clé `traitement_id`, donc 3NF respectée).

- `surface_restante_abandonnee` : NULL = pas encore tranché (ou aucune surface restante) ;
  TRUE/FALSE = décision de l'agent.
- `motif_surface_restante_abandonnee` : texte libre, obligatoire côté domaine (à la
  validation, CDG §9) quand la surface est abandonnée.

La CHECK garantit au niveau base qu'un motif n'est jamais posé sans décision « abandonnée »
(`motif IS NULL OR abandonnee IS TRUE`) : le motif n'a de sens que pour un abandon.

Revision ID: 0097
Revises: 0096
Create Date: 2026-09-24
"""

import sqlalchemy as sa

from alembic import op

revision = "0097"
down_revision = "0096"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "traitement_aerien",
        sa.Column("surface_restante_abandonnee", sa.Boolean(), nullable=True),
    )
    op.add_column(
        "traitement_aerien",
        sa.Column("motif_surface_restante_abandonnee", sa.Text(), nullable=True),
    )
    op.create_check_constraint(
        "ck_traitement_aerien_motif_abandon",
        "traitement_aerien",
        "motif_surface_restante_abandonnee IS NULL OR surface_restante_abandonnee IS TRUE",
    )


def downgrade() -> None:
    op.drop_constraint("ck_traitement_aerien_motif_abandon", "traitement_aerien")
    op.drop_column("traitement_aerien", "motif_surface_restante_abandonnee")
    op.drop_column("traitement_aerien", "surface_restante_abandonnee")
