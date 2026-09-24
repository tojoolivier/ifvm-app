"""Pull du référentiel aérien pour le mobile hors-ligne (#638) : sites aériens (+ position
active), équipes, membres, aéronefs et affectations, incrémentaux sur `since_*`.

Règle testée partout : un changement (désactivation, démontage, clôture) remonte comme
une ligne *mise à jour* — jamais comme une absence — sinon le mobile garderait à vie
l'état précédent."""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.users import Utilisateur

AERONEF = {"immatriculation": "5R-PULL", "societe": "Madagascar Helicopter", "volume_cuve_l": 800}


@pytest_asyncio.fixture
async def equipe_aerienne_avec_chef(db_session: AsyncSession, chef_de_base: Utilisateur) -> dict:
    from app.infrastructure.referentiel_model import EquipeMembreModel, EquipeModel

    modele = EquipeModel(id=uuid.uuid4(), nom="Équipe Pull", type="aerien", actif=True)
    modele.membres = [EquipeMembreModel(user_id=chef_de_base.id, fonction="chef")]
    db_session.add(modele)
    await db_session.commit()
    return {"id": str(modele.id), "chef_id": str(chef_de_base.id)}


async def _pull(client: AsyncClient, headers: dict, **since) -> dict:
    response = await client.get("/referentiel/pull", params=since, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def _futur() -> str:
    return (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()


@pytest.mark.asyncio
async def test_le_pull_expose_les_cinq_collections_aeriennes(client, auth_headers):
    data = await _pull(client, auth_headers)
    for cle in ("sites_aeriens", "equipes", "equipe_membres", "aeronefs", "equipe_aeronefs"):
        assert data[cle]["upserts"] == [], cle
        assert "server_time" in data[cle]


@pytest.mark.asyncio
async def test_sites_aeriens_avec_position_active_puis_demontage(
    client, auth_headers, admin_headers, base_aerienne
):
    avant = (await _pull(client, auth_headers))["sites_aeriens"]["upserts"]
    site = next(s for s in avant if s["id"] == str(base_aerienne.id))
    assert site["latitude"] is None  # jamais installé

    curseur = (await _pull(client, auth_headers))["sites_aeriens"]["server_time"]
    installe = await client.post(
        f"/sites-aeriens/{base_aerienne.id}/positions",
        json={"latitude": -22.4021, "longitude": 46.125, "altitude": 764.0},
        headers=admin_headers,
    )
    assert installe.status_code == 201, installe.text

    apres = (await _pull(client, auth_headers, since_sites_aeriens=curseur))["sites_aeriens"]
    site = next(s for s in apres["upserts"] if s["id"] == str(base_aerienne.id))
    assert site["latitude"] == pytest.approx(-22.4021)
    assert site["longitude"] == pytest.approx(46.125)
    assert site["altitude"] == pytest.approx(764.0)
    assert site["date_debut_position"] is not None

    curseur = apres["server_time"]
    demonte = await client.post(
        f"/sites-aeriens/{base_aerienne.id}/positions/demonter", headers=admin_headers
    )
    assert demonte.status_code == 200, demonte.text
    apres = (await _pull(client, auth_headers, since_sites_aeriens=curseur))["sites_aeriens"]
    site = next(s for s in apres["upserts"] if s["id"] == str(base_aerienne.id))
    assert site["latitude"] is None  # démonté : ligne mise à jour, pas absente


@pytest.mark.asyncio
async def test_sites_aeriens_incremental_sur_since(client, auth_headers, base_aerienne):
    assert (await _pull(client, auth_headers, since_sites_aeriens=_futur()))["sites_aeriens"][
        "upserts"
    ] == []


@pytest.mark.asyncio
async def test_site_desactive_remonte_avec_actif_false(
    client, auth_headers, admin_headers, base_aerienne
):
    curseur = (await _pull(client, auth_headers))["sites_aeriens"]["server_time"]
    reponse = await client.put(
        f"/sites-aeriens/{base_aerienne.id}", json={"actif": False}, headers=admin_headers
    )
    assert reponse.status_code == 200, reponse.text
    upserts = (await _pull(client, auth_headers, since_sites_aeriens=curseur))["sites_aeriens"][
        "upserts"
    ]
    assert [s["actif"] for s in upserts if s["id"] == str(base_aerienne.id)] == [False]


@pytest.mark.asyncio
async def test_equipes_et_membres(client, auth_headers, equipe_aerienne_avec_chef):
    data = await _pull(client, auth_headers)
    equipe = next(
        e for e in data["equipes"]["upserts"] if e["id"] == equipe_aerienne_avec_chef["id"]
    )
    assert equipe["type"] == "aerien"
    assert equipe["actif"] is True
    membres = [m for m in data["equipe_membres"]["upserts"] if m["equipe_id"] == equipe["id"]]
    assert [(m["user_id"], m["fonction"]) for m in membres] == [
        (equipe_aerienne_avec_chef["chef_id"], "chef")
    ]
    assert membres[0]["nom"] is not None

    futur = await _pull(client, auth_headers, since_equipes=_futur(), since_equipe_membres=_futur())
    assert futur["equipes"]["upserts"] == []
    assert futur["equipe_membres"]["upserts"] == []


@pytest.mark.asyncio
async def test_equipe_desactivee_remonte_avec_actif_false(
    client, auth_headers, admin_headers, equipe_aerienne_avec_chef
):
    curseur = (await _pull(client, auth_headers))["equipes"]["server_time"]
    reponse = await client.put(
        f"/equipes/{equipe_aerienne_avec_chef['id']}", json={"actif": False}, headers=admin_headers
    )
    assert reponse.status_code == 200, reponse.text
    upserts = (await _pull(client, auth_headers, since_equipes=curseur))["equipes"]["upserts"]
    assert [e["actif"] for e in upserts if e["id"] == equipe_aerienne_avec_chef["id"]] == [False]


@pytest.mark.asyncio
async def test_aeronef_cree_puis_desactive(client, auth_headers, admin_headers):
    cree = (await client.post("/aeronefs", json=AERONEF, headers=admin_headers)).json()
    data = await _pull(client, auth_headers)
    ligne = next(a for a in data["aeronefs"]["upserts"] if a["id"] == cree["id"])
    assert ligne["immatriculation"] == "5R-PULL"
    assert ligne["actif"] is True

    curseur = data["aeronefs"]["server_time"]
    assert (await _pull(client, auth_headers, since_aeronefs=curseur))["aeronefs"]["upserts"] == []

    await client.put(f"/aeronefs/{cree['id']}", json={"actif": False}, headers=admin_headers)
    upserts = (await _pull(client, auth_headers, since_aeronefs=curseur))["aeronefs"]["upserts"]
    assert [a["actif"] for a in upserts if a["id"] == cree["id"]] == [False]


@pytest.mark.asyncio
async def test_affectation_creee_puis_cloturee_remonte_comme_mise_a_jour(
    client, auth_headers, admin_headers, equipe_aerienne_avec_chef
):
    aeronef = (await client.post("/aeronefs", json=AERONEF, headers=admin_headers)).json()
    equipe_id = equipe_aerienne_avec_chef["id"]
    affectation = (
        await client.post(
            f"/equipes/{equipe_id}/aeronefs",
            json={"aeronef_id": aeronef["id"], "date_debut": "2026-06-01"},
            headers=admin_headers,
        )
    ).json()

    data = await _pull(client, auth_headers)
    ligne = next(a for a in data["equipe_aeronefs"]["upserts"] if a["id"] == affectation["id"])
    assert ligne["equipe_id"] == equipe_id
    assert ligne["aeronef_id"] == aeronef["id"]
    assert ligne["date_debut"] == "2026-06-01"
    assert ligne["date_fin"] is None

    curseur = data["equipe_aeronefs"]["server_time"]
    cloture = await client.put(
        f"/equipes/{equipe_id}/aeronefs/{affectation['id']}",
        json={"date_fin": "2026-07-01"},
        headers=admin_headers,
    )
    assert cloture.status_code == 200, cloture.text

    upserts = (await _pull(client, auth_headers, since_equipe_aeronefs=curseur))["equipe_aeronefs"][
        "upserts"
    ]
    assert [a["date_fin"] for a in upserts if a["id"] == affectation["id"]] == ["2026-07-01"]


@pytest.mark.asyncio
async def test_equipe_creee_avec_aeronef_expose_son_affectation_dans_le_pull(
    client, auth_headers, admin_headers, chef_de_base
):
    """`EquipeRepositoryImpl.create` pose l'affectation sans passer par
    `EquipeAeronefRepositoryImpl` : elle doit quand même porter un `updated_at`."""
    curseur = (await _pull(client, auth_headers))["equipe_aeronefs"]["server_time"]
    creee = await client.post(
        "/equipes",
        json={
            "nom": "Équipe Ihosy",
            "type": "aerien",
            "membres": [{"user_id": str(chef_de_base.id), "fonction": "chef"}],
            "aeronef": AERONEF,
        },
        headers=admin_headers,
    )
    assert creee.status_code == 201, creee.text

    upserts = (await _pull(client, auth_headers, since_equipe_aeronefs=curseur))["equipe_aeronefs"][
        "upserts"
    ]
    assert [a["equipe_id"] for a in upserts] == [creee.json()["id"]]
    assert upserts[0]["date_fin"] is None


@pytest.mark.asyncio
async def test_position_planifiee_dans_le_futur_n_est_pas_active(
    client, auth_headers, db_session, base_aerienne
):
    from datetime import date

    from app.infrastructure.referentiel_model import SiteAeriennePositionModel

    db_session.add(
        SiteAeriennePositionModel(
            site_id=base_aerienne.id,
            latitude=-22.0,
            longitude=46.0,
            date_debut=date.today() + timedelta(days=30),
        )
    )
    await db_session.commit()

    sites = (await _pull(client, auth_headers))["sites_aeriens"]["upserts"]
    site = next(s for s in sites if s["id"] == str(base_aerienne.id))
    assert site["latitude"] is None
