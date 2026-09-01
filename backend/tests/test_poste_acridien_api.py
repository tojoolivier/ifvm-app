"""Écritures du référentiel `poste_acridien` (#132).

Le pull hors-ligne (`GET /referentiel/pull`) ne transporte que des upserts : une
suppression physique resterait indéfiniment sur les téléphones déjà synchronisés.
D'où la règle vérifiée ici — `actif` en désactivation logique, aucune route `DELETE`.
"""

import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient


@pytest_asyncio.fixture
async def poste_inactif(db_session, zone_anti_acridien):
    from app.infrastructure.referentiel_model import PosteAcridienModel

    poste = PosteAcridienModel(
        id=uuid.uuid4(),
        code="PA-TEST-OFF",
        nom="Poste Fermé",
        za_id=zone_anti_acridien.id,
        actif=False,
    )
    db_session.add(poste)
    await db_session.commit()
    await db_session.refresh(poste)
    return poste


# --- GET liste -----------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_masque_les_inactifs_par_defaut(
    client: AsyncClient, auth_headers: dict, poste_acridien, poste_inactif
):
    response = await client.get("/postes-acridiens", headers=auth_headers)

    assert response.status_code == 200
    codes = [p["code"] for p in response.json()]
    assert "PA-TEST-01" in codes
    assert "PA-TEST-OFF" not in codes


@pytest.mark.asyncio
async def test_list_inclure_inactifs_retourne_les_deux_etats(
    client: AsyncClient, auth_headers: dict, poste_acridien, poste_inactif
):
    """L'écran d'administration affiche un badge « État » : il lui faut les deux."""
    response = await client.get("/postes-acridiens?inclure_inactifs=true", headers=auth_headers)

    assert response.status_code == 200
    codes = [p["code"] for p in response.json()]
    assert {"PA-TEST-01", "PA-TEST-OFF"} <= set(codes)


@pytest.mark.asyncio
async def test_list_expose_le_nombre_de_stations_rattachees(
    client: AsyncClient, auth_headers: dict, poste_acridien, station_fixe
):
    """Colonne « Stations » de la maquette : champ dérivé, jamais saisissable."""
    response = await client.get("/postes-acridiens", headers=auth_headers)

    poste = next(p for p in response.json() if p["code"] == "PA-TEST-01")
    assert poste["nb_stations"] == 1


