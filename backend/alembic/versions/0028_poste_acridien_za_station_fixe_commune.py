"""poste_acridien.za_id, drop poste_acridien.region, station_fixe.commune_id

Suite de 0027 (séparée pour laisser le DELETE de 0027 commit avant cet ALTER TABLE — cf. note
dans 0027 sur la FK déférée prospection.station_id -> station_fixe.id).

Revision ID: 0028
Revises: 0027
Create Date: 2026-08-24

"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision = "0028"
down_revision = "0027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("poste_acridien", "region")
    op.add_column("poste_acridien", sa.Column("za_id", UUID(as_uuid=True), nullable=False))
    op.create_foreign_key(
        "fk_poste_acridien_za_id", "poste_acridien", "zone_anti_acridien", ["za_id"], ["id"]
    )
    op.create_index("ix_poste_acridien_za_id", "poste_acridien", ["za_id"])

    op.add_column("station_fixe", sa.Column("commune_id", UUID(as_uuid=True), nullable=False))
    op.create_foreign_key(
        "fk_station_fixe_commune_id", "station_fixe", "commune", ["commune_id"], ["id"]
    )
    op.create_index("ix_station_fixe_commune_id", "station_fixe", ["commune_id"])


def downgrade() -> None:
    op.drop_index("ix_station_fixe_commune_id", table_name="station_fixe")
    op.drop_constraint("fk_station_fixe_commune_id", "station_fixe", type_="foreignkey")
    op.drop_column("station_fixe", "commune_id")

    op.drop_index("ix_poste_acridien_za_id", table_name="poste_acridien")
    op.drop_constraint("fk_poste_acridien_za_id", "poste_acridien", type_="foreignkey")
    op.drop_column("poste_acridien", "za_id")
    op.add_column("poste_acridien", sa.Column("region", sa.Text(), nullable=True))
