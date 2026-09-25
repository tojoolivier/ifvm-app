"""Écritures du référentiel `station_fixe` (issue #133).

Deux invariants structurent ce fichier :

- **Aucune suppression physique.** `GET /referentiel/pull` ne transporte que des
  upserts : une station effacée en base resterait indéfiniment sur les téléphones
  déjà synchronisés, et elle est de toute façon référencée par des prospections.
  La sortie de service passe par `actif=false`.
- **`pa_id` est une FK vers un poste acridien vivant.** Rattacher une station à un
  poste inexistant ou désactivé produirait une ligne inatteignable côté terrain.
"""

import uuid
from datetime import datetime, timedelta, timezone

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
    return poste


def payload_station(poste_acridien, commune, **overrides) -> dict:
    body = {
        "code": "ST-NEW-001",
        "nom": "Station Nouvelle",
        "pa_id": str(poste_acridien.id),
        "latitude": -19.5,
        "longitude": 46.25,
        "altitude": 820.0,
        "commune_id": str(commune.id),
    }
    body.update(overrides)
    return body


# --- POST /stations ----------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_station(client: AsyncClient, auth_headers: dict, poste_acridien, commune):
    response = await client.post(
        "/stations", json=payload_station(poste_acridien, commune), headers=auth_headers
    )

    assert response.status_code == 201
    data = response.json()
    assert data["code"] == "ST-NEW-001"
    assert data["nom"] == "Station Nouvelle"
    assert data["pa_id"] == str(poste_acridien.id)
    assert data["latitude"] == -19.5
    assert data["longitude"] == 46.25
    assert data["altitude"] == 820.0
    assert data["commune_id"] == str(commune.id)
    # Une station naît en service : le formulaire d'ajout n'a pas d'interrupteur.
    assert data["actif"] is True


@pytest.mark.asyncio
async def test_create_station_resout_les_libelles_geographiques(
    client: AsyncClient, auth_headers: dict, poste_acridien, commune
):
    """La réponse porte les libellés joints, pas seulement les FK — l'écran
    d'administration affiche « Poste acridien » et « Commune / District / Région »."""
    response = await client.post(
        "/stations", json=payload_station(poste_acridien, commune), headers=auth_headers
    )

    assert response.status_code == 201
    data = response.json()
    assert data["pa_code"] == "PA-TEST-01"
    assert data["pa_nom"] == "Poste Test"
    assert data["commune"] == "Commune Test"
    assert data["district"] == "District Test"
    assert data["region"] == "Région Test"


@pytest.mark.asyncio
async def test_create_station_altitude_optionnelle(
    client: AsyncClient, auth_headers: dict, poste_acridien, commune
):
    response = await client.post(
        "/stations",
        json=payload_station(poste_acridien, commune, altitude=None),
        headers=auth_headers,
    )

    assert response.status_code == 201
    assert response.json()["altitude"] is None


@pytest.mark.asyncio
async def test_create_station_apparait_dans_la_liste(
    client: AsyncClient, auth_headers: dict, poste_acridien, commune
):
    await client.post(
        "/stations", json=payload_station(poste_acridien, commune), headers=auth_headers
    )

    response = await client.get("/stations", headers=auth_headers)
    assert "ST-NEW-001" in [s["code"] for s in response.json()]


@pytest.mark.asyncio
async def test_create_station_code_deja_utilise_retourne_409(
    client: AsyncClient, auth_headers: dict, station_fixe, poste_acridien, commune
):
    """`station_fixe.code` est UNIQUE : un 409 lisible plutôt qu'une IntegrityError 500."""
    response = await client.post(
        "/stations",
        json=payload_station(poste_acridien, commune, code="ST-TEST-001"),
        headers=auth_headers,
    )

    assert response.status_code == 409
    assert "ST-TEST-001" in response.json()["detail"]


