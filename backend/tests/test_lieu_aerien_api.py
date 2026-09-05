"""Écritures du référentiel `lieu_aerien` — #prospection-lieu-base.

Comme les autres référentiels partagés (culture, poste acridien, ...), aucune
route DELETE : le pull hors-ligne ne transporte que des upserts, une suppression
physique resterait indéfiniment sur les téléphones déjà synchronisés — d'où la
désactivation logique (`actif=false`).
"""

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
        nom="Tuléar",
        latitude=-23.35,
        longitude=43.68,
        actif=True,
    )
    db_session.add(lieu)
    await db_session.commit()
    await db_session.refresh(lieu)
    return lieu


@pytest_asyncio.fixture
async def lieu_aerien_inactif(db_session):
    from app.infrastructure.referentiel_model import LieuAerienModel

    lieu = LieuAerienModel(
        id=uuid.uuid4(),
        type_lieu="stand",
        nom="Stand abandonné",
        latitude=-20.0,
        longitude=47.0,
        actif=False,
    )
    db_session.add(lieu)
    await db_session.commit()
    await db_session.refresh(lieu)
    return lieu


@pytest.mark.asyncio
async def test_list_lieux_aeriens(client: AsyncClient, auth_headers: dict, lieu_aerien):
    response = await client.get("/lieux-aeriens", headers=auth_headers)

    assert response.status_code == 200
    noms = [lieu["nom"] for lieu in response.json()]
    assert "Tuléar" in noms


@pytest.mark.asyncio
async def test_list_lieux_aeriens_masque_les_inactifs_par_defaut(
    client: AsyncClient, auth_headers: dict, lieu_aerien, lieu_aerien_inactif
):
    """Le sélecteur BASE de la prospection ne doit proposer que l'actif."""
    response = await client.get("/lieux-aeriens", headers=auth_headers)

    assert response.status_code == 200
    noms = [lieu["nom"] for lieu in response.json()]
    assert "Tuléar" in noms
    assert "Stand abandonné" not in noms


@pytest.mark.asyncio
async def test_list_lieux_aeriens_inclure_inactifs_retourne_les_deux_etats(
    client: AsyncClient, auth_headers: dict, lieu_aerien, lieu_aerien_inactif
):
    response = await client.get("/lieux-aeriens?inclure_inactifs=true", headers=auth_headers)

    assert response.status_code == 200
    noms = [lieu["nom"] for lieu in response.json()]
    assert {"Tuléar", "Stand abandonné"} <= set(noms)


@pytest.mark.asyncio
async def test_list_lieux_aeriens_filtre_par_type_lieu(
    client: AsyncClient, auth_headers: dict, lieu_aerien
):
    """C'est ce filtre que le mobile utilise pour ne proposer que les bases
    « principale » dans le sélecteur BASE de la prospection extensive aérienne."""
    response = await client.get("/lieux-aeriens?type_lieu=stand", headers=auth_headers)

    assert response.status_code == 200
    noms = [lieu["nom"] for lieu in response.json()]
    assert "Tuléar" not in noms


@pytest.mark.asyncio
async def test_list_lieux_aeriens_sans_authentification_refuse(client: AsyncClient):
    response = await client.get("/lieux-aeriens")

    assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_get_lieu_aerien_par_id(client: AsyncClient, auth_headers: dict, lieu_aerien):
    response = await client.get(f"/lieux-aeriens/{lieu_aerien.id}", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(lieu_aerien.id)
    assert data["type_lieu"] == "principale"
    assert data["nom"] == "Tuléar"
    assert data["actif"] is True


@pytest.mark.asyncio
async def test_get_lieu_aerien_inexistant_retourne_404(client: AsyncClient, auth_headers: dict):
    response = await client.get(f"/lieux-aeriens/{uuid.uuid4()}", headers=auth_headers)

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_create_lieu_aerien(client: AsyncClient, auth_headers: dict):
    response = await client.post(
        "/lieux-aeriens",
        json={"type_lieu": "principale", "nom": "Ihosy", "latitude": -22.4, "longitude": 46.12},
        headers=auth_headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["type_lieu"] == "principale"
    assert data["nom"] == "Ihosy"
    # Un lieu créé depuis l'administration est actif par défaut.
    assert data["actif"] is True
    assert data["updated_at"] is not None


@pytest.mark.asyncio
async def test_create_lieu_aerien_type_lieu_invalide_retourne_422(
    client: AsyncClient, auth_headers: dict
):
    response = await client.post(
        "/lieux-aeriens",
        json={"type_lieu": "annexe", "nom": "Lieu fantôme", "latitude": 0, "longitude": 0},
        headers=auth_headers,
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_lieu_aerien_latitude_hors_bornes_retourne_422(
    client: AsyncClient, auth_headers: dict
):
    response = await client.post(
        "/lieux-aeriens",
        json={"type_lieu": "principale", "nom": "Hors bornes", "latitude": 91, "longitude": 0},
        headers=auth_headers,
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_update_lieu_aerien(client: AsyncClient, auth_headers: dict, lieu_aerien):
    response = await client.put(
        f"/lieux-aeriens/{lieu_aerien.id}", json={"nom": "Tuléar aéroport"}, headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["nom"] == "Tuléar aéroport"
    # Champ non transmis : inchangé.
    assert data["type_lieu"] == "principale"


@pytest.mark.asyncio
async def test_update_lieu_aerien_desactivation_logique(
    client: AsyncClient, auth_headers: dict, lieu_aerien
):
    """La « suppression » depuis l'administration est un passage de `actif` à false."""
    response = await client.put(
        f"/lieux-aeriens/{lieu_aerien.id}", json={"actif": False}, headers=auth_headers
    )

    assert response.status_code == 200
    assert response.json()["actif"] is False

    relecture = await client.get(f"/lieux-aeriens/{lieu_aerien.id}", headers=auth_headers)
    assert relecture.status_code == 200
    assert relecture.json()["actif"] is False


@pytest.mark.asyncio
async def test_update_lieu_aerien_type_lieu_invalide_retourne_422(
    client: AsyncClient, auth_headers: dict, lieu_aerien
):
    response = await client.put(
        f"/lieux-aeriens/{lieu_aerien.id}", json={"type_lieu": "annexe"}, headers=auth_headers
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_update_lieu_aerien_inexistant_retourne_404(client: AsyncClient, auth_headers: dict):
    response = await client.put(
        f"/lieux-aeriens/{uuid.uuid4()}", json={"nom": "Fantôme"}, headers=auth_headers
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_pas_de_suppression_physique(client: AsyncClient, auth_headers: dict, lieu_aerien):
    """Aucune route DELETE : le pull ne transporte que des upserts, une ligne
    supprimée en base resterait sur les téléphones déjà synchronisés."""
    response = await client.delete(f"/lieux-aeriens/{lieu_aerien.id}", headers=auth_headers)

    assert response.status_code == 405


@pytest.mark.asyncio
async def test_lieu_aerien_desactive_reste_dans_le_pull(
    client: AsyncClient, auth_headers: dict, lieu_aerien
):
    """C'est tout l'intérêt de la désactivation : le terrain reçoit l'état `actif=false`."""
    await client.put(f"/lieux-aeriens/{lieu_aerien.id}", json={"actif": False}, headers=auth_headers)

    pull = await client.get("/referentiel/pull", headers=auth_headers)

    assert pull.status_code == 200
    lieux = pull.json()["lieux_aeriens"]["upserts"]
    ligne = next(lieu for lieu in lieux if lieu["id"] == str(lieu_aerien.id))
    assert ligne["actif"] is False
