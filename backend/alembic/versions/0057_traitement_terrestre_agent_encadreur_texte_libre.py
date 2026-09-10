"""traitement_terrestre : agent_encadreur redevient du texte libre

Même retour en arrière que la migration 0048 (`traitement_aerien.pilote`/`mecanicien`/
`consultant_international`) : `agent_encadreur_id` (FK vers `utilisateur`, sélection
dans le référentiel) est remplacé par la colonne texte libre `agent_encadreur`, sur le
même patron que `traitement_terrestre.consultant_international` (déjà en texte libre,
jamais touché par aucune des deux migrations FK). `chef_equipe_id` reste seul en FK sur
cette fiche — seul rôle terrestre dont l'appartenance au référentiel utilisateur est
vérifiée (`ChefEquipeInvalideError`), agent_encadreur ne l'a jamais été (aucune
validation de rôle ne portait dessus côté use case).

Backfill (upgrade) : `agent_encadreur` est rempli depuis
`utilisateur.prenom || ' ' || utilisateur.nom` via la FK existante avant que celle-ci
ne soit supprimée — aucune perte d'information pour les lignes déjà en base.

Downgrade : ré-ajoute `agent_encadreur_id` (FK nullable, sans backfill — un nom en
texte libre ne redonne pas un id de façon fiable, même irréversibilité déjà acceptée
par le downgrade de la 0048 dans l'autre sens).

Revision ID: 0057
Revises: 0056
Create Date: 2026-09-10

"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision = "0057"
down_revision = "0056"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "traitement_terrestre", sa.Column("agent_encadreur", sa.String(255), nullable=True)
    )
    op.execute(
        "UPDATE traitement_terrestre tt SET agent_encadreur = u.prenom || ' ' || u.nom "
        "FROM utilisateur u WHERE u.id = tt.agent_encadreur_id"
    )
    op.drop_column("traitement_terrestre", "agent_encadreur_id")


def downgrade() -> None:
    op.add_column(
        "traitement_terrestre",
        sa.Column(
            "agent_encadreur_id", UUID(as_uuid=True), sa.ForeignKey("utilisateur.id"), nullable=True
        ),
    )
    op.drop_column("traitement_terrestre", "agent_encadreur")
