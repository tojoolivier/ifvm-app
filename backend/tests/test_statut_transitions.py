import uuid

import pytest
from httpx import AsyncClient

from app.auth import create_access_token
from app.models.users import Utilisateur

# ---------------------------------------------------------------------------
# Fixtures utilisateurs par rôle
# ---------------------------------------------------------------------------


def _headers(user: Utilisateur) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


# `verificateur`, `validateur` et `admin` sont désormais des fixtures partagées
# (tests/conftest.py) — réutilisées telles quelles par test_notifications_api.py.


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
            "biotope": ["xerophyle"],
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
    client: AsyncClient,
    utilisateur: Utilisateur,
    auth_headers: dict,
    campagne_id: uuid.UUID,
    station_id: uuid.UUID,
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
    body = resp.json()
    assert body["statut"] == "verifiee"
    # #fiches-validees-multi-utilisateurs : colonnes présentes de longue date,
    # jamais renseignées avant ce chantier.
    assert body["verified_by"] == str(verificateur.id)
    assert body["verified_at"] is not None
    assert body["verified_by_nom"] == f"{verificateur.prenom} {verificateur.nom}"


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
    body = resp.json()
    assert body["statut"] == "validee"
    assert body["validated_by"] == str(validateur.id)
    assert body["validated_at"] is not None
    assert body["validated_by_nom"] == f"{validateur.prenom} {validateur.nom}"
    assert body["prospecteur_nom"] == f"{utilisateur.prenom} {utilisateur.nom}"


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
# Admin — se substitue à verificateur/validation_finale sur tous les
# déploiements où ces comptes dédiés n'existent pas encore ou ne sont pas
# utilisés (déblocage demandé après confusion : le compte admin ne voyait
# aucun bouton Vérifier/Valider côté web).
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_admin_peut_verifier(
    client: AsyncClient,
    utilisateur: Utilisateur,
    auth_headers: dict,
    campagne_id: uuid.UUID,
    station_id: uuid.UUID,
    admin: Utilisateur,
):
    pid = await _creer_prospection(client, auth_headers, campagne_id, station_id)
    await _changer_statut(client, pid, "en_attente", auth_headers)
    code = await _changer_statut(client, pid, "verifiee", _headers(admin))
    assert code == 200

    resp = await client.get(f"/prospections/{pid}", headers=auth_headers)
    body = resp.json()
    assert body["statut"] == "verifiee"
    assert body["verified_by"] == str(admin.id)


@pytest.mark.asyncio
async def test_admin_peut_valider(
    client: AsyncClient,
    utilisateur: Utilisateur,
    auth_headers: dict,
    campagne_id: uuid.UUID,
    station_id: uuid.UUID,
    admin: Utilisateur,
):
    pid = await _creer_prospection(client, auth_headers, campagne_id, station_id)
    await _changer_statut(client, pid, "en_attente", auth_headers)
    await _changer_statut(client, pid, "verifiee", _headers(admin))
    code = await _changer_statut(client, pid, "validee", _headers(admin))
    assert code == 200

    resp = await client.get(f"/prospections/{pid}", headers=auth_headers)
    body = resp.json()
    assert body["statut"] == "validee"
    assert body["validated_by"] == str(admin.id)


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
    client: AsyncClient,
    utilisateur: Utilisateur,
    auth_headers: dict,
    campagne_id: uuid.UUID,
    station_id: uuid.UUID,
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
    client: AsyncClient,
    utilisateur: Utilisateur,
    auth_headers: dict,
    campagne_id: uuid.UUID,
    station_id: uuid.UUID,
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


