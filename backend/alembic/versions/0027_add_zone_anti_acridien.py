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
NULL, FK nullable — cf. 0004_add_referentiel_station.py). `station_fixe` porte une FK déférée
depuis `prospection.station_id` (DEFERRABLE INITIALLY DEFERRED) : le DELETE déclenche ce trigger,
qui ne se résout qu'au COMMIT. Alembic exécute toutes les révisions d'un `upgrade` dans une seule
transaction (cf. env.py) — scinder la purge en 0027 et l'ALTER en 0028 ne crée donc PAS de commit
intermédiaire à soi seul. La purge est exécutée dans un `autocommit_block()` ci-dessous pour
forcer ce commit avant que 0028 n'altère `station_fixe`.

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
    #
    # autocommit_block() : le DELETE sur station_fixe déclenche le trigger différé de la FK
    # prospection.station_id (DEFERRABLE INITIALLY DEFERRED), qui ne se résout qu'au COMMIT.
    # Sans commit explicite ici, ce trigger reste en attente jusqu'à la fin de TOUTE la
    # transaction alembic (0027 + 0028 partagent la même transaction), et l'ALTER TABLE
    # station_fixe de 0028 échoue avec ObjectInUseError. Découper en deux révisions ne suffit
    # pas : il faut un vrai commit intermédiaire.
    with op.get_context().autocommit_block():
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
