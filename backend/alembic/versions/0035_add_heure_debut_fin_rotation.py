"""add heure_debut/heure_fin to traitement_rotation

Chaque rotation aérienne portait déjà température début/fin et vitesse du vent
début/fin ; heure_debut/heure_fin manquaient au même niveau de détail (l'écran
mobile n'affichait ni labels explicites, ni ces deux champs).

Colonnes ajoutées NOT NULL avec un server_default temporaire (une minute d'écart,
pour satisfaire d'emblée la contrainte heure_fin > heure_debut sur les lignes
existantes) puis retiré — même patron que `traitement_terrestre.heure_debut/
heure_fin` (migration 0010), contrainte CHECK incluse.

Revision ID: 0035
Revises: 0034
Create Date: 2026-08-31

"""

from alembic import op
import sqlalchemy as sa

revision = "0035"
down_revision = "0034"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "traitement_rotation",
        sa.Column("heure_debut", sa.Time(), nullable=False, server_default="00:00:00"),
    )
    op.add_column(
        "traitement_rotation",
        sa.Column("heure_fin", sa.Time(), nullable=False, server_default="00:01:00"),
    )
    op.alter_column("traitement_rotation", "heure_debut", server_default=None)
    op.alter_column("traitement_rotation", "heure_fin", server_default=None)

    op.create_check_constraint(
        "ck_traitement_rotation_heures",
        "traitement_rotation",
        "heure_fin > heure_debut",
    )


def downgrade() -> None:
    op.drop_constraint("ck_traitement_rotation_heures", "traitement_rotation", type_="check")
    op.drop_column("traitement_rotation", "heure_fin")
    op.drop_column("traitement_rotation", "heure_debut")
