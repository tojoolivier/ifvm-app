import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient


@pytest_asyncio.fixture
async def lieu_aerien(db_session):
    from app.infrastructure.referentiel_model import LieuAerienModel

    lieu = LieuAerienModel(
        id=uuid.uuid4(),
        type_lieu="principale",
        nom="Base Test",
        latitude=-21.0,
        longitude=44.0,
        altitude=300,
        actif=True,
    )
    db_session.add(lieu)
    await db_session.commit()
    return lieu


@pytest_asyncio.fixture
async def stand_inactif(db_session):
    from app.infrastructure.referentiel_model import LieuAerienModel

    lieu = LieuAerienModel(
        id=uuid.uuid4(),
        type_lieu="stand",
        nom="Stand Fermé",
        latitude=-20.5,
        longitude=44.5,
        altitude=None,
        actif=False,
    )
    db_session.add(lieu)
    await db_session.commit()
    return lieu


@pytest.mark.asyncio
async def test_create_lieu_aerien(client: AsyncClient, auth_headers: dict):
    response = await client.post(
        "/lieux-aeriens",
        json={
            "type_lieu": "stand",
            "nom": "Stand Ambositra",
            "latitude": -20.53,
            "longitude": 47.24,
            "altitude": 1265.0,
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["type_lieu"] == "stand"
    assert data["nom"] == "Stand Ambositra"
    assert data["actif"] is True


@pytest.mark.asyncio
async def test_create_lieu_aerien_type_lieu_invalide_422(client: AsyncClient, auth_headers: dict):
    response = await client.post(
        "/lieux-aeriens",
        json={
            "type_lieu": "quartier_general",
            "nom": "Quelque part",
            "latitude": -20.0,
            "longitude": 47.0,
        },
        headers=auth_headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_lieu_aerien_latitude_hors_bornes_422(client: AsyncClient, auth_headers: dict):
    response = await client.post(
        "/lieux-aeriens",
        json={
            "type_lieu": "principale",
            "nom": "Hors Madagascar",
            "latitude": 200.0,
            "longitude": 47.0,
        },
        headers=auth_headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_list_lieux_aeriens(client: AsyncClient, auth_headers: dict, lieu_aerien):
    response = await client.get("/lieux-aeriens", headers=auth_headers)
    assert response.status_code == 200
    noms = [lieu["nom"] for lieu in response.json()]
    assert "Base Test" in noms


@pytest.mark.asyncio
async def test_list_lieux_aeriens_filtre_type_lieu(
    client: AsyncClient, auth_headers: dict, lieu_aerien
):
    response = await client.get("/lieux-aeriens?type_lieu=stand", headers=auth_headers)
    assert response.status_code == 200
    assert all(lieu["type_lieu"] == "stand" for lieu in response.json())
    assert "Base Test" not in [lieu["nom"] for lieu in response.json()]


@pytest.mark.asyncio
async def test_list_lieux_aeriens_masque_les_inactifs_par_defaut(
    client: AsyncClient, auth_headers: dict, lieu_aerien, stand_inactif
):
    response = await client.get("/lieux-aeriens", headers=auth_headers)
    noms = [lieu["nom"] for lieu in response.json()]
    assert "Base Test" in noms
    assert "Stand Fermé" not in noms


@pytest.mark.asyncio
async def test_list_lieux_aeriens_inclure_inactifs(
    client: AsyncClient, auth_headers: dict, lieu_aerien, stand_inactif
):
    response = await client.get("/lieux-aeriens?inclure_inactifs=true", headers=auth_headers)
    noms = [lieu["nom"] for lieu in response.json()]
    assert "Base Test" in noms
    assert "Stand Fermé" in noms


@pytest.mark.asyncio
async def test_get_lieu_aerien_par_id(client: AsyncClient, auth_headers: dict, lieu_aerien):
    response = await client.get(f"/lieux-aeriens/{lieu_aerien.id}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(lieu_aerien.id)
    assert data["nom"] == "Base Test"


@pytest.mark.asyncio
async def test_get_lieu_aerien_inexistant_404(client: AsyncClient, auth_headers: dict):
    response = await client.get(f"/lieux-aeriens/{uuid.uuid4()}", headers=auth_headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_lieu_aerien_desactive(client: AsyncClient, auth_headers: dict, lieu_aerien):
    response = await client.put(
        f"/lieux-aeriens/{lieu_aerien.id}",
        json={"actif": False},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["actif"] is False

    response = await client.get("/lieux-aeriens", headers=auth_headers)
    assert lieu_aerien.id not in [uuid.UUID(lieu["id"]) for lieu in response.json()]


@pytest.mark.asyncio
async def test_update_lieu_aerien_type_lieu_invalide_422(
    client: AsyncClient, auth_headers: dict, lieu_aerien
):
    response = await client.put(
        f"/lieux-aeriens/{lieu_aerien.id}",
        json={"type_lieu": "quartier_general"},
        headers=auth_headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_update_lieu_aerien_inexistant_404(client: AsyncClient, auth_headers: dict):
    response = await client.put(
        f"/lieux-aeriens/{uuid.uuid4()}",
        json={"nom": "Peu importe"},
        headers=auth_headers,
    )
    assert response.status_code == 404
