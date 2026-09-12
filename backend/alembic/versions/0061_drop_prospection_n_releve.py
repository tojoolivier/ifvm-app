"""prospection : supprime la colonne n_releve (numéro de relevé)

Le "numéro de relevé" (généré côté mobile par `generateNumeroReleve`,
uniquement pour la prospection intensive — l'extensif ne l'a jamais
renseigné) n'est plus affiché nulle part côté mobile ni frontend web et
n'était qu'une donnée dérivée nullable, jamais une clé ni une référence
d'une autre table : sûr à retirer sans plan de réécriture.

`ix_prospection_n_releve` (créée par la migration 0005) est supprimée avant
la colonne.

Downgrade : restaure la colonne et l'index, vides (aucune reconstruction de
l'historique des numéros de relevé — dérivable uniquement depuis
station_id + date_prospection au moment de la saisie, pas depuis l'état
actuel de la table).

Revision ID: 0061
Revises: 0060
Create Date: 2026-09-12

"""

import sqlalchemy as sa

from alembic import op

revision = "0061"
down_revision = "0060"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index("ix_prospection_n_releve", table_name="prospection", if_exists=True)
    op.drop_column("prospection", "n_releve")


def downgrade() -> None:
    op.add_column("prospection", sa.Column("n_releve", sa.Text(), nullable=True))
    op.create_index("ix_prospection_n_releve", "prospection", ["n_releve"])
