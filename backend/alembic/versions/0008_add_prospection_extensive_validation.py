"""add extensive/validation fields (station libre, signalement, conclusion) and
aggregated population fields (captures par phénotype, densités larves)

Revision ID: 0008
Revises: 0007
Create Date: 2026-08-03

"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ==========================================
    # prospection — Références (A) + Observations (D) + signalement/conclusion
    # ==========================================
    op.add_column("prospection", sa.Column("station_libre", sa.Text(), nullable=True))
    op.add_column("prospection", sa.Column("type_station", sa.Text(), nullable=True))
    op.add_column("prospection", sa.Column("verdure_strate", sa.Text(), nullable=True))
    op.add_column("prospection", sa.Column("signalement_source", sa.Text(), nullable=True))
    op.add_column("prospection", sa.Column("signalement_date", sa.Text(), nullable=True))
    op.add_column("prospection", sa.Column("signalement_description", sa.Text(), nullable=True))
    op.add_column("prospection", sa.Column("conclusion_validation", sa.Text(), nullable=True))

    op.create_check_constraint(
        "ck_prospection_type_station",
        "prospection",
        "type_station IN ('riziere_bordure','bas_fond','plateau','jachere','culture')",
    )
    op.create_check_constraint(
        "ck_prospection_verdure_strate",
        "prospection",
        "verdure_strate IN ('faible','moyenne','forte')",
    )
    op.create_check_constraint(
        "ck_prospection_conclusion_validation",
        "prospection",
        "conclusion_validation IN ('confirmee','infirmee')",
    )

    # ==========================================
    # prospection_population — Imagos (B) et Larves (C) extensives agrégées
    # ==========================================
    pop_table = "prospection_population"
    op.add_column(pop_table, sa.Column("captures_sol", sa.Integer(), nullable=True))
    op.add_column(pop_table, sa.Column("captures_trans", sa.Integer(), nullable=True))
    op.add_column(pop_table, sa.Column("captures_greg", sa.Integer(), nullable=True))
    op.add_column(pop_table, sa.Column("stade_imago", sa.Text(), nullable=True))
    op.add_column(pop_table, sa.Column("essaim_observe", sa.Boolean(), nullable=True))
    op.add_column(pop_table, sa.Column("densites_larve", JSONB(), nullable=True))
    op.add_column(pop_table, sa.Column("tache_larvaire", sa.Boolean(), nullable=True))
    op.add_column(pop_table, sa.Column("bande_larvaire", sa.Boolean(), nullable=True))
    op.add_column(pop_table, sa.Column("interdistance", sa.Numeric(), nullable=True))
    op.add_column(pop_table, sa.Column("deplacement", sa.Text(), nullable=True))

    op.create_check_constraint(
        "ck_prospection_population_stade_imago",
        "prospection_population",
        "stade_imago IN ('A1','A2','A3','A4','A5')",
    )
    op.create_check_constraint(
        "ck_prospection_population_deplacement",
        "prospection_population",
        "deplacement IN ('repos','perchee')",
    )


def downgrade() -> None:
    pop_table = "prospection_population"
    op.drop_constraint("ck_prospection_population_deplacement", pop_table, type_="check")
    op.drop_constraint("ck_prospection_population_stade_imago", pop_table, type_="check")
    op.drop_column("prospection_population", "deplacement")
    op.drop_column("prospection_population", "interdistance")
    op.drop_column("prospection_population", "bande_larvaire")
    op.drop_column("prospection_population", "tache_larvaire")
    op.drop_column("prospection_population", "densites_larve")
    op.drop_column("prospection_population", "essaim_observe")
    op.drop_column("prospection_population", "stade_imago")
    op.drop_column("prospection_population", "captures_greg")
    op.drop_column("prospection_population", "captures_trans")
    op.drop_column("prospection_population", "captures_sol")

    op.drop_constraint("ck_prospection_conclusion_validation", "prospection", type_="check")
    op.drop_constraint("ck_prospection_verdure_strate", "prospection", type_="check")
    op.drop_constraint("ck_prospection_type_station", "prospection", type_="check")
    op.drop_column("prospection", "conclusion_validation")
    op.drop_column("prospection", "signalement_description")
    op.drop_column("prospection", "signalement_date")
    op.drop_column("prospection", "signalement_source")
    op.drop_column("prospection", "verdure_strate")
    op.drop_column("prospection", "type_station")
    op.drop_column("prospection", "station_libre")
