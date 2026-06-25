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
                {"espece": "NSE", "type_cible": "tache_larvaire", "surface_tot": 2.0}
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
        f"/prospections?type=intensive&statut=en_attente", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert all(p["statut"] == "en_attente" for p in data)
    assert len(data) >= 1
