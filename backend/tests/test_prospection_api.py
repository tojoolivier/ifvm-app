import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_prospection_intensive(
    client: AsyncClient, auth_headers: dict, campagne_id: uuid.UUID, station_id: uuid.UUID
):
    response = await client.post(
        "/prospections",
        json={
            "type_prospection": "intensive",
            "campagne_id": str(campagne_id),
            "station_id": str(station_id),
            "date_prospection": "2026-06-25",
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["type_prospection"] == "intensive"
    assert data["campagne_id"] == str(campagne_id)
    assert data["statut"] == "brouillon"
    assert "id" in data


@pytest.mark.asyncio
async def test_create_prospection_intensive_avec_sections(
    client: AsyncClient, auth_headers: dict, campagne_id: uuid.UUID, station_id: uuid.UUID
):
    response = await client.post(
        "/prospections",
        json={
            "type_prospection": "intensive",
            "campagne_id": str(campagne_id),
            "station_id": str(station_id),
            "date_prospection": "2026-06-25",
            "captures": [
                {
                    "espece": "LMC",
                    "categorie": "larve",
                    "sexe": None,
                    "phase": "solitaire",
                    "stade": "A1",
                    "effectif": 12,
                }
            ],
            "populations": [
                {
                    "espece": "LMC",
                    "categorie": "imago",
                    "densite_diffuse": 3.5,
                    "accouplement": "rare",
                }
            ],
            "infestations": [
                {"espece": "NSE", "type_cible": "tache_larvaire", "surface_totale": 2.0}
            ],
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert len(data["captures"]) == 1
    assert data["captures"][0]["effectif"] == 12
    assert data["captures"][0]["sexe"] is None
    assert len(data["populations"]) == 1
    assert data["populations"][0]["densite_diffuse"] == 3.5
    assert len(data["infestations"]) == 1
    assert data["infestations"][0]["type_cible"] == "tache_larvaire"


@pytest.mark.asyncio
async def test_create_prospection_avec_nouveaux_champs(
    client: AsyncClient, auth_headers: dict, campagne_id: uuid.UUID, station_id: uuid.UUID
):
    """Test de création avec les nouveaux champs (Références et Observations)"""
    response = await client.post(
        "/prospections",
        json={
            "type_prospection": "extensive",
            "campagne_id": str(campagne_id),
            "station_id": str(station_id),
            "date_prospection": "2026-07-29",
            "region": "Diana",
            "district": "Ambanja",
            "commune": "Ambanja",
            "za": "ZA001",
            "pa_code": "PA001",
            "degats_cultures_pourcent": 25,
            "verdissement_pourcent": 60,
            "hauteur_herbe_cm": 30.5,
            "infestations": [
                {
                    "espece": "LMC",
                    "type_cible": "essaim",
                    "surface_totale": 5.0,
                    "pullulation_nb": 3,
                    "taille_long": 100.0,
                    "taille_large": 50.0,
                    "taille_epaisseur": 10.0,
                    "essaim_en_vol": True,
                    "essaim_pose": False,
                    "type_essaim": "dense",
                    "nb_taches_bandes": 5,
                    "interdistance_m": 2.5,
                    "surface_contaminee_ha": 3.0,
                    "type_larve": "tache_larvaire",
                }
            ],
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()

    assert data["region"] == "Diana"
    assert data["district"] == "Ambanja"
    assert data["commune"] == "Ambanja"
    assert data["za"] == "ZA001"
    assert data["pa_code"] == "PA001"
    assert data["degats_cultures_pourcent"] == 25
    assert data["verdissement_pourcent"] == 60
    assert data["hauteur_herbe_cm"] == 30.5

    assert len(data["infestations"]) == 1
    infestation = data["infestations"][0]
    assert infestation["pullulation_nb"] == 3
    assert infestation["taille_long"] == 100.0
    assert infestation["taille_large"] == 50.0
    assert infestation["taille_epaisseur"] == 10.0
    assert infestation["essaim_en_vol"] is True
    assert infestation["essaim_pose"] is False
    assert infestation["type_essaim"] == "dense"
    assert infestation["nb_taches_bandes"] == 5
    assert infestation["interdistance_m"] == 2.5
    assert infestation["surface_contaminee_ha"] == 3.0
    assert infestation["type_larve"] == "tache_larvaire"


@pytest.mark.asyncio
async def test_create_prospection_avec_avertissements(
    client: AsyncClient, auth_headers: dict, campagne_id: uuid.UUID, station_id: uuid.UUID
):
    """#106 : la fiche « à vérifier » côté mobile transmet ses avertissements non
    bloquants (plausibilité horaire, écart historique) au backend, qui les
    persiste tels quels pour être visibles en revue."""
    response = await client.post(
        "/prospections",
        json={
            "type_prospection": "extensive",
            "campagne_id": str(campagne_id),
            "station_id": str(station_id),
            "date_prospection": "2026-07-29",
            "avertissements": [
                "Essaim/vol clair signalé de nuit : comportement forcé sur « posé ».",
                "Écart important par rapport à la dernière observation connue sur ce point.",
            ],
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()

    assert data["avertissements"] == [
        "Essaim/vol clair signalé de nuit : comportement forcé sur « posé ».",
        "Écart important par rapport à la dernière observation connue sur ce point.",
    ]


@pytest.mark.asyncio
async def test_create_prospection_sans_avertissements_est_vide(
    client: AsyncClient, auth_headers: dict, campagne_id: uuid.UUID, station_id: uuid.UUID
):
    response = await client.post(
        "/prospections",
        json={
            "type_prospection": "extensive",
            "campagne_id": str(campagne_id),
            "station_id": str(station_id),
            "date_prospection": "2026-07-29",
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    assert response.json()["avertissements"] == []


@pytest.mark.asyncio
async def test_create_prospection_population_methode_phase(
    client: AsyncClient, auth_headers: dict, campagne_id: uuid.UUID, station_id: uuid.UUID
):
    """Régression: methode/phase (population) et surface_infestee_pourcent (infestation)
    existent côté ORM/Pydantic mais avaient été oubliés dans le mapping du domaine
    (ProspectionPopulation / ProspectionInfestation), ce qui faisait planter la
    création avec un TypeError silencieux hors tests (aucun test n'envoyait ces
    champs avant cette régression)."""
    response = await client.post(
        "/prospections",
        json={
            "type_prospection": "extensive",
            "campagne_id": str(campagne_id),
            "station_id": str(station_id),
            "date_prospection": "2026-07-29",
            "populations": [
                {
                    "espece": "LMC",
                    "categorie": "imago",
                    "densite_diffuse": 3.5,
                    "methode": "comptage_direct",
                    "phase": "gregaire",
                }
            ],
            "infestations": [
                {
                    "espece": "NSE",
                    "type_cible": "tache_larvaire",
                    "surface_totale": 2.0,
                    "surface_infestee_pourcent": 45.0,
                }
            ],
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()

    assert len(data["populations"]) == 1
    population = data["populations"][0]
    assert population["methode"] == "comptage_direct"
    assert population["phase"] == "gregaire"

    assert len(data["infestations"]) == 1
    infestation = data["infestations"][0]
    assert infestation["surface_infestee_pourcent"] == 45.0


@pytest.mark.asyncio
async def test_create_prospection_avec_infestation_complete(
    client: AsyncClient, auth_headers: dict, campagne_id: uuid.UUID, station_id: uuid.UUID
):
    """Test de création avec une infestation complète (tous les champs)"""
    response = await client.post(
        "/prospections",
        json={
            "type_prospection": "extensive",
            "campagne_id": str(campagne_id),
            "station_id": str(station_id),
            "date_prospection": "2026-07-29",
            "infestations": [
                {
                    "espece": "NSE",
                    "type_cible": "bande_larvaire",
                    "taille_min": 10.0,
                    "taille_max": 25.0,
                    "taille_moy": 17.5,
                    "surface_totale": 10.0,
                    "densite_min": 2.0,
                    "densite_max": 8.0,
                    "densite_moy": 5.0,
                    "interdistance": 3.0,
                    "comportement": "deplacement",
                    "direction_de": "Nord",
                    "direction_vers": "Sud",
                    "vent_de": "Est",
                    "vent_vitesse": 15.0,
                    "pullulation_nb": 2,
                    "taille_long": 200.0,
                    "taille_large": 100.0,
                    "taille_epaisseur": 15.0,
                    "essaim_en_vol": False,
                    "essaim_pose": True,
                    "type_essaim": "vol_clair",
                    "nb_taches_bandes": 8,
                    "interdistance_m": 5.0,
                    "surface_contaminee_ha": 7.5,
                    "type_larve": "bande_larvaire",
                }
            ],
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()

    infestation = data["infestations"][0]
    assert infestation["type_cible"] == "bande_larvaire"
    assert infestation["pullulation_nb"] == 2
    assert infestation["type_essaim"] == "vol_clair"
    assert infestation["type_larve"] == "bande_larvaire"


@pytest.mark.asyncio
async def test_create_intensive_sans_station_id_echoue(
    client: AsyncClient, auth_headers: dict, campagne_id: uuid.UUID
):
    response = await client.post(
        "/prospections",
        json={
            "type_prospection": "intensive",
            "campagne_id": str(campagne_id),
            "date_prospection": "2026-06-25",
        },
        headers=auth_headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_sans_campagne_id_echoue(
    client: AsyncClient, auth_headers: dict, station_id: uuid.UUID
):
    response = await client.post(
        "/prospections",
        json={
            "type_prospection": "intensive",
            "station_id": str(station_id),
            "date_prospection": "2026-06-25",
        },
        headers=auth_headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_list_prospections_filtre_par_type(
    client: AsyncClient, auth_headers: dict, campagne_id: uuid.UUID, station_id: uuid.UUID
):
    await client.post(
        "/prospections",
        json={
            "type_prospection": "intensive",
            "campagne_id": str(campagne_id),
            "station_id": str(station_id),
            "date_prospection": "2026-06-25",
        },
        headers=auth_headers,
    )

    response = await client.get("/prospections?type=intensive", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert all(p["type_prospection"] == "intensive" for p in data)


@pytest.mark.asyncio
async def test_get_prospection_par_id(
    client: AsyncClient, auth_headers: dict, campagne_id: uuid.UUID, station_id: uuid.UUID
):
    create_resp = await client.post(
        "/prospections",
        json={
            "type_prospection": "intensive",
            "campagne_id": str(campagne_id),
            "station_id": str(station_id),
            "date_prospection": "2026-06-25",
        },
        headers=auth_headers,
    )
    prospection_id = create_resp.json()["id"]

    response = await client.get(f"/prospections/{prospection_id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["id"] == prospection_id


@pytest.mark.asyncio
async def test_get_prospection_inexistante_retourne_404(client: AsyncClient, auth_headers: dict):
    response = await client.get(f"/prospections/{uuid.uuid4()}", headers=auth_headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_prospection_brouillon(
    client: AsyncClient, auth_headers: dict, campagne_id: uuid.UUID, station_id: uuid.UUID
):
    create_resp = await client.post(
        "/prospections",
        json={
            "type_prospection": "intensive",
            "campagne_id": str(campagne_id),
            "station_id": str(station_id),
            "date_prospection": "2026-06-25",
        },
        headers=auth_headers,
    )
    prospection_id = create_resp.json()["id"]

    response = await client.put(
        f"/prospections/{prospection_id}",
        json={"observations": "Mise à jour OK"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["observations"] == "Mise à jour OK"


@pytest.mark.asyncio
async def test_update_prospection_efface_avertissements_une_fois_corriges(
    client: AsyncClient, auth_headers: dict, campagne_id: uuid.UUID, station_id: uuid.UUID
):
    """#106 : quand le prospecteur corrige la saisie et que plus aucun avertissement
    ne se déclenche, la fiche n'est plus « à vérifier » (liste vidée, pas conservée)."""
    create_resp = await client.post(
        "/prospections",
        json={
            "type_prospection": "extensive",
            "campagne_id": str(campagne_id),
            "station_id": str(station_id),
            "date_prospection": "2026-07-29",
            "avertissements": ["Écart important par rapport à la dernière observation connue."],
        },
        headers=auth_headers,
    )
    prospection_id = create_resp.json()["id"]

    response = await client.put(
        f"/prospections/{prospection_id}",
        json={"avertissements": []},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["avertissements"] == []


@pytest.mark.asyncio
async def test_update_prospection_avec_nouveaux_champs(
    client: AsyncClient, auth_headers: dict, campagne_id: uuid.UUID, station_id: uuid.UUID
):
    """Test de mise à jour avec les nouveaux champs"""
    create_resp = await client.post(
        "/prospections",
        json={
            "type_prospection": "extensive",
            "campagne_id": str(campagne_id),
            "station_id": str(station_id),
            "date_prospection": "2026-07-29",
        },
        headers=auth_headers,
    )
    prospection_id = create_resp.json()["id"]

    response = await client.put(
        f"/prospections/{prospection_id}",
        json={
            "region": "Analamanga",
            "district": "Antananarivo",
            "commune": "Antananarivo",
            "za": "ZA002",
            "pa_code": "PA002",
            "degats_cultures_pourcent": 50,
            "verdissement_pourcent": 40,
            "hauteur_herbe_cm": 45.0,
            "observations": "Mise à jour avec nouveaux champs",
        },
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["region"] == "Analamanga"
    assert data["district"] == "Antananarivo"
    assert data["commune"] == "Antananarivo"
    assert data["za"] == "ZA002"
    assert data["pa_code"] == "PA002"
    assert data["degats_cultures_pourcent"] == 50
    assert data["verdissement_pourcent"] == 40
    assert data["hauteur_herbe_cm"] == 45.0
    assert data["observations"] == "Mise à jour avec nouveaux champs"


@pytest.mark.asyncio
async def test_update_prospection_non_brouillon_interdit(
    client: AsyncClient, auth_headers: dict, campagne_id: uuid.UUID, station_id: uuid.UUID
):
    create_resp = await client.post(
        "/prospections",
        json={
            "type_prospection": "intensive",
            "campagne_id": str(campagne_id),
            "station_id": str(station_id),
            "date_prospection": "2026-06-25",
            "statut": "en_attente",
        },
        headers=auth_headers,
    )
    prospection_id = create_resp.json()["id"]

    response = await client.put(
        f"/prospections/{prospection_id}",
        json={"observations": "tentative de modif"},
        headers=auth_headers,
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_delete_prospection_brouillon(
    client: AsyncClient, auth_headers: dict, campagne_id: uuid.UUID, station_id: uuid.UUID
):
    create_resp = await client.post(
        "/prospections",
        json={
            "type_prospection": "intensive",
            "campagne_id": str(campagne_id),
            "station_id": str(station_id),
            "date_prospection": "2026-06-25",
        },
        headers=auth_headers,
    )
    prospection_id = create_resp.json()["id"]

    response = await client.delete(f"/prospections/{prospection_id}", headers=auth_headers)
    assert response.status_code == 204

    get_resp = await client.get(f"/prospections/{prospection_id}", headers=auth_headers)
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_prospection_non_brouillon_interdit(
    client: AsyncClient, auth_headers: dict, campagne_id: uuid.UUID, station_id: uuid.UUID
):
    create_resp = await client.post(
        "/prospections",
        json={
            "type_prospection": "intensive",
            "campagne_id": str(campagne_id),
            "station_id": str(station_id),
            "date_prospection": "2026-06-25",
            "statut": "en_attente",
        },
        headers=auth_headers,
    )
    prospection_id = create_resp.json()["id"]

    response = await client.delete(f"/prospections/{prospection_id}", headers=auth_headers)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_list_filtre_statut(
    client: AsyncClient, auth_headers: dict, campagne_id: uuid.UUID, station_id: uuid.UUID
):
    await client.post(
        "/prospections",
        json={
            "type_prospection": "intensive",
            "campagne_id": str(campagne_id),
            "station_id": str(station_id),
            "date_prospection": "2026-06-25",
            "statut": "en_attente",
        },
        headers=auth_headers,
    )

    response = await client.get(
        "/prospections?type=intensive&statut=en_attente", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert all(p["statut"] == "en_attente" for p in data)
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_create_prospection_avec_stades_larvaires_l6_l7(
    client: AsyncClient, auth_headers: dict, campagne_id: uuid.UUID, station_id: uuid.UUID
):
    """Test de création avec les nouveaux stades L6 et L7 pour NSE"""
    response = await client.post(
        "/prospections",
        json={
            "type_prospection": "extensive",
            "campagne_id": str(campagne_id),
            "station_id": str(station_id),
            "date_prospection": "2026-07-29",
            "captures": [
                {
                    "espece": "NSE",
                    "categorie": "larve",
                    "sexe": None,
                    "phase": "solitaire",
                    "stade": "L6",
                    "effectif": 5,
                },
                {
                    "espece": "NSE",
                    "categorie": "larve",
                    "sexe": None,
                    "phase": "solitaire",
                    "stade": "L7",
                    "effectif": 3,
                },
                {
                    "espece": "LMC",
                    "categorie": "larve",
                    "sexe": None,
                    "phase": "solitaire",
                    "stade": "L5",
                    "effectif": 8,
                },
            ],
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()

    captures = data["captures"]
    stades = [c["stade"] for c in captures]
    assert "L6" in stades
    assert "L7" in stades
    assert "L5" in stades


@pytest.mark.asyncio
async def test_create_prospection_avec_type_essaim_enum(
    client: AsyncClient, auth_headers: dict, campagne_id: uuid.UUID, station_id: uuid.UUID
):
    """Test de création avec les différents types d'essaim"""
    for type_essaim in ["vol_clair", "dense", "tres_dense"]:
        response = await client.post(
            "/prospections",
            json={
                "type_prospection": "extensive",
                "campagne_id": str(campagne_id),
                "station_id": str(station_id),
                "date_prospection": "2026-07-29",
                "infestations": [
                    {
                        "espece": "LMC",
                        "type_cible": "essaim",
                        "surface_totale": 3.0,
                        "type_essaim": type_essaim,
                        "essaim_en_vol": True,
                        "essaim_pose": False,
                    }
                ],
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["infestations"][0]["type_essaim"] == type_essaim


@pytest.mark.asyncio
async def test_create_prospection_avec_type_larve_enum(
    client: AsyncClient, auth_headers: dict, campagne_id: uuid.UUID, station_id: uuid.UUID
):
    """Test de création avec les différents types de larves"""
    for type_larve in ["tache_larvaire", "bande_larvaire"]:
        response = await client.post(
            "/prospections",
            json={
                "type_prospection": "extensive",
                "campagne_id": str(campagne_id),
                "station_id": str(station_id),
                "date_prospection": "2026-07-29",
                "infestations": [
                    {
                        "espece": "NSE",
                        "type_cible": type_larve,
                        "surface_totale": 2.0,
                        "type_larve": type_larve,
                    }
                ],
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["infestations"][0]["type_larve"] == type_larve


@pytest.mark.asyncio
async def test_create_prospection_extensive_avec_populations_agregees(
    client: AsyncClient, auth_headers: dict, campagne_id: uuid.UUID, station_id: uuid.UUID
):
    """Fiche extensive : comptages agrégés par phénotype (B) et densités par stade (C)."""
    response = await client.post(
        "/prospections",
        json={
            "type_prospection": "extensive",
            "campagne_id": str(campagne_id),
            "station_id": str(station_id),
            "date_prospection": "2026-07-29",
            "station_libre": "Ambohimanga",
            "type_station": "riziere_bordure",
            "verdure_strate": "moyenne",
            "populations": [
                {
                    "espece": "LMC",
                    "categorie": "imago",
                    "captures_sol": 3,
                    "captures_trans": 14,
                    "captures_greg": 0,
                    "stade_imago": "A2",
                    "densite_diffuse": 2.4,
                    "essaim_observe": False,
                },
                {
                    "espece": "NSE",
                    "categorie": "larve",
                    "densites_larve": {
                        "L1": 0,
                        "L2": 0,
                        "L3": 31,
                        "L4": 0,
                        "L5": 0,
                        "L6": 0,
                        "L7": 0,
                    },
                    "tache_larvaire": True,
                    "bande_larvaire": False,
                    "interdistance": 0.6,
                    "deplacement": "repos",
                },
            ],
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["station_libre"] == "Ambohimanga"
    assert data["type_station"] == "mesophyle"
    assert data["verdure_strate"] == "moyenne"

    imago = next(p for p in data["populations"] if p["categorie"] == "imago")
    assert imago["captures_sol"] == 3
    assert imago["captures_trans"] == 14
    assert imago["stade_imago"] == "A2"
    assert imago["essaim_observe"] is False

    larve = next(p for p in data["populations"] if p["categorie"] == "larve")
    assert larve["densites_larve"]["L3"] == 31
    assert larve["tache_larvaire"] is True
    assert larve["bande_larvaire"] is False
    assert larve["interdistance"] == 0.6
    assert larve["deplacement"] == "repos"


@pytest.mark.asyncio
async def test_create_prospection_validation_avec_signalement_et_conclusion(
    client: AsyncClient, auth_headers: dict, campagne_id: uuid.UUID, station_id: uuid.UUID
):
    """Fiche de validation : signalement affiché, conclusion binaire (pas de motif ni statut)."""
    response = await client.post(
        "/prospections",
        json={
            "type_prospection": "validation",
            "campagne_id": str(campagne_id),
            "station_id": str(station_id),
            "date_prospection": "2026-07-29",
            "signalement_source": "Rasoanaivo (habitant)",
            "signalement_date": "25/06",
            "signalement_description": "Beaucoup de criquets près du champ de riz, côté est",
            "conclusion_validation": "confirmee",
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["type_prospection"] == "validation"
    assert data["signalement_source"] == "Rasoanaivo (habitant)"
    assert data["signalement_date"] == "25/06"
    assert data["signalement_description"].startswith("Beaucoup de criquets")
    assert data["conclusion_validation"] == "confirmee"
    # Statut brouillon standard : la conclusion n'implique aucun état d'approbation intermédiaire.
    assert data["statut"] == "brouillon"


@pytest.mark.asyncio
async def test_create_prospection_conclusion_invalide_echoue(
    client: AsyncClient, auth_headers: dict, campagne_id: uuid.UUID, station_id: uuid.UUID
):
    response = await client.post(
        "/prospections",
        json={
            "type_prospection": "validation",
            "campagne_id": str(campagne_id),
            "station_id": str(station_id),
            "date_prospection": "2026-07-29",
            "conclusion_validation": "peut-etre",
        },
        headers=auth_headers,
    )
    # conclusion_validation est un Enum Pydantic (issue #117) : la valeur invalide est
    # rejetée à la validation du payload, avant toute requête SQL.
    assert response.status_code == 422
