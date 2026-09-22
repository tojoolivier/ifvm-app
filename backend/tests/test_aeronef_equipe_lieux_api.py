"""Aéronef d'une équipe aérienne + « seule l'équipe crée ses lieux » (migration 0078).

Règle produit (2026-09-19) : une équipe aérienne a un aéronef (immatriculation, société,
volume de cuve) ; seul le chef de base de l'équipe — le seul compte utilisateur de
l'équipe — crée ses bases et ses stands, rattachés d'office à SON équipe. Un admin peut
agir pour n'importe quelle équipe en la désignant.

Depuis #603 l'appareil n'est plus une colonne de l'équipe : `EquipeRead.aeronef_id` /
`aeronef` projettent l'affectation **en cours** (`equipe_aeronef` avec
`date_fin IS NULL`), posée à la création. Ce fichier garde donc son sujet — le parc et
les lieux vus depuis l'équipe — et les affectations successives, l'historique et le
refus du chevauchement vivent dans `test_equipe_aeronef_api.py`.
"""

import uuid

import pytest
from httpx import AsyncClient

from app.auth import create_access_token, hash_password
from app.models.users import Utilisateur

AERONEF = {"immatriculation": "5R-MJA", "societe": "Madagascar Helicopter", "volume_cuve_l": 800}


def _headers(utilisateur_id: uuid.UUID) -> dict:
    return {"Authorization": f"Bearer {create_access_token(utilisateur_id)}"}


@pytest.fixture
def chef_headers(chef_de_base) -> dict:
    """Le chef de base de `equipe_aerienne`."""
    return _headers(chef_de_base.id)


@pytest.fixture
def chef_bis_headers(equipe_aerienne_bis) -> dict:
    """Le chef de base de `equipe_aerienne_bis` — une autre équipe. Depuis ADR-018 le
    chef est une ligne de `equipe_membre`, plus une colonne de l'équipe."""
    chef = next(m for m in equipe_aerienne_bis.membres if m.fonction == "chef")
    return _headers(chef.user_id)


def _corps_equipe(chef_id, **extra) -> dict:
    """Corps de `POST /equipes` pour une équipe aérienne (référentiel unifié, ADR-018)."""
    corps = {
        "nom": "Équipe Ihosy",
        "type": "aerien",
        "membres": [
            {"user_id": str(chef_id), "fonction": "chef"},
            {"nom": "Rakoto", "prenom": "Jean", "fonction": "pilote"},
            {"nom": "Andria", "prenom": "Paul", "fonction": "mecanicien"},
        ],
        "aeronef": AERONEF,
        **extra,
    }
    # `aeronef=None` sert aux tests qui vérifient qu'il est exigé.
    return {k: v for k, v in corps.items() if v is not None}


# --- Aéronef -----------------------------------------------------------------------


@pytest.mark.asyncio
async def test_equipe_relue_avec_son_aeronef(
    client: AsyncClient, admin_headers: dict, chef_de_base
):
    creee = await client.post(
        "/equipes",
        json=_corps_equipe(chef_de_base.id, nom="Équipe Ihosy", aeronef=AERONEF),
        headers=admin_headers,
    )
    assert creee.status_code == 201, creee.text

    relue = await client.get(f"/equipes/{creee.json()['id']}", headers=admin_headers)
    assert relue.json()["aeronef"]["immatriculation"] == "5R-MJA"
    assert relue.json()["aeronef"]["volume_cuve_l"] == 800

    # Ce que la lecture projette est bien une affectation ouverte, pas une colonne.
    historique = await client.get(f"/equipes/{creee.json()['id']}/aeronefs", headers=admin_headers)
    assert [ligne["date_fin"] for ligne in historique.json()] == [None]
    assert historique.json()[0]["aeronef_id"] == relue.json()["aeronef_id"]


@pytest.mark.asyncio
async def test_equipe_sans_aeronef_422(client: AsyncClient, admin_headers: dict, chef_de_base):
    """L'hélicoptère est exigé pour toute nouvelle équipe : `aeronef` (créé à la volée)
    ou `aeronef_id` (déjà au parc, #621). Une équipe peut ensuite se retrouver sans
    appareil en service, mais seulement en bornant son affectation (#603)."""
    reponse = await client.post(
        "/equipes",
        json=_corps_equipe(chef_de_base.id, nom="Équipe Ihosy", aeronef=None),
        headers=admin_headers,
    )
    assert reponse.status_code == 422


