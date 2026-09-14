"""Fiche de vol — cas d'usage et routes, sur base réelle.

Couvre ce que le domaine pur ne peut pas garantir seul : la numérotation avec compteur
face à la contrainte UNIQUE, les contraintes SQL de rattachement, et le verrouillage
post-validation.
"""

import uuid
from datetime import date

import pytest

from app.infrastructure.prospection_model import ProspectionModel
from app.models.users import Utilisateur


@pytest.fixture
def payload_fiche(
    chef_de_base: Utilisateur, campagne_id: uuid.UUID, base_aerienne, stand_remplissage
) -> dict:
    return {
        "date_vol": "2026-08-24",
        "compagnie": "Aviation Malgache",
        "immatriculation": "MDG-A21",
        "campagne_id": str(campagne_id),
        "base_id": str(base_aerienne.id),
        "stand_id": str(stand_remplissage.id),
        "pilote": "Rakoto A.",
        "mecanicien": "Randria B.",
        "chef_de_base_id": str(chef_de_base.id),
    }


async def _creer(client, auth_headers, payload) -> dict:
    reponse = await client.post("/fiches-vol", json=payload, headers=auth_headers)
    assert reponse.status_code == 201, reponse.text
    return reponse.json()


# --- Création et numérotation ------------------------------------------------------


@pytest.mark.asyncio
async def test_creation_derive_le_numero_de_fiche(client, auth_headers, payload_fiche):
    fiche = await _creer(client, auth_headers, payload_fiche)
    assert fiche["numero_fiche"] == "001-2026-08-24-IHO01-MDGA21"
    assert fiche["statut"] == "brouillon"
    assert fiche["base_numero"] == "IHO01"
    assert fiche["stand_numero"] == "STD01"


@pytest.mark.asyncio
async def test_seconde_fiche_du_jour_recoit_un_compteur(client, auth_headers, payload_fiche):
    """Le terrain n'est jamais bloqué : la deuxième fiche est acceptée, numérotée. Le
    compteur est continu par campagne (jamais un suffixe -02 : cf. next_compteur)."""
    premiere = await _creer(client, auth_headers, payload_fiche)
    seconde = await _creer(client, auth_headers, payload_fiche)
    assert premiere["numero_fiche"] == "001-2026-08-24-IHO01-MDGA21"
    assert seconde["numero_fiche"] == "002-2026-08-24-IHO01-MDGA21"


@pytest.mark.asyncio
async def test_chef_de_base_doit_avoir_le_bon_role(
    client, auth_headers, payload_fiche, utilisateur
):
    payload_fiche["chef_de_base_id"] = str(utilisateur.id)  # rôle prospecteur
    reponse = await client.post("/fiches-vol", json=payload_fiche, headers=auth_headers)
    assert reponse.status_code == 403


# --- Vols et durées dérivées -------------------------------------------------------


@pytest.mark.asyncio
async def test_ajout_de_vols_et_duree_derivee(client, auth_headers, payload_fiche):
    fiche = await _creer(client, auth_headers, payload_fiche)
    reponse = await client.post(
        f"/fiches-vol/{fiche['id']}/vols",
        json={
            "numero": 1,
            "type_vol": "CONVOYAGE",
            "heure_debut": "05:30:00",
            "heure_fin": "06:45:00",
        },
        headers=auth_headers,
    )
    assert reponse.status_code == 200, reponse.text
    corps = reponse.json()
    assert corps["vols"][0]["duree_minutes"] == 75
    assert corps["duree_totale_minutes"] == 75


@pytest.mark.asyncio
async def test_un_convoyage_ne_peut_pas_pointer_une_rotation(client, auth_headers, payload_fiche):
    fiche = await _creer(client, auth_headers, payload_fiche)
    reponse = await client.post(
        f"/fiches-vol/{fiche['id']}/vols",
        json={
            "numero": 1,
            "type_vol": "CONVOYAGE",
            "heure_debut": "05:30:00",
            "heure_fin": "06:45:00",
            "rotation_id": str(uuid.uuid4()),
        },
        headers=auth_headers,
    )
    assert reponse.status_code == 422


