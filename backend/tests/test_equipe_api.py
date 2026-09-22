"""Référentiel unifié des équipes (ADR-018, #602).

Fusionne `test_equipe_aerienne_api.py` et `test_equipe_terrestre_api.py` : ce qui était
deux suites quasi identiques devient une seule, paramétrée par `type`. Les rares
comportements propres à l'aérien (aéronef) restent en tests dédiés, en fin de fichier.
"""

import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient

AERONEF = {"immatriculation": "5R-MJA", "societe": "Madagascar Helicopter", "volume_cuve_l": 800}

TYPES = ["aerien", "terrestre"]


@pytest_asyncio.fixture
async def chefs(chef_de_base, chef_equipe):
    """Le chef au bon rôle pour chaque type : `chef_de_base` en aérien, `chef_equipe`
    en terrestre — c'est la seule asymétrie qui subsiste entre les deux types."""
    return {"aerien": chef_de_base, "terrestre": chef_equipe}


@pytest_asyncio.fixture
async def equipes(equipe_aerienne, equipe_terrestre):
    return {"aerien": equipe_aerienne, "terrestre": equipe_terrestre}


@pytest_asyncio.fixture
async def chef_de_base_libre(db_session):
    """Un second chef de base ne dirigeant aucune équipe — pour les tests qui créent
    deux équipes aériennes et veulent isoler une violation *autre* que celle du chef."""
    from app.auth import hash_password
    from app.models.users import Utilisateur

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


def corps(type_equipe: str, chef_id, **extra) -> dict:
    """Corps minimal valide. L'aéronef n'est ajouté qu'en aérien, où il reste exigé
    (migration 0078) ; son immatriculation est unique par défaut, seuls les tests qui
    visent le doublon en passent une explicite."""
    aeronef = {**AERONEF, "immatriculation": f"5R-{uuid.uuid4().hex[:5].upper()}"}
    defaut = {
        "nom": f"Équipe {type_equipe}",
        "type": type_equipe,
        "membres": [{"user_id": str(chef_id), "fonction": "chef"}],
    }
    if type_equipe == "aerien":
        defaut["aeronef"] = aeronef
    return {**defaut, **extra}


@pytest.mark.parametrize("type_equipe", TYPES)
@pytest.mark.asyncio
async def test_create_equipe(client: AsyncClient, auth_headers: dict, type_equipe, chefs):
    chef = chefs[type_equipe]
    response = await client.post("/equipes", json=corps(type_equipe, chef.id), headers=auth_headers)
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["type"] == type_equipe
    assert data["actif"] is True
    assert [(m["user_id"], m["fonction"]) for m in data["membres"]] == [(str(chef.id), "chef")]


@pytest.mark.parametrize("type_equipe", TYPES)
@pytest.mark.asyncio
async def test_create_equipe_sans_chef_422(client: AsyncClient, auth_headers: dict, type_equipe):
    """Une équipe naît avec son chef, comme du temps où `chef_de_base_id` /
    `chef_equipe_id` étaient NOT NULL : l'unification ne l'a pas rendu facultatif."""
    response = await client.post(
        "/equipes",
        json={**corps(type_equipe, uuid.uuid4()), "membres": []},
        headers=auth_headers,
    )
    assert response.status_code == 422, response.text


@pytest.mark.parametrize("type_equipe", TYPES)
@pytest.mark.asyncio
async def test_create_equipe_avec_deux_chefs_422(
    client: AsyncClient, auth_headers: dict, type_equipe, chefs
):
    """Refusé en amont plutôt qu'en violation de `uq_equipe_membre_chef_par_equipe`."""
    chef = chefs[type_equipe]
    response = await client.post(
        "/equipes",
        json=corps(
            type_equipe,
            chef.id,
            membres=[
                {"user_id": str(chef.id), "fonction": "chef"},
                {"nom": "Autre", "prenom": "Chef", "fonction": "chef"},
            ],
        ),
        headers=auth_headers,
    )
    assert response.status_code == 422, response.text


@pytest.mark.parametrize("type_equipe", TYPES)
@pytest.mark.asyncio
async def test_ajouter_membre_avec_compte_existant(
    client: AsyncClient, auth_headers: dict, pilote, type_equipe, equipes
):
    equipe = equipes[type_equipe]
    response = await client.post(
        f"/equipes/{equipe.id}/membres",
        json={"user_id": str(pilote.id), "fonction": "pilote"},
        headers=auth_headers,
    )
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["user_id"] == str(pilote.id)
    assert data["fonction"] == "pilote"
    assert data["prenom"] == pilote.prenom


