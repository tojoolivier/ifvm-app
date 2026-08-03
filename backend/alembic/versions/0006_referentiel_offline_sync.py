"""referentiel offline sync: updated_at/actif on referentiel tables, pesticide/culture/code_stade

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-02

"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "poste_acridien",
        sa.Column("actif", sa.Boolean(), nullable=False, server_default="true"),
    )
    op.add_column(
        "poste_acridien",
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.add_column(
        "station_fixe",
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.add_column(
        "utilisateur",
        sa.Column("pa_id", UUID(as_uuid=True), sa.ForeignKey("poste_acridien.id"), nullable=True),
    )
    op.add_column(
        "utilisateur",
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    op.create_table(
        "pesticide",
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
        "culture",
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
        "code_stade",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("code", sa.Text(), nullable=False, unique=True),
        sa.Column("espece", sa.Text(), nullable=False),
        sa.Column("libelle", sa.Text(), nullable=False),
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


def downgrade() -> None:
    op.drop_table("code_stade")
    op.drop_table("culture")
    op.drop_table("pesticide")
    op.drop_column("utilisateur", "updated_at")
    op.drop_column("utilisateur", "pa_id")
    op.drop_column("station_fixe", "updated_at")
    op.drop_column("poste_acridien", "updated_at")
    op.drop_column("poste_acridien", "actif")
