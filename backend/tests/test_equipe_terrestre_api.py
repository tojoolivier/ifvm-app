import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_equipe_terrestre(client: AsyncClient, auth_headers: dict, chef_equipe):
    response = await client.post(
        "/equipes-terrestres",
        json={
            "nom": "Équipe Terrestre Ihosy",
            "chef_equipe_id": str(chef_equipe.id),
            "membres": [{"nom": "Rasoa Voahangy"}, {"nom": "Tovo Randria"}],
        },
        headers=auth_headers,
    )
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["nom"] == "Équipe Terrestre Ihosy"
    assert data["chef_equipe_id"] == str(chef_equipe.id)
    assert [m["nom"] for m in data["membres"]] == ["Rasoa Voahangy", "Tovo Randria"]
    assert data["actif"] is True


@pytest.mark.asyncio
async def test_create_equipe_terrestre_sans_membres(
    client: AsyncClient, auth_headers: dict, chef_equipe
):
    response = await client.post(
        "/equipes-terrestres",
        json={"nom": "Équipe Terrestre Ihosy", "chef_equipe_id": str(chef_equipe.id)},
        headers=auth_headers,
    )
    assert response.status_code == 201, response.text
    assert response.json()["membres"] == []


@pytest.mark.asyncio
async def test_create_equipe_terrestre_chef_avec_mauvais_role_403(
    client: AsyncClient, auth_headers: dict, pilote
):
    response = await client.post(
        "/equipes-terrestres",
        json={"nom": "Équipe Terrestre Ihosy", "chef_equipe_id": str(pilote.id)},
        headers=auth_headers,
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_create_equipe_terrestre_chef_inexistant_403(client: AsyncClient, auth_headers: dict):
    response = await client.post(
        "/equipes-terrestres",
        json={"nom": "Équipe Terrestre Ihosy", "chef_equipe_id": str(uuid.uuid4())},
        headers=auth_headers,
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_create_equipe_terrestre_chef_deja_assigne_409(
    client: AsyncClient, auth_headers: dict, equipe_terrestre, chef_equipe
):
    """Un chef d'équipe ne dirige qu'une équipe (UNIQUE chef_equipe_id)."""
    response = await client.post(
        "/equipes-terrestres",
        json={"nom": "Deuxième équipe", "chef_equipe_id": str(chef_equipe.id)},
        headers=auth_headers,
    )
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_list_equipes_terrestres_masque_les_inactives_par_defaut(
    client: AsyncClient, auth_headers: dict, equipe_terrestre, db_session
):
    equipe_terrestre.actif = False
    await db_session.commit()

    response = await client.get("/equipes-terrestres", headers=auth_headers)
    assert str(equipe_terrestre.id) not in [e["id"] for e in response.json()]

    response = await client.get("/equipes-terrestres?inclure_inactifs=true", headers=auth_headers)
    assert str(equipe_terrestre.id) in [e["id"] for e in response.json()]


@pytest.mark.asyncio
async def test_get_equipe_terrestre(client: AsyncClient, auth_headers: dict, equipe_terrestre):
    response = await client.get(f"/equipes-terrestres/{equipe_terrestre.id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["id"] == str(equipe_terrestre.id)


@pytest.mark.asyncio
async def test_get_equipe_terrestre_inexistante_404(client: AsyncClient, auth_headers: dict):
    response = await client.get(f"/equipes-terrestres/{uuid.uuid4()}", headers=auth_headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_create_sans_authentification_retourne_401(client: AsyncClient, chef_equipe):
    response = await client.post(
        "/equipes-terrestres",
        json={"nom": "Équipe Terrestre Ihosy", "chef_equipe_id": str(chef_equipe.id)},
    )
    assert response.status_code == 401
