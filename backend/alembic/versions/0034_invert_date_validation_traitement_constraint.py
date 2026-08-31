"""invert traitement date order: date_traitement >= date_validation

Renversement de règle métier (décision produit) : la date de validation précède
désormais la date de traitement (on valide/approuve d'abord, on exécute le
traitement ensuite), et non l'inverse comme le modélisait la contrainte d'origine
(migration 0010).

Le nom de contrainte `ck_traitement_date_validation` est conservé tel quel — il
identifie la relation entre les deux colonnes, pas un sens particulier — pour éviter
de casser un outillage qui la référencerait par nom.

Lignes déjà en base qui violeraient la nouvelle contrainte (date_traitement <
date_validation, valides sous l'ancienne règle) : les deux dates sont inversées entre
elles plutôt que l'une des deux arbitrairement écrasée — aucune des deux valeurs
saisies par l'agent n'est perdue, seul leur rattachement au champ change.

Revision ID: 0034
Revises: 0033
Create Date: 2026-08-31

"""

from alembic import op

revision = "0034"
down_revision = "0033"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "UPDATE traitement SET date_traitement = date_validation, date_validation = date_traitement "
        "WHERE date_traitement < date_validation"
    )

    op.drop_constraint("ck_traitement_date_validation", "traitement", type_="check")

    op.create_check_constraint(
        "ck_traitement_date_validation",
        "traitement",
        "date_traitement >= date_validation",
    )


def downgrade() -> None:
    op.execute(
        "UPDATE traitement SET date_traitement = date_validation, date_validation = date_traitement "
        "WHERE date_traitement > date_validation"
    )

    op.drop_constraint("ck_traitement_date_validation", "traitement", type_="check")

    op.create_check_constraint(
        "ck_traitement_date_validation",
        "traitement",
        "date_validation >= date_traitement",
    )
