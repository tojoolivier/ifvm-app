"""add captures_solitaro_transiens to prospection_population

Revision ID: 0025
Revises: 0024
Create Date: 2026-08-19

"""

import sqlalchemy as sa
from alembic import op

revision = "0025"
down_revision = "0024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "prospection_population",
        sa.Column("captures_solitaro_transiens", sa.Integer(), nullable=True)
    )
    
    op.execute("""
        COMMENT ON COLUMN prospection_population.captures_solitaro_transiens
        IS 'Nombre de captures de la phase Solitaro-Transiens (uniquement pour les imagos)'
    """)


def downgrade() -> None:
    op.drop_column("prospection_population", "captures_solitaro_transiens")