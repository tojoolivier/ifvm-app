"""add referentiel station fixe and poste acridien

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-25

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "poste_acridien",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("code", sa.Text(), nullable=False, unique=True),
        sa.Column("nom", sa.Text(), nullable=False),
        sa.Column("region", sa.Text(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "station_fixe",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("code", sa.Text(), nullable=False, unique=True),
        sa.Column("nom", sa.Text(), nullable=False),
        sa.Column("pa_id", UUID(as_uuid=True), sa.ForeignKey("poste_acridien.id"), nullable=False),
        sa.Column("latitude", sa.Numeric(), nullable=False),
        sa.Column("longitude", sa.Numeric(), nullable=False),
        sa.Column("altitude", sa.Numeric(), nullable=True),
        sa.Column("actif", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_station_fixe_pa_id", "station_fixe", ["pa_id"])

    op.create_foreign_key(
        "fk_prospection_station_id",
        "prospection",
        "station_fixe",
        ["station_id"],
        ["id"],
        deferrable=True,
        initially="deferred",
    )


def downgrade() -> None:
    op.drop_constraint("fk_prospection_station_id", "prospection", type_="foreignkey")
    op.drop_index("ix_station_fixe_pa_id", table_name="station_fixe")
    op.drop_table("station_fixe")
    op.drop_table("poste_acridien")
