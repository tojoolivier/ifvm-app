import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.users import Utilisateur
from app.auth import hash_password, create_access_token


# ---------------------------------------------------------------------------
# Fixtures utilisateurs par rôle
# ---------------------------------------------------------------------------


async def _create_user(db_session: AsyncSession, role: str) -> Utilisateur:
    user = Utilisateur(
        id=uuid.uuid4(),
        nom="Test",
        prenom=role.capitalize(),
        email=f"{role}+{uuid.uuid4().hex[:6]}@test.mg",
        password_hash=hash_password("secret"),
        role=role,
        actif=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


def _headers(user: Utilisateur) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


@pytest.fixture
async def verificateur(db_session: AsyncSession) -> Utilisateur:
    return await _create_user(db_session, "verificateur")


@pytest.fixture
async def validateur(db_session: AsyncSession) -> Utilisateur:
    return await _create_user(db_session, "validation_finale")


# ---------------------------------------------------------------------------
# Helper : créer une prospection et la mettre dans un statut donné
# ---------------------------------------------------------------------------


async def _creer_prospection(
    client: AsyncClient, auth_headers: dict, campagne_id: uuid.UUID, station_id: uuid.UUID
) -> str:
    resp = await client.post(
        "/prospections",
        json={
            "type_prospection": "intensive",
            "campagne_id": str(campagne_id),
            "station_id": str(station_id),
            "date_prospection": "2026-06-25",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _changer_statut(
    client: AsyncClient,
    prospection_id: str,
    nouveau_statut: str,
    headers: dict,
    commentaire: str | None = None,
) -> int:
    body: dict = {"statut": nouveau_statut}
    if commentaire:
        body["commentaire"] = commentaire
    resp = await client.patch(
        f"/prospections/{prospection_id}/statut",
        json=body,
        headers=headers,
    )
    return resp.status_code


# ---------------------------------------------------------------------------
# Tests de transitions valides
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_transition_brouillon_en_attente(
    client: AsyncClient, utilisateur: Utilisateur, auth_headers: dict, campagne_id: uuid.UUID, station_id: uuid.UUID
):
    pid = await _creer_prospection(client, auth_headers, campagne_id, station_id)
    code = await _changer_statut(client, pid, "en_attente", auth_headers)
    assert code == 200

    resp = await client.get(f"/prospections/{pid}", headers=auth_headers)
    assert resp.json()["statut"] == "en_attente"


@pytest.mark.asyncio
async def test_transition_en_attente_verifiee(
    client: AsyncClient,
    utilisateur: Utilisateur,
    auth_headers: dict,
    campagne_id: uuid.UUID,
    station_id: uuid.UUID,
    verificateur: Utilisateur,
):
    pid = await _creer_prospection(client, auth_headers, campagne_id, station_id)
    await _changer_statut(client, pid, "en_attente", auth_headers)
    code = await _changer_statut(client, pid, "verifiee", _headers(verificateur))
    assert code == 200

    resp = await client.get(f"/prospections/{pid}", headers=auth_headers)
    assert resp.json()["statut"] == "verifiee"


@pytest.mark.asyncio
async def test_transition_verifiee_validee(
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
    code = await _changer_statut(client, pid, "validee", _headers(validateur))
    assert code == 200

    resp = await client.get(f"/prospections/{pid}", headers=auth_headers)
    assert resp.json()["statut"] == "validee"


@pytest.mark.asyncio
async def test_transition_verifiee_rejetee(
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
    code = await _changer_statut(client, pid, "rejetee", _headers(validateur))
    assert code == 200


# ---------------------------------------------------------------------------
# Tests de transitions invalides
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_transition_invalide_brouillon_validee(
    client: AsyncClient, auth_headers: dict, campagne_id: uuid.UUID, station_id: uuid.UUID
):
    pid = await _creer_prospection(client, auth_headers, campagne_id, station_id)
    code = await _changer_statut(client, pid, "validee", auth_headers)
    assert code == 400


@pytest.mark.asyncio
async def test_transition_invalide_en_attente_validee(
    client: AsyncClient,
    utilisateur: Utilisateur,
    auth_headers: dict,
    campagne_id: uuid.UUID,
    station_id: uuid.UUID,
    validateur: Utilisateur,
):
    pid = await _creer_prospection(client, auth_headers, campagne_id, station_id)
    await _changer_statut(client, pid, "en_attente", auth_headers)
    code = await _changer_statut(client, pid, "validee", _headers(validateur))
    assert code == 400


# ---------------------------------------------------------------------------
# Tests de permissions
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_prospecteur_ne_peut_pas_verifier(
    client: AsyncClient, utilisateur: Utilisateur, auth_headers: dict, campagne_id: uuid.UUID, station_id: uuid.UUID
):
    pid = await _creer_prospection(client, auth_headers, campagne_id, station_id)
    await _changer_statut(client, pid, "en_attente", auth_headers)
    # Le même prospecteur tente de vérifier
    code = await _changer_statut(client, pid, "verifiee", auth_headers)
    assert code == 403


@pytest.mark.asyncio
async def test_verificateur_ne_peut_pas_valider(
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
    code = await _changer_statut(client, pid, "validee", _headers(verificateur))
    assert code == 403


# ---------------------------------------------------------------------------
# Test audit log — enregistrement automatique
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_audit_log_cree_lors_transition(
    client: AsyncClient, utilisateur: Utilisateur, auth_headers: dict, campagne_id: uuid.UUID, station_id: uuid.UUID
):
    pid = await _creer_prospection(client, auth_headers, campagne_id, station_id)
    await _changer_statut(client, pid, "en_attente", auth_headers)

    resp = await client.get(f"/prospections/{pid}/audit-log", headers=auth_headers)
    assert resp.status_code == 200
    logs = resp.json()
    assert len(logs) >= 1
    actions = [log["action"] for log in logs]
    assert "soumission" in actions


@pytest.mark.asyncio
async def test_audit_log_plusieurs_transitions(
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

    resp = await client.get(f"/prospections/{pid}/audit-log", headers=auth_headers)
    logs = resp.json()
    assert len(logs) >= 2


# ---------------------------------------------------------------------------
# Test commentaire
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_ajouter_commentaire(
    client: AsyncClient, utilisateur: Utilisateur, auth_headers: dict, campagne_id: uuid.UUID, station_id: uuid.UUID
):
    pid = await _creer_prospection(client, auth_headers, campagne_id, station_id)

    resp = await client.post(
        f"/prospections/{pid}/commentaire",
        json={"texte": "Données cohérentes avec le relevé terrain."},
        headers=auth_headers,
    )
    assert resp.status_code == 201

    audit_resp = await client.get(f"/prospections/{pid}/audit-log", headers=auth_headers)
    logs = audit_resp.json()
    commentaires = [l for l in logs if l["action"] == "commentaire"]
    assert len(commentaires) >= 1
    assert commentaires[0]["details"]["texte"] == "Données cohérentes avec le relevé terrain."


@pytest.mark.asyncio
async def test_audit_log_prospection_inexistante(
    client: AsyncClient, auth_headers: dict
):
    resp = await client.get(f"/prospections/{uuid.uuid4()}/audit-log", headers=auth_headers)
    assert resp.status_code == 404