@pytest.mark.asyncio
async def test_rejet_conserve_le_motif_dans_le_log_audit(
    client: AsyncClient,
    utilisateur: Utilisateur,
    auth_headers: dict,
    campagne_id: uuid.UUID,
    station_id: uuid.UUID,
    verificateur: Utilisateur,
    validateur: Utilisateur,
):
    """`StatutChange.commentaire` (modale « Rejeter avec motif » côté web)
    transitait déjà jusqu'à l'API mais `ChangerStatut.execute()` l'ignorait :
    la fiche changeait bien de statut, le motif saisi disparaissait sans
    jamais être stocké — impossible de l'afficher ensuite (#toutes-les-donnees)."""
    pid = await _creer_prospection(client, auth_headers, campagne_id, station_id)
    await _changer_statut(client, pid, "en_attente", auth_headers)
    await _changer_statut(client, pid, "verifiee", _headers(verificateur))
    code = await _changer_statut(
        client, pid, "rejetee", _headers(validateur), commentaire="Coordonnées GPS incohérentes."
    )
    assert code == 200

    resp = await client.get(f"/prospections/{pid}/audit-log", headers=auth_headers)
    logs = resp.json()
    rejet = next(log for log in logs if log["action"] == "rejet")
    assert rejet["details"]["commentaire"] == "Coordonnées GPS incohérentes."


# ---------------------------------------------------------------------------
# Test commentaire
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_ajouter_commentaire(
    client: AsyncClient,
    utilisateur: Utilisateur,
    auth_headers: dict,
    campagne_id: uuid.UUID,
    station_id: uuid.UUID,
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
    commentaires = [log for log in logs if log["action"] == "commentaire"]
    assert len(commentaires) >= 1
    assert commentaires[0]["details"]["texte"] == "Données cohérentes avec le relevé terrain."


@pytest.mark.asyncio
async def test_audit_log_prospection_inexistante(client: AsyncClient, auth_headers: dict):
    resp = await client.get(f"/prospections/{uuid.uuid4()}/audit-log", headers=auth_headers)
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Test disponible_pour_traitement — #fiches-validees-multi-utilisateurs
# ---------------------------------------------------------------------------


async def _valider_prospection(
    client: AsyncClient,
    auth_headers: dict,
    campagne_id: uuid.UUID,
    station_id: uuid.UUID,
    verificateur: Utilisateur,
    validateur: Utilisateur,
) -> str:
    pid = await _creer_prospection(client, auth_headers, campagne_id, station_id)
    await _changer_statut(client, pid, "en_attente", auth_headers)
    await _changer_statut(client, pid, "verifiee", _headers(verificateur))
    await _changer_statut(client, pid, "validee", _headers(validateur))
    return pid


@pytest.mark.asyncio
async def test_disponible_pour_traitement_exclut_une_fiche_deja_traitee(
    client: AsyncClient,
    utilisateur: Utilisateur,
    auth_headers: dict,
    campagne_id: uuid.UUID,
    station_id: uuid.UUID,
    verificateur: Utilisateur,
    validateur: Utilisateur,
    chef_equipe: Utilisateur,
):
    """« Consulter une fiche validée » (mobile) : une fiche validée mais pas
    encore transformée en traitement doit apparaître ; une fiche déjà
    transformée (par n'importe quel utilisateur) doit en disparaître — sans
    être supprimée (elle garde son historique, cf. GET /prospections/{id})."""
    pid_disponible = await _valider_prospection(
        client, auth_headers, campagne_id, station_id, verificateur, validateur
    )
    pid_deja_traitee = await _valider_prospection(
        client, auth_headers, campagne_id, station_id, verificateur, validateur
    )
    creation = await client.post(
        "/traitements",
        json={
            "prospection_id": pid_deja_traitee,
            "date_traitement": "2026-08-11",
            "date_validation": "2026-08-10",
            "localite": "Betioky",
            "terrestre": {
                "heure_debut": "06:00:00",
                "heure_fin": "09:00:00",
                "vitesse_vent_ms": 1.5,
                "temperature_c": 24.0,
                "chef_equipe_id": str(chef_equipe.id),
            },
        },
        headers=auth_headers,
    )
    assert creation.status_code == 201, creation.text

    resp = await client.get(
        "/prospections",
        params={"statut": "validee", "disponible_pour_traitement": "true"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    ids = [p["id"] for p in resp.json()]
    assert pid_disponible in ids
    assert pid_deja_traitee not in ids

    # La fiche déjà traitée n'est pas supprimée : toujours lisible individuellement.
    relecture = await client.get(f"/prospections/{pid_deja_traitee}", headers=auth_headers)
    assert relecture.status_code == 200
    assert relecture.json()["statut"] == "validee"
