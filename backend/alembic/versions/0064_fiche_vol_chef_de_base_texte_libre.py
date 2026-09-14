"""fiche_vol : chef de base redevient du texte libre

Défait la partie « chef de base » de la migration 0029 (ADR-011 §7.4) — décision
produit du 2026-09-14 : `chef_de_base_id` (FK vers `utilisateur`, réservée aux
comptes ayant le rôle `chef_de_base`) est remplacée par la colonne texte libre
`chef_de_base`. Même bascule déjà faite pour `prospection.lieu_base_id`
(migration 0063) et `traitement_aerien` (migration 0054) : l'agent saisit
directement le nom, sans dépendre d'un compte applicatif existant.

`pilote`/`mecanicien` étaient déjà en texte libre sur cette table (ADR-011 :
« externes à l'IFVM, des noms, pas des comptes ») — chef de base rejoint cette
convention plutôt que d'en rester l'unique exception.

Backfill (upgrade) : `chef_de_base` est rempli depuis `utilisateur.prenom` +
`utilisateur.nom` via la FK existante avant que celle-ci ne soit supprimée —
aucune perte d'information pour les lignes déjà en base (aucune attendue en
pratique : la fonctionnalité n'a encore aucune UI mobile/web).

Downgrade : ré-ajoute `chef_de_base_id` (FK NOT NULL) — irréversible sans
mapping fiable nom → compte, même limite déjà acceptée par les downgrades de
0054/0063 ; échoue explicitement si des lignes existent, plutôt que d'inventer
un utilisateur.

Revision ID: 0064
Revises: 0063
Create Date: 2026-09-14

"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import context, op

revision = "0064"
down_revision = "0063"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("fiche_vol", sa.Column("chef_de_base", sa.String(255), nullable=True))

    op.execute(
        "UPDATE fiche_vol fv SET chef_de_base = u.prenom || ' ' || u.nom "
        "FROM utilisateur u WHERE u.id = fv.chef_de_base_id"
    )

    op.alter_column("fiche_vol", "chef_de_base", nullable=False)

    op.drop_index("ix_fiche_vol_chef_de_base_id", table_name="fiche_vol")
    op.drop_column("fiche_vol", "chef_de_base_id")


def downgrade() -> None:
    conn = op.get_bind()
    if not context.is_offline_mode():
        n = conn.execute(sa.text("SELECT count(*) FROM fiche_vol")).scalar()
        if n:
            raise RuntimeError(
                f"Migration 0064 downgrade : `fiche_vol` contient déjà {n} ligne(s). "
                "Un nom en texte libre ne redonne pas un id de compte de façon fiable — "
                "backfillez `chef_de_base_id` à la main sur les lignes existantes, puis "
                "relancez ce downgrade (ou adaptez-le)."
            )

    op.add_column(
        "fiche_vol",
        sa.Column(
            "chef_de_base_id", UUID(as_uuid=True), sa.ForeignKey("utilisateur.id"), nullable=True
        ),
    )
    op.create_index("ix_fiche_vol_chef_de_base_id", "fiche_vol", ["chef_de_base_id"])

    op.drop_column("fiche_vol", "chef_de_base")
