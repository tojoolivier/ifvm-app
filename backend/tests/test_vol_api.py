"""Ligne d'activité aérienne, catégories et règles d'obligation par type (#608).

ADR-018 réintroduit `vol`, supprimée par la migration 0080 (ADR-017) : pas de carnet
de bord, pas de signatures, pas de cumuls d'heures, pas de `rotation_id`. Le document
de cadrage métier n'impose une base principale et un stand que pour `mise_en_place`
et `application` (§6) ; `convoyage` exige un motif et des lieux (§5.3/§5.5) ; `divers`
exige un motif ; `prospection` ne porte aucune obligation dure.
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient

AERONEF = {"immatriculation": "5R-VOL", "societe": "Madagascar Helicopter", "volume_cuve_l": 800}
DATE_VOL = "2026-06-10"
HEURE_DEBUT = "08:00:00"
HEURE_FIN = "10:00:00"


@pytest_asyncio.fixture
async def aeronef_affecte(client: AsyncClient, admin_headers: dict, equipe_aerienne) -> dict:
    """Appareil affecté à `equipe_aerienne` avant `DATE_VOL` — condition d'un vol
    valide (contrôle applicatif contre `equipe_aeronef`, #608)."""
    aeronef = (await client.post("/aeronefs", json=AERONEF, headers=admin_headers)).json()
    reponse = await client.post(
        f"/equipes/{equipe_aerienne.id}/aeronefs",
        json={"aeronef_id": aeronef["id"], "date_debut": "2026-01-01"},
        headers=admin_headers,
    )
    assert reponse.status_code == 201, reponse.text
    return aeronef


@pytest_asyncio.fixture
async def aeronef_non_affecte(client: AsyncClient, admin_headers: dict) -> dict:
    """Appareil au référentiel (#621) mais jamais affecté à aucune équipe."""
    autre = {"immatriculation": "5R-XXX", "societe": "Madagascar Helicopter", "volume_cuve_l": 700}
    return (await client.post("/aeronefs", json=autre, headers=admin_headers)).json()


@pytest_asyncio.fixture
async def stand(client: AsyncClient, admin_headers: dict, base_aerienne) -> dict:
    body = {
        "numero": "IHO01-STD",
        "localite": "Ihosy",
        "parent_site_id": str(base_aerienne.id),
    }
    reponse = await client.post("/sites-aeriens", json=body, headers=admin_headers)
    assert reponse.status_code == 201, reponse.text
    return reponse.json()


@pytest_asyncio.fixture
async def stand_autre_base(client: AsyncClient, admin_headers: dict, autre_base_aerienne) -> dict:
    """Stand rattaché à `autre_base_aerienne`, une base principale différente de
    `base_aerienne` — pour le refus « stand d'une autre base »."""
    body = {
        "numero": "BTK01-STD",
        "localite": "Betroka",
        "parent_site_id": str(autre_base_aerienne.id),
    }
    reponse = await client.post("/sites-aeriens", json=body, headers=admin_headers)
    assert reponse.status_code == 201, reponse.text
    return reponse.json()


def _payload(equipe, aeronef: dict, **overrides) -> dict:
    body = {
        "type": "divers",
        "equipe_id": str(equipe.id),
        "aeronef_id": aeronef["id"],
        "date_vol": DATE_VOL,
        "heure_debut": HEURE_DEBUT,
        "heure_fin": HEURE_FIN,
        "motif": "Reconnaissance",
    }
    body.update(overrides)
    return body


@pytest.mark.asyncio
@pytest.mark.parametrize("type_vol", ["mise_en_place", "application"])
async def test_creer_vol_mise_en_place_ou_application(
    client: AsyncClient,
    admin_headers: dict,
    equipe_aerienne,
    aeronef_affecte: dict,
    base_aerienne,
    stand: dict,
    type_vol: str,
):
    payload = _payload(
        equipe_aerienne,
        aeronef_affecte,
        type=type_vol,
        motif=None,
        site_principal_id=str(base_aerienne.id),
        stand_id=stand["id"],
    )
    reponse = await client.post("/vols", json=payload, headers=admin_headers)
    assert reponse.status_code == 201, reponse.text
    data = reponse.json()
    assert data["type"] == type_vol
    assert data["site_principal_id"] == str(base_aerienne.id)
    assert data["stand_id"] == stand["id"]
    assert data["duree_minutes"] == 120


@pytest.mark.asyncio
async def test_creer_vol_convoyage(
    client: AsyncClient, admin_headers: dict, equipe_aerienne, aeronef_affecte: dict
):
    payload = _payload(
        equipe_aerienne,
        aeronef_affecte,
        type="convoyage",
        motif="Retour en base après entretien",
        lieu_depart="Ihosy",
        lieu_arrivee="Betroka",
    )
    reponse = await client.post("/vols", json=payload, headers=admin_headers)
    assert reponse.status_code == 201, reponse.text
    assert reponse.json()["type"] == "convoyage"


@pytest.mark.asyncio
async def test_creer_vol_prospection_sans_rattachement(
    client: AsyncClient, admin_headers: dict, equipe_aerienne, aeronef_affecte: dict
):
    payload = _payload(equipe_aerienne, aeronef_affecte, type="prospection", motif=None)
    reponse = await client.post("/vols", json=payload, headers=admin_headers)
    assert reponse.status_code == 201, reponse.text


@pytest.mark.asyncio
async def test_creer_vol_divers(
    client: AsyncClient, admin_headers: dict, equipe_aerienne, aeronef_affecte: dict
):
    payload = _payload(equipe_aerienne, aeronef_affecte, type="divers", motif="Repositionnement")
    reponse = await client.post("/vols", json=payload, headers=admin_headers)
    assert reponse.status_code == 201, reponse.text


@pytest.mark.asyncio
@pytest.mark.parametrize("type_vol", ["mise_en_place", "application"])
async def test_refuse_mise_en_place_ou_application_sans_stand_ni_site_422(
    client: AsyncClient,
    admin_headers: dict,
    equipe_aerienne,
    aeronef_affecte: dict,
    type_vol: str,
):
    payload = _payload(equipe_aerienne, aeronef_affecte, type=type_vol, motif=None)
    reponse = await client.post("/vols", json=payload, headers=admin_headers)
    assert reponse.status_code == 422, reponse.text


@pytest.mark.asyncio
async def test_refuse_convoyage_sans_lieux_422(
    client: AsyncClient, admin_headers: dict, equipe_aerienne, aeronef_affecte: dict
):
    payload = _payload(equipe_aerienne, aeronef_affecte, type="convoyage", motif="Retour base")
    reponse = await client.post("/vols", json=payload, headers=admin_headers)
    assert reponse.status_code == 422, reponse.text


@pytest.mark.asyncio
async def test_refuse_divers_sans_motif_422(
    client: AsyncClient, admin_headers: dict, equipe_aerienne, aeronef_affecte: dict
):
    payload = _payload(equipe_aerienne, aeronef_affecte, type="divers", motif=None)
    reponse = await client.post("/vols", json=payload, headers=admin_headers)
    assert reponse.status_code == 422, reponse.text


@pytest.mark.asyncio
async def test_refuse_aeronef_non_affecte_422(
    client: AsyncClient, admin_headers: dict, equipe_aerienne, aeronef_non_affecte: dict
):
    payload = _payload(equipe_aerienne, aeronef_non_affecte, type="divers", motif="Reconnaissance")
    reponse = await client.post("/vols", json=payload, headers=admin_headers)
    assert reponse.status_code == 422, reponse.text


@pytest.mark.asyncio
async def test_refuse_stand_d_une_autre_base_principale_422(
    client: AsyncClient,
    admin_headers: dict,
    equipe_aerienne,
    aeronef_affecte: dict,
    base_aerienne,
    stand_autre_base: dict,
):
    payload = _payload(
        equipe_aerienne,
        aeronef_affecte,
        type="mise_en_place",
        motif=None,
        site_principal_id=str(base_aerienne.id),
        stand_id=stand_autre_base["id"],
    )
    reponse = await client.post("/vols", json=payload, headers=admin_headers)
    assert reponse.status_code == 422, reponse.text


@pytest.mark.asyncio
async def test_lire_un_vol_puis_le_lister(
    client: AsyncClient,
    admin_headers: dict,
    equipe_aerienne,
    aeronef_affecte: dict,
    base_aerienne,
    stand: dict,
):
    creation = await client.post(
        "/vols",
        json=_payload(
            equipe_aerienne,
            aeronef_affecte,
            type="mise_en_place",
            motif=None,
            site_principal_id=str(base_aerienne.id),
            stand_id=stand["id"],
        ),
        headers=admin_headers,
    )
    vol_id = creation.json()["id"]

    relu = await client.get(f"/vols/{vol_id}", headers=admin_headers)
    assert relu.status_code == 200
    assert relu.json()["id"] == vol_id

    liste = await client.get(f"/vols?equipe_id={equipe_aerienne.id}", headers=admin_headers)
    assert liste.status_code == 200
    assert vol_id in [v["id"] for v in liste.json()]
