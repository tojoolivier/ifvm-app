"""Tests de `GET /users/` — la colonne « Station » de la maquette §10.

Le poste acridien de rattachement (`utilisateur.pa_id`) existe en base depuis
l'origine mais n'était pas exposé par `UtilisateurRead` : l'écran Utilisateurs
masquait la colonne faute de donnée. On l'expose en lecture, sans migration.
"""

import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import hash_password
from app.models.users import Utilisateur


@pytest_asyncio.fixture
async def utilisateur_rattache(db_session: AsyncSession, poste_acridien) -> Utilisateur:
    user = Utilisateur(
        id=uuid.uuid4(),
        nom="Randria",
        prenom="Jean",
        email=f"jean.randria+{uuid.uuid4().hex[:6]}@test.mg",
        password_hash=hash_password("secret"),
        role="prospecteur",
        pa_id=poste_acridien.id,
        actif=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.mark.asyncio
async def test_list_users_expose_le_poste_acridien_de_rattachement(
    client: AsyncClient, admin_headers: dict, utilisateur_rattache, poste_acridien
):
    response = await client.get("/users/", headers=admin_headers)

    assert response.status_code == 200
    ligne = next(u for u in response.json() if u["id"] == str(utilisateur_rattache.id))
    assert ligne["pa_id"] == str(poste_acridien.id)
    assert ligne["pa_code"] == "PA-TEST-01"
    assert ligne["pa_nom"] == "Poste Test"


@pytest.mark.asyncio
async def test_list_users_laisse_le_rattachement_vide_sans_poste(
    client: AsyncClient, admin_headers: dict, admin
):
    response = await client.get("/users/", headers=admin_headers)

    assert response.status_code == 200
    ligne = next(u for u in response.json() if u["id"] == str(admin.id))
    assert ligne["pa_id"] is None
    assert ligne["pa_code"] is None
    assert ligne["pa_nom"] is None


@pytest_asyncio.fixture
async def chef_de_base(db_session: AsyncSession) -> Utilisateur:
    user = Utilisateur(
        id=uuid.uuid4(),
        nom="Rabe",
        prenom="Toky",
        email=f"toky.rabe+{uuid.uuid4().hex[:6]}@test.mg",
        password_hash=hash_password("secret"),
        role="chef_de_base",
        sigle="TR",
        actif=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.mark.asyncio
async def test_list_chefs_de_base_accessible_a_tout_utilisateur_authentifie(
    client: AsyncClient, auth_headers: dict, chef_de_base
):
    """`auth_headers` est un simple prospecteur, pas un admin — l'annuaire des
    chefs de base doit rester accessible pour remplir une fiche de vol."""
    response = await client.get("/users/chefs-de-base", headers=auth_headers)

    assert response.status_code == 200
    ligne = next(u for u in response.json() if u["id"] == str(chef_de_base.id))
    assert ligne["nom"] == "Rabe"
    assert ligne["prenom"] == "Toky"
    assert ligne["sigle"] == "TR"
    assert "email" not in ligne


@pytest.mark.asyncio
async def test_list_chefs_de_base_exclut_les_autres_roles(
    client: AsyncClient, auth_headers: dict, chef_de_base, utilisateur
):
    """`utilisateur` (fixture conftest) a le rôle `prospecteur` — il ne doit
    pas apparaître dans l'annuaire des chefs de base."""
    response = await client.get("/users/chefs-de-base", headers=auth_headers)
    identifiants = {u["id"] for u in response.json()}

    assert str(chef_de_base.id) in identifiants
    assert str(utilisateur.id) not in identifiants


@pytest.mark.asyncio
async def test_list_chefs_de_base_exclut_les_inactifs(
    client: AsyncClient, db_session: AsyncSession, auth_headers: dict, chef_de_base
):
    chef_de_base.actif = False
    await db_session.commit()

    response = await client.get("/users/chefs-de-base", headers=auth_headers)
    identifiants = {u["id"] for u in response.json()}

    assert str(chef_de_base.id) not in identifiants


@pytest.mark.asyncio
async def test_list_chefs_equipe_accessible_a_tout_utilisateur_authentifie(
    client: AsyncClient, auth_headers: dict, chef_equipe
):
    """Annuaire du sélecteur `chef_equipe_id` (création d'équipe terrestre) — même
    règle d'accès que `/users/chefs-de-base`."""
    response = await client.get("/users/chefs-equipe", headers=auth_headers)

    assert response.status_code == 200
    identifiants = {u["id"] for u in response.json()}
    assert str(chef_equipe.id) in identifiants


@pytest.mark.asyncio
async def test_list_chefs_equipe_exclut_les_autres_roles(
    client: AsyncClient, auth_headers: dict, chef_equipe, utilisateur
):
    response = await client.get("/users/chefs-equipe", headers=auth_headers)
    identifiants = {u["id"] for u in response.json()}

    assert str(chef_equipe.id) in identifiants
    assert str(utilisateur.id) not in identifiants


@pytest.mark.asyncio
async def test_list_chefs_equipe_exclut_les_inactifs(
    client: AsyncClient, db_session: AsyncSession, auth_headers: dict, chef_equipe
):
    chef_equipe.actif = False
    await db_session.commit()

    response = await client.get("/users/chefs-equipe", headers=auth_headers)
    identifiants = {u["id"] for u in response.json()}

    assert str(chef_equipe.id) not in identifiants


@pytest.mark.asyncio
async def test_list_users_reste_reserve_aux_admins(client: AsyncClient, auth_headers: dict):
    """L'annuaire complet ne doit pas s'ouvrir en élargissant le schéma de lecture."""
    response = await client.get("/users/", headers=auth_headers)

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_admin_ne_peut_pas_modifier_son_propre_compte(
    client: AsyncClient, admin: Utilisateur, admin_headers: dict
):
    """Un admin qui se retire le rôle ou se désactive se verrouille dehors."""
    response = await client.patch(
        f"/users/{admin.id}", json={"role": "prospecteur"}, headers=admin_headers
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_admin_peut_modifier_un_autre_compte(
    client: AsyncClient, admin_headers: dict, utilisateur_rattache: Utilisateur
):
    response = await client.patch(
        f"/users/{utilisateur_rattache.id}",
        json={"role": "verificateur"},
        headers=admin_headers,
    )

    assert response.status_code == 200
    assert response.json()["role"] == "verificateur"


@pytest.mark.asyncio
async def test_admin_peut_attribuer_un_sigle(
    client: AsyncClient, admin_headers: dict, utilisateur_rattache: Utilisateur
):
    response = await client.patch(
        f"/users/{utilisateur_rattache.id}",
        json={"sigle": "ADM"},
        headers=admin_headers,
    )

    assert response.status_code == 200
    assert response.json()["sigle"] == "ADM"


@pytest.mark.asyncio
async def test_sigle_vide_efface_le_sigle_existant(
    client: AsyncClient,
    admin_headers: dict,
    utilisateur_rattache: Utilisateur,
    db_session: AsyncSession,
):
    """Chaîne vide = effacement explicite — distinct de l'absence du champ dans
    le corps de la requête (`test_admin_peut_modifier_un_autre_compte` ci-dessus),
    qui laisse le sigle inchangé."""
    utilisateur_rattache.sigle = "ADM"
    await db_session.commit()

    response = await client.patch(
        f"/users/{utilisateur_rattache.id}",
        json={"sigle": "  "},
        headers=admin_headers,
    )

    assert response.status_code == 200
    assert response.json()["sigle"] is None


@pytest.mark.asyncio
async def test_me_reste_lisible_sans_rattachement(
    client: AsyncClient, auth_headers: dict, utilisateur
):
    """`/users/me` sert la même classe : les champs ajoutés doivent rester optionnels."""
    response = await client.get("/users/me", headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["email"] == utilisateur.email


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["pilote", "mecanicien", "consultant_international"])
async def test_creation_a_la_volee_cree_un_compte_non_authentifiable(
    client: AsyncClient, auth_headers: dict, role: str
):
    response = await client.post(
        "/users/a-la-volee",
        json={"nom": "Rasoa", "prenom": "Mamy", "role": role},
        headers=auth_headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["role"] == role
    assert body["peut_se_connecter"] is False
    assert body["email"]


@pytest.mark.asyncio
async def test_creation_a_la_volee_rejette_explicitement_chef_de_base(
    client: AsyncClient, auth_headers: dict
):
    response = await client.post(
        "/users/a-la-volee",
        json={"nom": "Rasoa", "prenom": "Mamy", "role": "chef_de_base"},
        headers=auth_headers,
    )

    assert response.status_code == 400
    assert "chef_de_base" in response.json()["detail"]


@pytest.mark.asyncio
async def test_compte_a_la_volee_ne_peut_pas_se_logger(
    client: AsyncClient, db_session: AsyncSession
):
    """Même avec le bon mot de passe, un compte `peut_se_connecter=False` est
    refusé au login — défense en profondeur au-delà du mot de passe généré."""
    user = Utilisateur(
        id=uuid.uuid4(),
        nom="Rasoa",
        prenom="Mamy",
        email=f"a-la-volee.{uuid.uuid4().hex[:6]}@ifvm.invalid",
        password_hash=hash_password("secret"),
        role="pilote",
        peut_se_connecter=False,
    )
    db_session.add(user)
    await db_session.commit()

    response = await client.post("/auth/login", json={"email": user.email, "password": "secret"})

    assert response.status_code == 401
