"""utilisateur : ck_utilisateur_role manque verificateur/validation_finale/consultant_international

`ck_utilisateur_role` (migration 0001) n'autorisait que 'prospecteur',
'chef_equipe', 'agent_encadreur', 'pilote', 'mecanicien', 'chef_de_base',
'admin' — la liste des rôles telle qu'elle existait à l'origine du projet.
`app/models/users.py::ROLES` a depuis grandi à dix rôles ('verificateur',
'validation_finale' ajoutés pour le circuit de validation des fiches de
prospection, 'consultant_international' pour la création à la volée côté
traitement aérien — migration 0046) sans que cette contrainte SQL ne soit
jamais mise à jour en conséquence.

Effet en production : `POST /users/` avec `role='verificateur'` ou
`role='validation_finale'` (tous deux proposés par le select du formulaire web
`UsersPage.tsx`) lève une `IntegrityError` (violation de check constraint) non
rattrapée par `create_user`, que Starlette renvoie en 500 texte brut (pas de
`detail` JSON) — d'où le message générique « Erreur lors de la création »
côté web, pour ce sous-ensemble de rôles seulement (les autres, présents dans
la contrainte d'origine, fonctionnaient déjà). Vérifié empiriquement par
insertion SQL directe sur une base migrée : 3 rôles rejetés avant cette
migration, 0 après.

On réaligne la contrainte sur `ROLES`, dans le même ordre, plutôt que de
la supprimer : un rôle mal orthographié doit continuer à être refusé par la
base, pas seulement par la validation applicative.

Revision ID: 0051
Revises: 0050
Create Date: 2026-09-07

"""

from alembic import op

revision = "0051"
down_revision = "0050"
branch_labels = None
depends_on = None

ANCIENS_ROLES = (
    "prospecteur",
    "chef_equipe",
    "agent_encadreur",
    "pilote",
    "mecanicien",
    "chef_de_base",
    "admin",
)

# Ordre identique à app.models.users.ROLES.
NOUVEAUX_ROLES = (
    "prospecteur",
    "verificateur",
    "validation_finale",
    "chef_equipe",
    "agent_encadreur",
    "pilote",
    "mecanicien",
    "chef_de_base",
    "consultant_international",
    "admin",
)


def _check_sql(roles: tuple[str, ...]) -> str:
    valeurs = ",".join(f"'{r}'" for r in roles)
    return f"role IN ({valeurs})"


def upgrade() -> None:
    op.drop_constraint("ck_utilisateur_role", "utilisateur", type_="check")
    op.create_check_constraint(
        "ck_utilisateur_role",
        "utilisateur",
        _check_sql(NOUVEAUX_ROLES),
    )


def downgrade() -> None:
    op.drop_constraint("ck_utilisateur_role", "utilisateur", type_="check")
    op.create_check_constraint(
        "ck_utilisateur_role",
        "utilisateur",
        _check_sql(ANCIENS_ROLES),
    )
