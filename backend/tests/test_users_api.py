"""Tests de `GET /users/` — la colonne « Station » de la maquette §10.

Le poste acridien de rattachement (`utilisateur.pa_id`) existe en base depuis
l'origine mais n'était pas exposé par `UtilisateurRead` : l'écran Utilisateurs
masquait la colonne faute de donnée. On l'expose en lecture, sans migration.
"""

import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import create_access_token, hash_password
from app.models.users import Utilisateur


@pytest_asyncio.fixture
async def admin(db_session: AsyncSession) -> Utilisateur:
    user = Utilisateur(
        id=uuid.uuid4(),
        nom="Soa",
        prenom="Lalao",
        email=f"lalao.soa+{uuid.uuid4().hex[:6]}@test.mg",
        password_hash=hash_password("secret"),
        role="admin",
        actif=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def admin_headers(admin: Utilisateur) -> dict:
    return {"Authorization": f"Bearer {create_access_token(admin.id)}"}


@pytest_asyncio.fixture
async def utilisateur_rattache(db_session: AsyncSession, poste_acridien) -> Utilisateur:
    user = Utilisateur(
        id=uuid.uuid4(),
        nom="Randria",
        prenom="Jean",
        email=f"jean.randria+{uuid.uuid4().hex[:6]}@test.mg",
        password_hash=hash_password("secret"),
        role="prospecteur",
        pa_id=poste_acridien.id,
        actif=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.mark.asyncio
async def test_list_users_expose_le_poste_acridien_de_rattachement(
    client: AsyncClient, admin_headers: dict, utilisateur_rattache, poste_acridien
):
    response = await client.get("/users/", headers=admin_headers)

    assert response.status_code == 200
    ligne = next(u for u in response.json() if u["id"] == str(utilisateur_rattache.id))
    assert ligne["pa_id"] == str(poste_acridien.id)
    assert ligne["pa_code"] == "PA-TEST-01"
    assert ligne["pa_nom"] == "Poste Test"


@pytest.mark.asyncio
async def test_list_users_laisse_le_rattachement_vide_sans_poste(
    client: AsyncClient, admin_headers: dict, admin
):
    response = await client.get("/users/", headers=admin_headers)

    assert response.status_code == 200
    ligne = next(u for u in response.json() if u["id"] == str(admin.id))
    assert ligne["pa_id"] is None
    assert ligne["pa_code"] is None
    assert ligne["pa_nom"] is None


@pytest.mark.asyncio
async def test_list_users_reste_reserve_aux_admins(client: AsyncClient, auth_headers: dict):
    """L'annuaire complet ne doit pas s'ouvrir en élargissant le schéma de lecture."""
    response = await client.get("/users/", headers=auth_headers)

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_admin_ne_peut_pas_modifier_son_propre_compte(
    client: AsyncClient, admin: Utilisateur, admin_headers: dict
):
    """Un admin qui se retire le rôle ou se désactive se verrouille dehors."""
    response = await client.patch(
        f"/users/{admin.id}", json={"role": "prospecteur"}, headers=admin_headers
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_admin_peut_modifier_un_autre_compte(
    client: AsyncClient, admin_headers: dict, utilisateur_rattache: Utilisateur
):
    response = await client.patch(
        f"/users/{utilisateur_rattache.id}",
        json={"role": "verificateur"},
        headers=admin_headers,
    )

    assert response.status_code == 200
    assert response.json()["role"] == "verificateur"


@pytest.mark.asyncio
async def test_me_reste_lisible_sans_rattachement(
    client: AsyncClient, auth_headers: dict, utilisateur
):
    """`/users/me` sert la même classe : les champs ajoutés doivent rester optionnels."""
    response = await client.get("/users/me", headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["email"] == utilisateur.email