@pytest.mark.parametrize("type_equipe", TYPES)
@pytest.mark.asyncio
async def test_ajouter_membre_cree_un_compte_a_la_volee(
    client: AsyncClient, auth_headers: dict, type_equipe, equipes
):
    """Un intervenant externe n'a pas de compte : il en reçoit un, non authentifiable."""
    equipe = equipes[type_equipe]
    response = await client.post(
        f"/equipes/{equipe.id}/membres",
        json={"nom": "Randria", "prenom": "Tovo", "fonction": "mecanicien"},
        headers=auth_headers,
    )
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["nom"] == "Randria"
    assert data["fonction"] == "mecanicien"

    membres = (await client.get(f"/equipes/{equipe.id}", headers=auth_headers)).json()["membres"]
    assert data["user_id"] in [m["user_id"] for m in membres]


@pytest.mark.parametrize("type_equipe", TYPES)
@pytest.mark.asyncio
async def test_creer_equipe_avec_membre_a_la_volee(
    client: AsyncClient, auth_headers: dict, type_equipe, chefs
):
    chef = chefs[type_equipe]
    response = await client.post(
        "/equipes",
        json=corps(
            type_equipe,
            chef.id,
            membres=[
                {"user_id": str(chef.id), "fonction": "chef"},
                {"nom": "Rakoto", "prenom": "Jean", "fonction": "pilote"},
            ],
        ),
        headers=auth_headers,
    )
    assert response.status_code == 201, response.text
    fonctions = {m["fonction"]: m["nom"] for m in response.json()["membres"]}
    assert fonctions["pilote"] == "Rakoto"


@pytest.mark.parametrize("type_equipe", TYPES)
@pytest.mark.asyncio
async def test_membre_a_la_volee_refuse_pour_un_chef(
    client: AsyncClient, auth_headers: dict, type_equipe
):
    """Un chef doit préexister (#319) : on ne l'invente pas en même temps que l'équipe."""
    response = await client.post(
        "/equipes",
        json=corps(
            type_equipe,
            uuid.uuid4(),
            membres=[{"nom": "Inconnu", "prenom": "Chef", "fonction": "chef"}],
        ),
        headers=auth_headers,
    )
    assert response.status_code == 400, response.text


@pytest.mark.parametrize("type_equipe", TYPES)
@pytest.mark.asyncio
async def test_second_chef_refuse(
    client: AsyncClient, auth_headers: dict, type_equipe, db_session, equipes
):
    """Une équipe n'a qu'un chef (`uq_equipe_membre_chef_par_equipe`)."""
    from app.auth import hash_password
    from app.models.users import Utilisateur

    equipe = equipes[type_equipe]
    autre_chef = Utilisateur(
        id=uuid.uuid4(),
        nom="Rabe",
        prenom="Naina",
        email=f"naina.rabe+{uuid.uuid4().hex[:6]}@test.mg",
        password_hash=hash_password("secret"),
        role="chef_de_base" if type_equipe == "aerien" else "chef_equipe",
        actif=True,
    )
    db_session.add(autre_chef)
    await db_session.commit()

    response = await client.post(
        f"/equipes/{equipe.id}/membres",
        json={"user_id": str(autre_chef.id), "fonction": "chef"},
        headers=auth_headers,
    )
    assert response.status_code == 409, response.text


@pytest.mark.parametrize("type_equipe", TYPES)
@pytest.mark.asyncio
async def test_chef_deja_chef_ailleurs_refuse(
    client: AsyncClient, auth_headers: dict, type_equipe, chefs, equipes
):
    """Un chef ne dirige qu'une équipe (`uq_equipe_membre_chef_par_utilisateur`) —
    la fixture d'équipe le prend déjà comme chef."""
    assert equipes[type_equipe] is not None
    chef = chefs[type_equipe]
    response = await client.post("/equipes", json=corps(type_equipe, chef.id), headers=auth_headers)
    assert response.status_code == 409, response.text


@pytest.mark.parametrize("type_equipe", TYPES)
@pytest.mark.asyncio
async def test_chef_avec_mauvais_role_403(
    client: AsyncClient,
    auth_headers: dict,
    pilote,
    type_equipe,
):
    response = await client.post(
        "/equipes", json=corps(type_equipe, pilote.id), headers=auth_headers
    )
    assert response.status_code == 403, response.text


