import copy
import uuid
from datetime import date

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.prospection_model import ProspectionModel, ProspectionPopulationModel


@pytest.fixture
def payload_traitement(chef_de_base):
    def _build(prospection_id, **overrides):
        payload = {
            "prospection_id": str(prospection_id),
            "date_traitement": "2026-08-11",
            "date_validation": "2026-08-12",
            "localite": "Betioky",
            "aerien": {
                "pilote": "J. Dupont",
                "mecanicien": "M. Rabe",
                "chef_de_base_id": str(chef_de_base.id),
            },
        }
        payload.update(overrides)
        return payload

    return _build


async def _creer_prospection(
    db_session: AsyncSession,
    campagne_id,
    utilisateur,
    surf_infestee=None,
    populations=(),
) -> uuid.UUID:
    p = ProspectionModel(
        id=uuid.uuid4(),
        type_prospection="extensive",
        campagne_id=campagne_id,
        prospecteur_id=utilisateur.id,
        date_prospection=date(2026, 8, 1),
        surf_infestee=surf_infestee,
        statut="brouillon",
        statut_sync="local",
    )
    for pop in populations:
        p.populations.append(ProspectionPopulationModel(id=uuid.uuid4(), **pop))
    db_session.add(p)
    await db_session.commit()
    return p.id


