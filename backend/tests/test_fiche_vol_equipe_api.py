"""Fiche de vol et équipe aérienne (migration 0078).

Choisir une équipe à la création renseigne l'en-tête (chef de base, pilote, mécanicien,
immatriculation, société de l'hélicoptère) depuis l'équipe — le serveur fait autorité — et
restreint la base et le stand à ceux de cette équipe.
"""

import uuid
from datetime import datetime

import pytest

from app.infrastructure.referentiel_model import (
    AeronefModel,
    BaseAerienneModel,
    StandRemplissageModel,
)


@pytest.fixture
async def equipe_equipee(db_session, equipe_aerienne):
    """`equipe_aerienne` avec pilote, mécanicien, consultant et son hélicoptère."""
    aeronef = AeronefModel(
        id=uuid.uuid4(),
        immatriculation="5R-MJA",
        societe="Heli Madagascar",
        volume_cuve_l=800,
        actif=True,
    )
    db_session.add(aeronef)
    await db_session.flush()
    equipe_aerienne.pilote = "Jean Rakoto"
    equipe_aerienne.mecanicien = "Paul Andria"
    equipe_aerienne.consultant_international = "John Smith"
    equipe_aerienne.aeronef_id = aeronef.id
    await db_session.commit()
    return equipe_aerienne


@pytest.fixture
async def stand_de_l_equipe(db_session, equipe_equipee):
    stand = StandRemplissageModel(
        id=uuid.uuid4(),
        numero="STDEQ",
        localite="Stand de l'équipe",
        latitude=-22.41,
        longitude=46.13,
        equipe_aerienne_id=equipe_equipee.id,
        actif=True,
    )
    db_session.add(stand)
    await db_session.commit()
    return stand


@pytest.fixture
def payload(campagne_id, base_aerienne, stand_de_l_equipe, equipe_equipee) -> dict:
    """Ce que le mobile envoie : en-tête pré-rempli (que le serveur écrasera) + équipe."""
    return {
        "date_vol": "2026-08-24",
        "compagnie": "Saisie au clavier",
        "immatriculation": "SAISIE-1",
        "campagne_id": str(campagne_id),
        "base_id": str(base_aerienne.id),
        "stand_id": str(stand_de_l_equipe.id),
        "pilote": "Saisi A.",
        "mecanicien": "Saisi B.",
        "chef_de_base_id": str(uuid.uuid4()),
        "equipe_aerienne_id": str(equipe_equipee.id),
    }


@pytest.mark.asyncio
async def test_l_en_tete_vient_de_l_equipe(client, auth_headers, payload, chef_de_base):
    reponse = await client.post("/fiches-vol", json=payload, headers=auth_headers)
    assert reponse.status_code == 201, reponse.text
    fiche = reponse.json()
    assert fiche["chef_de_base_id"] == str(chef_de_base.id)
    assert fiche["pilote"] == "Jean Rakoto"
    assert fiche["mecanicien"] == "Paul Andria"
    assert fiche["consultant_international"] == "John Smith"
    assert fiche["immatriculation"] == "5R-MJA"
    assert fiche["compagnie"] == "Heli Madagascar"
    assert fiche["equipe_aerienne_id"] == payload["equipe_aerienne_id"]
    assert fiche["equipe_aerienne_nom"] == "Équipe Ihosy"
    # Le numéro de fiche utilise l'immatriculation de l'hélicoptère de l'équipe.
    assert fiche["numero_fiche"].endswith("-5RMJA")


@pytest.mark.asyncio
async def test_une_base_secondaire_de_l_equipe_est_acceptee(
    client, auth_headers, payload, base_aerienne, db_session
):
    secondaire = BaseAerienneModel(
        id=uuid.uuid4(), parent_base_id=base_aerienne.id, numero="IHO02", localite="Ihosy nord"
    )
    db_session.add(secondaire)
    await db_session.commit()

    payload["base_id"] = str(secondaire.id)
    reponse = await client.post("/fiches-vol", json=payload, headers=auth_headers)
    assert reponse.status_code == 201, reponse.text


