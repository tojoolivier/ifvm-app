import copy
import uuid
from datetime import date, datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.prospection_model import ProspectionModel, ProspectionPopulationModel


@pytest.fixture
def payload_traitement(chef_de_base, pilote, mecanicien):
    def _build(prospection_id, **overrides):
        payload = {
            "prospection_id": str(prospection_id),
            "date_traitement": "2026-08-11",
            "date_validation": "2026-08-10",
            "localite": "Betioky",
            "aerien": {
                "pilote": f"{pilote.prenom} {pilote.nom}",
                "mecanicien": f"{mecanicien.prenom} {mecanicien.nom}",
                "chef_de_base_id": str(chef_de_base.id),
                # Texte libre (#traitement-aerien-base-texte-libre) — une valeur
                # absente du référentiel lieu_aerien doit être acceptée telle
                # quelle, jamais résolue/validée contre celui-ci.
                "base_principale": "Base Betioky",
                "immatricule_aeronef": "5R-ABC",
            },
        }
        payload.update(overrides)
        return payload

    return _build


async def _creer_prospection(
    db_session: AsyncSession,
    campagne_id,
    utilisateur,
    surface_infestee=None,
    populations=(),
    type_prospection="extensive",
    n_fiche=None,
) -> uuid.UUID:
    p = ProspectionModel(
        id=uuid.uuid4(),
        type_prospection=type_prospection,
        campagne_id=campagne_id,
        prospecteur_id=utilisateur.id,
        date_prospection=date(2026, 8, 1),
        surface_infestee=surface_infestee,
        n_fiche=n_fiche,
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
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement, pilote
):
    prospection_id = await _creer_prospection(
        db_session,
        campagne_id,
        utilisateur,
        surface_infestee=120.5,
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
    assert body["aerien"]["pilote"] == f"{pilote.prenom} {pilote.nom}"
    assert body["observations"] is None


@pytest.mark.asyncio
async def test_traitement_aerien_stand_et_base_secondaire_avec_date_installation(
    client, auth_headers, db_session, campagne_id, utilisateur, chef_de_base, pilote, mecanicien
):
    """#stand-base-secondaire-date-installation : Stand/Base secondaire restent
    du texte libre, la date d'installation de chacun est facultative et
    independante — aucun champ equivalent pour base_principale."""
    prospection_id = await _creer_prospection(db_session, campagne_id, utilisateur)
    resp = await client.post(
        "/traitements",
        json={
            "prospection_id": str(prospection_id),
            "date_traitement": "2026-08-11",
            "date_validation": "2026-08-10",
            "localite": "Betioky",
            "aerien": {
                "pilote": f"{pilote.prenom} {pilote.nom}",
                "mecanicien": f"{mecanicien.prenom} {mecanicien.nom}",
                "chef_de_base_id": str(chef_de_base.id),
                "base_principale": "Base Betioky",
                "stand": "Stand Ihosy",
                "stand_date_installation": "2026-07-01",
                "base_secondaire": "Base Ambovombe",
                "base_secondaire_date_installation": "2026-07-15",
                "immatricule_aeronef": "5R-ABC",
            },
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    aerien = resp.json()["aerien"]
    assert aerien["stand"] == "Stand Ihosy"
    assert aerien["stand_date_installation"] == "2026-07-01"
    assert aerien["base_secondaire"] == "Base Ambovombe"
    assert aerien["base_secondaire_date_installation"] == "2026-07-15"

    # Persistance après réouverture.
    relu = await client.get(f"/traitements/{resp.json()['id']}", headers=auth_headers)
    assert relu.json()["aerien"]["stand_date_installation"] == "2026-07-01"
    assert relu.json()["aerien"]["base_secondaire_date_installation"] == "2026-07-15"


@pytest.mark.asyncio
async def test_traitement_aerien_stand_et_base_secondaire_dates_facultatives(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement
):
    """Stand/Base secondaire et leurs dates sont facultatifs, indépendamment les
    uns des autres — aucun des quatre cas ne bloque l'enregistrement."""
    prospection_id = await _creer_prospection(db_session, campagne_id, utilisateur)
    resp = await client.post(
        "/traitements", json=payload_traitement(prospection_id), headers=auth_headers
    )
    assert resp.status_code == 201, resp.text
    aerien = resp.json()["aerien"]
    assert aerien["stand"] is None
    assert aerien["stand_date_installation"] is None
    assert aerien["base_secondaire"] is None
    assert aerien["base_secondaire_date_installation"] is None


@pytest.mark.asyncio
async def test_traitement_aerien_expose_le_numero_de_fiche_prospection_liee(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement, payload_rotation
):
    """#numero-fiche-prospection-liee : le champ est dérivé automatiquement de
    prospection_id (jamais saisi, jamais une seconde relation) et survit à une
    modification du traitement (ici : ajout d'une rotation)."""
    prospection_id = await _creer_prospection(
        db_session, campagne_id, utilisateur, type_prospection="intensive", n_fiche="EXT-2026-00125"
    )
    resp = await client.post(
        "/traitements", json=payload_traitement(prospection_id), headers=auth_headers
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["prospection_n_fiche"] == "EXT-2026-00125"

    # Persistance après reouverture (GET).
    relu = await client.get(f"/traitements/{body['id']}", headers=auth_headers)
    assert relu.json()["prospection_n_fiche"] == "EXT-2026-00125"

    # Une modification du traitement (ajout d'une rotation) ne change jamais
    # le numéro de la fiche de prospection liée.
    modifie = await client.post(
        f"/traitements/{body['id']}/rotations",
        json=payload_rotation(),
        headers=auth_headers,
    )
    assert modifie.status_code == 201, modifie.text
    assert modifie.json()["prospection_n_fiche"] == "EXT-2026-00125"


@pytest.mark.asyncio
async def test_traitement_terrestre_expose_le_numero_de_fiche_prospection_liee(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement_terrestre
):
    prospection_id = await _creer_prospection(
        db_session, campagne_id, utilisateur, type_prospection="extensive", n_fiche="EXT-2026-00126"
    )
    resp = await client.post(
        "/traitements", json=payload_traitement_terrestre(prospection_id), headers=auth_headers
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["prospection_n_fiche"] == "EXT-2026-00126"


@pytest.mark.asyncio
async def test_traitement_depuis_signalement_expose_le_meme_numero_que_le_message(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement_terrestre
):
    """Cas particulier (#signalements-treatment-ready) : une fiche de
    Validation/Signalisation a déjà son n_fiche aligné sur n_message dès sa
    création — le traitement doit reprendre exactement cette même valeur."""
    prospection_id = await _creer_prospection(
        db_session,
        campagne_id,
        utilisateur,
        type_prospection="validation",
        n_fiche="SIG-2026-00045",
    )
    resp = await client.post(
        "/traitements", json=payload_traitement_terrestre(prospection_id), headers=auth_headers
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["prospection_n_fiche"] == "SIG-2026-00045"


@pytest.mark.asyncio
async def test_traitement_aerien_conserve_plusieurs_evaluations_risque_population(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement
):
    """#evaluation-risque-population : liste dynamique ("+"), commune à Aérien et
    Terrestre, conservée avec son ordre après création et relecture."""
    prospection_id = await _creer_prospection(db_session, campagne_id, utilisateur)
    resp = await client.post(
        "/traitements",
        json=payload_traitement(
            prospection_id,
            evaluations_risque_population=[
                {
                    "habitat_proche": "Rizière communale",
                    "distance_km": 1.5,
                    "sensibilisation": True,
                },
                {
                    "habitat_proche": "Zone humide protégée",
                    "distance_km": 0.8,
                    "sensibilisation": False,
                },
            ],
        ),
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    evaluations = body["evaluations_risque_population"]
    assert len(evaluations) == 2
    assert evaluations[0]["ordre"] == 0
    assert evaluations[0]["habitat_proche"] == "Rizière communale"
    assert evaluations[0]["distance_km"] == 1.5
    assert evaluations[0]["sensibilisation"] is True
    assert evaluations[1]["ordre"] == 1
    assert evaluations[1]["habitat_proche"] == "Zone humide protégée"
    assert evaluations[1]["sensibilisation"] is False

    # Persistance après réouverture (GET), ordre conservé.
    relu = await client.get(f"/traitements/{body['id']}", headers=auth_headers)
    assert [e["habitat_proche"] for e in relu.json()["evaluations_risque_population"]] == [
        "Rizière communale",
        "Zone humide protégée",
    ]


@pytest.mark.asyncio
async def test_traitement_terrestre_accepte_une_seule_evaluation_risque_population(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement_terrestre
):
    prospection_id = await _creer_prospection(db_session, campagne_id, utilisateur)
    resp = await client.post(
        "/traitements",
        json=payload_traitement_terrestre(
            prospection_id,
            evaluations_risque_population=[
                {"habitat_proche": "Forêt classée", "distance_km": 2.0, "sensibilisation": True}
            ],
        ),
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    evaluations = resp.json()["evaluations_risque_population"]
    assert len(evaluations) == 1
    assert evaluations[0]["habitat_proche"] == "Forêt classée"
    assert evaluations[0]["distance_km"] == 2.0


@pytest.mark.asyncio
async def test_traitement_sans_evaluation_risque_population_renvoie_liste_vide(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement
):
    """Section facultative — aucune évaluation ajoutée ne bloque jamais l'enregistrement."""
    prospection_id = await _creer_prospection(db_session, campagne_id, utilisateur)
    resp = await client.post(
        "/traitements", json=payload_traitement(prospection_id), headers=auth_headers
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["evaluations_risque_population"] == []


@pytest.mark.asyncio
async def test_create_traitement_avec_observations(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement
):
    prospection_id = await _creer_prospection(db_session, campagne_id, utilisateur)
    resp = await client.post(
        "/traitements",
        json=payload_traitement(prospection_id, observations="RAS, vent calme toute la matinée"),
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["observations"] == "RAS, vent calme toute la matinée"

    get_resp = await client.get(f"/traitements/{body['id']}", headers=auth_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["observations"] == "RAS, vent calme toute la matinée"


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
async def test_create_rejette_pilote_identique_au_chef_de_base_422(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement
):
    prospection_id = await _creer_prospection(db_session, campagne_id, utilisateur)
    payload = payload_traitement(prospection_id)
    payload["aerien"]["pilote"] = "Hery Andria"  # même nom que chef_de_base (fixture)
    resp = await client.post("/traitements", json=payload, headers=auth_headers)
    assert resp.status_code == 422
    assert "Cette personne est déjà affectée à un autre rôle" in resp.json()["detail"]


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
        # numero_cuve n'y figure pas : dérivé côté serveur de `numero` (migration
        # 0047), plus un champ accepté par RotationCreate.
        payload = {
            "produit_id": produit_id,
            "quantite": 10.0,
            "unite": "L",
            "surface_ha": 5.0,
            "temperature_debut_c": 25.0,
            "temperature_fin_c": 27.0,
            "vent_debut_ms": 2.0,
            "vent_fin_ms": 3.0,
            "heure_debut": "06:00:00",
            "heure_ouverture_vanne": "06:05:00",
            "heure_fermeture_vanne": "06:20:00",
            "heure_fin": "06:30:00",
            "nom_commercial": "Fyfanon",
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
    # #produit-nom-commercial : dérivé côté client (texte avant le premier
    # chiffre du nom du pesticide), le backend le persiste tel quel.
    assert body["aerien"]["rotations"][0]["nom_commercial"] == "Fyfanon"
    # surface_traitee_ha n'est plus une saisie directe (migration 0046) : dérivée de la
    # somme des surface_ha des rotations.
    assert body["aerien"]["surface_traitee_ha"] == 5.0


@pytest.mark.asyncio
async def test_add_rotation_rejette_surface_qui_depasse_linfestee_422(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement, payload_rotation
):
    """§3/§12 (refonte surfaces) : c'est ici, à l'ajout d'une rotation (seul point
    d'écriture réel de surface_traitee_ha côté Aérien), que le plafond se vérifie —
    422 avec la surface restante réelle dans le message, pas un plancher silencieux."""
    prospection_id = await _creer_prospection(
        db_session, campagne_id, utilisateur, surface_infestee=3.0
    )
    resp_creation = await client.post(
        "/traitements", json=payload_traitement(prospection_id), headers=auth_headers
    )
    assert resp_creation.status_code == 201, resp_creation.text
    traitement_id = resp_creation.json()["id"]

    resp = await client.post(
        f"/traitements/{traitement_id}/rotations",
        json=payload_rotation(surface_ha=5.0),
        headers=auth_headers,
    )
    assert resp.status_code == 422, resp.text
    assert "3" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_create_traitement_aerien_rejette_prospection_deja_entierement_traitee_422(
    client,
    auth_headers,
    db_session,
    campagne_id,
    utilisateur,
    payload_traitement,
    payload_traitement_terrestre,
):
    """§6/§12 : une fiche Aérien fraîche (0 rotation) ne peut pas non plus être créée
    sur une prospection dont une AUTRE fiche (Terrestre ici — tous types confondus,
    §8) a déjà couvert toute la surface infestée.

    Les deux payloads sont construits d'affilée, AVANT toute requête HTTP
    (MissingGreenlet sinon — cf. commentaire de test_list_traitements_reprenable_
    exclut_origine_deja_utilisee_et_surface_epuisee)."""
    prospection_id = await _creer_prospection(
        db_session, campagne_id, utilisateur, surface_infestee=10.0
    )
    premiere = payload_traitement_terrestre(prospection_id)
    deuxieme = payload_traitement(prospection_id)
    premiere["terrestre"]["surface_atomiseur_ha"] = 10.0
    premiere["terrestre"]["surface_restante_abandonnee"] = False
    resp1 = await client.post("/traitements", json=premiere, headers=auth_headers)
    assert resp1.status_code == 201, resp1.text

    resp2 = await client.post("/traitements", json=deuxieme, headers=auth_headers)
    assert resp2.status_code == 422, resp2.text


@pytest.mark.asyncio
async def test_add_rotation_numero_cuve_toujours_derive(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement, payload_rotation
):
    """Migration 0047 : numero_cuve est toujours dérivé de numero (str(numero)),
    jamais un champ accepté en entrée — même envoyé, il est ignoré."""
    traitement_id = await _creer_traitement(
        client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement
    )
    r1 = await client.post(
        f"/traitements/{traitement_id}/rotations",
        json={**payload_rotation(), "numero_cuve": "AUTRE"},
        headers=auth_headers,
    )
    r2 = await client.post(
        f"/traitements/{traitement_id}/rotations",
        json=payload_rotation(),
        headers=auth_headers,
    )
    assert r1.status_code == 201, r1.text
    assert r2.status_code == 201, r2.text
    numeros_cuve = [r["numero_cuve"] for r in r2.json()["aerien"]["rotations"]]
    assert numeros_cuve == ["1", "2"]


@pytest.mark.asyncio
async def test_add_rotation_cumuls_separes_par_unite(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement, payload_rotation
):
    """Critère d'acceptation : une rotation dosée au litre et une au kg ne se
    mélangent jamais dans le même total."""
    traitement_id = await _creer_traitement(
        client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement
    )
    await client.post(
        f"/traitements/{traitement_id}/rotations",
        json=payload_rotation(quantite=10.0, unite="L"),
        headers=auth_headers,
    )
    resp = await client.post(
        f"/traitements/{traitement_id}/rotations",
        json=payload_rotation(quantite=4.0, unite="kg"),
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    aerien = resp.json()["aerien"]
    assert aerien["total_pesticide_l"] == 10.0
    assert aerien["total_pesticide_kg"] == 4.0


@pytest.mark.asyncio
async def test_add_rotation_heure_fermeture_vanne_anterieure_422(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement, payload_rotation
):
    traitement_id = await _creer_traitement(
        client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement
    )
    resp = await client.post(
        f"/traitements/{traitement_id}/rotations",
        json=payload_rotation(heure_ouverture_vanne="06:20:00", heure_fermeture_vanne="06:10:00"),
        headers=auth_headers,
    )
    assert resp.status_code == 422, resp.text


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
            json=payload_rotation(quantite=quantite),
            headers=auth_headers,
        )
        assert resp.status_code == 201, resp.text

    final = await client.get(f"/traitements/{traitement_id}", headers=auth_headers)
    assert final.status_code == 200
    aerien = final.json()["aerien"]
    assert aerien["nb_rotations"] == 3
    assert aerien["total_pesticide_l"] == 33.75
    # Chaque rotation du fixture porte surface_ha=5.0 par défaut : 3 x 5.0 = 15.0.
    assert aerien["surface_traitee_ha"] == 15.0


@pytest.mark.asyncio
async def test_update_rotation_recalcule_totaux(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement, payload_rotation
):
    traitement_id = await _creer_traitement(
        client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement
    )
    created = await client.post(
        f"/traitements/{traitement_id}/rotations",
        json=payload_rotation(quantite=10.0),
        headers=auth_headers,
    )
    rotation_id = created.json()["aerien"]["rotations"][0]["id"]

    resp = await client.put(
        f"/traitements/{traitement_id}/rotations/{rotation_id}",
        json=payload_rotation(quantite=20.0, nom_commercial="Nurelle"),
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    aerien = resp.json()["aerien"]
    assert aerien["nb_rotations"] == 1
    assert aerien["total_pesticide_l"] == 20.0
    # #produit-nom-commercial : bien mis à jour, pas seulement conservé.
    assert aerien["rotations"][0]["nom_commercial"] == "Nurelle"


@pytest.mark.asyncio
async def test_delete_rotation_recalcule_totaux(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement, payload_rotation
):
    traitement_id = await _creer_traitement(
        client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement
    )
    r1 = await client.post(
        f"/traitements/{traitement_id}/rotations",
        json=payload_rotation(quantite=10.0),
        headers=auth_headers,
    )
    r2 = await client.post(
        f"/traitements/{traitement_id}/rotations",
        json=payload_rotation(quantite=5.0),
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
            "date_validation": "2026-08-10",
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
        surface_infestee=100.0,
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
    """Critère d'acceptation CDG §9 : surface_restante_ha ne descend jamais sous 0 —
    exercé ici à l'égalité exacte (10 traités == 10 infestés), le seul cas qui atteint
    encore ce plancher sans déclencher le rejet ajouté par la refonte surfaces (§3/§12,
    cf. test_create_traitement_terrestre_rejette_surface_qui_depasse_linfestee_422)."""
    prospection_id = await _creer_prospection(
        db_session, campagne_id, utilisateur, surface_infestee=10.0
    )
    payload = payload_traitement_terrestre(prospection_id)
    payload["terrestre"]["surface_atomiseur_ha"] = 10.0
    payload["terrestre"]["surface_restante_abandonnee"] = False

    resp = await client.post("/traitements", json=payload, headers=auth_headers)
    assert resp.status_code == 201, resp.text
    terrestre = resp.json()["terrestre"]
    assert terrestre["surface_traitee_ha"] == 10.0
    assert terrestre["surface_restante_ha"] == 0.0


@pytest.mark.asyncio
async def test_create_traitement_terrestre_rejette_surface_qui_depasse_linfestee_422(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement_terrestre
):
    """§3/§12 (refonte surfaces) : une surface saisie qui dépasserait la surface
    infestée est rejetée (422, message nommant la surface restante réelle) plutôt que
    silencieusement plafonnée à 0 comme avant."""
    prospection_id = await _creer_prospection(
        db_session, campagne_id, utilisateur, surface_infestee=10.0
    )
    payload = payload_traitement_terrestre(prospection_id)
    payload["terrestre"]["surface_atomiseur_ha"] = 25.0
    payload["terrestre"]["surface_restante_abandonnee"] = False

    resp = await client.post("/traitements", json=payload, headers=auth_headers)
    assert resp.status_code == 422, resp.text
    assert "10" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_create_traitement_terrestre_rejette_en_tenant_compte_dune_autre_fiche_deja_liee_422(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement_terrestre
):
    """§8/§12 : le plafond tient compte de TOUTES les fiches déjà liées à la même
    prospection, pas seulement d'une chaîne de reprise explicite — une deuxième fiche
    indépendante ne peut pas faire dépasser la surface infestée.

    `deuxieme` est un `copy.deepcopy` de `premiere` (même prospection_id) plutôt
    qu'un second appel à `payload_traitement_terrestre` : ce dernier relit
    `chef_equipe.id`, un objet ORM chargé sur `db_session` — un second accès après
    une requête HTTP intercalée déclenche un rechargement paresseux hors contexte
    greenlet (`MissingGreenlet`, cf. commentaire de test_list_traitements_
    reprenable_exclut_origine_deja_utilisee_et_surface_epuisee)."""
    prospection_id = await _creer_prospection(
        db_session, campagne_id, utilisateur, surface_infestee=10.0
    )
    premiere = payload_traitement_terrestre(prospection_id)
    deuxieme = copy.deepcopy(premiere)
    premiere["terrestre"]["surface_atomiseur_ha"] = 7.0
    premiere["terrestre"]["surface_restante_abandonnee"] = True
    premiere["terrestre"]["motif_surface_restante_abandonnee"] = "reprise ultérieure"
    resp1 = await client.post("/traitements", json=premiere, headers=auth_headers)
    assert resp1.status_code == 201, resp1.text

    deuxieme["terrestre"]["surface_atomiseur_ha"] = 5.0
    deuxieme["terrestre"]["surface_restante_abandonnee"] = False
    resp2 = await client.post("/traitements", json=deuxieme, headers=auth_headers)
    assert resp2.status_code == 422, resp2.text
    assert "3" in resp2.json()["detail"]


@pytest.mark.asyncio
async def test_create_traitement_terrestre_surface_restante_positive_sans_abandonnee_422(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement_terrestre
):
    prospection_id = await _creer_prospection(
        db_session, campagne_id, utilisateur, surface_infestee=100.0
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
        "date_validation": "2026-08-10",
        "localite": "Betioky",
    }
    resp = await client.post("/traitements", json=payload, headers=auth_headers)
    assert resp.status_code == 422


@pytest.fixture
def payload_produit(pesticide):
    produit_id = str(pesticide.id)

    def _build(**overrides):
        payload = {"produit_id": produit_id, "quantite_l": 10.0, "nom_commercial": "Fyfanon"}
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
    # #produit-nom-commercial : dérivé côté client, le backend le persiste tel quel.
    assert body["terrestre"]["produits"][0]["nom_commercial"] == "Fyfanon"


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
        db_session, campagne_id, utilisateur, surface_infestee=200.0
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
        db_session, campagne_id, utilisateur, surface_infestee=200.0
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
    """Trois prospections distinctes (une par scénario) plutôt qu'une seule partagée :
    depuis la refonte surfaces (§8/§12), la somme des fiches liées à UNE MÊME
    prospection est plafonnée à sa surface infestée — les combiner sur une seule
    aurait fait dépasser 100 ha (10+10+100+5) et échoué à la création, pour une
    raison sans rapport avec ce que ce test vérifie (la logique de listage
    « reprenable », pas la cohérence des surfaces entre elles).

    `payload_traitement_terrestre(...)` n'est appelé qu'UNE SEULE fois (les deux
    autres payloads en sont des `copy.deepcopy`, prospection_id substitué) : cette
    fixture relit `chef_equipe.id`, un objet ORM chargé sur `db_session` — un
    second accès après une requête HTTP intercalée déclenche un rechargement
    paresseux hors contexte greenlet (`MissingGreenlet`)."""
    prospection_chaine_id = await _creer_prospection(
        db_session, campagne_id, utilisateur, surface_infestee=100.0
    )
    prospection_epuisee_id = await _creer_prospection(
        db_session, campagne_id, utilisateur, surface_infestee=100.0
    )
    prospection_reprenable_id = await _creer_prospection(
        db_session, campagne_id, utilisateur, surface_infestee=100.0
    )
    base_payload_chaine = payload_traitement_terrestre(prospection_chaine_id)
    base_payload_epuisee = copy.deepcopy(base_payload_chaine)
    base_payload_epuisee["prospection_id"] = str(prospection_epuisee_id)
    base_payload_reprenable = copy.deepcopy(base_payload_chaine)
    base_payload_reprenable["prospection_id"] = str(prospection_reprenable_id)

    # racine déjà utilisée comme origine par un autre maillon -> exclue, même si sa
    # propre surface_restante_ha > 0
    origine_utilisee = await _creer_fiche_terrestre_chainee(
        client,
        auth_headers,
        base_payload_chaine,
        surface_atomiseur_ha=10.0,
    )
    # cette reprise n'est elle-même l'origine de personne -> reste reprenable
    maillon_reprenable = await _creer_fiche_terrestre_chainee(
        client,
        auth_headers,
        base_payload_chaine,
        surface_atomiseur_ha=10.0,
        traitement_origine_id=origine_utilisee["id"],
    )

    # fiche à surface_restante_ha = 0 -> exclue (prospection dédiée : consomme à
    # elle seule toute la surface infestée).
    epuisee = await _creer_fiche_terrestre_chainee(
        client,
        auth_headers,
        base_payload_epuisee,
        surface_atomiseur_ha=100.0,
    )
    assert epuisee["terrestre"]["surface_restante_ha"] == 0.0

    # fiche indépendante encore reprenable (prospection dédiée elle aussi).
    reprenable = await _creer_fiche_terrestre_chainee(
        client,
        auth_headers,
        base_payload_reprenable,
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


async def _creer_fiche_aerien_chainee(
    client,
    auth_headers,
    base_payload: dict,
    payload_rotation,
    *,
    surface_ha: float,
    traitement_origine_id=None,
):
    """Mirroir de `_creer_fiche_terrestre_chainee` (migration 0050) : le chaînage de
    reprise est désormais aussi disponible côté Aérien. `surface_traitee_ha` n'étant
    pas une saisie directe côté Aérien (contrairement à `surface_atomiseur_ha` en
    Terrestre), une rotation est ajoutée après coup pour porter `surface_ha`."""
    payload = copy.deepcopy(base_payload)
    if traitement_origine_id is not None:
        payload["aerien"]["reprise_traitement"] = True
        payload["aerien"]["traitement_origine_id"] = str(traitement_origine_id)
    resp = await client.post("/traitements", json=payload, headers=auth_headers)
    assert resp.status_code == 201, resp.text
    traitement_id = resp.json()["id"]

    rot_resp = await client.post(
        f"/traitements/{traitement_id}/rotations",
        json=payload_rotation(surface_ha=surface_ha),
        headers=auth_headers,
    )
    assert rot_resp.status_code == 201, rot_resp.text
    return rot_resp.json()


@pytest.mark.asyncio
async def test_reprise_chaine_a_plusieurs_maillons_aerien(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement, payload_rotation
):
    """Mirroir de test_reprise_chaine_a_plusieurs_maillons, côté Aérien (migration 0050) :
    chaque maillon reprend surface_cumulee_ha du précédent, via ses rotations."""
    prospection_id = await _creer_prospection(
        db_session, campagne_id, utilisateur, surface_infestee=200.0
    )
    base_payload = payload_traitement(prospection_id)

    maillon_1 = await _creer_fiche_aerien_chainee(
        client, auth_headers, base_payload, payload_rotation, surface_ha=30.0
    )
    assert maillon_1["aerien"]["surface_cumulee_ha"] == 30.0

    maillon_2 = await _creer_fiche_aerien_chainee(
        client,
        auth_headers,
        base_payload,
        payload_rotation,
        surface_ha=20.0,
        traitement_origine_id=maillon_1["id"],
    )
    assert maillon_2["aerien"]["surface_cumulee_ha"] == 50.0
    assert maillon_2["aerien"]["reprise_traitement"] is True
    assert maillon_2["aerien"]["traitement_origine_id"] == maillon_1["id"]

    maillon_3 = await _creer_fiche_aerien_chainee(
        client,
        auth_headers,
        base_payload,
        payload_rotation,
        surface_ha=25.0,
        traitement_origine_id=maillon_2["id"],
    )
    assert maillon_3["aerien"]["surface_cumulee_ha"] == 75.0
    assert maillon_3["aerien"]["surface_restante_ha"] == 125.0


@pytest.mark.asyncio
async def test_reprise_aerien_origine_deja_utilisee_409(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement, payload_rotation
):
    prospection_id = await _creer_prospection(
        db_session, campagne_id, utilisateur, surface_infestee=200.0
    )
    base_payload = payload_traitement(prospection_id)

    maillon_1 = await _creer_fiche_aerien_chainee(
        client, auth_headers, base_payload, payload_rotation, surface_ha=30.0
    )
    await _creer_fiche_aerien_chainee(
        client,
        auth_headers,
        base_payload,
        payload_rotation,
        surface_ha=20.0,
        traitement_origine_id=maillon_1["id"],
    )

    payload = copy.deepcopy(base_payload)
    payload["aerien"]["reprise_traitement"] = True
    payload["aerien"]["traitement_origine_id"] = maillon_1["id"]
    resp = await client.post("/traitements", json=payload, headers=auth_headers)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_reprise_aerien_origine_introuvable_404(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement
):
    prospection_id = await _creer_prospection(db_session, campagne_id, utilisateur)
    payload = payload_traitement(prospection_id)
    payload["aerien"]["reprise_traitement"] = True
    payload["aerien"]["traitement_origine_id"] = str(uuid.uuid4())
    resp = await client.post("/traitements", json=payload, headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_reprise_aerien_sans_origine_id_422(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement
):
    prospection_id = await _creer_prospection(db_session, campagne_id, utilisateur)
    payload = payload_traitement(prospection_id)
    payload["aerien"]["reprise_traitement"] = True
    resp = await client.post("/traitements", json=payload, headers=auth_headers)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_list_traitements_reprenable_inclut_aerien_sans_filtre_de_type(
    client,
    auth_headers,
    db_session,
    campagne_id,
    utilisateur,
    payload_traitement,
    payload_rotation,
):
    """Migration 0050 : `reprenable=true` sans filtre de type couvre désormais
    aussi l'Aérien (jusqu'ici Terrestre uniquement) — chaque type a sa propre
    chaîne, une fiche épuisée ou déjà désignée comme origine dans SA propre
    chaîne n'affecte pas l'autre type (cf. test_list_traitements_reprenable_
    exclut_origine_deja_utilisee_et_surface_epuisee pour le Terrestre).

    Deux prospections distinctes (une par fiche) — depuis la refonte surfaces
    (§8/§12), les combiner sur une seule aurait fait dépasser sa surface
    infestée (100+5 ha) et échoué à la création, sans rapport avec ce que ce
    test vérifie (la logique de listage « reprenable »).

    `payload_traitement(...)` n'est appelé qu'UNE SEULE fois (le second payload en
    est un `copy.deepcopy`, prospection_id substitué) — cf. commentaire de
    test_list_traitements_reprenable_exclut_origine_deja_utilisee_et_surface_
    epuisee (MissingGreenlet sinon)."""
    prospection_epuisee_id = await _creer_prospection(
        db_session, campagne_id, utilisateur, surface_infestee=100.0
    )
    prospection_reprenable_id = await _creer_prospection(
        db_session, campagne_id, utilisateur, surface_infestee=100.0
    )
    base_payload_epuisee = payload_traitement(prospection_epuisee_id)
    base_payload_reprenable = copy.deepcopy(base_payload_epuisee)
    base_payload_reprenable["prospection_id"] = str(prospection_reprenable_id)

    epuisee = await _creer_fiche_aerien_chainee(
        client,
        auth_headers,
        base_payload_epuisee,
        payload_rotation,
        surface_ha=100.0,
    )
    assert epuisee["aerien"]["surface_restante_ha"] == 0.0

    reprenable = await _creer_fiche_aerien_chainee(
        client,
        auth_headers,
        base_payload_reprenable,
        payload_rotation,
        surface_ha=5.0,
    )

    resp = await client.get("/traitements", params={"reprenable": "true"}, headers=auth_headers)
    assert resp.status_code == 200
    ids = {t["id"] for t in resp.json()}
    assert reprenable["id"] in ids
    assert epuisee["id"] not in ids


@pytest.mark.asyncio
async def test_list_traitements_filtre_statut(
    client,
    auth_headers,
    db_session,
    campagne_id,
    utilisateur,
    payload_traitement,
    payload_traitement_terrestre,
):
    """Lot D : l'onglet « Brouillons » de la page web « Fiches de traitement »
    doit pouvoir isoler les fiches non encore validées côté serveur."""
    brouillon_id = await _creer_traitement(
        client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement
    )
    validee_id = await _creer_traitement_terrestre(
        client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement_terrestre
    )
    valider = await client.post(
        f"/traitements/{validee_id}/valider",
        json={
            "date_validation": "2026-08-11",
            "signatures": [{"role": "CHEF_EQUIPE", "signataire_nom": "Hery Rasoa"}],
        },
        headers=auth_headers,
    )
    assert valider.status_code == 200, valider.text

    brouillons = await client.get(
        "/traitements", params={"statut": "brouillon"}, headers=auth_headers
    )
    assert brouillons.status_code == 200
    ids_brouillons = {t["id"] for t in brouillons.json()}
    assert brouillon_id in ids_brouillons
    assert validee_id not in ids_brouillons

    validees = await client.get("/traitements", params={"statut": "validee"}, headers=auth_headers)
    ids_validees = {t["id"] for t in validees.json()}
    assert validee_id in ids_validees
    assert brouillon_id not in ids_validees


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
        db_session, campagne_id, utilisateur, surface_infestee=50.0
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


# ==========================================
# POST /traitements/{id}/valider — matrice de signatures + verrouillage (CDG §9)
# ==========================================


@pytest.mark.asyncio
async def test_valider_cycle_aerien_complet(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement, payload_rotation
):
    traitement_id = await _creer_traitement(
        client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement
    )
    await client.post(
        f"/traitements/{traitement_id}/rotations", json=payload_rotation(), headers=auth_headers
    )

    resp = await client.post(
        f"/traitements/{traitement_id}/valider",
        json={
            "date_validation": "2026-08-11",
            "signatures": [
                {"role": "PILOTE", "signataire_nom": "J. Dupont"},
                {"role": "MECANICIEN", "signataire_nom": "M. Rabe"},
                {"role": "CHEF_DE_BASE", "signataire_nom": "Hery Andria"},
            ],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["statut"] == "validee"
    assert body["date_validation"] == "2026-08-11"
    assert {s["role"] for s in body["signatures"]} == {"PILOTE", "MECANICIEN", "CHEF_DE_BASE"}


@pytest.mark.asyncio
async def test_valider_persiste_et_relit_le_trace_de_signature(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement, payload_rotation
):
    """Le tracé (chemin SVG) d'une signature doit survivre à la persistance et à
    une relecture ultérieure (GET) — pas seulement le nom du signataire."""
    traitement_id = await _creer_traitement(
        client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement
    )
    await client.post(
        f"/traitements/{traitement_id}/rotations", json=payload_rotation(), headers=auth_headers
    )

    resp = await client.post(
        f"/traitements/{traitement_id}/valider",
        json={
            "date_validation": "2026-08-11",
            "signatures": [
                {"role": "PILOTE", "signataire_nom": "J. Dupont", "signature_image": "M0 0 L10 10"},
                {"role": "MECANICIEN", "signataire_nom": "M. Rabe"},
                {
                    "role": "CHEF_DE_BASE",
                    "signataire_nom": "Hery Andria",
                    "signature_image": "M5 5 L20 20",
                },
            ],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text

    relecture = await client.get(f"/traitements/{traitement_id}", headers=auth_headers)
    assert relecture.status_code == 200, relecture.text
    par_role = {s["role"]: s for s in relecture.json()["signatures"]}
    assert par_role["PILOTE"]["signature_image"] == "M0 0 L10 10"
    assert par_role["CHEF_DE_BASE"]["signature_image"] == "M5 5 L20 20"
    assert par_role["MECANICIEN"]["signature_image"] is None


@pytest.mark.asyncio
async def test_valider_cycle_terrestre_complet_sans_agent_encadreur(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement_terrestre
):
    """Critère CDG §9 : un CRT terrestre sans agent encadreur reste validable."""
    traitement_id = await _creer_traitement_terrestre(
        client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement_terrestre
    )

    resp = await client.post(
        f"/traitements/{traitement_id}/valider",
        json={
            "date_validation": "2026-08-11",
            "signatures": [{"role": "CHEF_EQUIPE", "signataire_nom": "Hery"}],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["statut"] == "validee"
    assert {s["role"] for s in body["signatures"]} == {"CHEF_EQUIPE"}


@pytest.mark.asyncio
async def test_valider_aerien_consultant_renseigne_sans_signature_422(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement
):
    prospection_id = await _creer_prospection(db_session, campagne_id, utilisateur)
    payload = payload_traitement(prospection_id)
    payload["aerien"]["consultant_international"] = "Dr. Smith"
    created = await client.post("/traitements", json=payload, headers=auth_headers)
    traitement_id = created.json()["id"]

    resp = await client.post(
        f"/traitements/{traitement_id}/valider",
        json={
            "date_validation": "2026-08-11",
            "signatures": [
                {"role": "PILOTE", "signataire_nom": "J. Dupont"},
                {"role": "MECANICIEN", "signataire_nom": "M. Rabe"},
                {"role": "CHEF_DE_BASE", "signataire_nom": "Hery"},
            ],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_valider_terrestre_surface_restante_abandonnee_sans_motif_422(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement_terrestre
):
    """Critère CDG §9 : surface_restante_abandonnee=Oui sans motif en Observations bloque."""
    prospection_id = await _creer_prospection(
        db_session, campagne_id, utilisateur, surface_infestee=100.0
    )
    payload = payload_traitement_terrestre(prospection_id)
    payload["terrestre"]["surface_atomiseur_ha"] = 10.0
    payload["terrestre"]["surface_restante_abandonnee"] = True
    created = await client.post("/traitements", json=payload, headers=auth_headers)
    assert created.status_code == 201, created.text
    traitement_id = created.json()["id"]

    resp = await client.post(
        f"/traitements/{traitement_id}/valider",
        json={
            "date_validation": "2026-08-11",
            "signatures": [{"role": "CHEF_EQUIPE", "signataire_nom": "Hery"}],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_valider_terrestre_surface_restante_abandonnee_avec_motif_ok(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement_terrestre
):
    prospection_id = await _creer_prospection(
        db_session, campagne_id, utilisateur, surface_infestee=100.0
    )
    payload = payload_traitement_terrestre(prospection_id)
    payload["terrestre"]["surface_atomiseur_ha"] = 10.0
    payload["terrestre"]["surface_restante_abandonnee"] = True
    payload["terrestre"]["motif_surface_restante_abandonnee"] = "Zone inaccessible (crue)"
    created = await client.post("/traitements", json=payload, headers=auth_headers)
    traitement_id = created.json()["id"]

    resp = await client.post(
        f"/traitements/{traitement_id}/valider",
        json={
            "date_validation": "2026-08-11",
            "signatures": [{"role": "CHEF_EQUIPE", "signataire_nom": "Hery"}],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["statut"] == "validee"


@pytest.mark.asyncio
async def test_valider_traitement_inexistant_404(client, auth_headers, db_engine):
    resp = await client.post(
        f"/traitements/{uuid.uuid4()}/valider",
        json={"date_validation": "2026-08-11", "signatures": []},
        headers=auth_headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_valider_fiche_deja_validee_403(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement_terrestre
):
    traitement_id = await _creer_traitement_terrestre(
        client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement_terrestre
    )
    body = {
        "date_validation": "2026-08-11",
        "signatures": [{"role": "CHEF_EQUIPE", "signataire_nom": "Hery"}],
    }
    first = await client.post(
        f"/traitements/{traitement_id}/valider", json=body, headers=auth_headers
    )
    assert first.status_code == 200

    second = await client.post(
        f"/traitements/{traitement_id}/valider", json=body, headers=auth_headers
    )
    assert second.status_code == 403


@pytest.mark.asyncio
async def test_modifier_fiche_aerien_validee_rejetee_sur_tous_les_writes_403(
    client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement, payload_rotation
):
    """Tentative de modification post-verrouillage : rotations rejetées sur une fiche validée."""
    traitement_id = await _creer_traitement(
        client, auth_headers, db_session, campagne_id, utilisateur, payload_traitement
    )
    added = await client.post(
        f"/traitements/{traitement_id}/rotations", json=payload_rotation(), headers=auth_headers
    )
    rotation_id = added.json()["aerien"]["rotations"][0]["id"]

    await client.post(
        f"/traitements/{traitement_id}/valider",
        json={
            "date_validation": "2026-08-11",
            "signatures": [
                {"role": "PILOTE", "signataire_nom": "J. Dupont"},
                {"role": "MECANICIEN", "signataire_nom": "M. Rabe"},
                {"role": "CHEF_DE_BASE", "signataire_nom": "Hery"},
            ],
        },
        headers=auth_headers,
    )

    resp_add = await client.post(
        f"/traitements/{traitement_id}/rotations", json=payload_rotation(), headers=auth_headers
    )
    assert resp_add.status_code == 403

    resp_update = await client.put(
        f"/traitements/{traitement_id}/rotations/{rotation_id}",
        json=payload_rotation(),
        headers=auth_headers,
    )
    assert resp_update.status_code == 403

    resp_delete = await client.delete(
        f"/traitements/{traitement_id}/rotations/{rotation_id}", headers=auth_headers
    )
    assert resp_delete.status_code == 403


@pytest.mark.asyncio
async def test_modifier_fiche_terrestre_validee_rejetee_sur_tous_les_writes_403(
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
    added = await client.post(
        f"/traitements/{traitement_id}/produits", json=payload_produit(), headers=auth_headers
    )
    produit_id = added.json()["terrestre"]["produits"][0]["id"]

    await client.post(
        f"/traitements/{traitement_id}/valider",
        json={
            "date_validation": "2026-08-11",
            "signatures": [{"role": "CHEF_EQUIPE", "signataire_nom": "Hery"}],
        },
        headers=auth_headers,
    )

    resp_add = await client.post(
        f"/traitements/{traitement_id}/produits", json=payload_produit(), headers=auth_headers
    )
    assert resp_add.status_code == 403

    resp_delete = await client.delete(
        f"/traitements/{traitement_id}/produits/{produit_id}", headers=auth_headers
    )
    assert resp_delete.status_code == 403


# ==========================================
# POST /traitements/sync — synchronisation offline (ADR-002 / décision #60)
# ==========================================


def _payload_sync(fiche_id, prospection_id, base_updated_at, **overrides):
    payload = {
        "id": str(fiche_id),
        "base_updated_at": base_updated_at.isoformat(),
        "prospection_id": str(prospection_id),
        "date_traitement": "2026-08-11",
        "date_validation": "2026-08-10",
        "localite": "Betioky",
        "terrestre": {
            "heure_debut": "06:00:00",
            "heure_fin": "09:00:00",
            "vitesse_vent_ms": 1.5,
            "temperature_c": 24.0,
            "chef_equipe_id": None,  # injecté par l'appelant
        },
    }
    payload.update({k: v for k, v in overrides.items() if k != "terrestre"})
    if "terrestre" in overrides:
        payload["terrestre"].update(overrides["terrestre"])
    return payload


@pytest.mark.asyncio
async def test_sync_push_cree_fiche_inconnue_201(
    client, auth_headers, db_session, campagne_id, utilisateur, chef_equipe
):
    prospection_id = await _creer_prospection(db_session, campagne_id, utilisateur)
    fiche_id = uuid.uuid4()
    payload = _payload_sync(
        fiche_id,
        prospection_id,
        base_updated_at=datetime.utcnow(),
        terrestre={"chef_equipe_id": str(chef_equipe.id)},
    )
    resp = await client.post("/traitements/sync", json=payload, headers=auth_headers)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["id"] == str(fiche_id)
    assert body["statut_sync"] == "synced"


@pytest.mark.asyncio
async def test_sync_deux_appareils_meme_id_contenu_divergent_rejette_409_conflict(
    client, auth_headers, db_session, campagne_id, utilisateur, chef_equipe
):
    """Critère d'acceptation : deux appareils créant la même fiche hors-ligne (même id)
    avec un contenu divergent -> la seconde synchronisation est rejetée (409), marquée
    `conflict`, sans écraser la première."""
    prospection_id = await _creer_prospection(db_session, campagne_id, utilisateur)
    fiche_id = uuid.uuid4()
    t0 = datetime.utcnow()

    premier = await client.post(
        "/traitements/sync",
        json=_payload_sync(
            fiche_id,
            prospection_id,
            base_updated_at=t0,
            terrestre={"chef_equipe_id": str(chef_equipe.id)},
        ),
        headers=auth_headers,
    )
    assert premier.status_code == 201, premier.text

    second = await client.post(
        "/traitements/sync",
        json=_payload_sync(
            fiche_id,
            prospection_id,
            base_updated_at=t0 - timedelta(minutes=5),  # jamais lu la version serveur
            localite="Ampanihy",  # contenu divergent
            terrestre={"chef_equipe_id": str(chef_equipe.id)},
        ),
        headers=auth_headers,
    )
    assert second.status_code == 409, second.text
    body_conflit = second.json()
    assert body_conflit["statut_sync"] == "conflict"
    assert body_conflit["localite"] == "Betioky"  # la première version n'est pas écrasée

    verification = await client.get(f"/traitements/{fiche_id}", headers=auth_headers)
    assert verification.json()["localite"] == "Betioky"
    assert verification.json()["statut_sync"] == "conflict"


@pytest.mark.asyncio
async def test_sync_fiche_validee_rejette_systematiquement_sans_jamais_passer_par_conflict(
    client, auth_headers, db_session, campagne_id, utilisateur, chef_equipe
):
    """Critère d'acceptation : une fiche serveur déjà `validee` rejette systématiquement
    toute divergence entrante, sans jamais passer par `conflict`."""
    prospection_id = await _creer_prospection(db_session, campagne_id, utilisateur)
    fiche_id = uuid.uuid4()
    t0 = datetime.utcnow()

    cree = await client.post(
        "/traitements/sync",
        json=_payload_sync(
            fiche_id,
            prospection_id,
            base_updated_at=t0,
            terrestre={"chef_equipe_id": str(chef_equipe.id)},
        ),
        headers=auth_headers,
    )
    assert cree.status_code == 201, cree.text

    validee = await client.post(
        f"/traitements/{fiche_id}/valider",
        json={
            "date_validation": "2026-08-11",
            "signatures": [{"role": "CHEF_EQUIPE", "signataire_nom": "Hery"}],
        },
        headers=auth_headers,
    )
    assert validee.status_code == 200, validee.text
    updated_at_apres_validation = validee.json()["updated_at"]

    resync = await client.post(
        "/traitements/sync",
        json=_payload_sync(
            fiche_id,
            prospection_id,
            base_updated_at=t0,
            localite="Ampanihy",
            terrestre={"chef_equipe_id": str(chef_equipe.id)},
        ),
        headers=auth_headers,
    )
    assert resync.status_code == 409, resync.text
    assert resync.json()["localite"] == "Betioky"

    verification = await client.get(f"/traitements/{fiche_id}", headers=auth_headers)
    # jamais 'conflict' sur une fiche verrouillée
    assert verification.json()["statut_sync"] == "synced"
    assert verification.json()["updated_at"] == updated_at_apres_validation


@pytest.mark.asyncio
async def test_sync_renvoi_reseau_contenu_identique_traite_synced_sans_conflit(
    client, auth_headers, db_session, campagne_id, utilisateur, chef_equipe
):
    """Critère d'acceptation : un renvoi réseau (même id, contenu identique) est traité
    `synced` sans conflit."""
    prospection_id = await _creer_prospection(db_session, campagne_id, utilisateur)
    fiche_id = uuid.uuid4()
    t0 = datetime.utcnow()
    payload = _payload_sync(
        fiche_id,
        prospection_id,
        base_updated_at=t0,
        terrestre={"chef_equipe_id": str(chef_equipe.id)},
    )

    premier = await client.post("/traitements/sync", json=payload, headers=auth_headers)
    assert premier.status_code == 201, premier.text
    updated_at_serveur = premier.json()["updated_at"]

    renvoi = payload.copy()
    renvoi["base_updated_at"] = updated_at_serveur
    resp = await client.post("/traitements/sync", json=renvoi, headers=auth_headers)

    assert resp.status_code == 200, resp.text
    assert resp.json()["statut_sync"] == "synced"


@pytest.mark.asyncio
async def test_sync_renvoi_remplace_les_evaluations_risque_population(
    client, auth_headers, db_session, campagne_id, utilisateur, chef_equipe
):
    """#evaluation-risque-population, mode Offline-First : une fiche créée hors
    ligne (premier sync) puis rouverte et modifiée (deuxième sync, même id) voit
    ses évaluations remplacées en bloc — ajout, modification et suppression
    indifférenciés côté client, comme prospection_population."""
    prospection_id = await _creer_prospection(db_session, campagne_id, utilisateur)
    fiche_id = uuid.uuid4()
    t0 = datetime.utcnow()
    payload = _payload_sync(
        fiche_id,
        prospection_id,
        base_updated_at=t0,
        terrestre={"chef_equipe_id": str(chef_equipe.id)},
        evaluations_risque_population=[
            {"habitat_proche": "Rizière", "distance_km": 1.0, "sensibilisation": False}
        ],
    )
    premier = await client.post("/traitements/sync", json=payload, headers=auth_headers)
    assert premier.status_code == 201, premier.text
    assert len(premier.json()["evaluations_risque_population"]) == 1

    renvoi = payload.copy()
    renvoi["base_updated_at"] = premier.json()["updated_at"]
    renvoi["evaluations_risque_population"] = [
        {"habitat_proche": "Rizière modifiée", "distance_km": 1.2, "sensibilisation": True},
        {"habitat_proche": "Zone humide", "distance_km": 3.0, "sensibilisation": False},
    ]
    resp = await client.post("/traitements/sync", json=renvoi, headers=auth_headers)
    assert resp.status_code == 200, resp.text
    evaluations = resp.json()["evaluations_risque_population"]
    assert len(evaluations) == 2
    assert evaluations[0]["habitat_proche"] == "Rizière modifiée"
    assert evaluations[0]["sensibilisation"] is True
    assert evaluations[1]["habitat_proche"] == "Zone humide"

    # Relecture indépendante : la liste remplacée est bien celle persistée.
    relu = await client.get(f"/traitements/{fiche_id}", headers=auth_headers)
    assert len(relu.json()["evaluations_risque_population"]) == 2
