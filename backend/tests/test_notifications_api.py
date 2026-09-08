"""Centre de notifications (`GET /prospections/notifications`) — dérivé de
`audit_log`, pas de nouvelle table d'événements (migration 0052 : seul un
curseur `utilisateur.notifications_lues_at` est ajouté).

- Un prospecteur ne voit que les transitions de statut (vérification/
  validation/rejet) sur SES fiches — jamais la création (ce n'est pas une
  notification pour lui, il vient de la faire) ni les fiches des autres.
- Un rôle de revue (admin/verificateur/validation_finale) voit toutes les
  fiches et toutes les actions, création comprise (« nouvelle fiche »).
"""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import hash_password
from app.models.users import Utilisateur
from tests.test_statut_transitions import _changer_statut, _creer_prospection, _headers


@pytest.fixture
async def autre_prospecteur(db_session: AsyncSession) -> Utilisateur:
    user = Utilisateur(
        id=uuid.uuid4(),
        nom="Autre",
        prenom="Prospecteur",
        email=f"autre.prospecteur+{uuid.uuid4().hex[:6]}@test.mg",
        password_hash=hash_password("secret"),
        role="prospecteur",
        actif=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.mark.asyncio
async def test_prospecteur_voit_la_verification_de_sa_fiche(
    client: AsyncClient,
    utilisateur: Utilisateur,
    auth_headers: dict,
    campagne_id: uuid.UUID,
    station_id: uuid.UUID,
    verificateur: Utilisateur,
):
    pid = await _creer_prospection(client, auth_headers, campagne_id, station_id)
    await _changer_statut(client, pid, "en_attente", auth_headers)
    await _changer_statut(client, pid, "verifiee", _headers(verificateur))

    resp = await client.get("/prospections/notifications", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["non_lues"] >= 1
    actions = [n["action"] for n in body["items"] if n["fiche_id"] == pid]
    assert "verification" in actions
    assert "creation" not in actions


@pytest.mark.asyncio
async def test_prospecteur_ne_voit_pas_les_fiches_dun_autre(
    client: AsyncClient,
    utilisateur: Utilisateur,
    auth_headers: dict,
    campagne_id: uuid.UUID,
    station_id: uuid.UUID,
    verificateur: Utilisateur,
    autre_prospecteur: Utilisateur,
):
    pid = await _creer_prospection(client, auth_headers, campagne_id, station_id)
    await _changer_statut(client, pid, "en_attente", auth_headers)
    await _changer_statut(client, pid, "verifiee", _headers(verificateur))

    resp = await client.get("/prospections/notifications", headers=_headers(autre_prospecteur))
    assert resp.status_code == 200
    assert resp.json()["items"] == []


@pytest.mark.asyncio
async def test_rejet_expose_le_motif_dans_la_notification(
    client: AsyncClient,
    utilisateur: Utilisateur,
    auth_headers: dict,
    campagne_id: uuid.UUID,
    station_id: uuid.UUID,
    verificateur: Utilisateur,
    validateur: Utilisateur,
):
    pid = await _creer_prospection(client, auth_headers, campagne_id, station_id)
    await _changer_statut(client, pid, "en_attente", auth_headers)
    await _changer_statut(client, pid, "verifiee", _headers(verificateur))
    await _changer_statut(
        client, pid, "rejetee", _headers(validateur), commentaire="Motif du rejet."
    )

    resp = await client.get("/prospections/notifications", headers=auth_headers)
    rejet = next(n for n in resp.json()["items"] if n["action"] == "rejet")
    assert rejet["details"]["commentaire"] == "Motif du rejet."


@pytest.mark.asyncio
async def test_admin_voit_toutes_les_fiches_et_la_creation(
    client: AsyncClient,
    utilisateur: Utilisateur,
    auth_headers: dict,
    campagne_id: uuid.UUID,
    station_id: uuid.UUID,
    admin: Utilisateur,
):
    pid = await _creer_prospection(client, auth_headers, campagne_id, station_id)

    resp = await client.get("/prospections/notifications", headers=_headers(admin))
    assert resp.status_code == 200
    items = resp.json()["items"]
    creation = next(n for n in items if n["fiche_id"] == pid)
    assert creation["action"] == "creation"


@pytest.mark.asyncio
async def test_marquer_vues_fait_retomber_le_compteur_a_zero(
    client: AsyncClient,
    utilisateur: Utilisateur,
    auth_headers: dict,
    campagne_id: uuid.UUID,
    station_id: uuid.UUID,
    verificateur: Utilisateur,
):
    pid = await _creer_prospection(client, auth_headers, campagne_id, station_id)
    await _changer_statut(client, pid, "en_attente", auth_headers)
    await _changer_statut(client, pid, "verifiee", _headers(verificateur))

    avant = await client.get("/prospections/notifications", headers=auth_headers)
    assert avant.json()["non_lues"] >= 1

    marque = await client.post("/prospections/notifications/vu", headers=auth_headers)
    assert marque.status_code == 204

    apres = await client.get("/prospections/notifications", headers=auth_headers)
    assert apres.json()["non_lues"] == 0
    assert all(n["lu"] for n in apres.json()["items"])


@pytest.mark.asyncio
async def test_notifications_reste_accessible_sans_aucune_fiche(
    client: AsyncClient, auth_headers: dict
):
    resp = await client.get("/prospections/notifications", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == {"items": [], "non_lues": 0}
