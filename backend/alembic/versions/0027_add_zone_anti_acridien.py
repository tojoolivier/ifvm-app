"""add zone_anti_acridien (ZA), region/district/commune, and purge demo referentiel data

ZA (Zone Anti-Acridienne) est le niveau organisationnel au-dessus du poste acridien : un ZA
regroupe plusieurs PA (ex: ZA "Befandriana sud" -> PA "Ankaraobato", "Tanandava").

Commune/district/region ne sont pas fonctionnellement dépendants du PA (un PA peut couvrir
plusieurs régions administratives, ex: PA "Amboasary" a des stations en Androy ET Anosy) : la
dépendance réelle est station -> commune -> district -> region (hiérarchie administrative de
Madagascar, déjà documentée dans CONTEXT.md). C'est une donnée de référence stable (une station
fixe ne change pas de commune), pas un instantané d'événement comme prospection.region /
traitement.region (qui restent du texte libre à dessein, pour figer la valeur au moment de la
fiche) : on la normalise en trois tables plutôt que de dupliquer le texte sur chaque station, pour
éviter l'anomalie de mise à jour (renommer un district ne doit toucher qu'une ligne).

Les données de poste_acridien/station_fixe existantes sont des fixtures de démo intégralement
remplacées par l'import du référentiel réel (backend/app/fixtures.py) : elles sont purgées ici
plutôt que migrées, y compris les prospections de démo qui les référencent (station_id remis à
NULL, FK nullable — cf. 0004_add_referentiel_station.py). La purge est isolée dans cette révision
(qui commit avant 0028) car `station_fixe` porte une FK déférée depuis `prospection.station_id`
(DEFERRABLE INITIALLY DEFERRED) : Postgres refuse un ALTER TABLE sur `station_fixe` tant que le
trigger déféré du DELETE de cette même transaction n'est pas encore résolu.

Revision ID: 0027
Revises: 0026
Create Date: 2026-08-24

"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision = "0027"
down_revision = "0026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "zone_anti_acridien",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("code", sa.Text(), nullable=False, unique=True),
        sa.Column("nom", sa.Text(), nullable=False),
        sa.Column("actif", sa.Boolean(), nullable=False, server_default="true"),
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
    )

    op.create_table(
        "region",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("nom", sa.Text(), nullable=False, unique=True),
    )

    op.create_table(
        "district",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("nom", sa.Text(), nullable=False),
        sa.Column("region_id", UUID(as_uuid=True), sa.ForeignKey("region.id"), nullable=False),
        sa.UniqueConstraint("region_id", "nom", name="uq_district_region_id_nom"),
    )
    op.create_index("ix_district_region_id", "district", ["region_id"])

    op.create_table(
        "commune",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("nom", sa.Text(), nullable=False),
        sa.Column("district_id", UUID(as_uuid=True), sa.ForeignKey("district.id"), nullable=False),
        sa.UniqueConstraint("district_id", "nom", name="uq_commune_district_id_nom"),
    )
    op.create_index("ix_commune_district_id", "commune", ["district_id"])

    # Fixtures de démo intégralement remplacées par le référentiel réel : on purge plutôt que
    # de tenter un backfill de za_id/commune_id sur des données jetables.
    op.execute("UPDATE prospection SET station_id = NULL WHERE station_id IS NOT NULL")
    op.execute("DELETE FROM station_fixe")
    op.execute("DELETE FROM poste_acridien")


def downgrade() -> None:
    op.drop_index("ix_commune_district_id", table_name="commune")
    op.drop_table("commune")
    op.drop_index("ix_district_region_id", table_name="district")
    op.drop_table("district")
    op.drop_table("region")

    op.drop_table("zone_anti_acridien")
