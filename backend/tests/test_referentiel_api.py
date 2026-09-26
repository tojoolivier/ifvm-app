import uuid

import pytest
import pytest_asyncio
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
async def test_list_stations_filtre_par_pa(
    client: AsyncClient, auth_headers: dict, station_fixe, poste_acridien
):
    response = await client.get(f"/stations?pa_id={poste_acridien.id}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert all(s["pa_id"] == str(poste_acridien.id) for s in data)


@pytest.mark.asyncio
async def test_list_stations_recherche_textuelle(
    client: AsyncClient, auth_headers: dict, station_fixe
):
    response = await client.get("/stations?q=Test", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert any(s["nom"] == "Station Test" for s in data)


@pytest_asyncio.fixture
async def station_inactive(db_session, poste_acridien, commune):
    from app.infrastructure.referentiel_model import StationFixeModel

    station = StationFixeModel(
        id=uuid.uuid4(),
        code="ST-TEST-INACTIVE",
        nom="Station Fermée",
        pa_id=poste_acridien.id,
        latitude=-21.0,
        longitude=44.0,
        altitude=300,
        commune_id=commune.id,
        actif=False,
    )
    db_session.add(station)
    await db_session.commit()
    return station


@pytest.mark.asyncio
async def test_list_stations_masque_les_inactives_par_defaut(
    client: AsyncClient, auth_headers: dict, station_fixe, station_inactive
):
    """Le sélecteur de station d'une prospection ne doit proposer que l'actif."""
    response = await client.get("/stations", headers=auth_headers)

    assert response.status_code == 200
    codes = [s["code"] for s in response.json()]
    assert "ST-TEST-001" in codes
    assert "ST-TEST-INACTIVE" not in codes


@pytest.mark.asyncio
async def test_list_stations_inclure_inactifs_retourne_les_deux_etats(
    client: AsyncClient, auth_headers: dict, station_fixe, station_inactive
):
    """L'écran d'administration affiche un badge « État » : il lui faut les deux."""
    response = await client.get("/stations?inclure_inactifs=true", headers=auth_headers)

    assert response.status_code == 200
    codes = [s["code"] for s in response.json()]
    assert "ST-TEST-001" in codes
    assert "ST-TEST-INACTIVE" in codes


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
    client: AsyncClient,
    auth_headers: dict,
    campagne_id: uuid.UUID,
    station_id: uuid.UUID,
    equipe_terrestre_id: uuid.UUID,
):
    response = await client.post(
        "/prospections",
        json={
            "type_prospection": "intensive",
            "campagne_id": str(campagne_id),
            "equipe_id": str(equipe_terrestre_id),
            "station_id": str(station_id),
            "date_prospection": "2026-06-25",
            "biotope": ["xerophyle"],
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["station_id"] == str(station_id)


@pytest.mark.asyncio
async def test_create_prospection_intensive_avec_station_invalide_echoue(
    client: AsyncClient, auth_headers: dict, campagne_id: uuid.UUID, equipe_terrestre_id: uuid.UUID
):
    response = await client.post(
        "/prospections",
        json={
            "type_prospection": "intensive",
            "campagne_id": str(campagne_id),
            "equipe_id": str(equipe_terrestre_id),
            "station_id": str(uuid.uuid4()),
            "date_prospection": "2026-06-25",
            "biotope": ["xerophyle"],
        },
        headers=auth_headers,
    )
    assert response.status_code == 409
