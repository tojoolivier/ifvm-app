"""traitement : propriétaire réel de la fiche (cree_par_id)

`traitement` n'a jamais eu d'équivalent à `prospection.prospecteur_id` — la
visibilité dans « Mes fiches » côté mobile (`listMesTraitements`) reposait
entièrement sur `chef_equipe_id`/`chef_de_base_id`, deux champs issus d'un
référentiel de rôles (`utilisateur_equipe`) et non de l'identité réelle de
l'utilisateur connecté. Un compte qui crée une fiche sans figurer lui-même
dans ce référentiel (ou sans se sélectionner manuellement comme chef) ne
retrouvait donc jamais sa propre fiche, bien que parfaitement enregistrée.

`cree_par_id` est fixé automatiquement à l'utilisateur authentifié au moment
de la création (jamais depuis le payload client — dérivé du token dans
`POST /traitements/sync`, jamais réattribué par un push ultérieur), même rôle
que `prospecteur_id` pour la Prospection.

Nullable : colonne additive sur une table existante, aucune fiche déjà en
base ne peut être rétro-attribuée à un créateur — même tolérance que
`pesticide.type_produit` (migration 0044).

Revision ID: 0046
Revises: 0045
Create Date: 2026-09-03

"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision = "0046"
down_revision = "0045"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("traitement", sa.Column("cree_par_id", UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_traitement_cree_par_id_utilisateur",
        "traitement",
        "utilisateur",
        ["cree_par_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_traitement_cree_par_id_utilisateur", "traitement", type_="foreignkey")
    op.drop_column("traitement", "cree_par_id")