@pytest.mark.parametrize("type_equipe", TYPES)
@pytest.mark.asyncio
async def test_membre_inexistant_404(client: AsyncClient, auth_headers: dict, type_equipe, equipes):
    equipe = equipes[type_equipe]
    response = await client.post(
        f"/equipes/{equipe.id}/membres",
        json={"user_id": str(uuid.uuid4()), "fonction": "pilote"},
        headers=auth_headers,
    )
    assert response.status_code == 404, response.text


@pytest.mark.parametrize("type_equipe", TYPES)
@pytest.mark.asyncio
async def test_membre_deja_dans_equipe_409(
    client: AsyncClient, auth_headers: dict, pilote, type_equipe, equipes
):
    equipe = equipes[type_equipe]
    corps_membre = {"user_id": str(pilote.id), "fonction": "pilote"}
    await client.post(f"/equipes/{equipe.id}/membres", json=corps_membre, headers=auth_headers)
    response = await client.post(
        f"/equipes/{equipe.id}/membres", json=corps_membre, headers=auth_headers
    )
    assert response.status_code == 409, response.text


@pytest.mark.parametrize("type_equipe", TYPES)
@pytest.mark.asyncio
async def test_list_masque_les_inactives_par_defaut(
    client: AsyncClient, auth_headers: dict, db_session, type_equipe, equipes
):
    equipe = equipes[type_equipe]
    equipe.actif = False
    await db_session.commit()

    response = await client.get("/equipes", headers=auth_headers)
    assert str(equipe.id) not in [e["id"] for e in response.json()]

    response = await client.get("/equipes?inclure_inactifs=true", headers=auth_headers)
    assert str(equipe.id) in [e["id"] for e in response.json()]


