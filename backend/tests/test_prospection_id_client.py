"""Identifiant de fiche choisi par le client (#678) : la fiche naît sur l'appareil, son id
local reste son id. Rejouer un envoi ne crée pas de seconde fiche."""

import uuid

import pytest
from httpx import AsyncClient


def _corps(campagne_id, station_id, equipe_id, **extra) -> dict:
    return {
        "equipe_id": str(equipe_id),
        "type_prospection": "intensive",
        "campagne_id": str(campagne_id),
        "station_id": str(station_id),
        "date_prospection": "2026-06-25",
        "biotope": ["xerophyle"],
        **extra,
    }


@pytest.mark.asyncio
async def test_l_id_fourni_par_le_client_est_conserve(
    client: AsyncClient,
    auth_headers: dict,
    campagne_id: uuid.UUID,
    station_id: uuid.UUID,
    equipe_terrestre_id: uuid.UUID,
):
    id_local = uuid.uuid4()

    reponse = await client.post(
        "/prospections",
        json=_corps(campagne_id, station_id, equipe_terrestre_id, id=str(id_local)),
        headers=auth_headers,
    )

    assert reponse.status_code == 201
    assert reponse.json()["id"] == str(id_local)


@pytest.mark.asyncio
async def test_sans_id_le_serveur_en_genere_un(
    client: AsyncClient,
    auth_headers: dict,
    campagne_id: uuid.UUID,
    station_id: uuid.UUID,
    equipe_terrestre_id: uuid.UUID,
):
    reponse = await client.post(
        "/prospections",
        json=_corps(campagne_id, station_id, equipe_terrestre_id),
        headers=auth_headers,
    )

    assert reponse.status_code == 201
    uuid.UUID(reponse.json()["id"])


@pytest.mark.asyncio
async def test_rejouer_le_meme_id_ne_cree_pas_de_doublon(
    client: AsyncClient,
    auth_headers: dict,
    campagne_id: uuid.UUID,
    station_id: uuid.UUID,
    equipe_terrestre_id: uuid.UUID,
):
    id_local = uuid.uuid4()
    corps = _corps(campagne_id, station_id, equipe_terrestre_id, id=str(id_local))

    premiere = await client.post("/prospections", json=corps, headers=auth_headers)
    rejeu = await client.post("/prospections", json=corps, headers=auth_headers)

    assert premiere.status_code == 201
    assert rejeu.status_code == 201
    assert rejeu.json()["id"] == str(id_local)
    liste = await client.get(
        "/prospections", params={"campagne_id": str(campagne_id)}, headers=auth_headers
    )
    assert [p["id"] for p in liste.json()].count(str(id_local)) == 1


@pytest.mark.asyncio
async def test_l_id_d_un_autre_agent_est_refuse(
    client: AsyncClient,
    auth_headers: dict,
    admin_headers: dict,
    campagne_id: uuid.UUID,
    station_id: uuid.UUID,
    equipe_terrestre_id: uuid.UUID,
):
    id_local = uuid.uuid4()
    corps = _corps(campagne_id, station_id, equipe_terrestre_id, id=str(id_local))
    await client.post("/prospections", json=corps, headers=auth_headers)

    reponse = await client.post("/prospections", json=corps, headers=admin_headers)

    assert reponse.status_code == 409