@pytest.mark.asyncio
@pytest.mark.parametrize("volume", [0, -5])
async def test_volume_cuve_doit_etre_positif_422(
    client: AsyncClient, admin_headers: dict, chef_de_base, volume
):
    reponse = await client.post(
        "/equipes",
        json=_corps_equipe(
            chef_de_base.id,
            nom="Équipe Ihosy",
            aeronef={**AERONEF, "volume_cuve_l": volume},
        ),
        headers=admin_headers,
    )
    assert reponse.status_code == 422


@pytest.mark.asyncio
async def test_immatriculation_deja_prise_409_sans_ecrire_l_equipe(
    client: AsyncClient, admin_headers: dict, chef_de_base, db_session
):
    """Deux hélicoptères ne partagent pas une immatriculation ; l'échec n'écrit ni
    l'équipe ni l'aéronef (même transaction)."""
    premiere = await client.post(
        "/equipes",
        json=_corps_equipe(chef_de_base.id, nom="Équipe A", aeronef=AERONEF),
        headers=admin_headers,
    )
    assert premiere.status_code == 201, premiere.text

    # Un second chef, libre : la seule violation possible est celle de l'immatriculation.
    autre_chef = Utilisateur(
        id=uuid.uuid4(),
        nom="Rasolo",
        prenom="Tiana",
        email=f"tiana.rasolo+{uuid.uuid4().hex[:6]}@test.mg",
        password_hash=hash_password("secret"),
        role="chef_de_base",
        actif=True,
    )
    db_session.add(autre_chef)
    await db_session.commit()

    doublon = await client.post(
        "/equipes",
        json=_corps_equipe(autre_chef.id, nom="Équipe B", aeronef=AERONEF),
        headers=admin_headers,
    )
    assert doublon.status_code == 409, doublon.text
    assert "immatriculation" in doublon.json()["detail"]

    equipes = await client.get("/equipes?inclure_inactifs=true", headers=admin_headers)
    assert [e["nom"] for e in equipes.json()] == ["Équipe A"]


@pytest.mark.asyncio
async def test_liste_des_aeronefs(client: AsyncClient, admin_headers: dict, chef_de_base):
    await client.post(
        "/equipes",
        json=_corps_equipe(chef_de_base.id, nom="Équipe Ihosy", aeronef=AERONEF),
        headers=admin_headers,
    )
    reponse = await client.get("/aeronefs", headers=admin_headers)
    assert reponse.status_code == 200
    assert [a["immatriculation"] for a in reponse.json()] == ["5R-MJA"]


@pytest.mark.asyncio
async def test_admin_modifie_societe_et_volume_de_cuve(
    client: AsyncClient, admin_headers: dict, chef_de_base
):
    equipe = (
        await client.post(
            "/equipes",
            json=_corps_equipe(chef_de_base.id, nom="Équipe Ihosy", aeronef=AERONEF),
            headers=admin_headers,
        )
    ).json()

    # `aeronef_id` est l'appareil *en service* dans l'équipe (#603), pas une colonne.
    reponse = await client.put(
        f"/aeronefs/{equipe['aeronef_id']}",
        json={"societe": "Autre Société", "volume_cuve_l": 1000},
        headers=admin_headers,
    )
    assert reponse.status_code == 200, reponse.text
    assert reponse.json()["societe"] == "Autre Société"
    assert reponse.json()["volume_cuve_l"] == 1000
    assert reponse.json()["immatriculation"] == "5R-MJA"


@pytest.mark.asyncio
async def test_seul_un_admin_modifie_un_aeronef(
    client: AsyncClient, admin_headers: dict, chef_headers: dict, chef_de_base
):
    equipe = (
        await client.post(
            "/equipes",
            json=_corps_equipe(chef_de_base.id, nom="Équipe Ihosy", aeronef=AERONEF),
            headers=admin_headers,
        )
    ).json()

    reponse = await client.put(
        f"/aeronefs/{equipe['aeronef_id']}", json={"societe": "X"}, headers=chef_headers
    )
    assert reponse.status_code == 403


@pytest.mark.asyncio
async def test_modifier_aeronef_inexistant_404(client: AsyncClient, admin_headers: dict):
    reponse = await client.put(
        f"/aeronefs/{uuid.uuid4()}", json={"societe": "X"}, headers=admin_headers
    )
    assert reponse.status_code == 404


# --- Bases : seule l'équipe crée les siennes ---------------------------------------


