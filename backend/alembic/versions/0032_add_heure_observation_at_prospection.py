"""add heure_observation_at to prospection

L'écran Observations (mobile) renseigne désormais automatiquement une « heure
d'observation » au moment où la position GPS est acquise sur cet écran — un
horodatage complet (date + heure + fuseau), distinct de
`prospection_infestation_imago.heure_observation` (un HH:mm saisi/déduit par
cible d'infestation, sans lien avec le GPS). L'heure HH:mm affichée à l'agent
est dérivée de ce timestamp à la lecture, jamais stockée séparément.

Revision ID: 0032
Revises: 0031
Create Date: 2026-08-25

"""

import sqlalchemy as sa

from alembic import op

revision = "0032"
down_revision = "0031"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "prospection",
        sa.Column("heure_observation_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("prospection", "heure_observation_at")
