"""update type_station constraint to match biotope

Revision ID: 0025
Revises: 0024
Create Date: 2026-08-22

"""

import sqlalchemy as sa
from alembic import op

revision = "0025"
down_revision = "0024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint(
        "ck_prospection_type_station",
        "prospection",
        type_="check",
    )
    
    op.create_check_constraint(
        "ck_prospection_type_station",
        "prospection",
        "type_station IN ('xerophyle', 'mesophyle', 'hydrophyle')",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_prospection_type_station",
        "prospection",
        type_="check",
    )
    
    op.create_check_constraint(
        "ck_prospection_type_station",
        "prospection",
        "type_station IN ('riziere_bordure','bas_fond','plateau','jachere','culture')",
    )