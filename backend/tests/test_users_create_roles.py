"""Tests de `POST /users/` — jusqu'ici sans aucune couverture.

`ck_utilisateur_role` (migration 0001) n'autorisait que les sept rôles connus
à l'origine du projet ; `verificateur`/`validation_finale`/
`consultant_international` ont été ajoutés à `app.models.users.ROLES` (et au
formulaire web `UsersPage.tsx`) sans jamais mettre à jour cette contrainte SQL
— la création plantait en 500 texte brut pour ces trois rôles précisément
(migration 0051 les y ajoute).

Ce module ne peut PAS exercer `ck_utilisateur_role` lui-même : la contrainte
n'existe que dans le schéma migré par Alembic, alors que `conftest.py::db_engine`
construit son schéma via `Base.metadata.create_all()` (métadonnées ORM), qui ne
la déclare pas — cf. `app.models.users.Utilisateur` (aucun `__table_args__`).
La régression a été vérifiée empiriquement en dehors de pytest (insertions SQL
directes sur une base migrée par Alembic, avant/après 0051 — 3 rôles rejetés
avant, 0 après). Ici, on couvre ce que ce schéma de test peut réellement
exercer : la forme de l'erreur renvoyée par l'endpoint sur un vrai conflit
(email dupliqué), qui souffrait du même bug (IntegrityError non rattrapée).
"""

from httpx import AsyncClient

from app.models.users import Utilisateur


async def test_creation_reussie(client: AsyncClient, admin_headers: dict):
    resp = await client.post(
        "/users/",
        json={
            "nom": "Rakoto",
            "prenom": "Voahangy",
            "email": "voahangy.rakoto@test.mg",
            "password": "secret123",
            "role": "chef_equipe",
        },
        headers=admin_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["role"] == "chef_equipe"


async def test_creation_email_duplique_renvoie_un_detail_exploitable(
    client: AsyncClient, admin_headers: dict, admin: Utilisateur
):
    """Avant le fix : l'IntegrityError n'était pas rattrapée -> 500 texte brut
    sans `detail` JSON -> le front (`UsersPage.tsx`) retombait sur le message
    générique « Erreur lors de la création », impossible à distinguer d'un
    rôle refusé par `ck_utilisateur_role`. Reproduit ici avec un email
    dupliqué plutôt qu'un rôle : seul cas d'IntegrityError que ce schéma de
    test (ORM, pas Alembic) sait produire."""
    resp = await client.post(
        "/users/",
        json={
            "nom": "Doublon",
            "prenom": "Test",
            "email": admin.email,
            "password": "secret123",
            "role": "prospecteur",
        },
        headers=admin_headers,
    )
    assert resp.status_code == 400
    assert "existe déjà" in resp.json()["detail"]


async def test_creation_reste_reservee_aux_admins(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/users/",
        json={
            "nom": "X",
            "prenom": "Y",
            "email": "sans.droits@test.mg",
            "password": "secret123",
            "role": "prospecteur",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 403
