"""prospection.signature_visa_image : tracé vectoriel de la signature du prospecteur

Demande utilisateur : le dernier slide « Observations » de la Prospection Intensive
perd son champ « Photo » (jamais câblé — aucune capture, aucune persistance, un simple
bouton mort) au profit d'une signature numérique du prospecteur — nom auto-rempli
depuis l'utilisateur connecté (jamais ressaisi), tracé capturé au pavé de signature,
avec VALIDER/MODIFIER (même mécanique que #signatures-digitales-extensif-aerien,
migration 0053).

Réutilise `signature_visa_nom`/`signature_visa_horodatage` (migration 0036) plutôt que
d'introduire un nouveau triplet de colonnes : ce champ était le VISA du prospecteur
lui-même (jamais un rôle tiers comme Consultant FAO/Pilote/Chef de Base), retiré du
formulaire mobile Extensif Aérien (migration 0053) faute de tracé, mais jamais utilisé
par l'Intensif jusqu'ici. Il ne lui manquait que le tracé — cette migration ajoute
exactement ça, `signature_visa_image`, même format que ses 3 pairs (`Text()`,
nullable : tracé multi-traits sans borne raisonnable a priori, et rétrocompatibilité
avec les fiches déjà porteuses d'un nom+horodatage Visa sans tracé, migration 0036).

Revision ID: 0082
Revises: 0081
Create Date: 2026-09-22

"""

import sqlalchemy as sa

from alembic import op

revision = "0082"
down_revision = "0081"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("prospection", sa.Column("signature_visa_image", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("prospection", "signature_visa_image")
