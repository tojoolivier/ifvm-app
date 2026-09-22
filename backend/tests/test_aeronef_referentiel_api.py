"""Référentiel aéronef autonome (#621).

Jusqu'ici un appareil ne pouvait naître que dans `POST /equipes`, champ imbriqué
`aeronef`. Ça tenait tant que la relation était 1:1 ; #603 la casse (2 à 3 appareils
affectés successivement à une équipe), et un hélicoptère doit alors pouvoir exister
*avant* sa première affectation et *entre* deux affectations.

Le parc est une donnée d'administration : `POST` suit la règle de `PUT`, admin only.
"""

import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import hash_password
from app.models.users import Utilisateur


@pytest_asyncio.fixture
async def autre_chef_de_base(db_session: AsyncSession) -> Utilisateur:
    """Un second chef de base : `uq_equipe_membre_chef_par_utilisateur` interdit de
    réutiliser celui de la fixture `chef_de_base` pour une deuxième équipe."""
    chef = Utilisateur(
        id=uuid.uuid4(),
        nom="Rasolo",
        prenom="Tiana",
        email=f"tiana.rasolo+{uuid.uuid4().hex[:6]}@test.mg",
        password_hash=hash_password("secret"),
        role="chef_de_base",
        actif=True,
    )
    db_session.add(chef)
    await db_session.commit()
    return chef


AERONEF = {"immatriculation": "5R-MJB", "societe": "Madagascar Helicopter", "volume_cuve_l": 800}


def _corps_equipe(chef_id, **extra) -> dict:
    corps = {
        "nom": "Équipe Ihosy",
        "type": "aerien",
        "membres": [{"user_id": str(chef_id), "fonction": "chef"}],
        **extra,
    }
    return {k: v for k, v in corps.items() if v is not None}


@pytest.mark.asyncio
async def test_admin_cree_un_aeronef_sans_equipe(client: AsyncClient, admin_headers: dict):
    reponse = await client.post("/aeronefs", json=AERONEF, headers=admin_headers)
    assert reponse.status_code == 201, reponse.text
    cree = reponse.json()
    assert cree["immatriculation"] == "5R-MJB"
    assert cree["actif"] is True

    relu = await client.get(f"/aeronefs/{cree['id']}", headers=admin_headers)
    assert relu.status_code == 200
    assert relu.json()["societe"] == "Madagascar Helicopter"

    liste = await client.get("/aeronefs", headers=admin_headers)
    assert [a["id"] for a in liste.json()] == [cree["id"]]


@pytest.mark.asyncio
async def test_aeronef_inexistant_404(client: AsyncClient, admin_headers: dict):
    reponse = await client.get(f"/aeronefs/{uuid.uuid4()}", headers=admin_headers)
    assert reponse.status_code == 404


@pytest.mark.asyncio
async def test_immatriculation_deja_prise_409_sans_creer_de_ligne(
    client: AsyncClient, admin_headers: dict
):
    premier = await client.post("/aeronefs", json=AERONEF, headers=admin_headers)
    assert premier.status_code == 201, premier.text

    doublon = await client.post(
        "/aeronefs", json={**AERONEF, "societe": "Autre"}, headers=admin_headers
    )
    assert doublon.status_code == 409, doublon.text
    assert "immatriculation" in doublon.json()["detail"]

    liste = await client.get("/aeronefs?inclure_inactifs=true", headers=admin_headers)
    assert len(liste.json()) == 1


@pytest.mark.asyncio
async def test_seul_un_admin_cree_un_aeronef(client: AsyncClient, auth_headers: dict):
    """Même règle que `PUT /aeronefs/{id}` : un parc modifiable par le seul admin mais
    alimentable par n'importe qui n'aurait aucun sens."""
    reponse = await client.post("/aeronefs", json=AERONEF, headers=auth_headers)
    assert reponse.status_code == 403


@pytest.mark.asyncio
async def test_equipe_creee_a_partir_d_un_aeronef_existant(
    client: AsyncClient, admin_headers: dict, chef_de_base
):
    aeronef = (await client.post("/aeronefs", json=AERONEF, headers=admin_headers)).json()

    creee = await client.post(
        "/equipes",
        json=_corps_equipe(chef_de_base.id, aeronef_id=aeronef["id"]),
        headers=admin_headers,
    )
    assert creee.status_code == 201, creee.text
    assert creee.json()["aeronef"]["immatriculation"] == "5R-MJB"

    # Aucun doublon : l'appareil n'a pas été recréé au passage.
    liste = await client.get("/aeronefs", headers=admin_headers)
    assert len(liste.json()) == 1


@pytest.mark.asyncio
async def test_aeronef_et_aeronef_id_sont_exclusifs_422(
    client: AsyncClient, admin_headers: dict, chef_de_base
):
    aeronef = (await client.post("/aeronefs", json=AERONEF, headers=admin_headers)).json()
    reponse = await client.post(
        "/equipes",
        json=_corps_equipe(chef_de_base.id, aeronef=AERONEF, aeronef_id=aeronef["id"]),
        headers=admin_headers,
    )
    assert reponse.status_code == 422


@pytest.mark.asyncio
async def test_equipe_terrestre_refuse_un_aeronef_id_422(
    client: AsyncClient, admin_headers: dict, chef_equipe
):
    aeronef = (await client.post("/aeronefs", json=AERONEF, headers=admin_headers)).json()
    reponse = await client.post(
        "/equipes",
        json={
            "nom": "Équipe terrestre",
            "type": "terrestre",
            "membres": [{"user_id": str(chef_equipe.id), "fonction": "chef"}],
            "aeronef_id": aeronef["id"],
        },
        headers=admin_headers,
    )
    assert reponse.status_code == 422


@pytest.mark.asyncio
async def test_aeronef_id_inconnu_404(client: AsyncClient, admin_headers: dict, chef_de_base):
    reponse = await client.post(
        "/equipes",
        json=_corps_equipe(chef_de_base.id, aeronef_id=str(uuid.uuid4())),
        headers=admin_headers,
    )
    assert reponse.status_code == 404, reponse.text


@pytest.mark.asyncio
async def test_aeronef_deja_affecte_a_une_autre_equipe_409(
    client: AsyncClient, admin_headers: dict, chef_de_base, autre_chef_de_base
):
    """Depuis #603 la règle est temporelle : la seconde équipe demande l'appareil pour
    une période qui recouvre celle de la première (toutes deux ouvertes). Sur ce chemin
    — `POST /equipes`, où la date n'est pas saisie — le refus vient de l'index partiel
    `uq_equipe_aeronef_ouverte_par_aeronef`, d'où un 409 et non le 422 de
    `POST /equipes/{id}/aeronefs`."""
    aeronef = (await client.post("/aeronefs", json=AERONEF, headers=admin_headers)).json()
    premiere = await client.post(
        "/equipes",
        json=_corps_equipe(chef_de_base.id, nom="Équipe A", aeronef_id=aeronef["id"]),
        headers=admin_headers,
    )
    assert premiere.status_code == 201, premiere.text

    seconde = await client.post(
        "/equipes",
        json={
            "nom": "Équipe B",
            "type": "aerien",
            "membres": [{"user_id": str(autre_chef_de_base.id), "fonction": "chef"}],
            "aeronef_id": aeronef["id"],
        },
        headers=admin_headers,
    )
    assert seconde.status_code == 409, seconde.text
