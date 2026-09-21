"""utilisateur.updated_at : force la re-synchronisation des rôles sur les téléphones

Bug : `PATCH /users/{id}` changeait `role`/`actif` sans jamais toucher `updated_at`, alors que
la synchro du référentiel (`utilisateurs_equipe`) est un delta sur `updated_at > curseur`.
Un rôle modifié ne descendait donc jamais sur les appareils qui connaissaient déjà cet
utilisateur : ils continuaient de proposer un ancien « chef d'équipe » que le serveur refusait
à l'envoi de la fiche (« chef_equipe_id ne référence pas un utilisateur avec le rôle
'chef_equipe' »). Le modèle porte désormais `onupdate` (correctif de fond).

Cette migration ne change AUCUN schéma : elle avance une fois `updated_at` de tous les
utilisateurs pour que chaque appareil re-télécharge leur rôle/statut réels à la prochaine
synchronisation — sans quoi les écarts déjà installés survivraient au correctif.

Revision ID: 0079
Revises: 0078
Create Date: 2026-09-22

"""

from alembic import op

revision = "0079"
down_revision = "0078"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE utilisateur SET updated_at = now()")


def downgrade() -> None:
    # Donnée uniquement : l'horodatage d'origine n'est pas récupérable, et le
    # ré-avancer est sans effet néfaste (les appareils re-téléchargent, rien de plus).
    pass