@pytest.mark.asyncio
async def test_heure_de_fin_anterieure_est_refusee(client, auth_headers, payload_fiche):
    fiche = await _creer(client, auth_headers, payload_fiche)
    reponse = await client.post(
        f"/fiches-vol/{fiche['id']}/vols",
        json={
            "numero": 1,
            "type_vol": "DIVERS",
            "heure_debut": "10:00:00",
            "heure_fin": "09:00:00",
        },
        headers=auth_headers,
    )
    assert reponse.status_code == 422


# --- Cumuls ------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_cumuls_sont_calcules_et_jamais_stockes(client, auth_headers, payload_fiche):
    fiche = await _creer(client, auth_headers, payload_fiche)
    await client.post(
        f"/fiches-vol/{fiche['id']}/vols",
        json={
            "numero": 1,
            "type_vol": "DIVERS",
            "heure_debut": "08:00:00",
            "heure_fin": "09:30:00",
        },
        headers=auth_headers,
    )
    reponse = await client.get(
        "/fiches-vol/cumuls",
        params={"immatriculation": "MDG-A21", "reference": "2026-08-24"},
        headers=auth_headers,
    )
    assert reponse.status_code == 200, reponse.text
    assert reponse.json() == {"jour": 90, "semaine": 90, "mois": 90, "total": 90}


# --- Signatures et validation ------------------------------------------------------


@pytest.mark.asyncio
async def test_validation_refusee_sans_les_trois_signatures(client, auth_headers, payload_fiche):
    fiche = await _creer(client, auth_headers, payload_fiche)
    reponse = await client.put(f"/fiches-vol/{fiche['id']}/valider", headers=auth_headers)
    assert reponse.status_code == 422
    assert "MECANICIEN" in reponse.text


@pytest.mark.asyncio
async def test_validation_refusee_si_une_rotation_est_incomplete(
    client,
    auth_headers,
    payload_fiche,
    db_session,
    campagne_id,
    utilisateur,
    chef_de_base,
    pesticide,
    pilote,
    mecanicien,
):
    fiche = await _creer(client, auth_headers, payload_fiche)
    for role, nom in [
        ("PILOTE", "Rakoto A."),
        ("MECANICIEN", "Randria B."),
        ("CHEF_DE_BASE", "Rasoa C."),
    ]:
        await client.put(
            f"/fiches-vol/{fiche['id']}/signatures",
            json={"role": role, "signataire_nom": nom},
            headers=auth_headers,
        )
    rotation_id = await _rotation_reelle(
        client,
        auth_headers,
        db_session,
        campagne_id,
        utilisateur,
        chef_de_base,
        pesticide,
        pilote,
        mecanicien,
    )
    await client.post(
        f"/fiches-vol/{fiche['id']}/vols",
        json={
            "numero": 1,
            "type_vol": "MEP",
            "heure_debut": "06:00:00",
            "heure_fin": "06:20:00",
            "rotation_id": rotation_id,
        },
        headers=auth_headers,
    )
    reponse = await client.put(f"/fiches-vol/{fiche['id']}/valider", headers=auth_headers)
    assert reponse.status_code == 422
    assert "APPLICATION" in reponse.text


