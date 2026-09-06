"""traitement_aerien : chaînage de reprise (traitement_origine_id/reprise_traitement/surface_cumulee_ha)

Généralise à l'Aérien le mécanisme de reprise qui n'existait jusqu'ici que côté
Terrestre (`traitement_terrestre.traitement_origine_id`, migrations 0010/0013) :
une prospection dont la surface infestée n'a été que partiellement traitée par
une première fiche aérienne doit pouvoir être reprise par une fiche suivante,
plutôt que de rester bloquée ou de permettre une nouvelle fiche indépendante
qui ferait perdre le suivi du cumul déjà traité.

- `reprise_traitement` (bool, défaut false) + `traitement_origine_id` (auto-
  référence nullable vers `traitement.id`, jamais `traitement_aerien.id` —
  même convention que côté Terrestre : pointe vers la fiche précédente
  immédiate de la chaîne, pas vers la fiche racine).
- `surface_cumulee_ha` : NOT NULL défaut 0, contrairement à son équivalent
  Terrestre (nullable) — même choix que les autres champs dérivés de
  `traitement_aerien` depuis la migration 0047 (`total_pesticide_l/kg`,
  `surface_traitee_ha`) : single-writer, jamais NULL, recalculé à l'écriture
  par `TraitementAerien.recalculer_surfaces`.
- `ck_traitement_aerien_reprise` : mirroir exact de
  `ck_traitement_terrestre_reprise` — un `reprise_traitement=true` sans
  `traitement_origine_id` est une incohérence garantie impossible en base, pas
  seulement en application.
- Index unique partiel `uq_traitement_aerien_origine_id` (sur
  `traitement_origine_id IS NOT NULL`) : une fiche d'origine ne peut être
  désignée que par une seule fiche de reprise — chaîne linéaire garantie par
  la DB, mirroir de `uq_traitement_terrestre_origine_id` (migration 0013).

Revision ID: 0050
Revises: 0049
Create Date: 2026-09-06

"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision = "0050"
down_revision = "0049"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "traitement_aerien",
        sa.Column("reprise_traitement", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "traitement_aerien",
        sa.Column(
            "traitement_origine_id",
            UUID(as_uuid=True),
            sa.ForeignKey("traitement.id"),
            nullable=True,
        ),
    )
    op.add_column(
        "traitement_aerien",
        sa.Column("surface_cumulee_ha", sa.Numeric(10, 2), nullable=False, server_default="0"),
    )
    op.create_check_constraint(
        "ck_traitement_aerien_reprise",
        "traitement_aerien",
        "NOT reprise_traitement OR traitement_origine_id IS NOT NULL",
    )
    op.create_index(
        "ix_traitement_aerien_traitement_origine_id",
        "traitement_aerien",
        ["traitement_origine_id"],
    )
    op.create_index(
        "uq_traitement_aerien_origine_id",
        "traitement_aerien",
        ["traitement_origine_id"],
        unique=True,
        postgresql_where=sa.text("traitement_origine_id IS NOT NULL"),
    )
    op.execute(
        """
        COMMENT ON COLUMN traitement_aerien.traitement_origine_id
        IS 'Auto-reference vers traitement.id (pas traitement_aerien.id) : pointe vers la
        fiche precedente immediate en cas de reprise (liste chainee), pas vers la fiche
        racine de la zone - mirroir de traitement_terrestre.traitement_origine_id'
        """
    )
    op.execute(
        """
        COMMENT ON COLUMN traitement_aerien.surface_cumulee_ha
        IS 'Derive = surface_traitee_ha + surface_cumulee_ha de la fiche origine (si
        reprise_traitement), sinon = surface_traitee_ha - alimente par l''application,
        jamais NULL (contrairement a son equivalent Terrestre, cf. migration 0047)'
        """
    )


def downgrade() -> None:
    op.drop_index("uq_traitement_aerien_origine_id", table_name="traitement_aerien")
    op.drop_index("ix_traitement_aerien_traitement_origine_id", table_name="traitement_aerien")
    op.drop_constraint("ck_traitement_aerien_reprise", "traitement_aerien", type_="check")
    op.drop_column("traitement_aerien", "surface_cumulee_ha")
    op.drop_column("traitement_aerien", "traitement_origine_id")
    op.drop_column("traitement_aerien", "reprise_traitement")
