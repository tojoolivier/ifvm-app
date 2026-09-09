"""traitement_aerien : date d'installation du Stand et de la Base secondaire

Slide « Équipe » (Traitement Aérien uniquement) — ajoute, à côté des champs
texte libre `stand`/`base_secondaire` (migration 0054), une date facultative
et indépendante pour chacun : `stand_date_installation`/
`base_secondaire_date_installation`. Aucun champ équivalent pour
`base_principale` (hors périmètre, #stand-base-secondaire-date-installation) ;
Traitement Terrestre et Prospection non concernés.

Migration additive pure (2 colonnes nullable) : aucune colonne existante
touchée, aucune fiche déjà en base affectée (dates NULL par défaut, jamais
une date effacée ou remplacée), downgrade = DROP COLUMN sans perte pour les
fiches qui n'avaient pas encore ces champs.

Revision ID: 0056
Revises: 0055
Create Date: 2026-09-09

"""

import sqlalchemy as sa

from alembic import op

revision = "0056"
down_revision = "0055"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "traitement_aerien", sa.Column("stand_date_installation", sa.Date(), nullable=True)
    )
    op.add_column(
        "traitement_aerien",
        sa.Column("base_secondaire_date_installation", sa.Date(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("traitement_aerien", "base_secondaire_date_installation")
    op.drop_column("traitement_aerien", "stand_date_installation")
