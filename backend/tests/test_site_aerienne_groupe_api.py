"""#655 — création idempotente (id client) et déplacement groupé des sites aériens."""

import uuid

import pytest
from httpx import AsyncClient


async def _creer_dependant(client, headers, parent_id, *, numero="IHO02", site_id=None):
    corps = {"numero": numero, "localite": "Ihosy Sud", "parent_site_id": str(parent_id)}
    if site_id is not None:
        corps["id"] = str(site_id)
    return await client.post("/sites-aeriens", json=corps, headers=headers)


async def _installer(client, headers, site_id, latitude, longitude):
    response = await client.post(
        f"/sites-aeriens/{site_id}/positions",
        json={"latitude": latitude, "longitude": longitude},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


@pytest.mark.asyncio
async def test_creation_avec_id_client_conserve_lid(
    client: AsyncClient, admin_headers: dict, equipe_aerienne
):
    site_id = uuid.uuid4()
    response = await client.post(
        "/sites-aeriens",
        json={
            "id": str(site_id),
            "numero": "IHO10",
            "localite": "Ihosy",
            "equipe_id": str(equipe_aerienne.id),
        },
        headers=admin_headers,
    )
    assert response.status_code == 201
    assert response.json()["id"] == str(site_id)


@pytest.mark.asyncio
async def test_rejouer_la_meme_creation_ne_duplique_rien(
    client: AsyncClient, admin_headers: dict, equipe_aerienne
):
    corps = {
        "id": str(uuid.uuid4()),
        "numero": "IHO10",
        "localite": "Ihosy",
        "equipe_id": str(equipe_aerienne.id),
    }
    premiere = await client.post("/sites-aeriens", json=corps, headers=admin_headers)
    rejeu = await client.post("/sites-aeriens", json=corps, headers=admin_headers)
    assert premiere.status_code == 201
    assert rejeu.status_code in (200, 201)
    assert rejeu.json()["id"] == premiere.json()["id"]
    liste = await client.get("/sites-aeriens", headers=admin_headers)
    assert [s["numero"] for s in liste.json()].count("IHO10") == 1


@pytest.mark.asyncio
async def test_meme_id_contenu_different_409(
    client: AsyncClient, admin_headers: dict, base_aerienne
):
    """Deux dépendants distincts (numéros libres) : seul l'id partagé peut causer le 409."""
    site_id = uuid.uuid4()
    premier = await _creer_dependant(client, admin_headers, base_aerienne.id, site_id=site_id)
    autre = await _creer_dependant(
        client, admin_headers, base_aerienne.id, numero="IHO99", site_id=site_id
    )
    assert premier.status_code == 201
    assert autre.status_code == 409
    assert "id" in autre.json()["detail"].lower()


@pytest.mark.asyncio
async def test_creation_avec_position_initiale(
    client: AsyncClient, admin_headers: dict, equipe_aerienne
):
    site_id = uuid.uuid4()
    response = await client.post(
        "/sites-aeriens",
        json={
            "id": str(site_id),
            "numero": "IHO10",
            "localite": "Ihosy",
            "equipe_id": str(equipe_aerienne.id),
            "position": {"latitude": -21.8135, "longitude": 46.0432, "altitude": 893},
        },
        headers=admin_headers,
    )
    assert response.status_code == 201
    active = await client.get(f"/sites-aeriens/{site_id}/positions/active", headers=admin_headers)
    assert active.status_code == 200
    assert active.json()["latitude"] == pytest.approx(-21.8135)


@pytest.mark.asyncio
async def test_rejeu_avec_position_ne_duplique_pas_la_position(
    client: AsyncClient, admin_headers: dict, equipe_aerienne
):
    site_id = uuid.uuid4()
    corps = {
        "id": str(site_id),
        "numero": "IHO10",
        "localite": "Ihosy",
        "equipe_id": str(equipe_aerienne.id),
        "position": {"latitude": -21.8135, "longitude": 46.0432},
    }
    await client.post("/sites-aeriens", json=corps, headers=admin_headers)
    rejeu = await client.post("/sites-aeriens", json=corps, headers=admin_headers)
    assert rejeu.status_code in (200, 201)
    historique = await client.get(f"/sites-aeriens/{site_id}/positions", headers=admin_headers)
    assert len(historique.json()) == 1


@pytest.mark.asyncio
async def test_position_initiale_hors_bornes_422(
    client: AsyncClient, admin_headers: dict, equipe_aerienne
):
    response = await client.post(
        "/sites-aeriens",
        json={
            "numero": "IHO10",
            "localite": "Ihosy",
            "equipe_id": str(equipe_aerienne.id),
            "position": {"latitude": 91, "longitude": 46},
        },
        headers=admin_headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_dependant_avant_son_principal_409(client: AsyncClient, admin_headers: dict):
    """Rejoué au sync suivant : le parent n'existe pas *encore* côté serveur."""
    response = await _creer_dependant(client, admin_headers, uuid.uuid4())
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_dependant_dun_secondaire_422(
    client: AsyncClient, admin_headers: dict, base_aerienne
):
    secondaire = await _creer_dependant(client, admin_headers, base_aerienne.id)
    assert secondaire.status_code == 201
    petit = await _creer_dependant(client, admin_headers, secondaire.json()["id"], numero="IHO03")
    assert petit.status_code == 422


@pytest.mark.asyncio
async def test_deplacement_groupe_une_position_par_site_coche(
    client: AsyncClient, admin_headers: dict, base_aerienne
):
    stand = (await _creer_dependant(client, admin_headers, base_aerienne.id)).json()
    base_sec = (
        await _creer_dependant(client, admin_headers, base_aerienne.id, numero="IHO03")
    ).json()
    await _installer(client, admin_headers, base_aerienne.id, -21.8, 46.0)
    await _installer(client, admin_headers, stand["id"], -21.8, 46.0)
    await _installer(client, admin_headers, base_sec["id"], -22.4, 46.1)

    response = await client.post(
        f"/sites-aeriens/{base_aerienne.id}/deplacer",
        json={"latitude": -22.0, "longitude": 46.5, "dependants": [stand["id"]]},
        headers=admin_headers,
    )
    assert response.status_code == 200
    assert {p["site_id"] for p in response.json()} == {str(base_aerienne.id), stand["id"]}

    for site_id, attendu in (
        (base_aerienne.id, -22.0),
        (stand["id"], -22.0),
        (base_sec["id"], -22.4),
    ):
        active = await client.get(
            f"/sites-aeriens/{site_id}/positions/active", headers=admin_headers
        )
        assert active.json()["latitude"] == pytest.approx(attendu)
    # le dépendant non coché n'a pas reçu de nouvelle position
    historique = await client.get(
        f"/sites-aeriens/{base_sec['id']}/positions", headers=admin_headers
    )
    assert len(historique.json()) == 1


@pytest.mark.asyncio
async def test_deplacement_un_jour_apres_cloture_a_j_moins_1(
    client: AsyncClient, admin_headers: dict, base_aerienne, db_session
):
    """Une position ouverte avant aujourd'hui est close la veille ; celle d'un même
    jour est corrigée en place (`date_fin >= date_debut`)."""
    from datetime import date, timedelta

    from sqlalchemy import update

    from app.infrastructure.referentiel_model import SiteAeriennePositionModel

    ancienne = await _installer(client, admin_headers, base_aerienne.id, -21.8, 46.0)
    hier_j2 = date.today() - timedelta(days=2)
    await db_session.execute(
        update(SiteAeriennePositionModel)
        .where(SiteAeriennePositionModel.id == uuid.UUID(ancienne["id"]))
        .values(date_debut=hier_j2)
    )
    await db_session.commit()

    response = await client.post(
        f"/sites-aeriens/{base_aerienne.id}/deplacer",
        json={"latitude": -22.0, "longitude": 46.5},
        headers=admin_headers,
    )
    assert response.status_code == 200
    historique = (
        await client.get(f"/sites-aeriens/{base_aerienne.id}/positions", headers=admin_headers)
    ).json()
    assert len(historique) == 2
    fermee = next(p for p in historique if p["date_fin"] is not None)
    assert fermee["date_fin"] == (date.today() - timedelta(days=1)).isoformat()
    assert sum(p["date_fin"] is None for p in historique) == 1


@pytest.mark.asyncio
async def test_deplacement_meme_jour_corrige_en_place_et_rejoue_sans_doublon(
    client: AsyncClient, admin_headers: dict, base_aerienne
):
    await _installer(client, admin_headers, base_aerienne.id, -21.8, 46.0)
    corps = {"latitude": -22.0, "longitude": 46.5}
    for _ in range(2):
        response = await client.post(
            f"/sites-aeriens/{base_aerienne.id}/deplacer", json=corps, headers=admin_headers
        )
        assert response.status_code == 200
    historique = (
        await client.get(f"/sites-aeriens/{base_aerienne.id}/positions", headers=admin_headers)
    ).json()
    assert len(historique) == 1
    assert historique[0]["latitude"] == pytest.approx(-22.0)
    assert historique[0]["date_fin"] is None


@pytest.mark.asyncio
async def test_deplacement_installe_sur_un_site_sans_position(
    client: AsyncClient, admin_headers: dict, base_aerienne
):
    response = await client.post(
        f"/sites-aeriens/{base_aerienne.id}/deplacer",
        json={"latitude": -22.0, "longitude": 46.5},
        headers=admin_headers,
    )
    assert response.status_code == 200
    assert len(response.json()) == 1


@pytest.mark.asyncio
async def test_deplacement_dependant_dun_autre_principal_422_et_rien_de_deplace(
    client: AsyncClient, admin_headers: dict, base_aerienne, equipe_aerienne_bis
):
    autre_principal = await client.post(
        "/sites-aeriens",
        json={"numero": "AMB01", "localite": "Ambatobe", "equipe_id": str(equipe_aerienne_bis.id)},
        headers=admin_headers,
    )
    etranger = (await _creer_dependant(client, admin_headers, autre_principal.json()["id"])).json()
    response = await client.post(
        f"/sites-aeriens/{base_aerienne.id}/deplacer",
        json={"latitude": -22.0, "longitude": 46.5, "dependants": [etranger["id"]]},
        headers=admin_headers,
    )
    assert response.status_code == 422
    positions = await client.get(
        f"/sites-aeriens/{base_aerienne.id}/positions", headers=admin_headers
    )
    assert positions.json() == []


@pytest.mark.asyncio
async def test_deplacement_coordonnees_hors_bornes_422(
    client: AsyncClient, admin_headers: dict, base_aerienne
):
    response = await client.post(
        f"/sites-aeriens/{base_aerienne.id}/deplacer",
        json={"latitude": 10, "longitude": 181},
        headers=admin_headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_deplacement_site_inexistant_404(client: AsyncClient, admin_headers: dict):
    response = await client.post(
        f"/sites-aeriens/{uuid.uuid4()}/deplacer",
        json={"latitude": 10, "longitude": 20},
        headers=admin_headers,
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_dependant_na_pas_dequipe_propre_et_pointe_vers_son_principal(
    client: AsyncClient, admin_headers: dict, base_aerienne
):
    """#655 : le principal porte l'équipe, le dépendant n'en a pas (ck_..._equipe_coherente)."""
    dependant = (await _creer_dependant(client, admin_headers, base_aerienne.id)).json()
    assert dependant["equipe_id"] is None
    assert dependant["parent_site_id"] == str(base_aerienne.id)


@pytest.mark.asyncio
async def test_rattacher_a_un_parent_inconnu_par_put_409(
    client: AsyncClient, admin_headers: dict, base_aerienne
):
    dependant = (await _creer_dependant(client, admin_headers, base_aerienne.id)).json()
    response = await client.put(
        f"/sites-aeriens/{dependant['id']}",
        json={"parent_site_id": str(uuid.uuid4())},
        headers=admin_headers,
    )
    assert response.status_code == 409
    assert "parent_site_id inconnu" in response.json()["detail"]
