import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import create_access_token


@pytest_asyncio.fixture
async def deuxieme_pesticide(db_session: AsyncSession):
    from app.infrastructure.referentiel_model import PesticideModel

    p = PesticideModel(id=uuid.uuid4(), code=f"PEST-{uuid.uuid4().hex[:6]}", nom="Deltamethrine")
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)
    return p


@pytest.fixture
def payload_approvisionnement(pesticide, base_aerienne):
    def _payload(**overrides):
        body = {
            "type": "approvisionnement",
            "pesticide_id": str(pesticide.id),
            "site_id": str(base_aerienne.id),
            "quantite": 100,
            "unite": "L",
        }
        body.update(overrides)
        return body

    return _payload


@pytest.mark.asyncio
async def test_approvisionnement_puis_lecture_du_solde(
    client: AsyncClient, admin_headers: dict, payload_approvisionnement, pesticide, base_aerienne
):
    response = await client.post(
        "/mouvements-pesticide", json=payload_approvisionnement(), headers=admin_headers
    )
    assert response.status_code == 201
    data = response.json()
    assert data["type"] == "approvisionnement"
    assert data["site_destination_id"] is None

    solde = await client.get(
        f"/stock-pesticide/solde?site_id={base_aerienne.id}", headers=admin_headers
    )
    assert solde.status_code == 200
    lignes = solde.json()
    assert len(lignes) == 1
    assert lignes[0]["pesticide_id"] == str(pesticide.id)
    assert lignes[0]["unite"] == "L"
    assert lignes[0]["quantite"] == 100


@pytest.mark.asyncio
async def test_transfert_entre_deux_sites_et_lecture_des_deux_soldes(
    client: AsyncClient,
    admin_headers: dict,
    payload_approvisionnement,
    pesticide,
    base_aerienne,
    autre_base_aerienne,
):
    await client.post(
        "/mouvements-pesticide", json=payload_approvisionnement(quantite=100), headers=admin_headers
    )

    transfert = await client.post(
        "/mouvements-pesticide",
        json={
            "type": "transfert",
            "pesticide_id": str(pesticide.id),
            "site_id": str(base_aerienne.id),
            "site_destination_id": str(autre_base_aerienne.id),
            "quantite": 30,
            "unite": "L",
        },
        headers=admin_headers,
    )
    assert transfert.status_code == 201

    solde_source = await client.get(
        f"/stock-pesticide/solde?site_id={base_aerienne.id}", headers=admin_headers
    )
    assert solde_source.json()[0]["quantite"] == 70

    solde_destination = await client.get(
        f"/stock-pesticide/solde?site_id={autre_base_aerienne.id}", headers=admin_headers
    )
    assert solde_destination.json()[0]["quantite"] == 30


