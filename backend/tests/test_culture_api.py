"""Écritures du référentiel `culture` — issue #130.

Règle commune aux référentiels : le pull hors-ligne ne transporte que des
upserts, il n'a aucun mécanisme de suppression. Une suppression physique
resterait indéfiniment sur les téléphones déjà synchronisés — d'où la
désactivation logique (`actif=false`) et l'absence de route DELETE.
"""

import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient


@pytest_asyncio.fixture
async def culture(db_session):
    from app.infrastructure.referentiel_model import CultureModel

    c = CultureModel(id=uuid.uuid4(), code="RIZ", nom="Riz", actif=True)
    db_session.add(c)
    await db_session.commit()
    await db_session.refresh(c)
    return c


@pytest_asyncio.fixture
async def culture_inactive(db_session):
    from app.infrastructure.referentiel_model import CultureModel

    c = CultureModel(id=uuid.uuid4(), code="MAN-ABANDON", nom="Manioc abandonné", actif=False)
    db_session.add(c)
    await db_session.commit()
    await db_session.refresh(c)
    return c


@pytest.mark.asyncio
async def test_list_cultures(client: AsyncClient, auth_headers: dict, culture):
    response = await client.get("/cultures", headers=auth_headers)

    assert response.status_code == 200
    codes = [c["code"] for c in response.json()]
    assert "RIZ" in codes


@pytest.mark.asyncio
async def test_list_cultures_masque_les_inactives_par_defaut(
    client: AsyncClient, auth_headers: dict, culture, culture_inactive
):
    """Les sélecteurs métier (dégâts sur culture) ne doivent proposer que l'actif."""
    response = await client.get("/cultures", headers=auth_headers)

    assert response.status_code == 200
    codes = [c["code"] for c in response.json()]
    assert "RIZ" in codes
    assert "MAN-ABANDON" not in codes


@pytest.mark.asyncio
async def test_list_cultures_inclure_inactifs_retourne_les_deux_etats(
    client: AsyncClient, auth_headers: dict, culture, culture_inactive
):
    """L'écran d'administration affiche un badge « État » : il lui faut les deux."""
    response = await client.get("/cultures?inclure_inactifs=true", headers=auth_headers)

    assert response.status_code == 200
    codes = [c["code"] for c in response.json()]
    assert {"RIZ", "MAN-ABANDON"} <= set(codes)


@pytest.mark.asyncio
async def test_list_cultures_sans_authentification_refuse(client: AsyncClient):
    response = await client.get("/cultures")

    assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_get_culture_par_id(client: AsyncClient, auth_headers: dict, culture):
    response = await client.get(f"/cultures/{culture.id}", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(culture.id)
    assert data["code"] == "RIZ"
    assert data["nom"] == "Riz"
    assert data["actif"] is True


@pytest.mark.asyncio
async def test_get_culture_inexistante_retourne_404(client: AsyncClient, auth_headers: dict):
    response = await client.get(f"/cultures/{uuid.uuid4()}", headers=auth_headers)

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_create_culture(client: AsyncClient, auth_headers: dict):
    response = await client.post(
        "/cultures", json={"code": "MAIS", "nom": "Maïs"}, headers=auth_headers
    )

    assert response.status_code == 201
    data = response.json()
    assert data["code"] == "MAIS"
    assert data["nom"] == "Maïs"
    # Une culture créée depuis l'administration est active par défaut.
    assert data["actif"] is True
    assert data["updated_at"] is not None


@pytest.mark.asyncio
async def test_create_culture_puis_relecture(client: AsyncClient, auth_headers: dict):
    created = await client.post(
        "/cultures", json={"code": "ARA", "nom": "Arachide"}, headers=auth_headers
    )
    culture_id = created.json()["id"]

    response = await client.get(f"/cultures/{culture_id}", headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["code"] == "ARA"


@pytest.mark.asyncio
async def test_create_culture_code_deja_pris_retourne_409(
    client: AsyncClient, auth_headers: dict, culture
):
    """`culture.code` est unique en base : le doublon doit être un conflit, pas un 500."""
    response = await client.post(
        "/cultures", json={"code": "RIZ", "nom": "Riz pluvial"}, headers=auth_headers
    )

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_create_culture_code_vide_refuse(client: AsyncClient, auth_headers: dict):
    response = await client.post(
        "/cultures", json={"code": "", "nom": "Sans code"}, headers=auth_headers
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_update_culture(client: AsyncClient, auth_headers: dict, culture):
    response = await client.put(
        f"/cultures/{culture.id}", json={"nom": "Riz irrigué"}, headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["nom"] == "Riz irrigué"
    # Champ non transmis : inchangé.
    assert data["code"] == "RIZ"


@pytest.mark.asyncio
async def test_update_culture_desactivation_logique(
    client: AsyncClient, auth_headers: dict, culture
):
    """La « suppression » depuis l'administration est un passage de `actif` à false."""
    response = await client.put(
        f"/cultures/{culture.id}", json={"actif": False}, headers=auth_headers
    )

    assert response.status_code == 200
    assert response.json()["actif"] is False

    # La ligne existe toujours : elle repartira dans le pull comme un upsert.
    relecture = await client.get(f"/cultures/{culture.id}", headers=auth_headers)
    assert relecture.status_code == 200
    assert relecture.json()["actif"] is False


@pytest.mark.asyncio
async def test_update_culture_fait_avancer_updated_at(
    client: AsyncClient, auth_headers: dict, culture
):
    """Sans `updated_at` réhaussé, le pull incrémental ne renverrait pas la mise à jour."""
    avant = (await client.get(f"/cultures/{culture.id}", headers=auth_headers)).json()["updated_at"]

    apres = (
        await client.put(
            f"/cultures/{culture.id}", json={"nom": "Riz de contre-saison"}, headers=auth_headers
        )
    ).json()["updated_at"]

    assert apres > avant


@pytest.mark.asyncio
async def test_update_culture_inexistante_retourne_404(client: AsyncClient, auth_headers: dict):
    response = await client.put(
        f"/cultures/{uuid.uuid4()}", json={"nom": "Fantôme"}, headers=auth_headers
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_culture_code_deja_pris_retourne_409(
    client: AsyncClient, auth_headers: dict, culture, culture_inactive
):
    response = await client.put(
        f"/cultures/{culture.id}", json={"code": "MAN-ABANDON"}, headers=auth_headers
    )

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_suppression_reservee_a_ladmin(client: AsyncClient, auth_headers: dict, culture):
    """DELETE = soft-delete `deleted_at` (#674) : réservé à l'admin, un agent reçoit 403."""
    response = await client.delete(f"/cultures/{culture.id}", headers=auth_headers)

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_culture_desactivee_reste_dans_le_pull(
    client: AsyncClient, auth_headers: dict, culture
):
    """C'est tout l'intérêt de la désactivation : le terrain reçoit l'état `actif=false`."""
    await client.put(f"/cultures/{culture.id}", json={"actif": False}, headers=auth_headers)

    pull = await client.get("/referentiel/pull", headers=auth_headers)

    assert pull.status_code == 200
    cultures = pull.json()["cultures"]["upserts"]
    ligne = next(c for c in cultures if c["id"] == str(culture.id))
    assert ligne["actif"] is False