@pytest.mark.asyncio
async def test_create_station_poste_inconnu_retourne_409(
    client: AsyncClient, auth_headers: dict, poste_acridien, commune
):
    response = await client.post(
        "/stations",
        json=payload_station(poste_acridien, commune, pa_id=str(uuid.uuid4())),
        headers=auth_headers,
    )

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_create_station_poste_inactif_retourne_409(
    client: AsyncClient, auth_headers: dict, poste_inactif, commune
):
    """Rattacher une station vivante à un poste hors service produirait une ligne
    que le terrain ne peut plus atteindre."""
    response = await client.post(
        "/stations",
        json=payload_station(poste_inactif, commune, pa_id=str(poste_inactif.id)),
        headers=auth_headers,
    )

    assert response.status_code == 409
    assert "désactivé" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_create_station_commune_inconnue_retourne_409(
    client: AsyncClient, auth_headers: dict, poste_acridien, commune
):
    response = await client.post(
        "/stations",
        json=payload_station(poste_acridien, commune, commune_id=str(uuid.uuid4())),
        headers=auth_headers,
    )

    assert response.status_code == 409


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "champ,valeur",
    [
        ("code", ""),
        ("nom", ""),
        ("latitude", -91.0),
        ("latitude", 91.0),
        ("longitude", -181.0),
        ("longitude", 181.0),
    ],
)
async def test_create_station_payload_invalide_retourne_422(
    client: AsyncClient, auth_headers: dict, poste_acridien, commune, champ, valeur
):
    response = await client.post(
        "/stations",
        json=payload_station(poste_acridien, commune, **{champ: valeur}),
        headers=auth_headers,
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_station_sans_authentification_retourne_401(
    client: AsyncClient, poste_acridien, commune
):
    response = await client.post("/stations", json=payload_station(poste_acridien, commune))

    assert response.status_code == 401


# --- PUT /stations/{id} ------------------------------------------------------------


@pytest.mark.asyncio
async def test_update_station(client: AsyncClient, auth_headers: dict, station_fixe):
    response = await client.put(
        f"/stations/{station_fixe.id}",
        json={"nom": "Station Renommée", "altitude": 1200.0},
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["nom"] == "Station Renommée"
    assert data["altitude"] == 1200.0
    # Mise à jour partielle : ce qui n'est pas envoyé ne bouge pas.
    assert data["code"] == "ST-TEST-001"
    assert data["latitude"] == -20.0


@pytest.mark.asyncio
async def test_update_station_altitude_effacable(
    client: AsyncClient, auth_headers: dict, station_fixe
):
    """`altitude` est nullable : `null` explicite l'efface, absence = inchangé."""
    response = await client.put(
        f"/stations/{station_fixe.id}", json={"altitude": None}, headers=auth_headers
    )

    assert response.status_code == 200
    assert response.json()["altitude"] is None


@pytest.mark.asyncio
async def test_update_station_avance_updated_at(
    client: AsyncClient, auth_headers: dict, station_fixe
):
    """Le curseur du pull hors-ligne est `updated_at` : sans avancement, le téléphone
    ne reverra jamais la modification."""
    avant = station_fixe.updated_at
    if avant.tzinfo is None:
        avant = avant.replace(tzinfo=timezone.utc)

    response = await client.put(
        f"/stations/{station_fixe.id}", json={"nom": "Station Bougée"}, headers=auth_headers
    )

    assert response.status_code == 200
    apres = datetime.fromisoformat(response.json()["updated_at"])
    assert apres > avant


@pytest.mark.asyncio
async def test_update_station_desactive(client: AsyncClient, auth_headers: dict, station_fixe):
    response = await client.put(
        f"/stations/{station_fixe.id}", json={"actif": False}, headers=auth_headers
    )

    assert response.status_code == 200
    assert response.json()["actif"] is False


@pytest.mark.asyncio
async def test_station_desactivee_sort_de_la_liste_mais_reste_lisible(
    client: AsyncClient, auth_headers: dict, station_fixe
):
    await client.put(f"/stations/{station_fixe.id}", json={"actif": False}, headers=auth_headers)

    liste = await client.get("/stations", headers=auth_headers)
    assert "ST-TEST-001" not in [s["code"] for s in liste.json()]

    admin = await client.get("/stations?inclure_inactifs=true", headers=auth_headers)
    assert "ST-TEST-001" in [s["code"] for s in admin.json()]

    detail = await client.get(f"/stations/{station_fixe.id}", headers=auth_headers)
    assert detail.status_code == 200


@pytest.mark.asyncio
async def test_station_desactivee_est_poussee_au_terrain(
    client: AsyncClient, auth_headers: dict, station_fixe
):
    """La désactivation ne vaut que si le téléphone la reçoit : elle doit ressortir du
    pull comme un upsert `actif=false`, jamais comme une disparition."""
    depuis = (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()

    await client.put(f"/stations/{station_fixe.id}", json={"actif": False}, headers=auth_headers)

    response = await client.get(
        "/referentiel/pull",
        params={"since_stations_fixes": depuis},
        headers=auth_headers,
    )
    assert response.status_code == 200
    upserts = response.json()["stations_fixes"]["upserts"]
    poussee = [s for s in upserts if s["id"] == str(station_fixe.id)]
    assert poussee, "la station désactivée doit être poussée au terrain"
    assert poussee[0]["actif"] is False


@pytest.mark.asyncio
async def test_update_station_reactive(client: AsyncClient, auth_headers: dict, station_fixe):
    await client.put(f"/stations/{station_fixe.id}", json={"actif": False}, headers=auth_headers)

    response = await client.put(
        f"/stations/{station_fixe.id}", json={"actif": True}, headers=auth_headers
    )

    assert response.status_code == 200
    assert response.json()["actif"] is True


@pytest.mark.asyncio
async def test_update_station_inexistante_retourne_404(client: AsyncClient, auth_headers: dict):
    response = await client.put(
        f"/stations/{uuid.uuid4()}", json={"nom": "Fantôme"}, headers=auth_headers
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_station_code_deja_utilise_retourne_409(
    client: AsyncClient, auth_headers: dict, station_fixe, poste_acridien, commune
):
    creation = await client.post(
        "/stations", json=payload_station(poste_acridien, commune), headers=auth_headers
    )
    autre_id = creation.json()["id"]

    response = await client.put(
        f"/stations/{autre_id}", json={"code": "ST-TEST-001"}, headers=auth_headers
    )

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_update_station_conserve_son_propre_code(
    client: AsyncClient, auth_headers: dict, station_fixe
):
    """Renvoyer son code inchangé n'est pas un conflit avec soi-même."""
    response = await client.put(
        f"/stations/{station_fixe.id}",
        json={"code": "ST-TEST-001", "nom": "Station Test"},
        headers=auth_headers,
    )

    assert response.status_code == 200


@pytest.mark.asyncio
async def test_update_station_poste_inactif_retourne_409(
    client: AsyncClient, auth_headers: dict, station_fixe, poste_inactif
):
    response = await client.put(
        f"/stations/{station_fixe.id}",
        json={"pa_id": str(poste_inactif.id)},
        headers=auth_headers,
    )

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_update_station_deja_sous_poste_inactif_reste_editable(
    client: AsyncClient, auth_headers: dict, station_fixe, poste_inactif, db_session
):
    """Un poste fermé interdit un *nouveau* rattachement, pas la retouche d'une station
    qui lui était déjà rattachée : sinon la donnée héritée deviendrait intouchable, on
    ne pourrait même plus la désactiver."""
    from app.infrastructure.referentiel_model import StationFixeModel

    station = await db_session.get(StationFixeModel, station_fixe.id)
    station.pa_id = poste_inactif.id
    await db_session.commit()

    response = await client.put(
        f"/stations/{station_fixe.id}", json={"actif": False}, headers=auth_headers
    )

    assert response.status_code == 200
    assert response.json()["actif"] is False


@pytest.mark.asyncio
async def test_update_station_poste_inconnu_retourne_409(
    client: AsyncClient, auth_headers: dict, station_fixe
):
    response = await client.put(
        f"/stations/{station_fixe.id}", json={"pa_id": str(uuid.uuid4())}, headers=auth_headers
    )

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_update_station_commune_inconnue_retourne_409(
    client: AsyncClient, auth_headers: dict, station_fixe
):
    response = await client.put(
        f"/stations/{station_fixe.id}",
        json={"commune_id": str(uuid.uuid4())},
        headers=auth_headers,
    )

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_update_station_sans_authentification_retourne_401(client: AsyncClient, station_fixe):
    response = await client.put(f"/stations/{station_fixe.id}", json={"nom": "Anonyme"})

    assert response.status_code == 401


# --- Absence volontaire de DELETE --------------------------------------------------


@pytest.mark.asyncio
async def test_suppression_reservee_a_ladmin(client: AsyncClient, auth_headers: dict, station_fixe):
    """DELETE = soft-delete `deleted_at` (#674) : réservé à l'admin, un agent reçoit 403."""
    response = await client.delete(f"/stations/{station_fixe.id}", headers=auth_headers)

    assert response.status_code == 403

    survivante = await client.get(f"/stations/{station_fixe.id}", headers=auth_headers)
    assert survivante.status_code == 200


# --- GET /communes -----------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_communes(client: AsyncClient, auth_headers: dict, commune):
    """Le formulaire d'ajout doit pouvoir choisir `commune_id` : sans cette liste,
    la FK NOT NULL de `station_fixe` est insaisissable depuis l'UI."""
    response = await client.get("/communes", headers=auth_headers)

    assert response.status_code == 200
    lignes = response.json()
    cible = [c for c in lignes if c["id"] == str(commune.id)]
    assert cible, "la commune de test doit être listée"
    assert cible[0]["nom"] == "Commune Test"
    assert cible[0]["district"] == "District Test"
    assert cible[0]["region"] == "Région Test"


@pytest.mark.asyncio
async def test_list_communes_sans_authentification_retourne_401(client: AsyncClient):
    response = await client.get("/communes")

    assert response.status_code == 401