# --- GET /{id} -----------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_par_id(client: AsyncClient, auth_headers: dict, poste_acridien):
    response = await client.get(f"/postes-acridiens/{poste_acridien.id}", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(poste_acridien.id)
    assert data["code"] == "PA-TEST-01"
    assert data["za_code"] == "ZA-TEST-01"
    assert data["za_nom"] == "Zone Test"
    assert data["actif"] is True
    assert data["nb_stations"] == 0


@pytest.mark.asyncio
async def test_get_inexistant_retourne_404(client: AsyncClient, auth_headers: dict):
    response = await client.get(f"/postes-acridiens/{uuid.uuid4()}", headers=auth_headers)

    assert response.status_code == 404


# --- POST ----------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create(client: AsyncClient, auth_headers: dict, zone_anti_acridien):
    response = await client.post(
        "/postes-acridiens",
        json={"code": "PA-NEW-01", "nom": "Poste Neuf", "za_id": str(zone_anti_acridien.id)},
        headers=auth_headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["code"] == "PA-NEW-01"
    assert data["nom"] == "Poste Neuf"
    assert data["za_id"] == str(zone_anti_acridien.id)
    assert data["za_nom"] == "Zone Test"
    assert data["actif"] is True
    assert data["nb_stations"] == 0


@pytest.mark.asyncio
async def test_create_est_relu_par_la_liste(
    client: AsyncClient, auth_headers: dict, zone_anti_acridien
):
    await client.post(
        "/postes-acridiens",
        json={"code": "PA-NEW-02", "nom": "Poste Neuf", "za_id": str(zone_anti_acridien.id)},
        headers=auth_headers,
    )

    response = await client.get("/postes-acridiens", headers=auth_headers)
    assert "PA-NEW-02" in [p["code"] for p in response.json()]


@pytest.mark.asyncio
async def test_create_code_deja_pris_retourne_409(
    client: AsyncClient, auth_headers: dict, poste_acridien, zone_anti_acridien
):
    response = await client.post(
        "/postes-acridiens",
        json={"code": "PA-TEST-01", "nom": "Doublon", "za_id": str(zone_anti_acridien.id)},
        headers=auth_headers,
    )

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_create_zone_inexistante_retourne_409(client: AsyncClient, auth_headers: dict):
    response = await client.post(
        "/postes-acridiens",
        json={"code": "PA-NEW-03", "nom": "Poste Orphelin", "za_id": str(uuid.uuid4())},
        headers=auth_headers,
    )

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_create_code_vide_retourne_422(
    client: AsyncClient, auth_headers: dict, zone_anti_acridien
):
    response = await client.post(
        "/postes-acridiens",
        json={"code": "   ", "nom": "Sans code", "za_id": str(zone_anti_acridien.id)},
        headers=auth_headers,
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_sans_authentification_retourne_401(client: AsyncClient, zone_anti_acridien):
    response = await client.post(
        "/postes-acridiens",
        json={"code": "PA-NEW-04", "nom": "Anonyme", "za_id": str(zone_anti_acridien.id)},
    )

    assert response.status_code == 401


# --- PUT -----------------------------------------------------------------------


@pytest.mark.asyncio
async def test_update_nom(client: AsyncClient, auth_headers: dict, poste_acridien):
    response = await client.put(
        f"/postes-acridiens/{poste_acridien.id}",
        json={"nom": "Poste Renommé"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["nom"] == "Poste Renommé"
    assert response.json()["code"] == "PA-TEST-01"


@pytest.mark.asyncio
async def test_update_avance_updated_at_pour_le_pull_hors_ligne(
    client: AsyncClient, auth_headers: dict, poste_acridien
):
    """Sans `updated_at` remis à jour, le téléphone ne reverrait jamais la modification."""
    avant = (
        await client.get(f"/postes-acridiens/{poste_acridien.id}", headers=auth_headers)
    ).json()["updated_at"]

    apres = (
        await client.put(
            f"/postes-acridiens/{poste_acridien.id}",
            json={"nom": "Poste Renommé"},
            headers=auth_headers,
        )
    ).json()["updated_at"]

    assert apres > avant


@pytest.mark.asyncio
async def test_update_desactive_un_poste_sans_station(
    client: AsyncClient, auth_headers: dict, poste_acridien
):
    response = await client.put(
        f"/postes-acridiens/{poste_acridien.id}",
        json={"actif": False},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["actif"] is False


@pytest.mark.asyncio
async def test_update_refuse_de_desactiver_un_poste_avec_stations_actives(
    client: AsyncClient, auth_headers: dict, poste_acridien, station_fixe
):
    """Désactiver ne se propage pas : refuser plutôt qu'orpheliner les stations."""
    response = await client.put(
        f"/postes-acridiens/{poste_acridien.id}",
        json={"actif": False},
        headers=auth_headers,
    )

    assert response.status_code == 409
    assert "station" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_update_reactive_sans_controle_de_stations(
    client: AsyncClient, auth_headers: dict, poste_inactif
):
    response = await client.put(
        f"/postes-acridiens/{poste_inactif.id}",
        json={"actif": True},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["actif"] is True


@pytest.mark.asyncio
async def test_update_change_de_zone(
    client: AsyncClient, auth_headers: dict, poste_acridien, db_session
):
    from app.infrastructure.referentiel_model import ZoneAntiAcridienModel

    autre = ZoneAntiAcridienModel(id=uuid.uuid4(), code="ZA-TEST-02", nom="Zone Bis")
    db_session.add(autre)
    await db_session.commit()

    response = await client.put(
        f"/postes-acridiens/{poste_acridien.id}",
        json={"za_id": str(autre.id)},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["za_nom"] == "Zone Bis"


@pytest.mark.asyncio
async def test_update_zone_inexistante_retourne_409(
    client: AsyncClient, auth_headers: dict, poste_acridien
):
    response = await client.put(
        f"/postes-acridiens/{poste_acridien.id}",
        json={"za_id": str(uuid.uuid4())},
        headers=auth_headers,
    )

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_update_code_deja_pris_retourne_409(
    client: AsyncClient, auth_headers: dict, poste_acridien, poste_inactif
):
    response = await client.put(
        f"/postes-acridiens/{poste_acridien.id}",
        json={"code": "PA-TEST-OFF"},
        headers=auth_headers,
    )

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_update_meme_code_reste_accepte(
    client: AsyncClient, auth_headers: dict, poste_acridien
):
    """Renvoyer le formulaire inchangé ne doit pas se heurter à sa propre unicité."""
    response = await client.put(
        f"/postes-acridiens/{poste_acridien.id}",
        json={"code": "PA-TEST-01", "nom": "Poste Test"},
        headers=auth_headers,
    )

    assert response.status_code == 200


@pytest.mark.asyncio
async def test_update_inexistant_retourne_404(client: AsyncClient, auth_headers: dict):
    response = await client.put(
        f"/postes-acridiens/{uuid.uuid4()}",
        json={"nom": "Fantôme"},
        headers=auth_headers,
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_ignore_nb_stations_champ_derive(
    client: AsyncClient, auth_headers: dict, poste_acridien, station_fixe
):
    response = await client.put(
        f"/postes-acridiens/{poste_acridien.id}",
        json={"nom": "Poste Test", "nb_stations": 99},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["nb_stations"] == 1


# --- Pas de suppression physique -----------------------------------------------


@pytest.mark.asyncio
async def test_aucune_route_delete(client: AsyncClient, auth_headers: dict, poste_acridien):
    """Le pull ne transporte que des upserts : une ligne supprimée resterait sur les
    téléphones déjà synchronisés. La désactivation logique est la seule sortie."""
    response = await client.delete(f"/postes-acridiens/{poste_acridien.id}", headers=auth_headers)

    assert response.status_code == 405


# --- Propagation au pull hors-ligne --------------------------------------------


@pytest.mark.asyncio
async def test_desactivation_repercutee_dans_le_pull(
    client: AsyncClient, auth_headers: dict, poste_acridien
):
    await client.put(
        f"/postes-acridiens/{poste_acridien.id}",
        json={"actif": False},
        headers=auth_headers,
    )

    pull = await client.get("/referentiel/pull", headers=auth_headers)
    postes = pull.json()["postes_acridiens"]["upserts"]
    poste = next(p for p in postes if p["id"] == str(poste_acridien.id))
    assert poste["actif"] is False
