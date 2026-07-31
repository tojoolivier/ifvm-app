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
            "infestations": [{"espece": "NSE", "type_cible": "tache_larvaire", "surface_tot": 2.0}],
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
                    "surface_tot": 5.0,
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
                    "surface_tot": 10.0,
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
                        "surface_tot": 3.0,
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
                        "surface_tot": 2.0,
                        "type_larve": type_larve,
                    }
                ],
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["infestations"][0]["type_larve"] == type_larve