@pytest.mark.asyncio
async def test_fiche_signee_est_validable_et_verrouillee(client, auth_headers, payload_fiche):
    fiche = await _creer(client, auth_headers, payload_fiche)
    for role, nom in [
        ("PILOTE", "Rakoto A."),
        ("MECANICIEN", "Randria B."),
        ("CHEF_DE_BASE", "Rasoa C."),
    ]:
        reponse = await client.put(
            f"/fiches-vol/{fiche['id']}/signatures",
            json={
                "role": role,
                "signataire_nom": nom,
                "signature_image": "data:image/png;base64,AA",
            },
            headers=auth_headers,
        )
        assert reponse.status_code == 200, reponse.text

    reponse = await client.put(f"/fiches-vol/{fiche['id']}/valider", headers=auth_headers)
    assert reponse.status_code == 200, reponse.text
    assert reponse.json()["statut"] == "validee"

    # Verrouillage : plus aucune écriture après validation.
    apres = await client.post(
        f"/fiches-vol/{fiche['id']}/vols",
        json={
            "numero": 9,
            "type_vol": "DIVERS",
            "heure_debut": "12:00:00",
            "heure_fin": "12:30:00",
        },
        headers=auth_headers,
    )
    assert apres.status_code == 403


@pytest.mark.asyncio
async def test_le_verrouillage_interdit_aussi_le_retrait_d_un_vol(
    client, auth_headers, payload_fiche
):
    """« Plus aucune écriture » couvre la suppression autant que l'ajout."""
    fiche = await _creer(client, auth_headers, payload_fiche)
    ajout = await client.post(
        f"/fiches-vol/{fiche['id']}/vols",
        json={
            "numero": 1,
            "type_vol": "DIVERS",
            "heure_debut": "08:00:00",
            "heure_fin": "08:30:00",
        },
        headers=auth_headers,
    )
    vol_id = ajout.json()["vols"][0]["id"]
    for role, nom in [
        ("PILOTE", "Rakoto A."),
        ("MECANICIEN", "Randria B."),
        ("CHEF_DE_BASE", "Rasoa C."),
    ]:
        await client.put(
            f"/fiches-vol/{fiche['id']}/signatures",
            json={"role": role, "signataire_nom": nom},
            headers=auth_headers,
        )
    validee = await client.put(f"/fiches-vol/{fiche['id']}/valider", headers=auth_headers)
    assert validee.status_code == 200, validee.text

    retrait = await client.delete(f"/fiches-vol/{fiche['id']}/vols/{vol_id}", headers=auth_headers)
    assert retrait.status_code == 403


@pytest.mark.asyncio
async def test_rotation_inexistante_renvoie_404(client, auth_headers, payload_fiche):
    """Une tablette qui synchronise en retard peut pointer une rotation disparue : c'est
    un 404, pas une erreur serveur."""
    fiche = await _creer(client, auth_headers, payload_fiche)
    reponse = await client.post(
        f"/fiches-vol/{fiche['id']}/vols",
        json={
            "numero": 1,
            "type_vol": "MEP",
            "heure_debut": "06:00:00",
            "heure_fin": "06:20:00",
            "rotation_id": str(uuid.uuid4()),
        },
        headers=auth_headers,
    )
    assert reponse.status_code == 404, reponse.text


@pytest.mark.asyncio
async def test_prospection_inexistante_renvoie_404(client, auth_headers, payload_fiche):
    fiche = await _creer(client, auth_headers, payload_fiche)
    reponse = await client.post(
        f"/fiches-vol/{fiche['id']}/vols",
        json={
            "numero": 1,
            "type_vol": "PROSPECTION",
            "heure_debut": "06:00:00",
            "heure_fin": "06:20:00",
            "prospection_id": str(uuid.uuid4()),
        },
        headers=auth_headers,
    )
    assert reponse.status_code == 404, reponse.text


@pytest.mark.asyncio
async def test_resigner_rafraichit_l_horodatage(client, auth_headers, payload_fiche):
    """Resigner, c'est réattester : l'horodatage doit suivre le nouveau tracé."""
    fiche = await _creer(client, auth_headers, payload_fiche)
    premiere = await client.put(
        f"/fiches-vol/{fiche['id']}/signatures",
        json={"role": "PILOTE", "signataire_nom": "Rakoto A."},
        headers=auth_headers,
    )
    horodatage_initial = premiere.json()["signatures"][0]["horodatage"]

    seconde = await client.put(
        f"/fiches-vol/{fiche['id']}/signatures",
        json={
            "role": "PILOTE",
            "signataire_nom": "Rakoto A.",
            "signature_image": "data:image/png;base64,BB",
        },
        headers=auth_headers,
    )
    signatures = seconde.json()["signatures"]
    assert len(signatures) == 1  # upsert, pas de doublon de rôle
    assert signatures[0]["signature_image"] == "data:image/png;base64,BB"
    assert signatures[0]["horodatage"] > horodatage_initial


