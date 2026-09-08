"""traitement_aerien : base principale/stand/base secondaire redeviennent du texte libre

Défait la partie "lieux" de la migration 0047 — même décision produit, même
mécanique que la migration 0048 (pilote/mécanicien/consultant), déjà appliquée
pour la partie "personnes" de la 0047 : `lieu_base_principale_id`/
`lieu_stand_id`/`lieu_base_secondaire_id` (FK vers `lieu_aerien`) sont
remplacées par les colonnes texte libre `base_principale`/`stand`/
`base_secondaire`. L'utilisateur saisit directement la valeur, sans dépendre
du référentiel Web ni d'une synchronisation préalable.

`lieu_aerien` elle-même n'est PAS supprimée ni dépréciée : elle reste utilisée
par la prospection extensive aérienne (`prospection.lieu_base_id`), hors
périmètre de ce chantier (#traitement-aerien-base-texte-libre) — seul l'usage
sur `traitement_aerien` est défait, exactement comme la 0048 n'avait touché
que la partie "personnes" en laissant les 3 FK de lieux intactes à l'époque.

Backfill (upgrade) : `base_principale`/`stand`/`base_secondaire` sont remplies
depuis `lieu_aerien.nom` via les FK existantes avant que celles-ci ne soient
supprimées — aucune perte d'information pour les lignes déjà en base.
`base_principale` bascule en NOT NULL après ce backfill (obligatoire, comme
son équivalent FK l'était déjà).

Downgrade : ré-ajoute `lieu_base_principale_id`/`lieu_stand_id`/
`lieu_base_secondaire_id` (FK nullable, sans backfill — un nom en texte libre
ne redonne pas un id de façon fiable, même irréversibilité déjà acceptée par
le downgrade de la 0048 pour les personnes) ; NOT NULL sur la FK obligatoire
n'est pas restauré automatiquement (colonne NULL après downgrade), pour ne
pas échouer sur les lignes déjà écrites en texte libre entre-temps.

Revision ID: 0054
Revises: 0053
Create Date: 2026-09-08

"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision = "0054"
down_revision = "0053"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("traitement_aerien", sa.Column("base_principale", sa.String(255), nullable=True))
    op.add_column("traitement_aerien", sa.Column("stand", sa.String(255), nullable=True))
    op.add_column("traitement_aerien", sa.Column("base_secondaire", sa.String(255), nullable=True))

    op.execute(
        "UPDATE traitement_aerien ta SET base_principale = l.nom "
        "FROM lieu_aerien l WHERE l.id = ta.lieu_base_principale_id"
    )
    op.execute(
        "UPDATE traitement_aerien ta SET stand = l.nom "
        "FROM lieu_aerien l WHERE l.id = ta.lieu_stand_id"
    )
    op.execute(
        "UPDATE traitement_aerien ta SET base_secondaire = l.nom "
        "FROM lieu_aerien l WHERE l.id = ta.lieu_base_secondaire_id"
    )

    op.alter_column("traitement_aerien", "base_principale", nullable=False)

    op.drop_column("traitement_aerien", "lieu_stand_id")
    op.drop_column("traitement_aerien", "lieu_base_secondaire_id")
    op.drop_column("traitement_aerien", "lieu_base_principale_id")


def downgrade() -> None:
    op.add_column(
        "traitement_aerien",
        sa.Column(
            "lieu_base_principale_id",
            UUID(as_uuid=True),
            sa.ForeignKey("lieu_aerien.id"),
            nullable=True,
        ),
    )
    op.add_column(
        "traitement_aerien",
        sa.Column(
            "lieu_stand_id", UUID(as_uuid=True), sa.ForeignKey("lieu_aerien.id"), nullable=True
        ),
    )
    op.add_column(
        "traitement_aerien",
        sa.Column(
            "lieu_base_secondaire_id",
            UUID(as_uuid=True),
            sa.ForeignKey("lieu_aerien.id"),
            nullable=True,
        ),
    )

    op.drop_column("traitement_aerien", "base_secondaire")
    op.drop_column("traitement_aerien", "stand")
    op.drop_column("traitement_aerien", "base_principale")
