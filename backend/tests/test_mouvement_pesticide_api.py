import pytest
from httpx import AsyncClient


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
