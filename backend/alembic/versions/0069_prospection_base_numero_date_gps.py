"""prospection : Base principale (numero, date d'installation, GPS) + Base secondaire

La fiche de Prospection Extensive Aérienne n'avait qu'un champ `base`
(texte libre, la base principale du vol). Demande explicite : y ajouter un
numéro de base, une date d'installation et des coordonnées GPS capturées
sur place, puis ajouter une « Base secondaire » (texte libre) avec sa
propre date d'installation et ses propres coordonnées GPS — mêmes
libellés que `traitement_aerien.base_secondaire`/`stand_date_installation`
(migration 0054), mais avec des coordonnées GPS ici (jamais ajoutées côté
Traitement).

`base` (renommé "Base principale" côté affichage uniquement, colonne
inchangée pour ne pas invalider les fiches déjà synchronisées) reçoit son
numéro/date/coordonnées dans 4 nouvelles colonnes ; 4 colonnes
symétriques pour la base secondaire. Revient sur la décision documentée
en 0063 ("Pas de base secondaire côté prospection : ce concept n'existe
que pour le traitement") — demande explicite de l'ajouter.

Revision ID: 0069
Revises: 0068
Create Date: 2026-09-17

"""

import sqlalchemy as sa

from alembic import op

revision = "0069"
down_revision = "0068"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("prospection", sa.Column("base_numero", sa.Integer(), nullable=True))
    op.add_column("prospection", sa.Column("base_date_installation", sa.Date(), nullable=True))
    op.add_column("prospection", sa.Column("base_latitude", sa.Numeric(), nullable=True))
    op.add_column("prospection", sa.Column("base_longitude", sa.Numeric(), nullable=True))
    op.add_column("prospection", sa.Column("base_secondaire", sa.Text(), nullable=True))
    op.add_column(
        "prospection", sa.Column("base_secondaire_date_installation", sa.Date(), nullable=True)
    )
    op.add_column("prospection", sa.Column("base_secondaire_latitude", sa.Numeric(), nullable=True))
    op.add_column("prospection", sa.Column("base_secondaire_longitude", sa.Numeric(), nullable=True))


def downgrade() -> None:
    op.drop_column("prospection", "base_secondaire_longitude")
    op.drop_column("prospection", "base_secondaire_latitude")
    op.drop_column("prospection", "base_secondaire_date_installation")
    op.drop_column("prospection", "base_secondaire")
    op.drop_column("prospection", "base_longitude")
    op.drop_column("prospection", "base_latitude")
    op.drop_column("prospection", "base_date_installation")
    op.drop_column("prospection", "base_numero")
