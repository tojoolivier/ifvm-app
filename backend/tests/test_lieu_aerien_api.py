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
async def test_create_lieu_aerien(client: AsyncClient, auth_headers: dict, equipe_aerienne):
    response = await client.post(
        "/lieux-aeriens",
        json={
            "type_lieu": "stand",
            "nom": "Stand Ambositra",
            "latitude": -20.53,
            "longitude": 47.24,
            "altitude": 1265.0,
            "equipe_aerienne_id": str(equipe_aerienne.id),
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["type_lieu"] == "stand"
    assert data["nom"] == "Stand Ambositra"
    assert data["actif"] is True


@pytest.mark.asyncio
async def test_create_lieu_aerien_type_lieu_invalide_422(
    client: AsyncClient, auth_headers: dict, equipe_aerienne
):
    response = await client.post(
        "/lieux-aeriens",
        json={
            "type_lieu": "quartier_general",
            "nom": "Quelque part",
            "latitude": -20.0,
            "longitude": 47.0,
            "equipe_aerienne_id": str(equipe_aerienne.id),
        },
        headers=auth_headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_lieu_aerien_latitude_hors_bornes_422(
    client: AsyncClient, auth_headers: dict, equipe_aerienne
):
    response = await client.post(
        "/lieux-aeriens",
        json={
            "type_lieu": "principale",
            "nom": "Hors Madagascar",
            "latitude": 200.0,
            "longitude": 47.0,
            "equipe_aerienne_id": str(equipe_aerienne.id),
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


# --- Rattachement à une équipe aérienne (migration 0074) --------------------------------


@pytest.mark.asyncio
async def test_create_lieu_aerien_avec_equipe_aerienne(
    client: AsyncClient, auth_headers: dict, equipe_aerienne
):
    response = await client.post(
        "/lieux-aeriens",
        json={
            "type_lieu": "principale",
            "nom": "Base Ihosy",
            "latitude": -22.4,
            "longitude": 46.12,
            "equipe_aerienne_id": str(equipe_aerienne.id),
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["equipe_aerienne_id"] == str(equipe_aerienne.id)
    assert data["equipe_aerienne_nom"] == equipe_aerienne.nom


@pytest.mark.asyncio
async def test_create_lieu_aerien_sans_equipe_aerienne_422(client: AsyncClient, auth_headers: dict):
    """Obligatoire pour toute nouvelle création — les lieux déjà en base restent
    nullables, mais aucun nouveau lieu ne peut être créé sans équipe."""
    response = await client.post(
        "/lieux-aeriens",
        json={
            "type_lieu": "principale",
            "nom": "Base Sans Equipe",
            "latitude": -22.4,
            "longitude": 46.12,
        },
        headers=auth_headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_lieu_aerien_equipe_inexistante_409(client: AsyncClient, auth_headers: dict):
    response = await client.post(
        "/lieux-aeriens",
        json={
            "type_lieu": "principale",
            "nom": "Base Equipe Fantome",
            "latitude": -22.4,
            "longitude": 46.12,
            "equipe_aerienne_id": str(uuid.uuid4()),
        },
        headers=auth_headers,
    )
    assert response.status_code == 409
    assert response.json()["detail"] == "Équipe aérienne inconnue"


@pytest.mark.asyncio
async def test_plusieurs_lieux_aeriens_partagent_la_meme_equipe(
    client: AsyncClient, auth_headers: dict, equipe_aerienne
):
    """Pas d'UNIQUE sur `equipe_aerienne_id` : une équipe peut posséder plusieurs
    lieux (bases principales, secondaires, stands), contrairement à
    `base_aerienne.equipe_id` (1:1)."""
    lieux = [("Base A", "principale"), ("Base B", "principale"), ("Stand C", "stand")]
    for nom, type_lieu in lieux:
        response = await client.post(
            "/lieux-aeriens",
            json={
                "type_lieu": type_lieu,
                "nom": nom,
                "latitude": -22.4,
                "longitude": 46.12,
                "equipe_aerienne_id": str(equipe_aerienne.id),
            },
            headers=auth_headers,
        )
        assert response.status_code == 201, response.text

    liste = await client.get("/lieux-aeriens", headers=auth_headers)
    rattaches = [
        lieu for lieu in liste.json() if lieu["equipe_aerienne_id"] == str(equipe_aerienne.id)
    ]
    assert len(rattaches) == 3


@pytest.mark.asyncio
async def test_lieu_aerien_existant_sans_equipe_reste_lisible(
    client: AsyncClient, auth_headers: dict, lieu_aerien
):
    """Un lieu créé avant la migration 0074 (fixture directe, sans équipe) reste
    listable/consultable avec `equipe_aerienne_id`/`equipe_aerienne_nom` à null."""
    response = await client.get(f"/lieux-aeriens/{lieu_aerien.id}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["equipe_aerienne_id"] is None
    assert data["equipe_aerienne_nom"] is None


@pytest.mark.asyncio
async def test_update_lieu_aerien_rattache_un_lieu_existant_a_une_equipe(
    client: AsyncClient, auth_headers: dict, lieu_aerien, equipe_aerienne
):
    response = await client.put(
        f"/lieux-aeriens/{lieu_aerien.id}",
        json={"equipe_aerienne_id": str(equipe_aerienne.id)},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["equipe_aerienne_id"] == str(equipe_aerienne.id)
    assert data["equipe_aerienne_nom"] == equipe_aerienne.nom


@pytest.mark.asyncio
async def test_update_lieu_aerien_change_d_equipe(
    client: AsyncClient, auth_headers: dict, lieu_aerien, equipe_aerienne, equipe_aerienne_bis
):
    await client.put(
        f"/lieux-aeriens/{lieu_aerien.id}",
        json={"equipe_aerienne_id": str(equipe_aerienne.id)},
        headers=auth_headers,
    )
    response = await client.put(
        f"/lieux-aeriens/{lieu_aerien.id}",
        json={"equipe_aerienne_id": str(equipe_aerienne_bis.id)},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["equipe_aerienne_nom"] == equipe_aerienne_bis.nom


@pytest.mark.asyncio
async def test_update_lieu_aerien_equipe_inexistante_409(
    client: AsyncClient, auth_headers: dict, lieu_aerien
):
    response = await client.put(
        f"/lieux-aeriens/{lieu_aerien.id}",
        json={"equipe_aerienne_id": str(uuid.uuid4())},
        headers=auth_headers,
    )
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_update_lieu_aerien_omettre_equipe_la_laisse_inchangee(
    client: AsyncClient, auth_headers: dict, lieu_aerien, equipe_aerienne
):
    """`champs_fournis` (model_fields_set) distingue « absent » (inchangé) de
    « mis à NULL » (détachement) — même patron que `poste_acridien.equipe_terrestre_id`."""
    await client.put(
        f"/lieux-aeriens/{lieu_aerien.id}",
        json={"equipe_aerienne_id": str(equipe_aerienne.id)},
        headers=auth_headers,
    )
    response = await client.put(
        f"/lieux-aeriens/{lieu_aerien.id}",
        json={"nom": "Nouveau Nom"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["nom"] == "Nouveau Nom"
    assert data["equipe_aerienne_id"] == str(equipe_aerienne.id)


@pytest.mark.asyncio
async def test_referentiel_pull_transporte_equipe_aerienne_id(
    client: AsyncClient, auth_headers: dict, equipe_aerienne
):
    """Le pull mobile (`GET /referentiel/pull`) expose `equipe_aerienne_id` sur
    `lieux_aeriens`, pour que le cache SQLite local reste fidèle au contrat API."""
    creation = await client.post(
        "/lieux-aeriens",
        json={
            "type_lieu": "principale",
            "nom": "Base Pull",
            "latitude": -22.4,
            "longitude": 46.12,
            "equipe_aerienne_id": str(equipe_aerienne.id),
        },
        headers=auth_headers,
    )
    assert creation.status_code == 201
    lieu_id = creation.json()["id"]

    pull = await client.get("/referentiel/pull", headers=auth_headers)
    assert pull.status_code == 200
    lieu = next(u for u in pull.json()["lieux_aeriens"]["upserts"] if u["id"] == lieu_id)
    assert lieu["equipe_aerienne_id"] == str(equipe_aerienne.id)
