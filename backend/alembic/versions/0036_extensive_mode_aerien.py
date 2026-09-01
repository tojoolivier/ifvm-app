"""extensive: mode aérien (info équipe/aéronef + opérations aériennes 1-N)

Ajoute un mode aérien à la fiche de prospection extensive, en plus du mode
terrestre existant (comportement inchangé).

- `prospection.mode_extensif` : colonne nullable de plus, même pattern que
  `station_libre`/`type_station`/`verdure_strate` (migration 0008) — un axe
  orthogonal à `type_prospection`, pas une nouvelle valeur de cet enum. NULL sur
  toute fiche déjà enregistrée, traité comme terrestre côté application : aucun
  backfill, aucune fiche existante ne devient invalide ou ne réclame les nouveaux
  champs.
- 7 colonnes équipe/aéronef sur `prospection` : un seul jeu par fiche (non
  répétable), donc colonnes nullables directes comme `station_libre` — pas de
  table 1-1 séparée, cohérent avec le seul précédent déjà en place dans cette
  table pour ce type de données extensif-only.
- `prospection_operation_aerienne` : table enfant 1-N, miroir structurel de
  `traitement_rotation` (migration 0010) — `numero` assigné côté application,
  `UNIQUE(prospection_id, numero)`, `ON DELETE CASCADE`. `duree_minutes` est
  calculée (jamais saisie) et stockée à l'écriture plutôt que recalculée à
  chaque lecture : la formule ne dépend que de début/fin, un seul point
  d'écriture (mobile et backend appliquent la même règle), et ça évite de
  reparser `HH:MM` à chaque rendu de liste/récapitulatif.

Revision ID: 0036
Revises: 0035
Create Date: 2026-09-01

"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision = "0036"
down_revision = "0035"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ==========================================
    # prospection — mode extensif + équipe/aéronef
    # ==========================================
    op.add_column("prospection", sa.Column("mode_extensif", sa.Text(), nullable=True))
    op.add_column("prospection", sa.Column("societe", sa.Text(), nullable=True))
    op.add_column("prospection", sa.Column("immatricule_aeronef", sa.Text(), nullable=True))
    op.add_column("prospection", sa.Column("pilote", sa.Text(), nullable=True))
    op.add_column("prospection", sa.Column("mecanicien", sa.Text(), nullable=True))
    op.add_column("prospection", sa.Column("chef_de_base", sa.Text(), nullable=True))
    op.add_column("prospection", sa.Column("base", sa.Text(), nullable=True))
    op.add_column("prospection", sa.Column("base_secondaire", sa.Text(), nullable=True))

    op.create_check_constraint(
        "ck_prospection_mode_extensif",
        "prospection",
        "mode_extensif IN ('terrestre','aerien')",
    )

    # ==========================================
    # TABLE PROSPECTION_OPERATION_AERIENNE (1-N, mode aérien)
    # ==========================================
    op.create_table(
        "prospection_operation_aerienne",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column(
            "prospection_id",
            UUID(as_uuid=True),
            sa.ForeignKey("prospection.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("numero", sa.Integer(), nullable=False),
        sa.Column("type_operation", sa.Text(), nullable=False),
        sa.Column("debut_heure", sa.Text(), nullable=False),
        sa.Column("debut_temperature_c", sa.Numeric(5, 2), nullable=True),
        sa.Column("debut_vent_ms", sa.Numeric(5, 2), nullable=True),
        sa.Column("fin_heure", sa.Text(), nullable=False),
        sa.Column("fin_temperature_c", sa.Numeric(5, 2), nullable=True),
        sa.Column("fin_vent_ms", sa.Numeric(5, 2), nullable=True),
        sa.Column("duree_minutes", sa.Integer(), nullable=False),
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
        sa.CheckConstraint(
            "type_operation IN ('convoyage','prospection','divers')",
            name="ck_prospection_operation_aerienne_type",
        ),
        sa.CheckConstraint(
            r"debut_heure ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'",
            name="ck_prospection_operation_aerienne_debut_heure",
        ),
        sa.CheckConstraint(
            r"fin_heure ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'",
            name="ck_prospection_operation_aerienne_fin_heure",
        ),
        sa.UniqueConstraint(
            "prospection_id", "numero", name="uq_prospection_operation_aerienne_numero"
        ),
    )
    op.create_index(
        "ix_prospection_operation_aerienne_prospection_id",
        "prospection_operation_aerienne",
        ["prospection_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_prospection_operation_aerienne_prospection_id",
        table_name="prospection_operation_aerienne",
    )
    op.drop_table("prospection_operation_aerienne")

    op.drop_constraint("ck_prospection_mode_extensif", "prospection", type_="check")
    op.drop_column("prospection", "base_secondaire")
    op.drop_column("prospection", "base")
    op.drop_column("prospection", "chef_de_base")
    op.drop_column("prospection", "mecanicien")
    op.drop_column("prospection", "pilote")
    op.drop_column("prospection", "immatricule_aeronef")
    op.drop_column("prospection", "societe")
    op.drop_column("prospection", "mode_extensif")
