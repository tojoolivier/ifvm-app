"""Historisation des positions d'un site aérien (migration 0088, #604) : installer,
démonter, réinstaller ailleurs, lire l'historique complet avec la durée d'implantation
dérivée, lire la position active, refuser une seconde position active."""

import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_installer_une_position(client: AsyncClient, admin_headers: dict, base_aerienne):
    response = await client.post(
        f"/sites-aeriens/{base_aerienne.id}/positions",
        json={"latitude": -22.4021, "longitude": 46.1250, "altitude": 764.0},
        headers=admin_headers,
    )
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["site_id"] == str(base_aerienne.id)
    assert data["date_fin"] is None
    assert data["duree_jours"] == 0


@pytest.mark.asyncio
async def test_installer_refuse_une_seconde_position_active_409(
    client: AsyncClient, admin_headers: dict, base_aerienne
):
    await client.post(
        f"/sites-aeriens/{base_aerienne.id}/positions",
        json={"latitude": -22.4021, "longitude": 46.1250},
        headers=admin_headers,
    )
    reponse = await client.post(
        f"/sites-aeriens/{base_aerienne.id}/positions",
        json={"latitude": -22.5, "longitude": 46.2},
        headers=admin_headers,
    )
    assert reponse.status_code == 409


@pytest.mark.asyncio
async def test_demonter_sans_position_active_404(
    client: AsyncClient, admin_headers: dict, base_aerienne
):
    reponse = await client.post(
        f"/sites-aeriens/{base_aerienne.id}/positions/demonter", headers=admin_headers
    )
    assert reponse.status_code == 404


@pytest.mark.asyncio
async def test_demonter_puis_reinstaller_ailleurs(
    client: AsyncClient, admin_headers: dict, base_aerienne
):
    await client.post(
        f"/sites-aeriens/{base_aerienne.id}/positions",
        json={"latitude": -22.4021, "longitude": 46.1250},
        headers=admin_headers,
    )
    demontage = await client.post(
        f"/sites-aeriens/{base_aerienne.id}/positions/demonter", headers=admin_headers
    )
    assert demontage.status_code == 200
    assert demontage.json()["date_fin"] is not None

    reinstallation = await client.post(
        f"/sites-aeriens/{base_aerienne.id}/positions",
        json={"latitude": -22.5, "longitude": 46.2},
        headers=admin_headers,
    )
    assert reinstallation.status_code == 201
    assert reinstallation.json()["date_fin"] is None
    assert reinstallation.json()["latitude"] == -22.5


@pytest.mark.asyncio
async def test_historique_complet_apres_reinstallation(
    client: AsyncClient, admin_headers: dict, base_aerienne
):
    await client.post(
        f"/sites-aeriens/{base_aerienne.id}/positions",
        json={"latitude": -22.4021, "longitude": 46.1250},
        headers=admin_headers,
    )
    await client.post(
        f"/sites-aeriens/{base_aerienne.id}/positions/demonter", headers=admin_headers
    )
    await client.post(
        f"/sites-aeriens/{base_aerienne.id}/positions",
        json={"latitude": -22.5, "longitude": 46.2},
        headers=admin_headers,
    )

    historique = await client.get(
        f"/sites-aeriens/{base_aerienne.id}/positions", headers=admin_headers
    )
    assert historique.status_code == 200
    positions = historique.json()
    assert len(positions) == 2
    assert all("duree_jours" in p for p in positions)


@pytest.mark.asyncio
async def test_lire_la_position_active(client: AsyncClient, admin_headers: dict, base_aerienne):
    await client.post(
        f"/sites-aeriens/{base_aerienne.id}/positions",
        json={"latitude": -22.4021, "longitude": 46.1250},
        headers=admin_headers,
    )
    active = await client.get(
        f"/sites-aeriens/{base_aerienne.id}/positions/active", headers=admin_headers
    )
    assert active.status_code == 200
    assert active.json()["date_fin"] is None


@pytest.mark.asyncio
async def test_position_active_inexistante_404(
    client: AsyncClient, admin_headers: dict, base_aerienne
):
    reponse = await client.get(
        f"/sites-aeriens/{base_aerienne.id}/positions/active", headers=admin_headers
    )
    assert reponse.status_code == 404


@pytest.mark.asyncio
async def test_installer_sur_un_site_secondaire(
    client: AsyncClient, admin_headers: dict, base_aerienne
):
    """Un site secondaire (base secondaire ou stand — indistinguables depuis #604)
    installe/démonte une position exactement comme un principal."""
    secondaire = await client.post(
        "/sites-aeriens",
        json={"numero": "IHO02", "localite": "Ihosy Sud", "parent_site_id": str(base_aerienne.id)},
        headers=admin_headers,
    )
    site_id = secondaire.json()["id"]
    reponse = await client.post(
        f"/sites-aeriens/{site_id}/positions",
        json={"latitude": -22.45, "longitude": 46.15},
        headers=admin_headers,
    )
    assert reponse.status_code == 201, reponse.text


@pytest.mark.asyncio
async def test_installer_sur_un_site_inexistant_404(client: AsyncClient, admin_headers: dict):
    reponse = await client.post(
        f"/sites-aeriens/{uuid.uuid4()}/positions",
        json={"latitude": -22.4, "longitude": 46.1},
        headers=admin_headers,
    )
    assert reponse.status_code == 404


@pytest.mark.asyncio
async def test_demonter_sur_un_site_inexistant_404(client: AsyncClient, admin_headers: dict):
    reponse = await client.post(
        f"/sites-aeriens/{uuid.uuid4()}/positions/demonter", headers=admin_headers
    )
    assert reponse.status_code == 404