@pytest.mark.asyncio
async def test_transfert_sans_destination_422(
    client: AsyncClient, admin_headers: dict, payload_approvisionnement
):
    response = await client.post(
        "/mouvements-pesticide",
        json=payload_approvisionnement(type="transfert"),
        headers=admin_headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_destination_sur_mouvement_non_transfert_422(
    client: AsyncClient, admin_headers: dict, payload_approvisionnement, autre_base_aerienne
):
    response = await client.post(
        "/mouvements-pesticide",
        json=payload_approvisionnement(site_destination_id=str(autre_base_aerienne.id)),
        headers=admin_headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_mouvement_sur_site_secondaire_refuse_422(
    client: AsyncClient, admin_headers: dict, payload_approvisionnement, base_aerienne
):
    secondaire = await client.post(
        "/sites-aeriens",
        json={
            "numero": "IHO02",
            "localite": "Ihosy Sud",
            "parent_site_id": str(base_aerienne.id),
        },
        headers=admin_headers,
    )
    assert secondaire.status_code == 201

    response = await client.post(
        "/mouvements-pesticide",
        json=payload_approvisionnement(site_id=secondaire.json()["id"]),
        headers=admin_headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_deux_unites_distinctes_sur_meme_site_restent_separees(
    client: AsyncClient, admin_headers: dict, payload_approvisionnement, pesticide, base_aerienne
):
    await client.post(
        "/mouvements-pesticide",
        json=payload_approvisionnement(quantite=100, unite="L"),
        headers=admin_headers,
    )
    await client.post(
        "/mouvements-pesticide",
        json=payload_approvisionnement(quantite=50, unite="kg"),
        headers=admin_headers,
    )

    solde = await client.get(
        f"/stock-pesticide/solde?site_id={base_aerienne.id}", headers=admin_headers
    )
    lignes = {ligne["unite"]: ligne["quantite"] for ligne in solde.json()}
    assert lignes == {"L": 100, "kg": 50}


@pytest.mark.asyncio
async def test_rejeu_meme_id_meme_contenu_ne_double_pas_le_mouvement(
    client: AsyncClient, admin_headers: dict, payload_approvisionnement, base_aerienne
):
    """Saisie hors-ligne (#639) : l'envoi rejoué après une coupure renvoie la
    ressource existante — un doublon fausserait le solde de stock."""
    payload = payload_approvisionnement(id=str(uuid.uuid4()), quantite=100)
    premier = await client.post("/mouvements-pesticide", json=payload, headers=admin_headers)
    rejeu = await client.post("/mouvements-pesticide", json=payload, headers=admin_headers)
    assert premier.status_code == 201, premier.text
    assert rejeu.status_code == 201, rejeu.text
    assert rejeu.json()["id"] == premier.json()["id"] == payload["id"]

    solde = await client.get(
        f"/stock-pesticide/solde?site_id={base_aerienne.id}", headers=admin_headers
    )
    assert solde.json()[0]["quantite"] == 100


@pytest.mark.asyncio
async def test_meme_id_contenu_different_409(
    client: AsyncClient, admin_headers: dict, payload_approvisionnement
):
    identifiant = str(uuid.uuid4())
    premier = await client.post(
        "/mouvements-pesticide",
        json=payload_approvisionnement(id=identifiant, quantite=100),
        headers=admin_headers,
    )
    assert premier.status_code == 201, premier.text
    conflit = await client.post(
        "/mouvements-pesticide",
        json=payload_approvisionnement(id=identifiant, quantite=250),
        headers=admin_headers,
    )
    assert conflit.status_code == 409, conflit.text


@pytest.mark.asyncio
async def test_droits_de_saisie_chef_de_base_et_admin_seulement(
    client: AsyncClient,
    admin_headers: dict,
    auth_headers: dict,
    chef_de_base,
    payload_approvisionnement,
):
    chef_headers = {"Authorization": f"Bearer {create_access_token(chef_de_base.id)}"}

    refus = await client.post(
        "/mouvements-pesticide", json=payload_approvisionnement(), headers=auth_headers
    )
    assert refus.status_code == 403, refus.text

    for headers in (chef_headers, admin_headers):
        reponse = await client.post(
            "/mouvements-pesticide", json=payload_approvisionnement(), headers=headers
        )
        assert reponse.status_code == 201, reponse.text


@pytest.mark.asyncio
async def test_meme_id_date_differente_409(
    client: AsyncClient, admin_headers: dict, payload_approvisionnement
):
    identifiant = str(uuid.uuid4())
    premier = await client.post(
        "/mouvements-pesticide",
        json=payload_approvisionnement(id=identifiant, date_mouvement="2026-01-10"),
        headers=admin_headers,
    )
    assert premier.status_code == 201, premier.text
    conflit = await client.post(
        "/mouvements-pesticide",
        json=payload_approvisionnement(id=identifiant, date_mouvement="2026-01-11"),
        headers=admin_headers,
    )
    assert conflit.status_code == 409, conflit.text


@pytest.mark.asyncio
async def test_rejeu_sans_date_ne_compare_pas_la_date(
    client: AsyncClient, admin_headers: dict, payload_approvisionnement
):
    identifiant = str(uuid.uuid4())
    premier = await client.post(
        "/mouvements-pesticide",
        json=payload_approvisionnement(id=identifiant, date_mouvement="2026-01-10"),
        headers=admin_headers,
    )
    rejeu = await client.post(
        "/mouvements-pesticide",
        json=payload_approvisionnement(id=identifiant),
        headers=admin_headers,
    )
    assert premier.status_code == 201, premier.text
    assert rejeu.status_code == 201, rejeu.text
    assert rejeu.json()["date_mouvement"] == "2026-01-10"


# --- journal des mouvements (#606, #609) : GET /mouvements-pesticide ------------------------------


async def _enregistrer(client: AsyncClient, headers: dict, **corps) -> dict:
    reponse = await client.post("/mouvements-pesticide", json=corps, headers=headers)
    assert reponse.status_code == 201, reponse.text
    return reponse.json()


@pytest.mark.asyncio
async def test_journal_liste_les_mouvements_du_plus_recent_au_plus_ancien(
    client: AsyncClient, admin_headers: dict, pesticide, base_aerienne
):
    base = {"pesticide_id": str(pesticide.id), "site_id": str(base_aerienne.id), "unite": "L"}
    ancien = await _enregistrer(
        client,
        admin_headers,
        type="approvisionnement",
        quantite=100,
        date_mouvement="2026-08-01",
        **base,
    )
    recent = await _enregistrer(
        client,
        admin_headers,
        type="approvisionnement",
        quantite=50,
        date_mouvement="2026-09-01",
        **base,
    )

    reponse = await client.get("/mouvements-pesticide", headers=admin_headers)

    assert reponse.status_code == 200, reponse.text
    assert [ligne["id"] for ligne in reponse.json()] == [recent["id"], ancien["id"]]


@pytest.mark.asyncio
async def test_journal_filtre_par_type(
    client: AsyncClient, admin_headers: dict, pesticide, base_aerienne, autre_base_aerienne
):
    base = {"pesticide_id": str(pesticide.id), "site_id": str(base_aerienne.id), "unite": "L"}
    await _enregistrer(client, admin_headers, type="approvisionnement", quantite=100, **base)
    await _enregistrer(
        client,
        admin_headers,
        type="transfert",
        quantite=30,
        site_destination_id=str(autre_base_aerienne.id),
        **base,
    )

    reponse = await client.get("/mouvements-pesticide?type=transfert", headers=admin_headers)

    assert [ligne["type"] for ligne in reponse.json()] == ["transfert"]


@pytest.mark.asyncio
async def test_journal_par_site_inclut_les_transferts_recus(
    client: AsyncClient, admin_headers: dict, pesticide, base_aerienne, autre_base_aerienne
):
    """Le journal d'un site montre ce qu'il porte ET les transferts qui l'alimentent."""
    base = {"pesticide_id": str(pesticide.id), "site_id": str(base_aerienne.id), "unite": "L"}
    await _enregistrer(client, admin_headers, type="approvisionnement", quantite=100, **base)
    await _enregistrer(
        client,
        admin_headers,
        type="transfert",
        quantite=30,
        site_destination_id=str(autre_base_aerienne.id),
        **base,
    )

    destination = await client.get(
        f"/mouvements-pesticide?site_id={autre_base_aerienne.id}", headers=admin_headers
    )
    source = await client.get(
        f"/mouvements-pesticide?site_id={base_aerienne.id}", headers=admin_headers
    )

    assert [ligne["type"] for ligne in destination.json()] == ["transfert"]
    assert sorted(ligne["type"] for ligne in source.json()) == ["approvisionnement", "transfert"]


@pytest.mark.asyncio
async def test_journal_filtre_par_pesticide_et_par_periode(
    client: AsyncClient, admin_headers: dict, pesticide, deuxieme_pesticide, base_aerienne
):
    site = {"site_id": str(base_aerienne.id), "unite": "L", "type": "approvisionnement"}
    await _enregistrer(
        client,
        admin_headers,
        pesticide_id=str(pesticide.id),
        quantite=10,
        date_mouvement="2026-08-01",
        **site,
    )
    dans_la_periode = await _enregistrer(
        client,
        admin_headers,
        pesticide_id=str(pesticide.id),
        quantite=20,
        date_mouvement="2026-08-15",
        **site,
    )
    await _enregistrer(
        client,
        admin_headers,
        pesticide_id=str(deuxieme_pesticide.id),
        quantite=30,
        date_mouvement="2026-08-15",
        **site,
    )
    await _enregistrer(
        client,
        admin_headers,
        pesticide_id=str(pesticide.id),
        quantite=40,
        date_mouvement="2026-09-30",
        **site,
    )

    reponse = await client.get(
        f"/mouvements-pesticide?pesticide_id={pesticide.id}&date_debut=2026-08-10&date_fin=2026-08-31",
        headers=admin_headers,
    )

    assert [ligne["id"] for ligne in reponse.json()] == [dans_la_periode["id"]]


@pytest.mark.asyncio
async def test_journal_bornes_de_periode_incluses(
    client: AsyncClient, admin_headers: dict, pesticide, base_aerienne
):
    corps = {
        "type": "approvisionnement",
        "pesticide_id": str(pesticide.id),
        "site_id": str(base_aerienne.id),
        "unite": "L",
        "quantite": 5,
    }
    un = await _enregistrer(client, admin_headers, date_mouvement="2026-08-10", **corps)
    deux = await _enregistrer(client, admin_headers, date_mouvement="2026-08-31", **corps)

    reponse = await client.get(
        "/mouvements-pesticide?date_debut=2026-08-10&date_fin=2026-08-31", headers=admin_headers
    )

    assert {ligne["id"] for ligne in reponse.json()} == {un["id"], deux["id"]}


@pytest.mark.asyncio
async def test_journal_vide_quand_rien_ne_correspond(client: AsyncClient, admin_headers: dict):
    reponse = await client.get(
        f"/mouvements-pesticide?traitement_id={uuid.uuid4()}", headers=admin_headers
    )

    assert reponse.status_code == 200
    assert reponse.json() == []


@pytest.mark.asyncio
async def test_journal_type_inconnu_422(client: AsyncClient, admin_headers: dict):
    reponse = await client.get("/mouvements-pesticide?type=peremption", headers=admin_headers)

    assert reponse.status_code == 422


@pytest.mark.asyncio
async def test_journal_lisible_par_tout_utilisateur_authentifie_mais_pas_anonyme(
    client: AsyncClient, auth_headers: dict
):
    """La saisie est réservée (chef de base, admin) ; la lecture est ouverte, comme les soldes."""
    assert (await client.get("/mouvements-pesticide", headers=auth_headers)).status_code == 200
    assert (await client.get("/mouvements-pesticide")).status_code in (401, 403)
