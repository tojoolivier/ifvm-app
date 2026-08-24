"""update type_station constraint to match biotope

type_station passe de l'ancienne classification par usage du sol ('riziere_bordure',
'bas_fond', 'plateau', 'jachere', 'culture') à la classification biotope
('xerophyle', 'mesophyle', 'hydrophyle') déjà utilisée par le formulaire mobile extensif
(BIOTOPE_EXTENSIVE_OPTIONS). Il n'existe pas de correspondance fiable ancien -> nouveau
(ce sont deux axes de classification différents, pas un simple renommage) : les lignes de
démo existantes portant une ancienne valeur sont donc remises à NULL plutôt que
mappées au hasard vers une des trois nouvelles valeurs.

Revision ID: 0026
Revises: 0025
Create Date: 2026-08-22

"""

from alembic import op

revision = "0026"
down_revision = "0025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "UPDATE prospection SET type_station = NULL "
        "WHERE type_station IS NOT NULL "
        "AND type_station NOT IN ('xerophyle', 'mesophyle', 'hydrophyle')"
    )

    op.drop_constraint(
        "ck_prospection_type_station",
        "prospection",
        type_="check",
    )

    op.create_check_constraint(
        "ck_prospection_type_station",
        "prospection",
        "type_station IN ('xerophyle', 'mesophyle', 'hydrophyle')",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_prospection_type_station",
        "prospection",
        type_="check",
    )

    op.create_check_constraint(
        "ck_prospection_type_station",
        "prospection",
        "type_station IN ('riziere_bordure','bas_fond','plateau','jachere','culture')",
    )