@pytest.mark.asyncio
async def test_chef_cree_sa_base_principale_sans_designer_l_equipe(
    client: AsyncClient, chef_headers: dict, equipe_aerienne
):
    reponse = await client.post(
        "/bases-aeriennes",
        json={"numero": "IHO01", "localite": "Ihosy"},
        headers=chef_headers,
    )
    assert reponse.status_code == 201, reponse.text
    assert reponse.json()["equipe_id"] == str(equipe_aerienne.id)


@pytest.mark.asyncio
async def test_chef_ne_cree_pas_une_base_pour_une_autre_equipe_403(
    client: AsyncClient, chef_headers: dict, equipe_aerienne, equipe_aerienne_bis
):
    reponse = await client.post(
        "/bases-aeriennes",
        json={"numero": "BET01", "localite": "Betroka", "equipe_id": str(equipe_aerienne_bis.id)},
        headers=chef_headers,
    )
    assert reponse.status_code == 403


@pytest.mark.asyncio
async def test_utilisateur_sans_equipe_ne_cree_pas_de_base_403(
    client: AsyncClient, auth_headers: dict, equipe_aerienne
):
    reponse = await client.post(
        "/bases-aeriennes",
        json={"numero": "IHO01", "localite": "Ihosy", "equipe_id": str(equipe_aerienne.id)},
        headers=auth_headers,
    )
    assert reponse.status_code == 403


@pytest.mark.asyncio
async def test_chef_cree_une_base_secondaire_sous_sa_principale(
    client: AsyncClient, chef_headers: dict, base_aerienne
):
    reponse = await client.post(
        "/bases-aeriennes",
        json={"numero": "IHO02", "localite": "Ihosy nord", "parent_base_id": str(base_aerienne.id)},
        headers=chef_headers,
    )
    assert reponse.status_code == 201, reponse.text
    assert reponse.json()["parent_base_id"] == str(base_aerienne.id)


@pytest.mark.asyncio
async def test_chef_ne_cree_pas_une_secondaire_sous_la_principale_d_une_autre_equipe_403(
    client: AsyncClient, chef_bis_headers: dict, base_aerienne
):
    """`base_aerienne` appartient à `equipe_aerienne`, pas à l'équipe du chef « bis »."""
    reponse = await client.post(
        "/bases-aeriennes",
        json={"numero": "IHO02", "localite": "Volé", "parent_base_id": str(base_aerienne.id)},
        headers=chef_bis_headers,
    )
    assert reponse.status_code == 403


@pytest.mark.asyncio
async def test_chef_ne_modifie_pas_la_base_d_une_autre_equipe_403(
    client: AsyncClient, chef_bis_headers: dict, base_aerienne
):
    reponse = await client.put(
        f"/bases-aeriennes/{base_aerienne.id}", json={"actif": False}, headers=chef_bis_headers
    )
    assert reponse.status_code == 403


@pytest.mark.asyncio
async def test_chef_modifie_sa_propre_base(client: AsyncClient, chef_headers: dict, base_aerienne):
    reponse = await client.put(
        f"/bases-aeriennes/{base_aerienne.id}",
        json={"localite": "Ihosy centre"},
        headers=chef_headers,
    )
    assert reponse.status_code == 200, reponse.text
    assert reponse.json()["localite"] == "Ihosy centre"


# --- Stands : rattachés à l'équipe -------------------------------------------------


@pytest.mark.asyncio
async def test_chef_cree_son_stand_rattache_a_son_equipe(
    client: AsyncClient, chef_headers: dict, equipe_aerienne
):
    reponse = await client.post(
        "/stands-remplissage",
        json={"numero": "STD10", "localite": "Stand Ihosy"},
        headers=chef_headers,
    )
    assert reponse.status_code == 201, reponse.text
    assert reponse.json()["equipe_aerienne_id"] == str(equipe_aerienne.id)


@pytest.mark.asyncio
async def test_chef_ne_cree_pas_un_stand_pour_une_autre_equipe_403(
    client: AsyncClient, chef_headers: dict, equipe_aerienne_bis
):
    reponse = await client.post(
        "/stands-remplissage",
        json={
            "numero": "STD11",
            "localite": "Ailleurs",
            "equipe_aerienne_id": str(equipe_aerienne_bis.id),
        },
        headers=chef_headers,
    )
    assert reponse.status_code == 403


@pytest.mark.asyncio
async def test_utilisateur_sans_equipe_ne_cree_pas_de_stand_403(
    client: AsyncClient, auth_headers: dict, equipe_aerienne
):
    reponse = await client.post(
        "/stands-remplissage",
        json={
            "numero": "STD12",
            "localite": "Ailleurs",
            "equipe_aerienne_id": str(equipe_aerienne.id),
        },
        headers=auth_headers,
    )
    assert reponse.status_code == 403


