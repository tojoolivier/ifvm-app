"""prospection_population.stades_imago — répartition imago par sexe/sous-stade

La saisie Prospection Extensive (écran Imagos, `extensive-imagos.tsx`) permet de
répartir les captures par sexe et sous-stade (12 clés fixes : femelleA1..femelleA5,
maleA1, maleA234, maleA5) mais cette répartition n'était persistée nulle part côté
backend — seule la répartition par phases (`captures_sol`/`captures_trans`/
`captures_greg`/`captures_solitaro_transiens`) l'était. Le récapitulatif mobile
affichait donc systématiquement un message d'indisponibilité pour ce champ, alors
que la donnée était bien saisie côté client.

Même pattern que `densites_larve` (migration 0008), champ sœur pour la catégorie
larve sur la même table : colonne JSONB nullable, sans contrainte CHECK sur ses
clés (les 12 clés imago sont fixes et connues côté application, pas besoin d'un
CHECK Postgres pour les valider — cohérent avec l'absence de contrainte sur
`densites_larve`, dont les clés varient par espèce). Additive, sans backfill : les
fiches déjà enregistrées gardent `NULL` (répartition non disponible pour l'existant,
comportement inchangé pour elles).

Revision ID: 0046
Revises: 0045
Create Date: 2026-09-04

"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision = "0046"
down_revision = "0045"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "prospection_population",
        sa.Column("stades_imago", JSONB(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("prospection_population", "stades_imago")