@pytest.mark.parametrize("type_equipe", TYPES)
@pytest.mark.asyncio
async def test_get_equipe(client: AsyncClient, auth_headers: dict, type_equipe, equipes):
    equipe = equipes[type_equipe]
    response = await client.get(f"/equipes/{equipe.id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["id"] == str(equipe.id)
    assert response.json()["type"] == type_equipe


@pytest.mark.parametrize("type_equipe", TYPES)
@pytest.mark.asyncio
async def test_update_equipe_ne_change_pas_le_type(
    client: AsyncClient, auth_headers: dict, type_equipe, equipes
):
    """`type` n'existe pas dans `EquipeUpdate` : l'envoyer ne fait rien (Pydantic
    l'ignore), il n'y a pas de chemin pour reclasser une équipe."""
    equipe = equipes[type_equipe]
    autre_type = "terrestre" if type_equipe == "aerien" else "aerien"
    response = await client.put(
        f"/equipes/{equipe.id}",
        json={"nom": "Renommée", "type": autre_type},
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text
    assert response.json()["nom"] == "Renommée"
    assert response.json()["type"] == type_equipe


@pytest.mark.asyncio
async def test_list_equipes_filtre_par_type(
    client: AsyncClient, auth_headers: dict, equipe_aerienne, equipe_terrestre
):
    aeriennes = (await client.get("/equipes?type=aerien", headers=auth_headers)).json()
    assert [e["id"] for e in aeriennes] == [str(equipe_aerienne.id)]

    terrestres = (await client.get("/equipes?type=terrestre", headers=auth_headers)).json()
    assert [e["id"] for e in terrestres] == [str(equipe_terrestre.id)]


@pytest.mark.asyncio
async def test_get_equipe_inexistante_404(client: AsyncClient, auth_headers: dict):
    response = await client.get(f"/equipes/{uuid.uuid4()}", headers=auth_headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_create_sans_authentification_401(client: AsyncClient, chef_equipe):
    response = await client.post("/equipes", json=corps("terrestre", chef_equipe.id))
    assert response.status_code == 401


# --- propre à l'aérien : l'aéronef ------------------------------------------------


@pytest.mark.asyncio
async def test_create_equipe_aerienne_avec_aeronef(
    client: AsyncClient, auth_headers: dict, chef_de_base
):
    response = await client.post(
        "/equipes", json=corps("aerien", chef_de_base.id, aeronef=AERONEF), headers=auth_headers
    )
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["aeronef"]["immatriculation"] == "5R-MJA"
    assert data["aeronef_id"] == data["aeronef"]["id"]


@pytest.mark.asyncio
async def test_equipe_aerienne_sans_aeronef_422(
    client: AsyncClient, auth_headers: dict, chef_de_base
):
    """L'hélicoptère reste exigé pour toute nouvelle équipe aérienne (migration 0078)."""
    response = await client.post(
        "/equipes",
        json={"nom": "Équipe", "type": "aerien", "membres": []},
        headers=auth_headers,
    )
    assert response.status_code == 422, response.text


@pytest.mark.asyncio
async def test_aeronef_refuse_sur_une_equipe_terrestre(
    client: AsyncClient, auth_headers: dict, chef_equipe
):
    """`ck_equipe_aeronef_reserve_aerien` : un hélicoptère n'a rien à faire dans une
    équipe terrestre — refusé en amont, avec un message plutôt qu'une violation brute."""
    response = await client.post(
        "/equipes", json=corps("terrestre", chef_equipe.id, aeronef=AERONEF), headers=auth_headers
    )
    assert response.status_code == 422, response.text


@pytest.mark.asyncio
async def test_immatriculation_deja_prise_409(
    client: AsyncClient, auth_headers: dict, chef_de_base, chef_de_base_libre
):
    premiere = await client.post(
        "/equipes", json=corps("aerien", chef_de_base.id, aeronef=AERONEF), headers=auth_headers
    )
    assert premiere.status_code == 201, premiere.text
    response = await client.post(
        "/equipes",
        json=corps("aerien", chef_de_base_libre.id, nom="Deuxième", aeronef=AERONEF),
        headers=auth_headers,
    )
    assert response.status_code == 409, response.text


@pytest.mark.asyncio
async def test_base_principale_avec_equipe_deja_assignee_409(
    client: AsyncClient, admin_headers: dict, base_aerienne, equipe_aerienne
):
    """Une équipe ne possède qu'une base principale (UNIQUE base_aerienne.equipe_id) —
    `base_aerienne` (fixture) possède déjà `equipe_aerienne`."""
    response = await client.post(
        "/bases-aeriennes",
        json={"numero": "IHO09", "localite": "Ailleurs", "equipe_id": str(equipe_aerienne.id)},
        headers=admin_headers,
    )
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_base_principale_avec_equipe_inexistante_404(
    client: AsyncClient, admin_headers: dict
):
    response = await client.post(
        "/bases-aeriennes",
        json={"numero": "IHO09", "localite": "Ailleurs", "equipe_id": str(uuid.uuid4())},
        headers=admin_headers,
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_base_principale_refuse_une_equipe_terrestre_404(
    client: AsyncClient, admin_headers: dict, equipe_terrestre
):
    """La FK composite `(equipe_id, equipe_type)` interdit en SQL qu'une base aérienne
    soit rattachée à une équipe terrestre — c'est tout l'intérêt du type dans la FK."""
    response = await client.post(
        "/bases-aeriennes",
        json={"numero": "IHO09", "localite": "Ailleurs", "equipe_id": str(equipe_terrestre.id)},
        headers=admin_headers,
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_lieu_aerien_refuse_une_equipe_terrestre(
    client: AsyncClient, admin_headers: dict, equipe_terrestre
):
    """Les identifiants d'équipe étant désormais partagés entre les deux types, un id
    d'équipe terrestre est un id parfaitement valide : sans contrôle de type côté
    application, il ne se heurtait qu'à la FK composite — une violation brute (500) au
    lieu d'une erreur métier."""
    response = await client.post(
        "/lieux-aeriens",
        json={
            "type_lieu": "stand",
            "nom": "Stand",
            "latitude": -22.4,
            "longitude": 46.1,
            "equipe_aerienne_id": str(equipe_terrestre.id),
        },
        headers=admin_headers,
    )
    assert response.status_code == 409, response.text


@pytest.mark.asyncio
async def test_stand_remplissage_refuse_une_equipe_terrestre(
    client: AsyncClient, admin_headers: dict, equipe_terrestre
):
    response = await client.post(
        "/stands-remplissage",
        json={
            "numero": "STD90",
            "localite": "Ailleurs",
            "equipe_aerienne_id": str(equipe_terrestre.id),
        },
        headers=admin_headers,
    )
    assert response.status_code == 404, response.text
