import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_site_principal(client: AsyncClient, admin_headers: dict, equipe_aerienne):
    response = await client.post(
        "/sites-aeriens",
        json={
            "numero": "IHO01",
            "localite": "Ihosy",
            "equipe_id": str(equipe_aerienne.id),
        },
        headers=admin_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["numero"] == "IHO01"
    assert data["parent_site_id"] is None
    assert data["equipe_id"] == str(equipe_aerienne.id)
    assert data["actif"] is True


@pytest.mark.asyncio
async def test_create_site_principal_sans_equipe_422(client: AsyncClient, admin_headers: dict):
    """#equipe-aerienne : un site principal doit appartenir à une équipe aérienne."""
    response = await client.post(
        "/sites-aeriens",
        json={"numero": "IHO01", "localite": "Ihosy"},
        headers=admin_headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_site_secondaire_avec_sa_propre_equipe_422(
    client: AsyncClient, admin_headers: dict, base_aerienne, equipe_aerienne_bis
):
    """Un site secondaire hérite de l'équipe de son principal, il ne peut pas
    en avoir une à lui — qu'il joue le rôle de base secondaire ou de stand (#604)."""
    response = await client.post(
        "/sites-aeriens",
        json={
            "numero": "IHO02",
            "localite": "Ihosy Sud",
            "parent_site_id": str(base_aerienne.id),
            "equipe_id": str(equipe_aerienne_bis.id),
        },
        headers=admin_headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_site_secondaire(client: AsyncClient, admin_headers: dict, base_aerienne):
    response = await client.post(
        "/sites-aeriens",
        json={
            "numero": "IHO02",
            "localite": "Ihosy Sud",
            "parent_site_id": str(base_aerienne.id),
        },
        headers=admin_headers,
    )
    assert response.status_code == 201
    assert response.json()["parent_site_id"] == str(base_aerienne.id)


@pytest.mark.asyncio
async def test_create_site_secondaire_d_une_secondaire_refusee(
    client: AsyncClient, admin_headers: dict, base_aerienne
):
    """La hiérarchie s'arrête à 2 niveaux : pas de secondaire d'une secondaire."""
    secondaire = await client.post(
        "/sites-aeriens",
        json={"numero": "IHO02", "localite": "Ihosy Sud", "parent_site_id": str(base_aerienne.id)},
        headers=admin_headers,
    )
    assert secondaire.status_code == 201

    reponse = await client.post(
        "/sites-aeriens",
        json={
            "numero": "IHO03",
            "localite": "Ihosy Ouest",
            "parent_site_id": secondaire.json()["id"],
        },
        headers=admin_headers,
    )
    assert reponse.status_code == 422


@pytest.mark.asyncio
async def test_create_site_parent_inexistant_409(client: AsyncClient, admin_headers: dict):
    """#655 : un parent inconnu du serveur n'est pas une saisie invalide — le mobile
    hors-ligne peut envoyer le dépendant avant son principal, il est rejoué."""
    response = await client.post(
        "/sites-aeriens",
        json={"numero": "IHO01", "localite": "Ihosy", "parent_site_id": str(uuid.uuid4())},
        headers=admin_headers,
    )
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_create_site_numero_deja_pris_409(
    client: AsyncClient, admin_headers: dict, base_aerienne, equipe_aerienne_bis
):
    response = await client.post(
        "/sites-aeriens",
        json={
            "numero": base_aerienne.numero,
            "localite": "Ailleurs",
            "equipe_id": str(equipe_aerienne_bis.id),
        },
        headers=admin_headers,
    )
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_list_sites_masque_les_inactifs_par_defaut(
    client: AsyncClient, admin_headers: dict, base_aerienne
):
    await client.put(
        f"/sites-aeriens/{base_aerienne.id}", json={"actif": False}, headers=admin_headers
    )
    response = await client.get("/sites-aeriens", headers=admin_headers)
    assert str(base_aerienne.id) not in [b["id"] for b in response.json()]

    response = await client.get("/sites-aeriens?inclure_inactifs=true", headers=admin_headers)
    assert str(base_aerienne.id) in [b["id"] for b in response.json()]


@pytest.mark.asyncio
async def test_get_site_aerienne_inexistant_404(client: AsyncClient, admin_headers: dict):
    response = await client.get(f"/sites-aeriens/{uuid.uuid4()}", headers=admin_headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_site_aerienne_inexistant_404(client: AsyncClient, admin_headers: dict):
    response = await client.put(
        f"/sites-aeriens/{uuid.uuid4()}", json={"localite": "Peu importe"}, headers=admin_headers
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_un_site_ne_peut_pas_etre_son_propre_parent(
    client: AsyncClient, admin_headers: dict, base_aerienne
):
    response = await client.put(
        f"/sites-aeriens/{base_aerienne.id}",
        json={"parent_site_id": str(base_aerienne.id)},
        headers=admin_headers,
    )
    assert response.status_code == 422