@pytest.mark.asyncio
async def test_la_base_d_une_autre_equipe_est_refusee(
    client, auth_headers, payload, equipe_aerienne_bis, db_session
):
    autre_base = BaseAerienneModel(
        id=uuid.uuid4(), equipe_id=equipe_aerienne_bis.id, numero="BET01", localite="Betroka"
    )
    db_session.add(autre_base)
    await db_session.commit()

    payload["base_id"] = str(autre_base.id)
    reponse = await client.post("/fiches-vol", json=payload, headers=auth_headers)
    assert reponse.status_code == 422
    assert "base" in reponse.json()["detail"]


@pytest.mark.asyncio
async def test_le_stand_d_une_autre_equipe_est_refuse(
    client, auth_headers, payload, equipe_aerienne_bis, db_session
):
    stand = StandRemplissageModel(
        id=uuid.uuid4(),
        numero="STDBIS",
        localite="Chez Betroka",
        equipe_aerienne_id=equipe_aerienne_bis.id,
    )
    db_session.add(stand)
    await db_session.commit()

    payload["stand_id"] = str(stand.id)
    reponse = await client.post("/fiches-vol", json=payload, headers=auth_headers)
    assert reponse.status_code == 422
    assert "stand" in reponse.json()["detail"]


@pytest.mark.asyncio
async def test_un_stand_sans_equipe_n_est_propose_a_personne(
    client, auth_headers, payload, stand_remplissage
):
    """`stand_remplissage` (fixture) est antérieur à la migration : sans équipe, donc
    refusé tant qu'un admin ne l'a pas rattaché."""
    payload["stand_id"] = str(stand_remplissage.id)
    reponse = await client.post("/fiches-vol", json=payload, headers=auth_headers)
    assert reponse.status_code == 422


@pytest.mark.asyncio
async def test_equipe_inexistante_404(client, auth_headers, payload):
    payload["equipe_aerienne_id"] = str(uuid.uuid4())
    reponse = await client.post("/fiches-vol", json=payload, headers=auth_headers)
    assert reponse.status_code == 404


@pytest.mark.asyncio
async def test_equipe_inactive_404(client, auth_headers, payload, equipe_equipee, db_session):
    """Une équipe sortie de service ne démarre plus de fiche."""
    equipe_equipee.actif = False
    await db_session.commit()
    reponse = await client.post("/fiches-vol", json=payload, headers=auth_headers)
    assert reponse.status_code == 404


@pytest.mark.asyncio
async def test_equipe_sans_aeronef_garde_l_immatriculation_saisie(
    client, auth_headers, payload, equipe_equipee, db_session
):
    """Équipe antérieure à la migration (pas d'hélicoptère) : rien à déduire, la saisie
    du client est conservée — mais le chef et le pilote viennent quand même de l'équipe."""
    equipe_equipee.aeronef_id = None
    await db_session.commit()

    reponse = await client.post("/fiches-vol", json=payload, headers=auth_headers)
    assert reponse.status_code == 201, reponse.text
    assert reponse.json()["immatriculation"] == "SAISIE-1"
    assert reponse.json()["compagnie"] == "Saisie au clavier"
    assert reponse.json()["pilote"] == "Jean Rakoto"


@pytest.mark.asyncio
async def test_sans_equipe_le_comportement_anterieur_est_conserve(
    client, auth_headers, payload, chef_de_base, stand_remplissage
):
    """Clients mobiles pas encore mis à jour : pas d'équipe, valeurs saisies conservées,
    aucun contrôle sur les lieux."""
    payload.pop("equipe_aerienne_id")
    payload["chef_de_base_id"] = str(chef_de_base.id)
    payload["stand_id"] = str(stand_remplissage.id)  # stand « sans équipe »

    reponse = await client.post("/fiches-vol", json=payload, headers=auth_headers)
    assert reponse.status_code == 201, reponse.text
    assert reponse.json()["pilote"] == "Saisi A."
    assert reponse.json()["immatriculation"] == "SAISIE-1"
    assert reponse.json()["equipe_aerienne_id"] is None


# --- Synchronisation hors-ligne ----------------------------------------------------


def _push(fiche_id, payload, base_updated_at):
    return {
        **payload,
        "id": str(fiche_id),
        "base_updated_at": base_updated_at.isoformat(),
        "vols": [],
    }


