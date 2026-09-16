"""equipe_aerienne : équipe propriétaire d'une base aérienne principale, avec chef de base

Demande utilisateur du 2026-09-16 (en continuité de la fiche de vol, migration 0064) :
« une base aérienne peut avoir une ou plusieurs bases secondaires, une base secondaire
devrait être liée à une base principale, une base principale devrait appartenir à une
équipe aérienne, et une équipe aérienne devrait avoir un chef de base ». La hiérarchie
base principale/secondaire existe déjà (`base_aerienne.parent_base_id`, migration 0064) ;
cette migration ajoute le niveau `equipe_aerienne` au-dessus de la base principale.

## Cardinalités (confirmées avec l'utilisateur)

1 équipe aérienne = 1 chef de base = 1 base aérienne principale. Modélisées par deux
contraintes UNIQUE plutôt qu'une table de jointure N:N, puisque les deux relations sont
1:1 :

- `equipe_aerienne.chef_de_base_id` UNIQUE : un chef de base ne dirige qu'une équipe.
- `base_aerienne.equipe_id` UNIQUE (NULL excepté des deux côtés du fait de la nature
  des contraintes UNIQUE Postgres, qui autorisent plusieurs NULL) : une équipe ne
  possède qu'une base principale.

Une base secondaire hérite de l'équipe de sa base principale par transitivité
(`base_secondaire.parent_base_id -> base_principale.equipe_id`) plutôt que de porter
sa propre colonne `equipe_id` — colonne qui serait soit redondante (même valeur que
celle de la principale), soit incohérente si jamais désynchronisée. D'où le CHECK
`ck_base_aerienne_equipe_coherente` : `equipe_id` NOT NULL **si et seulement si**
`parent_base_id` IS NULL (base principale).

## Garde-fou données existantes

`base_aerienne` existe depuis la migration 0064 (récente, probablement vide en
production, mais non garanti). Si des bases principales existent déjà sans pouvoir
recevoir d'`equipe_id` automatiquement (aucune équipe ne peut être devinée), la
migration échoue explicitement plutôt que d'inventer une équipe placeholder — même
principe que le garde-fou de 0064 pour `fiche_vol`.

Revision ID: 0066
Revises: 0065
Create Date: 2026-09-16
"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import context, op

revision = "0066"
down_revision = "0065"
branch_labels = None
depends_on = None


def _require_no_base_principale(conn) -> None:
    if context.is_offline_mode():
        return
    n = conn.execute(
        sa.text("SELECT count(*) FROM base_aerienne WHERE parent_base_id IS NULL")
    ).scalar()
    if n:
        raise RuntimeError(
            f"Migration 0066 : {n} base(s) aérienne(s) principale(s) existent déjà sans "
            "équipe aérienne assignée. Créez d'abord les équipes correspondantes et "
            "backfillez `base_aerienne.equipe_id` à la main, puis relancez cette "
            "migration — voir sa docstring pour le détail."
        )


def upgrade() -> None:
    conn = op.get_bind()

    # ==========================================
    # equipe_aerienne
    # ==========================================
    op.create_table(
        "equipe_aerienne",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("nom", sa.String(255), nullable=False),
        sa.Column("chef_de_base_id", UUID(as_uuid=True), nullable=False),
        sa.Column("actif", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["chef_de_base_id"],
            ["utilisateur.id"],
            name="fk_equipe_aerienne_chef_de_base_id",
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint("chef_de_base_id", name="uq_equipe_aerienne_chef_de_base_id"),
    )
    op.execute(
        "COMMENT ON TABLE equipe_aerienne IS "
        "'Une equipe = un chef de base (UNIQUE chef_de_base_id) = une base aerienne "
        "principale (UNIQUE base_aerienne.equipe_id). Une base secondaire herite de "
        "l''equipe de sa principale via parent_base_id, elle ne porte pas sa propre "
        "equipe_id (cf. ck_base_aerienne_equipe_coherente).'"
    )

    # ==========================================
    # base_aerienne.equipe_id
    # ==========================================
    op.add_column("base_aerienne", sa.Column("equipe_id", UUID(as_uuid=True), nullable=True))

    _require_no_base_principale(conn)

    op.create_foreign_key(
        "fk_base_aerienne_equipe_id",
        "base_aerienne",
        "equipe_aerienne",
        ["equipe_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_unique_constraint("uq_base_aerienne_equipe_id", "base_aerienne", ["equipe_id"])
    op.create_check_constraint(
        "ck_base_aerienne_equipe_coherente",
        "base_aerienne",
        "(parent_base_id IS NULL AND equipe_id IS NOT NULL) OR "
        "(parent_base_id IS NOT NULL AND equipe_id IS NULL)",
    )


def downgrade() -> None:
    op.drop_constraint("ck_base_aerienne_equipe_coherente", "base_aerienne", type_="check")
    op.drop_constraint("uq_base_aerienne_equipe_id", "base_aerienne", type_="unique")
    op.drop_constraint("fk_base_aerienne_equipe_id", "base_aerienne", type_="foreignkey")
    op.drop_column("base_aerienne", "equipe_id")
    op.drop_table("equipe_aerienne")
