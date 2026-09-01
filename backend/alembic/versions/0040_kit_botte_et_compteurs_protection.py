"""moyens de protection : compteurs par personne + kit_boite renommée kit_botte

Toutes les personnes à bord de l'hélicoptère (ou de l'équipe terrestre) doivent
être équipées, pas seulement « au moins une » : les 5 colonnes de protection
passent de booléen à un nombre de personnes équipées.

`kit_boite` (boîte à pharmacie) est renommée `kit_botte` (bottes) — même
sémantique de comptage que les 4 autres, changement de nom demandé côté métier.

Conversion des valeurs existantes : true -> 1, false -> 0 (une seule personne
connue équipée par défaut, faute de mieux — les fiches déjà validées peuvent
être corrigées manuellement si le compte réel diffère).

Revision ID: 0040
Revises: 0039
Create Date: 2026-08-31

"""

import sqlalchemy as sa

from alembic import op

revision = "0040"
down_revision = "0039"
branch_labels = None
depends_on = None

_COLONNES_BOOL_VERS_COMPTEUR = (
    "kit_combinaison",
    "kit_gants",
    "kit_lunettes",
    "kit_masques",
)


def upgrade() -> None:
    op.alter_column("traitement", "kit_boite", new_column_name="kit_botte")

    for colonne in (*_COLONNES_BOOL_VERS_COMPTEUR, "kit_botte"):
        # Le DEFAULT booléen ('false') ne se caste pas automatiquement vers
        # INTEGER dans le même ALTER COLUMN — il faut le retirer avant de
        # changer le type, puis poser le nouveau DEFAULT (0) après coup.
        op.execute(f"ALTER TABLE traitement ALTER COLUMN {colonne} DROP DEFAULT")
        op.alter_column(
            "traitement",
            colonne,
            type_=sa.Integer(),
            postgresql_using=f"CASE WHEN {colonne} THEN 1 ELSE 0 END",
        )
        op.alter_column("traitement", colonne, server_default="0")


def downgrade() -> None:
    for colonne in (*_COLONNES_BOOL_VERS_COMPTEUR, "kit_botte"):
        op.execute(f"ALTER TABLE traitement ALTER COLUMN {colonne} DROP DEFAULT")
        op.alter_column(
            "traitement",
            colonne,
            type_=sa.Boolean(),
            postgresql_using=f"{colonne} > 0",
        )
        op.alter_column("traitement", colonne, server_default="false")

    op.alter_column("traitement", "kit_botte", new_column_name="kit_boite")