@pytest.mark.asyncio
async def test_sync_cree_la_fiche_depuis_l_equipe(client, auth_headers, payload):
    fiche_id = uuid.uuid4()
    reponse = await client.post(
        "/fiches-vol/sync", json=_push(fiche_id, payload, datetime.utcnow()), headers=auth_headers
    )
    assert reponse.status_code == 201, reponse.text
    assert reponse.json()["pilote"] == "Jean Rakoto"
    assert reponse.json()["immatriculation"] == "5R-MJA"


@pytest.mark.asyncio
async def test_le_renvoi_de_synchro_ne_reecrit_pas_le_snapshot_du_jour(
    client, auth_headers, payload, equipe_equipee, db_session
):
    """L'en-tête est un snapshot : si l'équipe change de pilote après la création, un
    renvoi de la même fiche ne l'écrase pas (« une fiche ancienne conserve le pilote du
    jour »)."""
    fiche_id = uuid.uuid4()
    creation = await client.post(
        "/fiches-vol/sync", json=_push(fiche_id, payload, datetime.utcnow()), headers=auth_headers
    )
    assert creation.status_code == 201, creation.text
    snapshot = creation.json()

    equipe_equipee.pilote = "Nouveau Pilote"
    await db_session.commit()

    # Le mobile renvoie ce que le serveur lui a rendu.
    renvoi = _push(fiche_id, payload, datetime.utcnow())
    for champ in ("pilote", "mecanicien", "immatriculation", "compagnie", "chef_de_base_id"):
        renvoi[champ] = snapshot[champ]
    reponse = await client.post("/fiches-vol/sync", json=renvoi, headers=auth_headers)
    assert reponse.status_code == 200, reponse.text
    assert reponse.json()["pilote"] == "Jean Rakoto"


@pytest.mark.asyncio
async def test_sync_omettant_equipe_ne_detache_pas_une_fiche_deja_rattachee(
    client, auth_headers, payload, equipe_equipee
):
    """Un client qui n'envoie pas encore ce champ (mobile pas à jour) ne doit jamais
    pouvoir détacher silencieusement une fiche déjà rattachée à une équipe."""
    fiche_id = uuid.uuid4()
    creation = await client.post(
        "/fiches-vol/sync", json=_push(fiche_id, payload, datetime.utcnow()), headers=auth_headers
    )
    assert creation.status_code == 201, creation.text

    renvoi = _push(fiche_id, payload, datetime.utcnow())
    renvoi.pop("equipe_aerienne_id")
    reponse = await client.post("/fiches-vol/sync", json=renvoi, headers=auth_headers)
    assert reponse.status_code == 200, reponse.text
    assert reponse.json()["equipe_aerienne_id"] == str(equipe_equipee.id)
    assert reponse.json()["pilote"] == "Jean Rakoto"


@pytest.mark.asyncio
async def test_sync_meme_equipe_ignore_un_en_tete_falsifie(
    client, auth_headers, payload, equipe_aerienne_bis
):
    """Un renvoi de synchro sur la même équipe ne doit pas pouvoir substituer le chef
    de base, le pilote ou l'appareil par ceux d'une autre équipe : l'en-tête reste le
    snapshot du jour, jamais celui que le client soumet."""
    fiche_id = uuid.uuid4()
    creation = await client.post(
        "/fiches-vol/sync", json=_push(fiche_id, payload, datetime.utcnow()), headers=auth_headers
    )
    assert creation.status_code == 201, creation.text
    snapshot = creation.json()

    renvoi = _push(fiche_id, payload, datetime.utcnow())
    renvoi["chef_de_base_id"] = str(equipe_aerienne_bis.chef_de_base_id)
    renvoi["pilote"] = "Pilote Usurpateur"
    renvoi["immatriculation"] = "USURPE-1"
    reponse = await client.post("/fiches-vol/sync", json=renvoi, headers=auth_headers)
    assert reponse.status_code == 200, reponse.text
    assert reponse.json()["chef_de_base_id"] == snapshot["chef_de_base_id"]
    assert reponse.json()["pilote"] == "Jean Rakoto"
    assert reponse.json()["immatriculation"] == snapshot["immatriculation"]
