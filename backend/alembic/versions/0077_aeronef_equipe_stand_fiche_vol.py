"""aeronef (hélicoptère d'une équipe aérienne) + rattachement équipe des stands et des fiches de vol

Demande utilisateur (2026-09-19) : une équipe aérienne dispose d'un aéronef (hélicoptère) ;
seule l'équipe crée ses lieux aériens (bases, stands) ; à la création d'une fiche de vol on
choisit l'équipe, et les lieux proposés + chef de base, pilote, mécanicien, immatriculation
et société de l'hélicoptère se déduisent d'elle.

## Modèle ER (cardinalités confirmées avec l'utilisateur)

- `aeronef(id, immatriculation UNIQUE, societe, volume_cuve_l, actif)` : entité à part
  entière plutôt que trois colonnes sur `equipe_aerienne`. `immatriculation` identifie un
  appareil physique (clé candidate) et détermine `societe` et `volume_cuve_l` : les loger
  dans `equipe_aerienne` créerait la dépendance transitive
  `equipe → immatriculation → societe, volume_cuve` (violation de 3FN) et obligerait à
  écraser les valeurs de l'équipe pour changer d'appareil. Ici, chaque attribut dépend de la
  seule clé de sa table (BCNF).
- `equipe_aerienne.aeronef_id` : FK **UNIQUE**, nullable. 1:1 — une équipe a au plus un
  aéronef, un aéronef est affecté à au plus une équipe. Nullable : les équipes créées avant
  cette migration n'en ont pas ; `EquipeAerienneCreate` l'exige pour toute nouvelle équipe
  (même patron que `pilote`/`mecanicien`, migration 0072). `ON DELETE RESTRICT` : jamais de
  suppression, la sortie de service passe par `actif=false`.
- `stand_remplissage.equipe_aerienne_id` : FK nullable **sans UNIQUE** — une équipe possède
  plusieurs stands. Une base principale porte déjà son équipe (`base_aerienne.equipe_id`,
  migration 0066), une base secondaire l'hérite de sa principale : seuls les stands
  manquaient. Nullable : les stands existants restent « sans équipe » jusqu'à rattachement
  manuel (`PUT /stands-remplissage/{id}`, admin) ; obligatoire pour toute nouvelle création.
- `fiche_vol.equipe_aerienne_id` : FK nullable, sans UNIQUE (une équipe a plusieurs
  fiches). Nullable pour les fiches antérieures et les clients mobiles qui ne l'envoient pas
  encore.

## Ce qui est volontairement dupliqué

`fiche_vol.compagnie`/`immatriculation`/`pilote`/`mecanicien`/`consultant_international`/
`chef_de_base_id` **restent stockés sur la fiche** alors qu'ils se déduisent maintenant de
l'équipe : c'est le snapshot temporel déjà documenté sur `FicheVol` (une fiche ancienne doit
garder l'exploitant, le pilote et l'appareil *du jour*, même si l'équipe change d'hélicoptère
ou de pilote ensuite). Le serveur les renseigne depuis l'équipe à la création ; il ne les
recalcule jamais ensuite.

Revision ID: 0077
Revises: 0076
Create Date: 2026-09-19

Renumérotée 0075 -> 0077 (collision) : cette migration a été créée en parallèle de
`0075_traitement_terrestre_stock_initial.py`, fusionnée sur main entretemps avec le
même `down_revision="0074"`, qui a elle-même reçu `0076_traitement_moyens_humains_
materiels.py` à sa suite — même précédent que le rebase 0046->0047.
"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision = "0077"
down_revision = "0076"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "aeronef",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("immatriculation", sa.String(20), nullable=False),
        sa.Column("societe", sa.Text(), nullable=False),
        sa.Column("volume_cuve_l", sa.Numeric(8, 2), nullable=False),
        sa.Column("actif", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.UniqueConstraint("immatriculation", name="uq_aeronef_immatriculation"),
        sa.CheckConstraint("volume_cuve_l > 0", name="ck_aeronef_volume_cuve_positif"),
    )

    op.add_column("equipe_aerienne", sa.Column("aeronef_id", UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_equipe_aerienne_aeronef_id",
        "equipe_aerienne",
        "aeronef",
        ["aeronef_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_unique_constraint("uq_equipe_aerienne_aeronef_id", "equipe_aerienne", ["aeronef_id"])

    op.add_column(
        "stand_remplissage", sa.Column("equipe_aerienne_id", UUID(as_uuid=True), nullable=True)
    )
    op.create_foreign_key(
        "fk_stand_remplissage_equipe_aerienne_id",
        "stand_remplissage",
        "equipe_aerienne",
        ["equipe_aerienne_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index(
        "ix_stand_remplissage_equipe_aerienne_id", "stand_remplissage", ["equipe_aerienne_id"]
    )

    op.add_column("fiche_vol", sa.Column("equipe_aerienne_id", UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_fiche_vol_equipe_aerienne_id",
        "fiche_vol",
        "equipe_aerienne",
        ["equipe_aerienne_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index("ix_fiche_vol_equipe_aerienne_id", "fiche_vol", ["equipe_aerienne_id"])


def downgrade() -> None:
    op.drop_index("ix_fiche_vol_equipe_aerienne_id", table_name="fiche_vol")
    op.drop_constraint("fk_fiche_vol_equipe_aerienne_id", "fiche_vol", type_="foreignkey")
    op.drop_column("fiche_vol", "equipe_aerienne_id")

    op.drop_index("ix_stand_remplissage_equipe_aerienne_id", table_name="stand_remplissage")
    op.drop_constraint(
        "fk_stand_remplissage_equipe_aerienne_id", "stand_remplissage", type_="foreignkey"
    )
    op.drop_column("stand_remplissage", "equipe_aerienne_id")

    op.drop_constraint("uq_equipe_aerienne_aeronef_id", "equipe_aerienne", type_="unique")
    op.drop_constraint("fk_equipe_aerienne_aeronef_id", "equipe_aerienne", type_="foreignkey")
    op.drop_column("equipe_aerienne", "aeronef_id")

    op.drop_table("aeronef")
