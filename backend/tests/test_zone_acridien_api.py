"""Écritures du référentiel `zone_anti_acridien` (#equipe-terrestre, migration 0073).

Comme `poste_acridien` (#132) : le pull hors-ligne ne transporte que des upserts,
aucune route DELETE, la sortie de service passe par `actif=false` — bloquée tant
que des postes actifs sont rattachés (même garde-fou que poste_acridien ->
station_fixe, un niveau plus haut dans la hiérarchie).
"""

import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient


@pytest_asyncio.fixture
async def zone_inactive(db_session):
    from app.infrastructure.referentiel_model import ZoneAntiAcridienModel

    zone = ZoneAntiAcridienModel(
        id=uuid.uuid4(), code="ZA-TEST-OFF", nom="Zone Fermée", actif=False
    )
    db_session.add(zone)
    await db_session.commit()
    await db_session.refresh(zone)
    return zone


# --- GET liste -------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_masque_les_inactives_par_defaut(
    client: AsyncClient, auth_headers: dict, zone_anti_acridien, zone_inactive
):
    response = await client.get("/zones-anti-acridiennes", headers=auth_headers)

    assert response.status_code == 200
    codes = [z["code"] for z in response.json()]
    assert "ZA-TEST-01" in codes
    assert "ZA-TEST-OFF" not in codes


@pytest.mark.asyncio
async def test_list_inclure_inactives_retourne_les_deux_etats(
    client: AsyncClient, auth_headers: dict, zone_anti_acridien, zone_inactive
):
    response = await client.get(
        "/zones-anti-acridiennes?inclure_inactifs=true", headers=auth_headers
    )

    assert response.status_code == 200
    codes = [z["code"] for z in response.json()]
    assert {"ZA-TEST-01", "ZA-TEST-OFF"} <= set(codes)


# --- POST --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create(client: AsyncClient, auth_headers: dict):
    response = await client.post(
        "/zones-anti-acridiennes",
        json={"code": "ZA-NEW-01", "nom": "Zone Neuve"},
        headers=auth_headers,
    )

    assert response.status_code == 201, response.text
    data = response.json()
    assert data["code"] == "ZA-NEW-01"
    assert data["nom"] == "Zone Neuve"
    assert data["actif"] is True


@pytest.mark.asyncio
async def test_create_code_deja_pris_retourne_409(
    client: AsyncClient, auth_headers: dict, zone_anti_acridien
):
    response = await client.post(
        "/zones-anti-acridiennes",
        json={"code": "ZA-TEST-01", "nom": "Doublon"},
        headers=auth_headers,
    )

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_create_code_vide_retourne_422(client: AsyncClient, auth_headers: dict):
    response = await client.post(
        "/zones-anti-acridiennes",
        json={"code": "   ", "nom": "Sans code"},
        headers=auth_headers,
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_sans_authentification_retourne_401(client: AsyncClient):
    response = await client.post(
        "/zones-anti-acridiennes",
        json={"code": "ZA-NEW-02", "nom": "Anonyme"},
    )

    assert response.status_code == 401


# --- PUT -----------------------------------------------------------------------


@pytest.mark.asyncio
async def test_update_nom(client: AsyncClient, auth_headers: dict, zone_anti_acridien):
    response = await client.put(
        f"/zones-anti-acridiennes/{zone_anti_acridien.id}",
        json={"nom": "Zone Renommée"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["nom"] == "Zone Renommée"
    assert response.json()["code"] == "ZA-TEST-01"


@pytest.mark.asyncio
async def test_update_desactive_une_zone_sans_poste_actif(
    client: AsyncClient, auth_headers: dict, zone_anti_acridien
):
    response = await client.put(
        f"/zones-anti-acridiennes/{zone_anti_acridien.id}",
        json={"actif": False},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["actif"] is False


@pytest.mark.asyncio
async def test_update_refuse_de_desactiver_une_zone_avec_postes_actifs(
    client: AsyncClient, auth_headers: dict, zone_anti_acridien, poste_acridien
):
    response = await client.put(
        f"/zones-anti-acridiennes/{zone_anti_acridien.id}",
        json={"actif": False},
        headers=auth_headers,
    )

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_update_reactive_sans_controle_de_postes(
    client: AsyncClient, auth_headers: dict, zone_inactive
):
    response = await client.put(
        f"/zones-anti-acridiennes/{zone_inactive.id}",
        json={"actif": True},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["actif"] is True


@pytest.mark.asyncio
async def test_update_code_deja_pris_retourne_409(
    client: AsyncClient, auth_headers: dict, zone_anti_acridien, zone_inactive
):
    response = await client.put(
        f"/zones-anti-acridiennes/{zone_anti_acridien.id}",
        json={"code": "ZA-TEST-OFF"},
        headers=auth_headers,
    )

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_update_meme_code_reste_accepte(
    client: AsyncClient, auth_headers: dict, zone_anti_acridien
):
    response = await client.put(
        f"/zones-anti-acridiennes/{zone_anti_acridien.id}",
        json={"code": "ZA-TEST-01", "nom": "Zone Test"},
        headers=auth_headers,
    )

    assert response.status_code == 200


@pytest.mark.asyncio
async def test_update_inexistante_retourne_404(client: AsyncClient, auth_headers: dict):
    response = await client.put(
        f"/zones-anti-acridiennes/{uuid.uuid4()}",
        json={"nom": "Fantôme"},
        headers=auth_headers,
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_suppression_reservee_a_ladmin(
    client: AsyncClient, auth_headers: dict, zone_anti_acridien
):
    response = await client.delete(
        f"/zones-anti-acridiennes/{zone_anti_acridien.id}", headers=auth_headers
    )

    assert response.status_code == 403
