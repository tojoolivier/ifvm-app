import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_stand_remplissage(client: AsyncClient, admin_headers: dict, equipe_aerienne):
    response = await client.post(
        "/stands-remplissage",
        json={
            "numero": "STD01",
            "localite": "Stand Sud",
            "latitude": -22.41,
            "longitude": 46.13,
            "equipe_aerienne_id": str(equipe_aerienne.id),
        },
        headers=admin_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["numero"] == "STD01"
    assert data["actif"] is True
    assert data["equipe_aerienne_id"] == str(equipe_aerienne.id)


@pytest.mark.asyncio
async def test_create_stand_numero_deja_pris_409(
    client: AsyncClient, admin_headers: dict, stand_remplissage, equipe_aerienne
):
    response = await client.post(
        "/stands-remplissage",
        json={
            "numero": stand_remplissage.numero,
            "localite": "Ailleurs",
            "equipe_aerienne_id": str(equipe_aerienne.id),
        },
        headers=admin_headers,
    )
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_list_stands_masque_les_inactifs_par_defaut(
    client: AsyncClient, admin_headers: dict, stand_remplissage
):
    await client.put(
        f"/stands-remplissage/{stand_remplissage.id}", json={"actif": False}, headers=admin_headers
    )
    response = await client.get("/stands-remplissage", headers=admin_headers)
    assert str(stand_remplissage.id) not in [s["id"] for s in response.json()]

    response = await client.get("/stands-remplissage?inclure_inactifs=true", headers=admin_headers)
    assert str(stand_remplissage.id) in [s["id"] for s in response.json()]


@pytest.mark.asyncio
async def test_get_stand_remplissage_par_id(
    client: AsyncClient, admin_headers: dict, stand_remplissage
):
    response = await client.get(
        f"/stands-remplissage/{stand_remplissage.id}", headers=admin_headers
    )
    assert response.status_code == 200
    assert response.json()["numero"] == stand_remplissage.numero


@pytest.mark.asyncio
async def test_get_stand_remplissage_inexistant_404(client: AsyncClient, admin_headers: dict):
    response = await client.get(f"/stands-remplissage/{uuid.uuid4()}", headers=admin_headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_stand_remplissage_inexistant_404(client: AsyncClient, admin_headers: dict):
    response = await client.put(
        f"/stands-remplissage/{uuid.uuid4()}",
        json={"localite": "Peu importe"},
        headers=admin_headers,
    )
    assert response.status_code == 404
