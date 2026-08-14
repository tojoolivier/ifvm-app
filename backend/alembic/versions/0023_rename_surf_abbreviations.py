"""rename surf_* abbreviations to full surface_* form for naming consistency

Revision ID: 0023
Revises: 0022
Create Date: 2026-08-14

"""

from alembic import op

revision = "0023"
down_revision = "0022"
branch_labels = None
depends_on = None

RENAMES = [
    ("prospection", "surf_station", "surface_station"),
    ("prospection", "surf_prospectee", "surface_prospectee"),
    ("prospection", "surf_infestee", "surface_infestee"),
    ("prospection_infestation", "surface_tot", "surface_totale"),
    ("prospection_infestation_larve", "surf_infestee_pourcent", "surface_infestee_pourcent"),
]


def upgrade() -> None:
    for table, old_name, new_name in RENAMES:
        op.alter_column(table, old_name, new_column_name=new_name)


def downgrade() -> None:
    for table, old_name, new_name in RENAMES:
        op.alter_column(table, new_name, new_column_name=old_name)
