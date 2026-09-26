"""Ligne d'activité aérienne, catégories et règles d'obligation par type (#608).

ADR-018 réintroduit `vol`, supprimée par la migration 0080 (ADR-017) : pas de carnet
de bord, pas de signatures, pas de cumuls d'heures, pas de `rotation_id`. Le document
de cadrage métier n'impose une base principale et un stand que pour `mise_en_place`
et `application` (§6) ; `convoyage` exige un motif et des lieux (§5.3/§5.5) ; `divers`
exige un motif ; `prospection` ne porte aucune obligation dure.
"""

import uuid
from datetime import date

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.prospection_model import ProspectionModel

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


@pytest_asyncio.fixture
async def traitement_aerien_id(
    client: AsyncClient,
    admin_headers: dict,
    db_session: AsyncSession,
    campagne_id: uuid.UUID,
    admin,
    chef_de_base,
    pilote,
    mecanicien,
    base_aerienne,
    equipe_aerienne_id: uuid.UUID,
) -> uuid.UUID:
    """Fiche `traitement` de type AERIEN, pour les tests de rattachement
    `vol.traitement_id` (#610) — une prospection minimale suffit comme origine,
    son propre contenu n'est pas ce qui est testé ici."""
    prospection = ProspectionModel(
        id=uuid.uuid4(),
        type_prospection="extensive",
        campagne_id=campagne_id,
        prospecteur_id=admin.id,
        date_prospection=date(2026, 6, 1),
        statut="brouillon",
        statut_sync="local",
    )
    db_session.add(prospection)
    await db_session.commit()

    reponse = await client.post(
        "/traitements",
        json={
            "prospection_id": str(prospection.id),
            "equipe_id": str(equipe_aerienne_id),
            "date_traitement": "2026-06-05",
            "date_validation": "2026-06-04",
            "localite": "Ihosy",
            "aerien": {
                "pilote": f"{pilote.prenom} {pilote.nom}",
                "mecanicien": f"{mecanicien.prenom} {mecanicien.nom}",
                "chef_de_base_id": str(chef_de_base.id),
                "base_principale": "Base Ihosy",
                "site_principal_id": str(base_aerienne.id),
                "immatricule_aeronef": "5R-ABC",
            },
        },
        headers=admin_headers,
    )
    assert reponse.status_code == 201, reponse.text
    return uuid.UUID(reponse.json()["id"])


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


@pytest.mark.asyncio
async def test_rattacher_traitement_a_vol_application(
    client: AsyncClient,
    admin_headers: dict,
    equipe_aerienne,
    aeronef_affecte: dict,
    base_aerienne,
    stand: dict,
    traitement_aerien_id: uuid.UUID,
):
    """Le rattachement est toujours différé (#610) : le vol est créé sans
    `traitement_id` (`VolCreate` ne porte pas ce champ), puis rattaché via une
    mise à jour — jamais à la création."""
    creation = await client.post(
        "/vols",
        json=_payload(
            equipe_aerienne,
            aeronef_affecte,
            type="application",
            motif=None,
            site_principal_id=str(base_aerienne.id),
            stand_id=stand["id"],
        ),
        headers=admin_headers,
    )
    assert creation.status_code == 201, creation.text
    vol_id = creation.json()["id"]
    assert creation.json()["traitement_id"] is None

    rattachement = await client.patch(
        f"/vols/{vol_id}",
        json={"traitement_id": str(traitement_aerien_id)},
        headers=admin_headers,
    )
    assert rattachement.status_code == 200, rattachement.text
    assert rattachement.json()["traitement_id"] == str(traitement_aerien_id)

    relu = await client.get(f"/vols/{vol_id}", headers=admin_headers)
    assert relu.json()["traitement_id"] == str(traitement_aerien_id)


