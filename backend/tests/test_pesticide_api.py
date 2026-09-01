"""Écritures du référentiel `pesticide` (issue #129, #134).

Aucune suppression physique : `GET /referentiel/pull` ne transporte que des upserts.
La sortie de service passe par `actif=false`.
"""

import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient


@pytest_asyncio.fixture
async def pesticide(db_session):
    from app.infrastructure.referentiel_model import PesticideModel

    p = PesticideModel(
        id=uuid.uuid4(),
        code="PEST-TEST-01",
        nom="Pesticide Test",
        matiere_active="Pyréthrine",
        dose_reference="2 l/ha",
        actif=True,
    )
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)
    return p


def payload_pesticide(**overrides) -> dict:
    body = {
        "code": "PEST-NEW-001",
        "nom": "Pesticide Nouveau",
        "matiere_active": "Métarhizium",
        "dose_reference": "1.5 l/ha",
    }
    body.update(overrides)
    return body


# --- POST /pesticides ----------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_pesticide(client: AsyncClient, auth_headers: dict):
    response = await client.post("/pesticides", json=payload_pesticide(), headers=auth_headers)

    assert response.status_code == 201
    data = response.json()
    assert data["code"] == "PEST-NEW-001"
    assert data["nom"] == "Pesticide Nouveau"
    assert data["matiere_active"] == "Métarhizium"
    assert data["dose_reference"] == "1.5 l/ha"
    assert data["actif"] is True


@pytest.mark.asyncio
async def test_create_pesticide_matiere_active_optionnelle(client: AsyncClient, auth_headers: dict):
    response = await client.post(
        "/pesticides",
        json=payload_pesticide(matiere_active=None),
        headers=auth_headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["matiere_active"] is None


@pytest.mark.asyncio
async def test_create_pesticide_dose_optionnelle(client: AsyncClient, auth_headers: dict):
    response = await client.post(
        "/pesticides",
        json=payload_pesticide(dose_reference=None),
        headers=auth_headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["dose_reference"] is None


@pytest.mark.asyncio
async def test_create_pesticide_code_deja_pris(client: AsyncClient, auth_headers: dict, pesticide):
    response = await client.post(
        "/pesticides",
        json=payload_pesticide(code=pesticide.code),
        headers=auth_headers,
    )

    assert response.status_code == 409
    assert "déjà utilisé" in response.json()["detail"]


# --- GET /pesticides ----------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_pesticides(client: AsyncClient, auth_headers: dict, pesticide):
    response = await client.get("/pesticides", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    pest = next((p for p in data if p["code"] == pesticide.code), None)
    assert pest is not None
    assert pest["nom"] == "Pesticide Test"
    assert pest["matiere_active"] == "Pyréthrine"


@pytest.mark.asyncio
async def test_list_pesticides_inclure_inactifs(
    client: AsyncClient, auth_headers: dict, db_session, pesticide
):
    from app.infrastructure.referentiel_model import PesticideModel

    # Créer un pesticide inactif
    inactif = PesticideModel(
        id=uuid.uuid4(),
        code="PEST-OFF",
        nom="Pesticide Inactif",
        actif=False,
    )
    db_session.add(inactif)
    await db_session.commit()

    # Sans inclure_inactifs : pesticide inactif absent
    response = await client.get("/pesticides?inclure_inactifs=false", headers=auth_headers)
    assert response.status_code == 200
    codes = [p["code"] for p in response.json()]
    assert "PEST-OFF" not in codes

    # Avec inclure_inactifs : pesticide inactif présent
    response = await client.get("/pesticides?inclure_inactifs=true", headers=auth_headers)
    assert response.status_code == 200
    codes = [p["code"] for p in response.json()]
    assert "PEST-OFF" in codes


# --- GET /pesticides/{id} -----------------------------------------------------------


@pytest.mark.asyncio
async def test_get_pesticide(client: AsyncClient, auth_headers: dict, pesticide):
    response = await client.get(f"/pesticides/{pesticide.id}", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(pesticide.id)
    assert data["code"] == pesticide.code
    assert data["nom"] == pesticide.nom
    assert data["matiere_active"] == "Pyréthrine"
    assert data["dose_reference"] == "2 l/ha"


@pytest.mark.asyncio
async def test_get_pesticide_inexistant(client: AsyncClient, auth_headers: dict):
    response = await client.get(f"/pesticides/{uuid.uuid4()}", headers=auth_headers)

    assert response.status_code == 404
    assert "Pesticide non trouvé" in response.json()["detail"]


# --- PUT /pesticides/{id} ----------------------------------------------------------


@pytest.mark.asyncio
async def test_update_pesticide(client: AsyncClient, auth_headers: dict, pesticide):
    response = await client.put(
        f"/pesticides/{pesticide.id}",
        json={
            "code": "PEST-UPDATED",
            "nom": "Pesticide Mis à Jour",
            "matiere_active": "Deltaméthrine",
            "dose_reference": "3 l/ha",
        },
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["code"] == "PEST-UPDATED"
    assert data["nom"] == "Pesticide Mis à Jour"
    assert data["matiere_active"] == "Deltaméthrine"
    assert data["dose_reference"] == "3 l/ha"


@pytest.mark.asyncio
async def test_update_pesticide_desactivation_logique(
    client: AsyncClient, auth_headers: dict, pesticide
):
    """Pas de DELETE : `actif=false` est la seule sortie."""
    response = await client.put(
        f"/pesticides/{pesticide.id}",
        json={"actif": False},
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["actif"] is False


@pytest.mark.asyncio
async def test_update_pesticide_mise_a_jour_partielle(
    client: AsyncClient, auth_headers: dict, pesticide
):
    """La mise à jour peut toucher un sous-ensemble de champs."""
    response = await client.put(
        f"/pesticides/{pesticide.id}",
        json={"matiere_active": "Nouvelle Substance"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()
    # Les champs non fournis conservent leur valeur
    assert data["code"] == pesticide.code
    assert data["nom"] == pesticide.nom
    assert data["matiere_active"] == "Nouvelle Substance"
    assert data["dose_reference"] == "2 l/ha"  # Inchangé


@pytest.mark.asyncio
async def test_update_pesticide_code_deja_pris(client: AsyncClient, auth_headers: dict, db_session):
    from app.infrastructure.referentiel_model import PesticideModel

    p1 = PesticideModel(
        id=uuid.uuid4(),
        code="PEST-1",
        nom="Pesticide 1",
        actif=True,
    )
    p2 = PesticideModel(
        id=uuid.uuid4(),
        code="PEST-2",
        nom="Pesticide 2",
        actif=True,
    )
    db_session.add(p1)
    db_session.add(p2)
    await db_session.commit()

    # Essayer de changer le code de p2 en PEST-1
    response = await client.put(
        f"/pesticides/{p2.id}",
        json={"code": "PEST-1"},
        headers=auth_headers,
    )

    assert response.status_code == 409
    assert "déjà utilisé" in response.json()["detail"]


@pytest.mark.asyncio
async def test_update_pesticide_inexistant(client: AsyncClient, auth_headers: dict):
    response = await client.put(
        f"/pesticides/{uuid.uuid4()}",
        json={"nom": "N'importe"},
        headers=auth_headers,
    )

    assert response.status_code == 404
    assert "Pesticide non trouvé" in response.json()["detail"]
