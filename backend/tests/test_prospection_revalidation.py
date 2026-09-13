"""#revalidation-prospection : une fiche extensive/validation validée depuis
plus de 5 jours sans traitement associé doit disparaître de « disponible pour
traitement » et apparaître dans « à revalider ». La revalider crée une
NOUVELLE fiche (chaînée via `revalide_de_id`), jamais une mise à jour en
place — cf. plan robust-finding-hartmanis.md.
"""

import uuid
from datetime import datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import create_access_token
from app.domain.prospection import DELAI_REVALIDATION_JOURS
from app.models.users import Utilisateur


def _headers(user: Utilisateur) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


async def _creer_prospection(
    client: AsyncClient,
    auth_headers: dict,
    campagne_id: uuid.UUID,
    type_prospection: str = "extensive",
    station_id: uuid.UUID | None = None,
    revalide_de_id: str | None = None,
) -> str:
    payload: dict = {
        "type_prospection": type_prospection,
        "campagne_id": str(campagne_id),
        "date_prospection": "2026-08-01",
    }
    if type_prospection == "intensive":
        payload["biotope"] = ["xerophyle"]
    if station_id is not None:
        payload["station_id"] = str(station_id)
    if revalide_de_id is not None:
        payload["revalide_de_id"] = revalide_de_id
    resp = await client.post("/prospections", json=payload, headers=auth_headers)
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _changer_statut(
    client: AsyncClient, prospection_id: str, nouveau_statut: str, headers: dict
) -> None:
    resp = await client.patch(
        f"/prospections/{prospection_id}/statut", json={"statut": nouveau_statut}, headers=headers
    )
    assert resp.status_code == 200, resp.text


async def _valider_extensive(
    client: AsyncClient,
    auth_headers: dict,
    campagne_id: uuid.UUID,
    verificateur: Utilisateur,
    validateur: Utilisateur,
) -> str:
    pid = await _creer_prospection(client, auth_headers, campagne_id, "extensive")
    await _changer_statut(client, pid, "en_attente", auth_headers)
    await _changer_statut(client, pid, "verifiee", _headers(verificateur))
    await _changer_statut(client, pid, "validee", _headers(validateur))
    return pid


async def _valider_intensive(
    client: AsyncClient,
    auth_headers: dict,
    campagne_id: uuid.UUID,
    station_id: uuid.UUID,
    verificateur: Utilisateur,
    validateur: Utilisateur,
) -> str:
    pid = await _creer_prospection(client, auth_headers, campagne_id, "intensive", station_id)
    await _changer_statut(client, pid, "en_attente", auth_headers)
    await _changer_statut(client, pid, "verifiee", _headers(verificateur))
    await _changer_statut(client, pid, "validee", _headers(validateur))
    return pid


async def _reculer_validated_at(db_session: AsyncSession, prospection_id: str, jours: int) -> None:
    """Recule `validated_at` — aucune route ne permet de le faire (stampé
    server-side, jamais fourni par le client), donc manipulation directe."""
    seuil = datetime.utcnow() - timedelta(days=jours)
    await db_session.execute(
        text("UPDATE prospection SET validated_at = :seuil WHERE id = :id"),
        {"seuil": seuil, "id": prospection_id},
    )
    await db_session.commit()


