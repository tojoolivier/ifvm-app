"""Écritures du référentiel `code_stade` — issue #131.

Le pull hors-ligne (`GET /referentiel/pull`) ne transporte que des upserts : une
suppression physique resterait indéfiniment sur les téléphones déjà synchronisés.
D'où `actif` en désactivation logique et aucune route `DELETE`.
"""

import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient


@pytest_asyncio.fixture
async def code_stade_inactif(db_session):
    from app.infrastructure.referentiel_model import CodeStadeModel, StadeModel

    db_session.add(StadeModel(code="A9", libelle="Imago stade A9", actif=False))
    await db_session.flush()
    place = CodeStadeModel(
        id=uuid.uuid4(),
        code="A9",
        categorie="imago",
        sexe="F",
        espece=None,
        libelle="♀ Imago stade A9",
        ordre=99,
        actif=False,
    )
    db_session.add(place)
    await db_session.commit()
    await db_session.refresh(place)
    return place


async def _un_code_stade(client: AsyncClient, auth_headers: dict) -> dict:
    response = await client.get("/codes-stades", headers=auth_headers)
    return response.json()[0]


@pytest.mark.asyncio
async def test_list_codes_stades(client: AsyncClient, auth_headers: dict):
    response = await client.get("/codes-stades", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    ligne = data[0]
    assert set(ligne) >= {
        "id",
        "code",
        "categorie",
        "sexe",
        "espece",
        "libelle",
        "ordre",
        "actif",
        "updated_at",
    }


@pytest.mark.asyncio
async def test_list_codes_stades_masque_les_inactifs_par_defaut(
    client: AsyncClient, auth_headers: dict, code_stade_inactif
):
    response = await client.get("/codes-stades", headers=auth_headers)

    assert response.status_code == 200
    assert all(ligne["id"] != str(code_stade_inactif.id) for ligne in response.json())


@pytest.mark.asyncio
async def test_list_codes_stades_inclure_inactifs_retourne_les_deux_etats(
    client: AsyncClient, auth_headers: dict, code_stade_inactif
):
    """L'écran d'administration affiche un badge « État » : il lui faut les deux."""
    response = await client.get("/codes-stades?inclure_inactifs=true", headers=auth_headers)

    assert response.status_code == 200
    ids = [ligne["id"] for ligne in response.json()]
    assert str(code_stade_inactif.id) in ids


@pytest.mark.asyncio
async def test_list_codes_stades_inclure_inactifs_prime_sur_actif(
    client: AsyncClient, auth_headers: dict, code_stade_inactif
):
    """Les deux filtres se combinent comme sur `/stations` : `inclure_inactifs` gagne."""
    response = await client.get(
        "/codes-stades?actif=true&inclure_inactifs=true", headers=auth_headers
    )

    assert response.status_code == 200
    assert str(code_stade_inactif.id) in [ligne["id"] for ligne in response.json()]


@pytest.mark.asyncio
async def test_list_codes_stades_actif_false_ne_retourne_que_les_inactifs(
    client: AsyncClient, auth_headers: dict, code_stade_inactif
):
    response = await client.get("/codes-stades?actif=false", headers=auth_headers)

    assert response.status_code == 200
    lignes = response.json()
    assert [ligne["id"] for ligne in lignes] == [str(code_stade_inactif.id)]


@pytest.mark.asyncio
async def test_list_codes_stades_sans_authentification_refuse(client: AsyncClient):
    response = await client.get("/codes-stades")

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_code_stade_par_id(client: AsyncClient, auth_headers: dict):
    attendu = await _un_code_stade(client, auth_headers)

    response = await client.get(f"/codes-stades/{attendu['id']}", headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["id"] == attendu["id"]


@pytest.mark.asyncio
async def test_get_code_stade_inexistant_retourne_404(client: AsyncClient, auth_headers: dict):
    response = await client.get(f"/codes-stades/{uuid.uuid4()}", headers=auth_headers)

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_create_code_stade(client: AsyncClient, auth_headers: dict):
    response = await client.post(
        "/codes-stades",
        json={
            "code": "L7",
            "categorie": "imago",
            "sexe": "F",
            "espece": "NSE",
            "libelle": "♀ Larve stade L7",
            "ordre": 12,
        },
        headers=auth_headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["code"] == "L7"
    assert data["espece"] == "NSE"
    assert data["ordre"] == 12
    # Créé actif : la désactivation est un geste explicite.
    assert data["actif"] is True
    assert uuid.UUID(data["id"])


@pytest.mark.asyncio
async def test_create_code_stade_apparait_dans_la_liste(client: AsyncClient, auth_headers: dict):
    creation = await client.post(
        "/codes-stades",
        json={
            "code": "L7",
            "categorie": "imago",
            "sexe": "M",
            "espece": "NSE",
            "libelle": "♂ Larve stade L7",
            "ordre": 3,
        },
        headers=auth_headers,
    )
    assert creation.status_code == 201

    response = await client.get("/codes-stades", headers=auth_headers)

    assert creation.json()["id"] in [ligne["id"] for ligne in response.json()]


@pytest.mark.asyncio
async def test_create_code_stade_hors_vocabulaire_refuse(client: AsyncClient, auth_headers: dict):
    """`code_stade.code` référence `stade.code` : un code inconnu casserait la grille."""
    response = await client.post(
        "/codes-stades",
        json={
            "code": "ZZ9",
            "categorie": "imago",
            "sexe": "F",
            "espece": None,
            "libelle": "Stade inventé",
            "ordre": 0,
        },
        headers=auth_headers,
    )

    assert response.status_code == 409
    assert "ZZ9" in response.json()["detail"]


@pytest.mark.asyncio
async def test_create_code_stade_doublon_de_grille_refuse(client: AsyncClient, auth_headers: dict):
    """(code, categorie, sexe, espece) est unique — A1 femelle existe déjà (amorçage)."""
    response = await client.post(
        "/codes-stades",
        json={
            "code": "A1",
            "categorie": "imago",
            "sexe": "F",
            "espece": None,
            "libelle": "♀ Imago stade A1 (doublon)",
            "ordre": 0,
        },
        headers=auth_headers,
    )

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_create_code_stade_categorie_invalide_refuse(client: AsyncClient, auth_headers: dict):
    response = await client.post(
        "/codes-stades",
        json={
            "code": "A1",
            "categorie": "nymphe",
            "sexe": "F",
            "espece": None,
            "libelle": "Catégorie inventée",
            "ordre": 0,
        },
        headers=auth_headers,
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_code_stade_sexe_invalide_refuse(client: AsyncClient, auth_headers: dict):
    response = await client.post(
        "/codes-stades",
        json={
            "code": "A1",
            "categorie": "imago",
            "sexe": "X",
            "espece": None,
            "libelle": "Sexe inventé",
            "ordre": 0,
        },
        headers=auth_headers,
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_update_code_stade_libelle_et_ordre(client: AsyncClient, auth_headers: dict):
    cible = await _un_code_stade(client, auth_headers)

    response = await client.put(
        f"/codes-stades/{cible['id']}",
        json={"libelle": "Libellé corrigé", "ordre": 42},
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["libelle"] == "Libellé corrigé"
    assert data["ordre"] == 42
    assert data["code"] == cible["code"]


@pytest.mark.asyncio
async def test_update_code_stade_desactive(client: AsyncClient, auth_headers: dict):
    """Désactivation logique : la ligne reste en base pour rester upsertable au pull."""
    cible = await _un_code_stade(client, auth_headers)

    response = await client.put(
        f"/codes-stades/{cible['id']}", json={"actif": False}, headers=auth_headers
    )

    assert response.status_code == 200
    assert response.json()["actif"] is False

    toujours_la = await client.get(f"/codes-stades/{cible['id']}", headers=auth_headers)
    assert toujours_la.status_code == 200


@pytest.mark.asyncio
async def test_update_code_stade_reactive(
    client: AsyncClient, auth_headers: dict, code_stade_inactif
):
    response = await client.put(
        f"/codes-stades/{code_stade_inactif.id}", json={"actif": True}, headers=auth_headers
    )

    assert response.status_code == 200
    assert response.json()["actif"] is True


@pytest.mark.asyncio
async def test_update_code_stade_touche_updated_at(client: AsyncClient, auth_headers: dict):
    """Le curseur `since_codes_stades` du pull repose sur `updated_at`."""
    cible = await _un_code_stade(client, auth_headers)

    response = await client.put(
        f"/codes-stades/{cible['id']}", json={"libelle": "Nouveau libellé"}, headers=auth_headers
    )

    assert response.status_code == 200
    assert response.json()["updated_at"] > cible["updated_at"]


@pytest.mark.asyncio
async def test_update_code_stade_partiel_ne_touche_pas_le_reste(
    client: AsyncClient, auth_headers: dict
):
    cible = await _un_code_stade(client, auth_headers)

    response = await client.put(
        f"/codes-stades/{cible['id']}", json={"ordre": 7}, headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["libelle"] == cible["libelle"]
    assert data["categorie"] == cible["categorie"]
    assert data["sexe"] == cible["sexe"]


@pytest.mark.asyncio
async def test_update_code_stade_inexistant_retourne_404(client: AsyncClient, auth_headers: dict):
    response = await client.put(
        f"/codes-stades/{uuid.uuid4()}", json={"ordre": 1}, headers=auth_headers
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_code_stade_vers_une_grille_deja_prise_refuse(
    client: AsyncClient, auth_headers: dict
):
    lignes = (await client.get("/codes-stades", headers=auth_headers)).json()
    a1_femelle = next(ligne for ligne in lignes if ligne["code"] == "A1" and ligne["sexe"] == "F")
    a2_femelle = next(ligne for ligne in lignes if ligne["code"] == "A2" and ligne["sexe"] == "F")

    response = await client.put(
        f"/codes-stades/{a2_femelle['id']}", json={"code": "A1"}, headers=auth_headers
    )

    assert response.status_code == 409
    assert a1_femelle["id"] != a2_femelle["id"]


@pytest.mark.asyncio
async def test_suppression_reservee_a_ladmin(client: AsyncClient, auth_headers: dict):
    """DELETE = soft-delete `deleted_at` (#674) : réservé à l'admin, un agent reçoit 403."""
    cible = await _un_code_stade(client, auth_headers)

    response = await client.delete(f"/codes-stades/{cible['id']}", headers=auth_headers)

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_ecriture_reprise_par_le_pull_hors_ligne(client: AsyncClient, auth_headers: dict):
    """Une création doit redescendre aux tablettes via le curseur `since_codes_stades`."""
    avant = (await client.get("/referentiel/pull", headers=auth_headers)).json()
    curseur = avant["codes_stades"]["server_time"]

    creation = await client.post(
        "/codes-stades",
        json={
            "code": "L7",
            "categorie": "larve",
            "sexe": None,
            "espece": "LMI",
            "libelle": "Larve stade L7 (Locusta)",
            "ordre": 6,
        },
        headers=auth_headers,
    )
    assert creation.status_code == 201

    apres = await client.get(
        f"/referentiel/pull?since_codes_stades={curseur}", headers=auth_headers
    )

    assert apres.status_code == 200
    upserts = apres.json()["codes_stades"]["upserts"]
    assert creation.json()["id"] in [u["id"] for u in upserts]
