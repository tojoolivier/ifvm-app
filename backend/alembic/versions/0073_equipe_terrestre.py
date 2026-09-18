"""equipe_terrestre : équipe terrestre (chef + membres), rattachement poste_acridien

Demande utilisateur (2026-09-18) : pouvoir regrouper/filtrer le personnel et les
postes/stations acridiens par équipe, sur le même principe que l'équipe aérienne
(migrations 0066/0072) mais côté terrestre.

## Cardinalités (confirmées avec l'utilisateur)

- 1 équipe terrestre = 1 chef d'équipe (rôle `chef_equipe`, déjà un rôle backend
  existant) : `equipe_terrestre.chef_equipe_id` UNIQUE — un chef ne dirige qu'une
  équipe, même règle que `equipe_aerienne.chef_de_base_id`.
- Une équipe terrestre porte un nombre variable d'« autres membres » — table fille
  `equipe_terrestre_membre` (`ON DELETE CASCADE`), même patron que
  `equipe_aerienne_membre` (migration 0072) : un texte concaténé violerait la 1FN
  (repeating group), une table fille permet d'identifier/supprimer chaque membre
  individuellement.
- `poste_acridien.equipe_terrestre_id` (nullable, FK simple) : **pas d'UNIQUE**,
  contrairement à `base_aerienne.equipe_id`. Une équipe terrestre est une équipe
  mobile qui peut couvrir plusieurs postes d'une même zone anti-acridienne — la
  relation est plusieurs postes : une équipe, pas 1:1 comme côté aérien (où une
  équipe correspond à une base physique unique).

Revision ID: 0073
Revises: 0072
Create Date: 2026-09-18

"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision = "0073"
down_revision = "0072"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ==========================================
    # equipe_terrestre
    # ==========================================
    op.create_table(
        "equipe_terrestre",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("nom", sa.String(255), nullable=False),
        sa.Column("chef_equipe_id", UUID(as_uuid=True), nullable=False),
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
            ["chef_equipe_id"],
            ["utilisateur.id"],
            name="fk_equipe_terrestre_chef_equipe_id",
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint("chef_equipe_id", name="uq_equipe_terrestre_chef_equipe_id"),
    )
    op.execute(
        "COMMENT ON TABLE equipe_terrestre IS "
        "'Une equipe terrestre = un chef d''equipe (UNIQUE chef_equipe_id, role "
        "chef_equipe). Plusieurs postes acridiens peuvent partager la meme equipe "
        "(poste_acridien.equipe_terrestre_id, pas d''UNIQUE) : une equipe terrestre "
        "est mobile, contrairement a l''equipe aerienne rattachee a une base unique.'"
    )

    op.create_table(
        "equipe_terrestre_membre",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "equipe_terrestre_id",
            UUID(as_uuid=True),
            sa.ForeignKey("equipe_terrestre.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("nom", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_equipe_terrestre_membre_equipe_terrestre_id",
        "equipe_terrestre_membre",
        ["equipe_terrestre_id"],
    )

    # ==========================================
    # poste_acridien.equipe_terrestre_id
    # ==========================================
    op.add_column(
        "poste_acridien", sa.Column("equipe_terrestre_id", UUID(as_uuid=True), nullable=True)
    )
    op.create_foreign_key(
        "fk_poste_acridien_equipe_terrestre_id",
        "poste_acridien",
        "equipe_terrestre",
        ["equipe_terrestre_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index(
        "ix_poste_acridien_equipe_terrestre_id", "poste_acridien", ["equipe_terrestre_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_poste_acridien_equipe_terrestre_id", table_name="poste_acridien")
    op.drop_constraint(
        "fk_poste_acridien_equipe_terrestre_id", "poste_acridien", type_="foreignkey"
    )
    op.drop_column("poste_acridien", "equipe_terrestre_id")

    op.drop_index(
        "ix_equipe_terrestre_membre_equipe_terrestre_id", table_name="equipe_terrestre_membre"
    )
    op.drop_table("equipe_terrestre_membre")
    op.drop_table("equipe_terrestre")
