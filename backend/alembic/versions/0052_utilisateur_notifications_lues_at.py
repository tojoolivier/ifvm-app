"""utilisateur : notifications_lues_at — curseur de lecture du centre de notifications

Le centre de notifications (mobile : statut de mes fiches ; web : nouvelles
fiches et actions de vérification/validation/rejet) se construit à partir de
`audit_log`, déjà alimenté à chaque transition de statut — pas de nouvelle
table d'événements.

Ce qui manquait : savoir ce qu'un utilisateur a déjà vu. Un curseur unique par
utilisateur (« dernière consultation du centre de notifications ») suffit :
c'est un attribut scalaire de l'utilisateur (dépendance fonctionnelle directe
sur sa clé), pas une collection — une table de lecture par notification serait
sur-dimensionnée pour un simple badge de compteur nouveau/vu, et personne ici
ne demande un « marquer cette notification comme lue » individuel.

Revision ID: 0052
Revises: 0051
Create Date: 2026-09-08

"""

import sqlalchemy as sa

from alembic import op

revision = "0052"
down_revision = "0051"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "utilisateur",
        sa.Column("notifications_lues_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("utilisateur", "notifications_lues_at")
