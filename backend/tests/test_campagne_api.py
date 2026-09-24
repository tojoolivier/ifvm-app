import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.users import Utilisateur


@pytest.mark.asyncio
async def test_create_campagne_est_active_par_defaut(client: AsyncClient, auth_headers: dict):
    response = await client.post(
        "/campagnes",
        json={"name": "Campagne 2027", "start_date": "2027-01-01"},
        headers=auth_headers,
    )

    assert response.status_code == 201
    assert response.json()["actif"] is True


@pytest.mark.asyncio
async def test_update_desactive_une_campagne(
    client: AsyncClient, auth_headers: dict, campagne_id: uuid.UUID
):
    response = await client.put(
        f"/campagnes/{campagne_id}",
        json={"actif": False},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["actif"] is False


@pytest.mark.asyncio
async def test_update_reactive_une_campagne(
    client: AsyncClient, auth_headers: dict, campagne_id: uuid.UUID
):
    await client.put(f"/campagnes/{campagne_id}", json={"actif": False}, headers=auth_headers)

    response = await client.put(
        f"/campagnes/{campagne_id}",
        json={"actif": True},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["actif"] is True


@pytest.mark.asyncio
async def test_desactiver_une_campagne_n_orpheline_pas_les_prospections(
    client: AsyncClient,
    auth_headers: dict,
    campagne_id: uuid.UUID,
    db_session: AsyncSession,
    utilisateur: Utilisateur,
):
    """La désactivation logique remplace le DELETE physique : une prospection déjà
    rattachée à la campagne reste lisible après désactivation (#137)."""
    from datetime import date

    from app.infrastructure.prospection_model import ProspectionModel

    prospection = ProspectionModel(
        id=uuid.uuid4(),
        type_prospection="intensive",
        campagne_id=campagne_id,
        prospecteur_id=utilisateur.id,
        date_prospection=date(2026, 1, 5),
        statut="brouillon",
    )
    db_session.add(prospection)
    await db_session.commit()

    desactivation = await client.put(
        f"/campagnes/{campagne_id}",
        json={"actif": False},
        headers=auth_headers,
    )
    assert desactivation.status_code == 200

    lecture = await client.get(f"/prospections/{prospection.id}", headers=auth_headers)
    assert lecture.status_code == 200
    assert lecture.json()["campagne_id"] == str(campagne_id)


@pytest.mark.asyncio
async def test_suppression_reservee_a_ladmin(
    client: AsyncClient, auth_headers: dict, campagne_id: uuid.UUID
):
    """DELETE = soft-delete `deleted_at` (#674) : réservé à l'admin, un agent reçoit 403."""
    response = await client.delete(f"/campagnes/{campagne_id}", headers=auth_headers)

    assert response.status_code == 403