@pytest.mark.asyncio
async def test_le_trace_de_signature_est_facultatif(client, auth_headers, payload_fiche):
    fiche = await _creer(client, auth_headers, payload_fiche)
    reponse = await client.put(
        f"/fiches-vol/{fiche['id']}/signatures",
        json={"role": "PILOTE", "signataire_nom": "Rakoto A."},
        headers=auth_headers,
    )
    assert reponse.status_code == 200
    assert reponse.json()["signatures"][0]["signature_image"] is None


# --- Lecture -----------------------------------------------------------------------


@pytest.mark.asyncio
async def test_lecture_et_liste(client, auth_headers, payload_fiche):
    fiche = await _creer(client, auth_headers, payload_fiche)
    lue = await client.get(f"/fiches-vol/{fiche['id']}", headers=auth_headers)
    assert lue.status_code == 200
    assert lue.json()["numero_fiche"] == fiche["numero_fiche"]

    liste = await client.get(
        "/fiches-vol", params={"immatriculation": "MDG-A21"}, headers=auth_headers
    )
    assert liste.status_code == 200
    assert len(liste.json()) == 1


@pytest.mark.asyncio
async def test_fiche_inconnue_renvoie_404(client, auth_headers):
    reponse = await client.get(f"/fiches-vol/{uuid.uuid4()}", headers=auth_headers)
    assert reponse.status_code == 404


async def _rotation_reelle(
    client,
    auth_headers,
    db_session,
    campagne_id,
    utilisateur,
    chef_de_base,
    pesticide,
    pilote,
    mecanicien,
) -> str:
    """Crée une rotation authentique : la FK `vol.rotation_id` interdit tout UUID inventé."""
    prospection = ProspectionModel(
        id=uuid.uuid4(),
        type_prospection="extensive",
        campagne_id=campagne_id,
        prospecteur_id=utilisateur.id,
        date_prospection=date(2026, 8, 1),
        statut="brouillon",
        statut_sync="local",
    )
    db_session.add(prospection)
    await db_session.commit()

    traitement = await client.post(
        "/traitements",
        json={
            "prospection_id": str(prospection.id),
            "date_traitement": "2026-08-11",
            "date_validation": "2026-08-10",
            "localite": "Betioky",
            "aerien": {
                "pilote": f"{pilote.prenom} {pilote.nom}",
                "mecanicien": f"{mecanicien.prenom} {mecanicien.nom}",
                "chef_de_base_id": str(chef_de_base.id),
                "base_principale": "Base Betioky",
                "immatricule_aeronef": "5R-ABC",
            },
        },
        headers=auth_headers,
    )
    assert traitement.status_code == 201, traitement.text

    rotation = await client.post(
        f"/traitements/{traitement.json()['id']}/rotations",
        json={
            "produit_id": str(pesticide.id),
            "quantite": 10.0,
            "unite": "L",
            "surface_ha": 5.0,
            "temperature_debut_c": 25.0,
            "temperature_fin_c": 27.0,
            "vent_debut_ms": 2.0,
            "vent_fin_ms": 3.0,
            "heure_debut": "06:00:00",
            "heure_ouverture_vanne": "06:05:00",
            "heure_fermeture_vanne": "06:25:00",
            "heure_fin": "06:30:00",
        },
        headers=auth_headers,
    )
    assert rotation.status_code == 201, rotation.text
    return rotation.json()["aerien"]["rotations"][0]["id"]
