import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_equipe_aerienne(client: AsyncClient, auth_headers: dict, chef_de_base):
    response = await client.post(
        "/equipes-aeriennes",
        json={
            "nom": "Équipe Ihosy",
            "chef_de_base_id": str(chef_de_base.id),
            "pilote": "Jean Rakoto",
            "mecanicien": "Paul Andria",
            "consultant_international": "John Smith",
            "membres": [{"nom": "Rasoa Voahangy"}, {"nom": "Tovo Randria"}],
        },
        headers=auth_headers,
    )
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["nom"] == "Équipe Ihosy"
    assert data["chef_de_base_id"] == str(chef_de_base.id)
    assert data["pilote"] == "Jean Rakoto"
    assert data["mecanicien"] == "Paul Andria"
    assert data["consultant_international"] == "John Smith"
    assert [m["nom"] for m in data["membres"]] == ["Rasoa Voahangy", "Tovo Randria"]
    assert data["actif"] is True


@pytest.mark.asyncio
async def test_create_equipe_aerienne_sans_consultant_ni_membres(
    client: AsyncClient, auth_headers: dict, chef_de_base
):
    """Consultant international et membres sont facultatifs, contrairement à
    pilote/mécanicien."""
    response = await client.post(
        "/equipes-aeriennes",
        json={
            "nom": "Équipe Ihosy",
            "chef_de_base_id": str(chef_de_base.id),
            "pilote": "Jean Rakoto",
            "mecanicien": "Paul Andria",
        },
        headers=auth_headers,
    )
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["consultant_international"] is None
    assert data["membres"] == []


@pytest.mark.asyncio
async def test_create_equipe_aerienne_sans_pilote_422(
    client: AsyncClient, auth_headers: dict, chef_de_base
):
    """pilote/mécanicien sont exigés pour toute nouvelle équipe."""
    response = await client.post(
        "/equipes-aeriennes",
        json={
            "nom": "Équipe Ihosy",
            "chef_de_base_id": str(chef_de_base.id),
            "mecanicien": "Paul Andria",
        },
        headers=auth_headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_equipe_aerienne_chef_avec_mauvais_role_403(
    client: AsyncClient, auth_headers: dict, pilote
):
    response = await client.post(
        "/equipes-aeriennes",
        json={
            "nom": "Équipe Ihosy",
            "chef_de_base_id": str(pilote.id),
            "pilote": "Jean Rakoto",
            "mecanicien": "Paul Andria",
        },
        headers=auth_headers,
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_create_equipe_aerienne_chef_inexistant_403(client: AsyncClient, auth_headers: dict):
    response = await client.post(
        "/equipes-aeriennes",
        json={
            "nom": "Équipe Ihosy",
            "chef_de_base_id": str(uuid.uuid4()),
            "pilote": "Jean Rakoto",
            "mecanicien": "Paul Andria",
        },
        headers=auth_headers,
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_create_equipe_aerienne_chef_deja_assigne_409(
    client: AsyncClient, auth_headers: dict, equipe_aerienne, chef_de_base
):
    """Un chef de base ne dirige qu'une équipe (UNIQUE chef_de_base_id)."""
    response = await client.post(
        "/equipes-aeriennes",
        json={
            "nom": "Deuxième équipe",
            "chef_de_base_id": str(chef_de_base.id),
            "pilote": "Jean Rakoto",
            "mecanicien": "Paul Andria",
        },
        headers=auth_headers,
    )
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_list_equipes_masque_les_inactives_par_defaut(
    client: AsyncClient, auth_headers: dict, equipe_aerienne, db_session
):
    equipe_aerienne.actif = False
    await db_session.commit()

    response = await client.get("/equipes-aeriennes", headers=auth_headers)
    assert str(equipe_aerienne.id) not in [e["id"] for e in response.json()]

    response = await client.get("/equipes-aeriennes?inclure_inactifs=true", headers=auth_headers)
    assert str(equipe_aerienne.id) in [e["id"] for e in response.json()]


@pytest.mark.asyncio
async def test_get_equipe_aerienne(client: AsyncClient, auth_headers: dict, equipe_aerienne):
    response = await client.get(f"/equipes-aeriennes/{equipe_aerienne.id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["id"] == str(equipe_aerienne.id)


@pytest.mark.asyncio
async def test_get_equipe_aerienne_inexistante_404(client: AsyncClient, auth_headers: dict):
    response = await client.get(f"/equipes-aeriennes/{uuid.uuid4()}", headers=auth_headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_base_principale_avec_equipe_deja_assignee_409(
    client: AsyncClient, auth_headers: dict, base_aerienne, equipe_aerienne
):
    """Une équipe ne possède qu'une base principale (UNIQUE base_aerienne.equipe_id) —
    `base_aerienne` (fixture) possède déjà `equipe_aerienne`."""
    response = await client.post(
        "/bases-aeriennes",
        json={
            "numero": "IHO09",
            "localite": "Ailleurs",
            "equipe_id": str(equipe_aerienne.id),
        },
        headers=auth_headers,
    )
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_base_principale_avec_equipe_inexistante_404(client: AsyncClient, auth_headers: dict):
    response = await client.post(
        "/bases-aeriennes",
        json={"numero": "IHO09", "localite": "Ailleurs", "equipe_id": str(uuid.uuid4())},
        headers=auth_headers,
    )
    assert response.status_code == 404