@pytest.mark.asyncio
async def test_create_traitement_aerien_brouillon(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement
):
    prospection_id = await _creer_prospection(
        db_session,
        campagne_id,
        utilisateur,
        surf_infestee=120.5,
        populations=[{"espece": "LMC", "categorie": "imago"}],
    )
    resp = await client.post(
        "/traitements", json=payload_traitement(prospection_id), headers=auth_headers
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["statut"] == "brouillon"
    assert body["type_traitement"] == "AERIEN"
    assert body["numero_fiche"] == "Hery-Aerien-2026-08-11"
    assert body["cible"]["espece"] == "LMC"
    assert body["cible"]["surface_infestee_ha"] == 120.5
    assert body["aerien"]["pilote"] == "J. Dupont"


@pytest.mark.asyncio
async def test_create_deux_fois_suffixe_incremental(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement
):
    prospection_id = await _creer_prospection(db_session, campagne_id, utilisateur)
    r1 = await client.post(
        "/traitements", json=payload_traitement(prospection_id), headers=auth_headers
    )
    r2 = await client.post(
        "/traitements", json=payload_traitement(prospection_id), headers=auth_headers
    )
    assert r1.status_code == 201
    assert r2.status_code == 201, r2.text
    assert r1.json()["numero_fiche"] == "Hery-Aerien-2026-08-11"
    assert r2.json()["numero_fiche"] == "Hery-Aerien-2026-08-11-2"


@pytest.mark.asyncio
async def test_create_rejette_mauvais_role_403(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement
):
    prospection_id = await _creer_prospection(db_session, campagne_id, utilisateur)
    payload = payload_traitement(prospection_id)
    # utilisateur (fixture) a le rôle 'prospecteur', pas 'chef_de_base'
    payload["aerien"]["chef_de_base_id"] = str(utilisateur.id)
    resp = await client.post("/traitements", json=payload, headers=auth_headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_create_prospection_inexistante_404(
    client, auth_headers, payload_traitement, db_engine
):
    resp = await client.post(
        "/traitements", json=payload_traitement(uuid.uuid4()), headers=auth_headers
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_traitement_snapshot_non_renseigne(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement
):
    # prospection sans populations ni surface → snapshot avec champs "non renseigné"
    prospection_id = await _creer_prospection(db_session, campagne_id, utilisateur)
    created = await client.post(
        "/traitements", json=payload_traitement(prospection_id), headers=auth_headers
    )
    traitement_id = created.json()["id"]

    resp = await client.get(f"/traitements/{traitement_id}", headers=auth_headers)
    assert resp.status_code == 200
    cible = resp.json()["cible"]
    assert cible["espece"] == "non renseigné"
    assert cible["petites_larves"] == "non renseigné"
    assert cible["grandes_larves"] == "non renseigné"
    assert cible["vols_clairs_essaims"] == "non renseigné"
    assert cible["repartition_population"] == "non renseigné"
    assert cible["surface_infestee_ha"] == "non renseigné"


@pytest.mark.asyncio
async def test_get_traitement_inexistant_404(client, auth_headers, db_engine):
    resp = await client.get(f"/traitements/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404


@pytest.fixture
def payload_rotation(pesticide):
    produit_id = str(pesticide.id)

    def _build(**overrides):
        payload = {
            "numero_cuve": "C1",
            "produit_id": produit_id,
            "quantite_l": 10.0,
            "temperature_debut_c": 25.0,
            "temperature_fin_c": 27.0,
            "vent_debut_ms": 2.0,
            "vent_fin_ms": 3.0,
        }
        payload.update(overrides)
        return payload

    return _build


async def _creer_traitement(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement
):
    prospection_id = await _creer_prospection(db_session, campagne_id, utilisateur)
    resp = await client.post(
        "/traitements", json=payload_traitement(prospection_id), headers=auth_headers
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_add_rotation_incremente_totaux(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement, payload_rotation
):
    traitement_id = await _creer_traitement(
        client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement
    )
    resp = await client.post(
        f"/traitements/{traitement_id}/rotations",
        json=payload_rotation(),
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["aerien"]["nb_rotations"] == 1
    assert body["aerien"]["total_pesticide_l"] == 10.0
    assert len(body["aerien"]["rotations"]) == 1
    assert body["aerien"]["rotations"][0]["numero"] == 1


@pytest.mark.asyncio
async def test_creer_traitement_avec_trois_rotations_cdg_9(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement, payload_rotation
):
    """Critère d'acceptation CDG §9: nb_rotations=3, total_pesticide_l = somme des 3 quantités."""
    traitement_id = await _creer_traitement(
        client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement
    )
    for quantite in (10.0, 15.5, 8.25):
        resp = await client.post(
            f"/traitements/{traitement_id}/rotations",
            json=payload_rotation(quantite_l=quantite),
            headers=auth_headers,
        )
        assert resp.status_code == 201, resp.text

    final = await client.get(f"/traitements/{traitement_id}", headers=auth_headers)
    assert final.status_code == 200
    aerien = final.json()["aerien"]
    assert aerien["nb_rotations"] == 3
    assert aerien["total_pesticide_l"] == 33.75


@pytest.mark.asyncio
async def test_update_rotation_recalcule_totaux(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement, payload_rotation
):
    traitement_id = await _creer_traitement(
        client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement
    )
    created = await client.post(
        f"/traitements/{traitement_id}/rotations",
        json=payload_rotation(quantite_l=10.0),
        headers=auth_headers,
    )
    rotation_id = created.json()["aerien"]["rotations"][0]["id"]

    resp = await client.put(
        f"/traitements/{traitement_id}/rotations/{rotation_id}",
        json=payload_rotation(quantite_l=20.0),
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    aerien = resp.json()["aerien"]
    assert aerien["nb_rotations"] == 1
    assert aerien["total_pesticide_l"] == 20.0


@pytest.mark.asyncio
async def test_delete_rotation_recalcule_totaux(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement, payload_rotation
):
    traitement_id = await _creer_traitement(
        client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement
    )
    r1 = await client.post(
        f"/traitements/{traitement_id}/rotations",
        json=payload_rotation(quantite_l=10.0),
        headers=auth_headers,
    )
    r2 = await client.post(
        f"/traitements/{traitement_id}/rotations",
        json=payload_rotation(quantite_l=5.0),
        headers=auth_headers,
    )
    rotation_id_1 = r1.json()["aerien"]["rotations"][0]["id"]

    resp = await client.delete(
        f"/traitements/{traitement_id}/rotations/{rotation_id_1}", headers=auth_headers
    )
    assert resp.status_code == 200, resp.text
    aerien = resp.json()["aerien"]
    assert aerien["nb_rotations"] == 1
    assert aerien["total_pesticide_l"] == 5.0
    assert r2.status_code == 201


@pytest.mark.asyncio
async def test_add_rotation_traitement_inexistant_404(
    client, auth_headers, payload_rotation, db_engine
):
    resp = await client.post(
        f"/traitements/{uuid.uuid4()}/rotations", json=payload_rotation(), headers=auth_headers
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_rotation_inexistante_404(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement
):
    traitement_id = await _creer_traitement(
        client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement
    )
    resp = await client.delete(
        f"/traitements/{traitement_id}/rotations/{uuid.uuid4()}", headers=auth_headers
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_rotation_dun_autre_traitement_404(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement, payload_rotation
):
    traitement_1 = await _creer_traitement(
        client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement
    )
    traitement_2 = await _creer_traitement(
        client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement
    )
    created = await client.post(
        f"/traitements/{traitement_1}/rotations", json=payload_rotation(), headers=auth_headers
    )
    rotation_id = created.json()["aerien"]["rotations"][0]["id"]

    resp = await client.delete(
        f"/traitements/{traitement_2}/rotations/{rotation_id}", headers=auth_headers
    )
    assert resp.status_code == 404

    # la rotation appartient toujours au traitement 1, ses totaux sont intacts
    verif = await client.get(f"/traitements/{traitement_1}", headers=auth_headers)
    assert verif.json()["aerien"]["nb_rotations"] == 1


@pytest.mark.asyncio
async def test_list_traitements_filtres(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement
):
    p1 = await _creer_prospection(db_session, campagne_id, utilisateur)
    p2 = await _creer_prospection(db_session, campagne_id, utilisateur)
    await client.post("/traitements", json=payload_traitement(p1), headers=auth_headers)
    await client.post("/traitements", json=payload_traitement(p2), headers=auth_headers)

    tous = await client.get(
        "/traitements", params={"type_traitement": "AERIEN"}, headers=auth_headers
    )
    assert tous.status_code == 200
    assert len(tous.json()) == 2

    filtre = await client.get(
        "/traitements",
        params={"type_traitement": "AERIEN", "prospection_id": str(p1)},
        headers=auth_headers,
    )
    assert filtre.status_code == 200
    assert len(filtre.json()) == 1
    assert filtre.json()[0]["prospection_id"] == str(p1)

    vide = await client.get(
        "/traitements", params={"type_traitement": "TERRESTRE"}, headers=auth_headers
    )
    assert vide.json() == []


@pytest.fixture
def payload_traitement_terrestre(chef_equipe):
    def _build(prospection_id, **overrides):
        payload = {
            "prospection_id": str(prospection_id),
            "date_traitement": "2026-08-11",
            "date_validation": "2026-08-12",
            "localite": "Betioky",
            "terrestre": {
                "heure_debut": "06:00:00",
                "heure_fin": "09:00:00",
                "vitesse_vent_ms": 1.5,
                "temperature_c": 24.0,
                "chef_equipe_id": str(chef_equipe.id),
            },
        }
        payload.update(overrides)
        return payload

    return _build


@pytest.mark.asyncio
async def test_create_traitement_terrestre_brouillon(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement_terrestre
):
    prospection_id = await _creer_prospection(
        db_session,
        campagne_id,
        utilisateur,
        surf_infestee=100.0,
        populations=[{"espece": "LMC", "categorie": "imago"}],
    )
    payload = payload_traitement_terrestre(prospection_id)
    payload["terrestre"]["surface_atomiseur_ha"] = 10.0
    payload["terrestre"]["surface_disque_rotatif_ha"] = 5.0
    payload["terrestre"]["surface_ulvamast_ha"] = 2.0
    payload["terrestre"]["surface_restante_abandonnee"] = False

    resp = await client.post("/traitements", json=payload, headers=auth_headers)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["statut"] == "brouillon"
    assert body["type_traitement"] == "TERRESTRE"
    assert body["numero_fiche"] == "Hery-Terrestre-2026-08-11"
    assert body["cible"]["surface_infestee_ha"] == 100.0
    assert body["terrestre"]["surface_traitee_ha"] == 17.0
    assert body["terrestre"]["surface_restante_ha"] == 83.0


@pytest.mark.asyncio
async def test_create_traitement_terrestre_surface_restante_plancher_zero(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement_terrestre
):
    """Critère d'acceptation CDG §9: surface_restante_ha ne descend jamais sous 0."""
    prospection_id = await _creer_prospection(
        db_session, campagne_id, utilisateur, surf_infestee=10.0
    )
    payload = payload_traitement_terrestre(prospection_id)
    payload["terrestre"]["surface_atomiseur_ha"] = 25.0

    resp = await client.post("/traitements", json=payload, headers=auth_headers)
    assert resp.status_code == 201, resp.text
    terrestre = resp.json()["terrestre"]
    assert terrestre["surface_traitee_ha"] == 25.0
    assert terrestre["surface_restante_ha"] == 0.0


@pytest.mark.asyncio
async def test_create_traitement_terrestre_surface_restante_positive_sans_abandonnee_422(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement_terrestre
):
    prospection_id = await _creer_prospection(
        db_session, campagne_id, utilisateur, surf_infestee=100.0
    )
    payload = payload_traitement_terrestre(prospection_id)
    payload["terrestre"]["surface_atomiseur_ha"] = 10.0

    resp = await client.post("/traitements", json=payload, headers=auth_headers)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_terrestre_deux_fois_suffixe_incremental(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement_terrestre
):
    prospection_id = await _creer_prospection(db_session, campagne_id, utilisateur)
    r1 = await client.post(
        "/traitements", json=payload_traitement_terrestre(prospection_id), headers=auth_headers
    )
    r2 = await client.post(
        "/traitements", json=payload_traitement_terrestre(prospection_id), headers=auth_headers
    )
    assert r1.status_code == 201
    assert r2.status_code == 201, r2.text
    assert r1.json()["numero_fiche"] == "Hery-Terrestre-2026-08-11"
    assert r2.json()["numero_fiche"] == "Hery-Terrestre-2026-08-11-2"


@pytest.mark.asyncio
async def test_create_terrestre_heure_fin_anterieure_422(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement_terrestre
):
    prospection_id = await _creer_prospection(db_session, campagne_id, utilisateur)
    payload = payload_traitement_terrestre(prospection_id)
    payload["terrestre"]["heure_debut"] = "09:00:00"
    payload["terrestre"]["heure_fin"] = "09:00:00"

    resp = await client.post("/traitements", json=payload, headers=auth_headers)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_terrestre_rejette_mauvais_role_403(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement_terrestre
):
    prospection_id = await _creer_prospection(db_session, campagne_id, utilisateur)
    payload = payload_traitement_terrestre(prospection_id)
    # utilisateur (fixture) a le rôle 'prospecteur', pas 'chef_equipe'
    payload["terrestre"]["chef_equipe_id"] = str(utilisateur.id)
    resp = await client.post("/traitements", json=payload, headers=auth_headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_create_traitement_sans_aerien_ni_terrestre_422(
    client, auth_headers, db_session, campagne_id, utilisateur
):
    prospection_id = await _creer_prospection(db_session, campagne_id, utilisateur)
    payload = {
        "prospection_id": str(prospection_id),
        "date_traitement": "2026-08-11",
        "date_validation": "2026-08-12",
        "localite": "Betioky",
    }
    resp = await client.post("/traitements", json=payload, headers=auth_headers)
    assert resp.status_code == 422


@pytest.fixture
def payload_produit(pesticide):
    produit_id = str(pesticide.id)

    def _build(**overrides):
        payload = {"produit_id": produit_id, "quantite_l": 10.0}
        payload.update(overrides)
        return payload

    return _build


async def _creer_traitement_terrestre(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement_terrestre
):
    prospection_id = await _creer_prospection(db_session, campagne_id, utilisateur)
    resp = await client.post(
        "/traitements", json=payload_traitement_terrestre(prospection_id), headers=auth_headers
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_add_produit_recalcule_total(
    client,
    auth_headers,
    db_session,
    campagne_id,
    utilisateur,
    payload_traitement_terrestre,
    payload_produit,
):
    traitement_id = await _creer_traitement_terrestre(
        client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement_terrestre
    )
    resp = await client.post(
        f"/traitements/{traitement_id}/produits",
        json=payload_produit(),
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["terrestre"]["total_pesticide_l"] == 10.0
    assert len(body["terrestre"]["produits"]) == 1
    assert body["terrestre"]["produits"][0]["numero"] == 1


@pytest.mark.asyncio
async def test_ajout_trois_produits_recalcule_total(
    client,
    auth_headers,
    db_session,
    campagne_id,
    utilisateur,
    payload_traitement_terrestre,
    payload_produit,
):
    traitement_id = await _creer_traitement_terrestre(
        client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement_terrestre
    )
    for quantite in (10.0, 15.5, 8.25):
        resp = await client.post(
            f"/traitements/{traitement_id}/produits",
            json=payload_produit(quantite_l=quantite),
            headers=auth_headers,
        )
        assert resp.status_code == 201, resp.text

    final = await client.get(f"/traitements/{traitement_id}", headers=auth_headers)
    assert final.status_code == 200
    terrestre = final.json()["terrestre"]
    assert len(terrestre["produits"]) == 3
    assert terrestre["total_pesticide_l"] == 33.75


@pytest.mark.asyncio
async def test_delete_produit_recalcule_total(
    client,
    auth_headers,
    db_session,
    campagne_id,
    utilisateur,
    payload_traitement_terrestre,
    payload_produit,
):
    traitement_id = await _creer_traitement_terrestre(
        client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement_terrestre
    )
    r1 = await client.post(
        f"/traitements/{traitement_id}/produits",
        json=payload_produit(quantite_l=10.0),
        headers=auth_headers,
    )
    r2 = await client.post(
        f"/traitements/{traitement_id}/produits",
        json=payload_produit(quantite_l=5.0),
        headers=auth_headers,
    )
    produit_id_1 = r1.json()["terrestre"]["produits"][0]["id"]

    resp = await client.delete(
        f"/traitements/{traitement_id}/produits/{produit_id_1}", headers=auth_headers
    )
    assert resp.status_code == 200, resp.text
    terrestre = resp.json()["terrestre"]
    assert len(terrestre["produits"]) == 1
    assert terrestre["total_pesticide_l"] == 5.0
    assert r2.status_code == 201


@pytest.mark.asyncio
async def test_delete_dernier_produit_repasse_total_a_none(
    client,
    auth_headers,
    db_session,
    campagne_id,
    utilisateur,
    payload_traitement_terrestre,
    payload_produit,
):
    traitement_id = await _creer_traitement_terrestre(
        client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement_terrestre
    )
    created = await client.post(
        f"/traitements/{traitement_id}/produits",
        json=payload_produit(),
        headers=auth_headers,
    )
    produit_id = created.json()["terrestre"]["produits"][0]["id"]

    resp = await client.delete(
        f"/traitements/{traitement_id}/produits/{produit_id}", headers=auth_headers
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["terrestre"]["total_pesticide_l"] is None
    assert resp.json()["terrestre"]["produits"] == []


@pytest.mark.asyncio
async def test_add_produit_traitement_inexistant_404(
    client, auth_headers, payload_produit, db_engine
):
    resp = await client.post(
        f"/traitements/{uuid.uuid4()}/produits", json=payload_produit(), headers=auth_headers
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_add_produit_traitement_aerien_404(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement, payload_produit
):
    traitement_id = await _creer_traitement(
        client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement
    )
    resp = await client.post(
        f"/traitements/{traitement_id}/produits",
        json=payload_produit(),
        headers=auth_headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_produit_inexistant_404(
    client,
    auth_headers,
    db_session,
    campagne_id,
    utilisateur,
    payload_traitement_terrestre,
):
    traitement_id = await _creer_traitement_terrestre(
        client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement_terrestre
    )
    resp = await client.delete(
        f"/traitements/{traitement_id}/produits/{uuid.uuid4()}", headers=auth_headers
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_produit_dun_autre_traitement_404(
    client,
    auth_headers,
    db_session,
    campagne_id,
    utilisateur,
    payload_traitement_terrestre,
    payload_produit,
):
    traitement_1 = await _creer_traitement_terrestre(
        client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement_terrestre
    )
    traitement_2 = await _creer_traitement_terrestre(
        client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement_terrestre
    )
    created = await client.post(
        f"/traitements/{traitement_1}/produits", json=payload_produit(), headers=auth_headers
    )
    produit_id = created.json()["terrestre"]["produits"][0]["id"]

    resp = await client.delete(
        f"/traitements/{traitement_2}/produits/{produit_id}", headers=auth_headers
    )
    assert resp.status_code == 404

    verif = await client.get(f"/traitements/{traitement_1}", headers=auth_headers)
    assert len(verif.json()["terrestre"]["produits"]) == 1


async def _creer_fiche_terrestre_chainee(
    client,
    auth_headers,
    base_payload: dict,
    *,
    surface_atomiseur_ha: float,
    traitement_origine_id=None,
):
    """Fixture-factory : crée un maillon de la chaîne de reprise (racine ou reprise).

    `base_payload` est cloné à chaque appel — évite de rappeler la fixture
    `payload_traitement_terrestre` (donc de relire `chef_equipe.id`) à chaque maillon.
    """
    payload = copy.deepcopy(base_payload)
    payload["terrestre"]["surface_atomiseur_ha"] = surface_atomiseur_ha
    payload["terrestre"]["surface_restante_abandonnee"] = False
    if traitement_origine_id is not None:
        payload["terrestre"]["reprise_traitement"] = True
        payload["terrestre"]["traitement_origine_id"] = str(traitement_origine_id)
    resp = await client.post("/traitements", json=payload, headers=auth_headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.mark.asyncio
async def test_reprise_chaine_a_plusieurs_maillons(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement_terrestre
):
    """CDG §9 : chaque maillon reprend surface_cumulee_ha du précédent, sur un seul niveau."""
    prospection_id = await _creer_prospection(
        db_session, campagne_id, utilisateur, surf_infestee=200.0
    )
    base_payload = payload_traitement_terrestre(prospection_id)

    maillon_1 = await _creer_fiche_terrestre_chainee(
        client,
        auth_headers,
        base_payload,
        surface_atomiseur_ha=30.0,
    )
    assert maillon_1["terrestre"]["surface_cumulee_ha"] == 30.0

    maillon_2 = await _creer_fiche_terrestre_chainee(
        client,
        auth_headers,
        base_payload,
        surface_atomiseur_ha=20.0,
        traitement_origine_id=maillon_1["id"],
    )
    assert maillon_2["terrestre"]["surface_cumulee_ha"] == 50.0
    assert maillon_2["terrestre"]["reprise_traitement"] is True
    assert maillon_2["terrestre"]["traitement_origine_id"] == maillon_1["id"]

    maillon_3 = await _creer_fiche_terrestre_chainee(
        client,
        auth_headers,
        base_payload,
        surface_atomiseur_ha=25.0,
        traitement_origine_id=maillon_2["id"],
    )
    assert maillon_3["terrestre"]["surface_cumulee_ha"] == 75.0
    assert maillon_3["terrestre"]["surface_restante_ha"] == 125.0


@pytest.mark.asyncio
async def test_reprise_origine_deja_utilisee_409(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement_terrestre
):
    prospection_id = await _creer_prospection(
        db_session, campagne_id, utilisateur, surf_infestee=200.0
    )
    base_payload = payload_traitement_terrestre(prospection_id)

    maillon_1 = await _creer_fiche_terrestre_chainee(
        client,
        auth_headers,
        base_payload,
        surface_atomiseur_ha=30.0,
    )
    await _creer_fiche_terrestre_chainee(
        client,
        auth_headers,
        base_payload,
        surface_atomiseur_ha=20.0,
        traitement_origine_id=maillon_1["id"],
    )

    payload = copy.deepcopy(base_payload)
    payload["terrestre"]["surface_atomiseur_ha"] = 15.0
    payload["terrestre"]["surface_restante_abandonnee"] = False
    payload["terrestre"]["reprise_traitement"] = True
    payload["terrestre"]["traitement_origine_id"] = maillon_1["id"]
    resp = await client.post("/traitements", json=payload, headers=auth_headers)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_reprise_origine_introuvable_404(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement_terrestre
):
    prospection_id = await _creer_prospection(db_session, campagne_id, utilisateur)
    payload = payload_traitement_terrestre(prospection_id)
    payload["terrestre"]["reprise_traitement"] = True
    payload["terrestre"]["traitement_origine_id"] = str(uuid.uuid4())
    resp = await client.post("/traitements", json=payload, headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_reprise_traitement_sans_origine_id_422(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement_terrestre
):
    prospection_id = await _creer_prospection(db_session, campagne_id, utilisateur)
    payload = payload_traitement_terrestre(prospection_id)
    payload["terrestre"]["reprise_traitement"] = True
    resp = await client.post("/traitements", json=payload, headers=auth_headers)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_list_traitements_reprenable_exclut_origine_deja_utilisee_et_surface_epuisee(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement_terrestre
):
    prospection_id = await _creer_prospection(
        db_session, campagne_id, utilisateur, surf_infestee=100.0
    )
    base_payload = payload_traitement_terrestre(prospection_id)

    # racine déjà utilisée comme origine par un autre maillon -> exclue, même si sa
    # propre surface_restante_ha > 0
    origine_utilisee = await _creer_fiche_terrestre_chainee(
        client,
        auth_headers,
        base_payload,
        surface_atomiseur_ha=10.0,
    )
    # cette reprise n'est elle-même l'origine de personne -> reste reprenable
    maillon_reprenable = await _creer_fiche_terrestre_chainee(
        client,
        auth_headers,
        base_payload,
        surface_atomiseur_ha=10.0,
        traitement_origine_id=origine_utilisee["id"],
    )
    # fiche à surface_restante_ha = 0 -> exclue
    epuisee = await _creer_fiche_terrestre_chainee(
        client,
        auth_headers,
        base_payload,
        surface_atomiseur_ha=100.0,
    )
    assert epuisee["terrestre"]["surface_restante_ha"] == 0.0
    # fiche indépendante encore reprenable
    reprenable = await _creer_fiche_terrestre_chainee(
        client,
        auth_headers,
        base_payload,
        surface_atomiseur_ha=5.0,
    )

    resp = await client.get(
        "/traitements",
        params={"type_traitement": "TERRESTRE", "reprenable": "true"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    ids = {t["id"] for t in resp.json()}
    assert ids == {maillon_reprenable["id"], reprenable["id"]}


@pytest.mark.asyncio
async def test_list_traitements_filtre_chef_equipe_id(
    client,
    auth_headers,
    db_session,
    campagne_id,
    utilisateur,
    payload_traitement_terrestre,
    chef_equipe,
):
    prospection_id = await _creer_prospection(db_session, campagne_id, utilisateur)
    base_payload = payload_traitement_terrestre(prospection_id)
    await _creer_fiche_terrestre_chainee(
        client, auth_headers, base_payload, surface_atomiseur_ha=1.0
    )

    resp = await client.get(
        "/traitements", params={"chef_equipe_id": str(chef_equipe.id)}, headers=auth_headers
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 1


@pytest.mark.asyncio
async def test_get_traitement_terrestre(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement_terrestre
):
    prospection_id = await _creer_prospection(
        db_session, campagne_id, utilisateur, surf_infestee=50.0
    )
    payload = payload_traitement_terrestre(prospection_id)
    payload["terrestre"]["surface_restante_abandonnee"] = True
    created = await client.post("/traitements", json=payload, headers=auth_headers)
    traitement_id = created.json()["id"]

    resp = await client.get(f"/traitements/{traitement_id}", headers=auth_headers)
    assert resp.status_code == 200
    terrestre = resp.json()["terrestre"]
    assert terrestre["heure_debut"] == "06:00:00"
    assert terrestre["heure_fin"] == "09:00:00"
    assert terrestre["surface_traitee_ha"] == 0.0
    assert terrestre["surface_restante_ha"] == 50.0
