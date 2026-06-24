import uuid
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_postes_acridiens(client: AsyncClient, auth_headers: dict, poste_acridien):
    response = await client.get("/postes-acridiens", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    codes = [pa["code"] for pa in data]
    assert "PA-TEST-01" in codes


@pytest.mark.asyncio
async def test_list_stations(client: AsyncClient, auth_headers: dict, station_fixe):
    response = await client.get("/stations", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    codes = [s["code"] for s in data]
    assert "ST-TEST-001" in codes


@pytest.mark.asyncio
async def test_list_stations_filtre_par_pa(client: AsyncClient, auth_headers: dict, station_fixe, poste_acridien):
    response = await client.get(f"/stations?pa_id={poste_acridien.id}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert all(s["pa_id"] == str(poste_acridien.id) for s in data)


@pytest.mark.asyncio
async def test_list_stations_recherche_textuelle(client: AsyncClient, auth_headers: dict, station_fixe):
    response = await client.get("/stations?q=Test", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert any(s["nom"] == "Station Test" for s in data)


@pytest.mark.asyncio
async def test_get_station_par_id(client: AsyncClient, auth_headers: dict, station_fixe):
    response = await client.get(f"/stations/{station_fixe.id}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(station_fixe.id)
    assert data["code"] == "ST-TEST-001"
    assert data["pa_code"] == "PA-TEST-01"
    assert data["pa_nom"] == "Poste Test"


@pytest.mark.asyncio
async def test_get_station_inexistante_retourne_404(client: AsyncClient, auth_headers: dict):
    response = await client.get(f"/stations/{uuid.uuid4()}", headers=auth_headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_create_prospection_intensive_avec_station_valide(
    client: AsyncClient, auth_headers: dict, campagne_id: uuid.UUID, station_id: uuid.UUID
):
    response = await client.post(
        "/prospections",
        json={
            "type_prospection": "intensive",
            "campagne_id": str(campagne_id),
            "station_id": str(station_id),
            "date_prospection": "2026-06-25",
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["station_id"] == str(station_id)


@pytest.mark.asyncio
async def test_create_prospection_intensive_avec_station_invalide_echoue(
    client: AsyncClient, auth_headers: dict, campagne_id: uuid.UUID
):
    response = await client.post(
        "/prospections",
        json={
            "type_prospection": "intensive",
            "campagne_id": str(campagne_id),
            "station_id": str(uuid.uuid4()),
            "date_prospection": "2026-06-25",
        },
        headers=auth_headers,
    )
    assert response.status_code == 409
