"""prospection_population.deplacement : remplace la valeur 'perchee' par 'deplacement'

Le champ `deplacement` d'une population Larves n'a que 2 états utiles pour le métier :
au repos, ou en déplacement — la 2e valeur portait jusqu'ici le libellé « Perchée »
(`perchee`), plus précis mais pas la distinction voulue (perchée n'est qu'une des façons
d'être en déplacement). Alignement demandé par le métier sur le vocabulaire déjà utilisé
ailleurs pour le même genre d'état (`prospection_population.etat`,
`prospection_infestation.comportement` : `repos`/`deplacement`).

Données existantes : toute ligne `deplacement = 'perchee'` est basculée vers
`'deplacement'` avant de resserrer la CHECK — sinon la contrainte casserait sur les fiches
déjà saisies.

Revision ID: 0084
Revises: 0083
Create Date: 2026-09-22
"""

from alembic import op

revision = "0084"
down_revision = "0083"
branch_labels = None
depends_on = None

_TABLE = "prospection_population"
_CONSTRAINT = "ck_prospection_population_deplacement"


def upgrade() -> None:
    op.drop_constraint(_CONSTRAINT, _TABLE, type_="check")
    op.execute(
        f"UPDATE {_TABLE} SET deplacement = 'deplacement' WHERE deplacement = 'perchee'"
    )
    op.create_check_constraint(
        _CONSTRAINT,
        _TABLE,
        "deplacement IN ('repos','deplacement')",
    )


def downgrade() -> None:
    # Les lignes remontées ici en 'perchee' ne sont pas forcément celles qui portaient
    # 'perchee' avant l'upgrade (une fiche a pu être saisie avec 'deplacement' entre
    # temps) — la distinction d'origine entre « perchée » et « en déplacement » n'est
    # de toute façon plus enregistrée nulle part depuis l'upgrade ; on ne peut pas la
    # reconstruire, seulement revenir à un vocabulaire compatible avec l'ancienne CHECK.
    op.drop_constraint(_CONSTRAINT, _TABLE, type_="check")
    op.execute(
        f"UPDATE {_TABLE} SET deplacement = 'perchee' WHERE deplacement = 'deplacement'"
    )
    op.create_check_constraint(
        _CONSTRAINT,
        _TABLE,
        "deplacement IN ('repos','perchee')",
    )