@pytest.mark.asyncio
async def test_admin_doit_designer_l_equipe_du_stand_422(client: AsyncClient, admin_headers: dict):
    reponse = await client.post(
        "/stands-remplissage",
        json={"numero": "STD13", "localite": "Sans équipe"},
        headers=admin_headers,
    )
    assert reponse.status_code == 422


@pytest.mark.asyncio
async def test_admin_stand_pour_equipe_inexistante_404(client: AsyncClient, admin_headers: dict):
    reponse = await client.post(
        "/stands-remplissage",
        json={
            "numero": "STD14",
            "localite": "Fantôme",
            "equipe_aerienne_id": str(uuid.uuid4()),
        },
        headers=admin_headers,
    )
    assert reponse.status_code == 404


@pytest.mark.asyncio
async def test_chef_ne_modifie_pas_le_stand_d_une_autre_equipe_403(
    client: AsyncClient, admin_headers: dict, chef_bis_headers: dict, equipe_aerienne
):
    stand = (
        await client.post(
            "/stands-remplissage",
            json={
                "numero": "STD15",
                "localite": "Chez l'autre",
                "equipe_aerienne_id": str(equipe_aerienne.id),
            },
            headers=admin_headers,
        )
    ).json()
    reponse = await client.put(
        f"/stands-remplissage/{stand['id']}", json={"actif": False}, headers=chef_bis_headers
    )
    assert reponse.status_code == 403


@pytest.mark.asyncio
async def test_stand_sans_equipe_modifiable_par_un_admin_seulement(
    client: AsyncClient, admin_headers: dict, chef_headers: dict, stand_remplissage
):
    """Un stand antérieur à la migration (« sans équipe ») n'a pas de propriétaire : un
    chef de base ne peut pas le modifier, un admin le peut."""
    par_un_chef = await client.put(
        f"/stands-remplissage/{stand_remplissage.id}", json={"localite": "X"}, headers=chef_headers
    )
    assert par_un_chef.status_code == 403

    par_un_admin = await client.put(
        f"/stands-remplissage/{stand_remplissage.id}", json={"localite": "X"}, headers=admin_headers
    )
    assert par_un_admin.status_code == 200


@pytest.mark.asyncio
async def test_admin_rattache_un_stand_existant_a_une_equipe(
    client: AsyncClient, admin_headers: dict, stand_remplissage, equipe_aerienne
):
    reponse = await client.put(
        f"/stands-remplissage/{stand_remplissage.id}",
        json={"equipe_aerienne_id": str(equipe_aerienne.id)},
        headers=admin_headers,
    )
    assert reponse.status_code == 200, reponse.text
    assert reponse.json()["equipe_aerienne_id"] == str(equipe_aerienne.id)


@pytest.mark.asyncio
async def test_chef_ne_change_pas_l_equipe_de_son_stand_403(
    client: AsyncClient, chef_headers: dict, equipe_aerienne, equipe_aerienne_bis
):
    stand = (
        await client.post(
            "/stands-remplissage",
            json={"numero": "STD16", "localite": "Le mien"},
            headers=chef_headers,
        )
    ).json()
    reponse = await client.put(
        f"/stands-remplissage/{stand['id']}",
        json={"equipe_aerienne_id": str(equipe_aerienne_bis.id)},
        headers=chef_headers,
    )
    assert reponse.status_code == 403


@pytest.mark.asyncio
async def test_chef_reenvoie_le_meme_stand_sans_403(
    client: AsyncClient, chef_headers: dict, equipe_aerienne
):
    """Un PUT qui échoue simplement l'équipe déjà en place (lecture-modification-
    écriture typique d'un client) ne doit pas 403 le propriétaire légitime — seul un
    changement réel d'équipe est réservé à l'admin."""
    stand = (
        await client.post(
            "/stands-remplissage",
            json={"numero": "STD17", "localite": "Le mien"},
            headers=chef_headers,
        )
    ).json()
    reponse = await client.put(
        f"/stands-remplissage/{stand['id']}",
        json={"localite": "Le mien (renommé)", "equipe_aerienne_id": stand["equipe_aerienne_id"]},
        headers=chef_headers,
    )
    assert reponse.status_code == 200, reponse.text
    assert reponse.json()["localite"] == "Le mien (renommé)"
    assert reponse.json()["equipe_aerienne_id"] == str(equipe_aerienne.id)
