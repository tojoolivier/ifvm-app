import uuid

import pytest
from httpx import AsyncClient

from app.auth import create_access_token


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
