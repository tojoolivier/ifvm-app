import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_base_principale(client: AsyncClient, auth_headers: dict, equipe_aerienne):
    response = await client.post(
        "/bases-aeriennes",
        json={
            "numero": "IHO01",
            "localite": "Ihosy",
            "latitude": -22.4021,
            "longitude": 46.1250,
            "equipe_id": str(equipe_aerienne.id),
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["numero"] == "IHO01"
    assert data["parent_base_id"] is None
    assert data["equipe_id"] == str(equipe_aerienne.id)
    assert data["actif"] is True


@pytest.mark.asyncio
async def test_create_base_principale_sans_equipe_422(client: AsyncClient, auth_headers: dict):
    """#equipe-aerienne : une base principale doit appartenir à une équipe aérienne."""
    response = await client.post(
        "/bases-aeriennes",
        json={"numero": "IHO01", "localite": "Ihosy", "latitude": -22.4021, "longitude": 46.1250},
        headers=auth_headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_base_secondaire_avec_sa_propre_equipe_422(
    client: AsyncClient, auth_headers: dict, base_aerienne, equipe_aerienne_bis
):
    """Une base secondaire hérite de l'équipe de sa principale, elle ne peut pas
    en avoir une à elle."""
    response = await client.post(
        "/bases-aeriennes",
        json={
            "numero": "IHO02",
            "localite": "Ihosy Sud",
            "parent_base_id": str(base_aerienne.id),
            "equipe_id": str(equipe_aerienne_bis.id),
        },
        headers=auth_headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_base_secondaire(client: AsyncClient, auth_headers: dict, base_aerienne):
    response = await client.post(
        "/bases-aeriennes",
        json={
            "numero": "IHO02",
            "localite": "Ihosy Sud",
            "parent_base_id": str(base_aerienne.id),
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    assert response.json()["parent_base_id"] == str(base_aerienne.id)


@pytest.mark.asyncio
async def test_create_base_secondaire_d_une_secondaire_refusee(
    client: AsyncClient, auth_headers: dict, base_aerienne
):
    """La hiérarchie s'arrête à 2 niveaux : pas de secondaire d'une secondaire."""
    secondaire = await client.post(
        "/bases-aeriennes",
        json={"numero": "IHO02", "localite": "Ihosy Sud", "parent_base_id": str(base_aerienne.id)},
        headers=auth_headers,
    )
    assert secondaire.status_code == 201

    reponse = await client.post(
        "/bases-aeriennes",
        json={
            "numero": "IHO03",
            "localite": "Ihosy Ouest",
            "parent_base_id": secondaire.json()["id"],
        },
        headers=auth_headers,
    )
    assert reponse.status_code == 422


@pytest.mark.asyncio
async def test_create_base_parent_inexistant_422(client: AsyncClient, auth_headers: dict):
    response = await client.post(
        "/bases-aeriennes",
        json={"numero": "IHO01", "localite": "Ihosy", "parent_base_id": str(uuid.uuid4())},
        headers=auth_headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_base_numero_deja_pris_409(
    client: AsyncClient, auth_headers: dict, base_aerienne, equipe_aerienne_bis
):
    response = await client.post(
        "/bases-aeriennes",
        json={
            "numero": base_aerienne.numero,
            "localite": "Ailleurs",
            "equipe_id": str(equipe_aerienne_bis.id),
        },
        headers=auth_headers,
    )
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_list_bases_masque_les_inactives_par_defaut(
    client: AsyncClient, auth_headers: dict, base_aerienne
):
    await client.put(
        f"/bases-aeriennes/{base_aerienne.id}", json={"actif": False}, headers=auth_headers
    )
    response = await client.get("/bases-aeriennes", headers=auth_headers)
    assert str(base_aerienne.id) not in [b["id"] for b in response.json()]

    response = await client.get("/bases-aeriennes?inclure_inactifs=true", headers=auth_headers)
    assert str(base_aerienne.id) in [b["id"] for b in response.json()]


@pytest.mark.asyncio
async def test_get_base_aerienne_inexistante_404(client: AsyncClient, auth_headers: dict):
    response = await client.get(f"/bases-aeriennes/{uuid.uuid4()}", headers=auth_headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_base_aerienne_inexistante_404(client: AsyncClient, auth_headers: dict):
    response = await client.put(
        f"/bases-aeriennes/{uuid.uuid4()}", json={"localite": "Peu importe"}, headers=auth_headers
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_une_base_ne_peut_pas_etre_son_propre_parent(
    client: AsyncClient, auth_headers: dict, base_aerienne
):
    response = await client.put(
        f"/bases-aeriennes/{base_aerienne.id}",
        json={"parent_base_id": str(base_aerienne.id)},
        headers=auth_headers,
    )
    assert response.status_code == 422