@pytest.mark.asyncio
async def test_validated_at_stampe_a_la_creation_pour_type_validation(
    client: AsyncClient, auth_headers: dict, campagne_id: uuid.UUID
):
    """`validation` (signalement) est auto-validée à la création, sans passer
    par `apply_transition` — `validated_at` doit quand même être stampé (sinon
    la règle des 5 jours ne peut jamais s'appliquer sur ce type)."""
    resp = await client.post(
        "/prospections",
        json={
            "type_prospection": "validation",
            "campagne_id": str(campagne_id),
            "date_prospection": "2026-08-01",
            "n_message": "MSG-001",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["statut"] == "validee"
    assert data["validated_at"] is not None


@pytest.mark.asyncio
async def test_disponible_pour_traitement_exclut_fiche_extensive_perimee(
    client: AsyncClient,
    db_session: AsyncSession,
    auth_headers: dict,
    campagne_id: uuid.UUID,
    verificateur: Utilisateur,
    validateur: Utilisateur,
):
    pid_recente = await _valider_extensive(
        client, auth_headers, campagne_id, verificateur, validateur
    )
    pid_perimee = await _valider_extensive(
        client, auth_headers, campagne_id, verificateur, validateur
    )
    await _reculer_validated_at(db_session, pid_perimee, DELAI_REVALIDATION_JOURS + 1)

    resp = await client.get(
        "/prospections",
        params={"statut": "validee", "disponible_pour_traitement": "true"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    ids = [p["id"] for p in resp.json()]
    assert pid_recente in ids
    assert pid_perimee not in ids


@pytest.mark.asyncio
async def test_disponible_pour_traitement_n_exclut_pas_intensive_perimee(
    client: AsyncClient,
    db_session: AsyncSession,
    auth_headers: dict,
    campagne_id: uuid.UUID,
    station_id: uuid.UUID,
    verificateur: Utilisateur,
    validateur: Utilisateur,
):
    """La règle des 5 jours est propre à extensive/validation — l'intensive
    n'est jamais concernée, même très ancienne."""
    pid = await _valider_intensive(
        client, auth_headers, campagne_id, station_id, verificateur, validateur
    )
    await _reculer_validated_at(db_session, pid, DELAI_REVALIDATION_JOURS + 30)

    resp = await client.get(
        "/prospections",
        params={"statut": "validee", "disponible_pour_traitement": "true"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert pid in [p["id"] for p in resp.json()]


@pytest.mark.asyncio
async def test_disponible_pour_traitement_n_exclut_pas_la_fiche_de_revalidation(
    client: AsyncClient,
    db_session: AsyncSession,
    auth_headers: dict,
    campagne_id: uuid.UUID,
    verificateur: Utilisateur,
    validateur: Utilisateur,
):
    """Une fiche périmée revalidée (a un enfant `revalide_de_id`) reste
    exclue ; l'enfant, lui, est frais (`validated_at` récent) et normalement
    disponible."""
    pid_origine = await _valider_extensive(
        client, auth_headers, campagne_id, verificateur, validateur
    )
    await _reculer_validated_at(db_session, pid_origine, DELAI_REVALIDATION_JOURS + 1)
    pid_enfant = await _valider_extensive(
        client, auth_headers, campagne_id, verificateur, validateur
    )
    # La revalidation elle-même se ferait en pratique via le payload de
    # création (revalide_de_id) — ici on simule directement en base pour ne
    # pas dépendre du parcours mobile complet.
    await db_session.execute(
        text("UPDATE prospection SET revalide_de_id = :origine WHERE id = :enfant"),
        {"origine": pid_origine, "enfant": pid_enfant},
    )
    await db_session.commit()

    resp = await client.get(
        "/prospections",
        params={"statut": "validee", "disponible_pour_traitement": "true"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    ids = [p["id"] for p in resp.json()]
    assert pid_origine not in ids
    assert pid_enfant in ids


@pytest.mark.asyncio
async def test_a_revalider_retourne_exactement_les_fiches_perimees(
    client: AsyncClient,
    db_session: AsyncSession,
    auth_headers: dict,
    campagne_id: uuid.UUID,
    station_id: uuid.UUID,
    verificateur: Utilisateur,
    validateur: Utilisateur,
    chef_equipe: Utilisateur,
):
    pid_recente = await _valider_extensive(
        client, auth_headers, campagne_id, verificateur, validateur
    )

    pid_a_revalider = await _valider_extensive(
        client, auth_headers, campagne_id, verificateur, validateur
    )
    await _reculer_validated_at(db_session, pid_a_revalider, DELAI_REVALIDATION_JOURS + 1)

    # Périmée mais déjà traitée : ne doit apparaître ni ici, ni dans
    # disponible_pour_traitement (déjà couvert par ailleurs).
    pid_perimee_traitee = await _valider_extensive(
        client, auth_headers, campagne_id, verificateur, validateur
    )
    await _reculer_validated_at(db_session, pid_perimee_traitee, DELAI_REVALIDATION_JOURS + 1)
    creation = await client.post(
        "/traitements",
        json={
            "prospection_id": pid_perimee_traitee,
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

    # Périmée mais déjà revalidée : ne doit plus apparaître (remplacée).
    pid_perimee_revalidee = await _valider_extensive(
        client, auth_headers, campagne_id, verificateur, validateur
    )
    await _reculer_validated_at(db_session, pid_perimee_revalidee, DELAI_REVALIDATION_JOURS + 1)
    await _creer_prospection(
        client, auth_headers, campagne_id, "extensive", revalide_de_id=pid_perimee_revalidee
    )

    # Intensive périmée : jamais concernée par la règle.
    pid_intensive = await _valider_intensive(
        client, auth_headers, campagne_id, station_id, verificateur, validateur
    )
    await _reculer_validated_at(db_session, pid_intensive, DELAI_REVALIDATION_JOURS + 30)

    resp = await client.get(
        "/prospections",
        params={"statut": "validee", "a_revalider": "true"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    ids = [p["id"] for p in resp.json()]
    assert ids == [pid_a_revalider]
    assert pid_recente not in ids
    assert pid_perimee_traitee not in ids
    assert pid_perimee_revalidee not in ids
    assert pid_intensive not in ids


@pytest.mark.asyncio
async def test_deux_fiches_ne_peuvent_pas_revalider_la_meme_origine(
    client: AsyncClient,
    db_session: AsyncSession,
    auth_headers: dict,
    campagne_id: uuid.UUID,
    verificateur: Utilisateur,
    validateur: Utilisateur,
):
    """`uq_prospection_revalide_de_id` (index unique partiel, migration 0062) :
    chaîne linéaire garantie par la DB, même mécanisme que
    `uq_traitement_terrestre_origine_id` pour la reprise de traitement."""
    pid_origine = await _valider_extensive(
        client, auth_headers, campagne_id, verificateur, validateur
    )
    await _reculer_validated_at(db_session, pid_origine, DELAI_REVALIDATION_JOURS + 1)

    await _creer_prospection(
        client, auth_headers, campagne_id, "extensive", revalide_de_id=pid_origine
    )

    resp = await client.post(
        "/prospections",
        json={
            "type_prospection": "extensive",
            "campagne_id": str(campagne_id),
            "date_prospection": "2026-08-01",
            "revalide_de_id": pid_origine,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 422, resp.text