@pytest.mark.asyncio
async def test_refuse_rattacher_traitement_a_vol_d_un_autre_type_422(
    client: AsyncClient,
    admin_headers: dict,
    equipe_aerienne,
    aeronef_affecte: dict,
    traitement_aerien_id: uuid.UUID,
):
    creation = await client.post(
        "/vols",
        json=_payload(equipe_aerienne, aeronef_affecte, type="divers", motif="Repositionnement"),
        headers=admin_headers,
    )
    assert creation.status_code == 201, creation.text
    vol_id = creation.json()["id"]

    rattachement = await client.patch(
        f"/vols/{vol_id}",
        json={"traitement_id": str(traitement_aerien_id)},
        headers=admin_headers,
    )
    assert rattachement.status_code == 422, rattachement.text


@pytest.mark.asyncio
async def test_rattacher_deux_prospections_a_un_meme_vol(
    client: AsyncClient,
    admin_headers: dict,
    equipe_aerienne,
    aeronef_affecte: dict,
    campagne_id: uuid.UUID,
    equipe_terrestre_id: uuid.UUID,
):
    creation = await client.post(
        "/vols",
        json=_payload(equipe_aerienne, aeronef_affecte, type="prospection", motif=None),
        headers=admin_headers,
    )
    assert creation.status_code == 201, creation.text
    vol_id = creation.json()["id"]

    ids = []
    for _ in range(2):
        reponse = await client.post(
            "/prospections",
            json={
                "equipe_id": str(equipe_terrestre_id),
                "type_prospection": "extensive",
                "campagne_id": str(campagne_id),
                "date_prospection": "2026-06-10",
                "vol_id": vol_id,
            },
            headers=admin_headers,
        )
        assert reponse.status_code == 201, reponse.text
        assert reponse.json()["vol_id"] == vol_id
        ids.append(reponse.json()["id"])

    liste = await client.get(f"/prospections?vol_id={vol_id}", headers=admin_headers)
    assert liste.status_code == 200
    assert {p["id"] for p in liste.json()} == set(ids)


@pytest.mark.asyncio
async def test_refuse_prospection_sur_vol_non_prospection_422(
    client: AsyncClient,
    admin_headers: dict,
    equipe_aerienne,
    aeronef_affecte: dict,
    campagne_id: uuid.UUID,
    equipe_terrestre_id: uuid.UUID,
):
    creation = await client.post(
        "/vols",
        json=_payload(equipe_aerienne, aeronef_affecte, type="divers", motif="Repositionnement"),
        headers=admin_headers,
    )
    assert creation.status_code == 201, creation.text
    vol_id = creation.json()["id"]

    reponse = await client.post(
        "/prospections",
        json={
            "equipe_id": str(equipe_terrestre_id),
            "type_prospection": "extensive",
            "campagne_id": str(campagne_id),
            "date_prospection": "2026-06-10",
            "vol_id": vol_id,
        },
        headers=admin_headers,
    )
    assert reponse.status_code == 422, reponse.text


@pytest.mark.asyncio
async def test_rejeu_vol_meme_id_meme_contenu_ne_cree_pas_de_doublon(
    client: AsyncClient, admin_headers: dict, equipe_aerienne, aeronef_affecte: dict
):
    """Saisie hors-ligne (#639) : l'envoi rejoué renvoie le vol existant."""
    payload = _payload(equipe_aerienne, aeronef_affecte, id=str(uuid.uuid4()))
    premier = await client.post("/vols", json=payload, headers=admin_headers)
    rejeu = await client.post("/vols", json=payload, headers=admin_headers)
    assert premier.status_code == 201, premier.text
    assert rejeu.status_code == 201, rejeu.text
    assert rejeu.json()["id"] == premier.json()["id"] == payload["id"]

    liste = await client.get(f"/vols?equipe_id={equipe_aerienne.id}", headers=admin_headers)
    assert [v["id"] for v in liste.json()].count(payload["id"]) == 1


