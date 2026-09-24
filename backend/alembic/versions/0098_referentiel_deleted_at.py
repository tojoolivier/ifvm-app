"""Référentiel : soft-delete `deleted_at` (#674)

Le pull incrémental (`since=`) ne transporte que des upserts : un DELETE physique resterait
sur les téléphones déjà synchronisés et casserait les FK RESTRICT depuis l'historique
(vols, traitements). On ajoute donc `deleted_at TIMESTAMPTZ NULL` sur chaque table de
référentiel synchronisée ; `actif=false` garde son sens « désactivé, restaurable ».

Modèle (relational-and-schema-design) : attribut monovalué, dépend uniquement de la clé
de chaque table → 3NF respectée, pas de nouvelle table. NULL = ligne vivante.

Revision ID: 0098
Revises: 0097
Create Date: 2026-09-24
"""

import sqlalchemy as sa

from alembic import op

revision = "0098"
down_revision = "0097"
branch_labels = None
depends_on = None

TABLES = (
    "zone_anti_acridien",
    "poste_acridien",
    "station_fixe",
    "lieu_aerien",
    "aeronef",
    "equipe",
    "equipe_aeronef",
    "site_aerienne",
    "pesticide",
    "culture",
    "code_stade",
    "campagne",
)


def upgrade() -> None:
    for table in TABLES:
        op.add_column(table, sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True))


def downgrade() -> None:
    for table in reversed(TABLES):
        op.drop_column(table, "deleted_at")