@pytest.mark.asyncio
async def test_vol_meme_id_contenu_different_409(
    client: AsyncClient, admin_headers: dict, equipe_aerienne, aeronef_affecte: dict
):
    identifiant = str(uuid.uuid4())
    premier = await client.post(
        "/vols",
        json=_payload(equipe_aerienne, aeronef_affecte, id=identifiant),
        headers=admin_headers,
    )
    assert premier.status_code == 201, premier.text
    conflit = await client.post(
        "/vols",
        json=_payload(equipe_aerienne, aeronef_affecte, id=identifiant, motif="Autre motif"),
        headers=admin_headers,
    )
    assert conflit.status_code == 409, conflit.text


@pytest.mark.asyncio
async def test_rejeu_vol_texte_vide_equivaut_a_absent(
    client: AsyncClient, admin_headers: dict, equipe_aerienne, aeronef_affecte: dict
):
    """`observations=""` et `observations` absent sont la même saisie : pas de faux 409."""
    identifiant = str(uuid.uuid4())
    premier = await client.post(
        "/vols",
        json=_payload(equipe_aerienne, aeronef_affecte, id=identifiant),
        headers=admin_headers,
    )
    rejeu = await client.post(
        "/vols",
        json=_payload(equipe_aerienne, aeronef_affecte, id=identifiant, observations=""),
        headers=admin_headers,
    )
    assert premier.status_code == 201, premier.text
    assert rejeu.status_code == 201, rejeu.text


@pytest.mark.asyncio
async def test_lister_les_vols_d_un_traitement_aerien(
    client: AsyncClient,
    admin_headers: dict,
    equipe_aerienne,
    aeronef_affecte: dict,
    base_aerienne,
    stand: dict,
    traitement_aerien_id: uuid.UUID,
):
    """La fiche de traitement retrouve son vol (#610) : `GET /vols?traitement_id=`."""
    corps = _payload(
        equipe_aerienne,
        aeronef_affecte,
        type="application",
        motif=None,
        site_principal_id=str(base_aerienne.id),
        stand_id=stand["id"],
    )
    rattache = (await client.post("/vols", json=corps, headers=admin_headers)).json()["id"]
    libre = (await client.post("/vols", json=corps, headers=admin_headers)).json()["id"]
    await client.patch(
        f"/vols/{rattache}",
        json={"traitement_id": str(traitement_aerien_id)},
        headers=admin_headers,
    )

    reponse = await client.get(f"/vols?traitement_id={traitement_aerien_id}", headers=admin_headers)

    assert reponse.status_code == 200, reponse.text
    assert [vol["id"] for vol in reponse.json()] == [rattache]
    assert libre not in [vol["id"] for vol in reponse.json()]


@pytest.mark.asyncio
async def test_lister_les_vols_d_un_traitement_sans_vol_renvoie_une_liste_vide(
    client: AsyncClient, admin_headers: dict
):
    reponse = await client.get(f"/vols?traitement_id={uuid.uuid4()}", headers=admin_headers)

    assert reponse.status_code == 200
    assert reponse.json() == []


@pytest.mark.asyncio
async def test_filtres_equipe_et_traitement_se_combinent(
    client: AsyncClient,
    admin_headers: dict,
    equipe_aerienne,
    aeronef_affecte: dict,
    base_aerienne,
    stand: dict,
    traitement_aerien_id: uuid.UUID,
):
    vol_id = (
        await client.post(
            "/vols",
            json=_payload(
                equipe_aerienne,
                aeronef_affecte,
                type="application",
                motif=None,
                site_principal_id=str(base_aerienne.id),
                stand_id=stand["id"],
            ),
            headers=admin_headers,
        )
    ).json()["id"]
    await client.patch(
        f"/vols/{vol_id}",
        json={"traitement_id": str(traitement_aerien_id)},
        headers=admin_headers,
    )

    bon = await client.get(
        f"/vols?equipe_id={equipe_aerienne.id}&traitement_id={traitement_aerien_id}",
        headers=admin_headers,
    )
    autre_equipe = await client.get(
        f"/vols?equipe_id={uuid.uuid4()}&traitement_id={traitement_aerien_id}",
        headers=admin_headers,
    )

    assert [vol["id"] for vol in bon.json()] == [vol_id]
    assert autre_equipe.json() == []
