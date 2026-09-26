"""Affectations d'aéronefs bornées dans le temps (#603, migration 0087).

Une équipe aérienne dispose de 2 à 3 appareils, utilisés l'un après l'autre pendant la
campagne. L'ancien `equipe.aeronef_id` sous `UNIQUE` n'en savait dire qu'un, et
remplacer un hélicoptère effaçait la trace du précédent. `equipe_aeronef` pose une
ligne par période : `date_fin IS NULL` désigne l'affectation en cours.

La règle « un aéronef sur une seule équipe à la fois » est **temporelle** — elle porte
sur le chevauchement des intervalles `[date_debut, date_fin)` — et validée côté
application : `EXCLUDE USING gist` est hors scope (ADR-018). D'où un 422 et non un 409 :
le corps est recevable, c'est le calendrier qui ne tient pas.
"""

import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import hash_password
from app.models.users import Utilisateur

AERONEF_A = {"immatriculation": "5R-MJA", "societe": "Madagascar Helicopter", "volume_cuve_l": 800}
AERONEF_B = {"immatriculation": "5R-MJB", "societe": "Madagascar Helicopter", "volume_cuve_l": 950}


@pytest_asyncio.fixture
async def aeronef_a(client: AsyncClient, admin_headers: dict) -> dict:
    return (await client.post("/aeronefs", json=AERONEF_A, headers=admin_headers)).json()


@pytest_asyncio.fixture
async def aeronef_b(client: AsyncClient, admin_headers: dict) -> dict:
    return (await client.post("/aeronefs", json=AERONEF_B, headers=admin_headers)).json()


@pytest_asyncio.fixture
async def equipe_terrestre_creee(db_session: AsyncSession, chef_equipe: Utilisateur) -> dict:
    from app.infrastructure.referentiel_model import EquipeMembreModel, EquipeModel

    equipe = EquipeModel(id=uuid.uuid4(), nom="Équipe terrestre", type="terrestre", actif=True)
    equipe.membres = [EquipeMembreModel(user_id=chef_equipe.id, fonction="chef")]
    db_session.add(equipe)
    await db_session.commit()
    return {"id": str(equipe.id)}


@pytest_asyncio.fixture
async def autre_equipe(client: AsyncClient, admin_headers: dict, db_session: AsyncSession) -> dict:
    """Une seconde équipe aérienne, sans appareil, avec son propre chef."""
    from app.infrastructure.referentiel_model import EquipeMembreModel, EquipeModel

    chef = Utilisateur(
        id=uuid.uuid4(),
        nom="Rasolo",
        prenom="Tiana",
        email=f"tiana.rasolo+{uuid.uuid4().hex[:6]}@test.mg",
        password_hash=hash_password("secret"),
        role="chef_de_base",
        actif=True,
    )
    db_session.add(chef)
    await db_session.flush()
    equipe = EquipeModel(id=uuid.uuid4(), nom="Équipe Betroka", type="aerien", actif=True)
    equipe.membres = [EquipeMembreModel(user_id=chef.id, fonction="chef")]
    db_session.add(equipe)
    await db_session.commit()
    return {"id": str(equipe.id), "chef_id": str(chef.id)}


@pytest_asyncio.fixture
async def equipe(db_session: AsyncSession, chef_de_base: Utilisateur) -> dict:
    from app.infrastructure.referentiel_model import EquipeMembreModel, EquipeModel

    modele = EquipeModel(id=uuid.uuid4(), nom="Équipe Ihosy", type="aerien", actif=True)
    modele.membres = [EquipeMembreModel(user_id=chef_de_base.id, fonction="chef")]
    db_session.add(modele)
    await db_session.commit()
    return {"id": str(modele.id)}


@pytest.mark.asyncio
async def test_affecter_un_aeronef_puis_le_lire_comme_affectation_active(
    client: AsyncClient, admin_headers: dict, equipe: dict, aeronef_a: dict
):
    reponse = await client.post(
        f"/equipes/{equipe['id']}/aeronefs",
        json={"aeronef_id": aeronef_a["id"], "date_debut": "2026-06-01"},
        headers=admin_headers,
    )
    assert reponse.status_code == 201, reponse.text
    affectation = reponse.json()
    assert affectation["date_fin"] is None
    assert affectation["aeronef"]["immatriculation"] == "5R-MJA"

    relue = await client.get(f"/equipes/{equipe['id']}", headers=admin_headers)
    assert relue.json()["aeronef_id"] == aeronef_a["id"]
    assert relue.json()["aeronef"]["immatriculation"] == "5R-MJA"


@pytest.mark.asyncio
async def test_deux_aeronefs_successifs_et_leur_historique(
    client: AsyncClient, admin_headers: dict, equipe: dict, aeronef_a: dict, aeronef_b: dict
):
    """Le cœur du ticket : remplacer un appareil sans perdre le précédent."""
    premiere = await client.post(
        f"/equipes/{equipe['id']}/aeronefs",
        json={"aeronef_id": aeronef_a["id"], "date_debut": "2026-06-01"},
        headers=admin_headers,
    )
    assert premiere.status_code == 201, premiere.text

    cloture = await client.put(
        f"/equipes/{equipe['id']}/aeronefs/{premiere.json()['id']}",
        json={"date_fin": "2026-07-01"},
        headers=admin_headers,
    )
    assert cloture.status_code == 200, cloture.text
    assert cloture.json()["date_fin"] == "2026-07-01"

    seconde = await client.post(
        f"/equipes/{equipe['id']}/aeronefs",
        json={"aeronef_id": aeronef_b["id"], "date_debut": "2026-07-01"},
        headers=admin_headers,
    )
    assert seconde.status_code == 201, seconde.text

    historique = await client.get(f"/equipes/{equipe['id']}/aeronefs", headers=admin_headers)
    assert historique.status_code == 200
    lignes = historique.json()
    assert [ligne["aeronef"]["immatriculation"] for ligne in lignes] == ["5R-MJB", "5R-MJA"]
    assert [ligne["date_fin"] for ligne in lignes] == [None, "2026-07-01"]

    # L'appareil en service est le second ; le premier reste lisible dans l'historique.
    relue = await client.get(f"/equipes/{equipe['id']}", headers=admin_headers)
    assert relue.json()["aeronef"]["immatriculation"] == "5R-MJB"


@pytest.mark.asyncio
async def test_equipe_entre_deux_appareils_n_a_pas_d_aeronef_actif(
    client: AsyncClient, admin_headers: dict, equipe: dict, aeronef_a: dict
):
    """Ce que le 1:1 ne savait pas dire : une équipe qui a rendu son appareil."""
    affectation = (
        await client.post(
            f"/equipes/{equipe['id']}/aeronefs",
            json={"aeronef_id": aeronef_a["id"], "date_debut": "2026-06-01"},
            headers=admin_headers,
        )
    ).json()
    await client.put(
        f"/equipes/{equipe['id']}/aeronefs/{affectation['id']}",
        json={"date_fin": "2026-07-01"},
        headers=admin_headers,
    )

    relue = await client.get(f"/equipes/{equipe['id']}", headers=admin_headers)
    assert relue.json()["aeronef_id"] is None
    assert relue.json()["aeronef"] is None
    assert (
        len((await client.get(f"/equipes/{equipe['id']}/aeronefs", headers=admin_headers)).json())
        == 1
    )


@pytest.mark.asyncio
async def test_aeronef_deja_actif_sur_une_autre_equipe_422(
    client: AsyncClient, admin_headers: dict, equipe: dict, autre_equipe: dict, aeronef_a: dict
):
    premiere = await client.post(
        f"/equipes/{equipe['id']}/aeronefs",
        json={"aeronef_id": aeronef_a["id"], "date_debut": "2026-06-01"},
        headers=admin_headers,
    )
    assert premiere.status_code == 201, premiere.text

    conflit = await client.post(
        f"/equipes/{autre_equipe['id']}/aeronefs",
        json={"aeronef_id": aeronef_a["id"], "date_debut": "2026-06-15"},
        headers=admin_headers,
    )
    assert conflit.status_code == 422, conflit.text
    assert "chevauche" in conflit.json()["detail"]


@pytest.mark.asyncio
async def test_periodes_closes_qui_se_chevauchent_refusees_422(
    client: AsyncClient, admin_headers: dict, equipe: dict, autre_equipe: dict, aeronef_a: dict
):
    """Le chevauchement ne se limite pas aux affectations ouvertes : deux périodes
    bornées qui se recoupent sont tout autant un appareil en deux endroits."""
    premiere = await client.post(
        f"/equipes/{equipe['id']}/aeronefs",
        json={"aeronef_id": aeronef_a["id"], "date_debut": "2026-06-01", "date_fin": "2026-07-01"},
        headers=admin_headers,
    )
    assert premiere.status_code == 201, premiere.text

    conflit = await client.post(
        f"/equipes/{autre_equipe['id']}/aeronefs",
        json={"aeronef_id": aeronef_a["id"], "date_debut": "2026-06-20", "date_fin": "2026-08-01"},
        headers=admin_headers,
    )
    assert conflit.status_code == 422, conflit.text


@pytest.mark.asyncio
async def test_periodes_jointives_acceptees(
    client: AsyncClient, admin_headers: dict, equipe: dict, autre_equipe: dict, aeronef_a: dict
):
    """`[debut, fin)` est semi-ouvert : finir le 1er juillet et recommencer le 1er
    juillet ne se chevauche pas — sans quoi tout transfert d'appareil coûterait un jour
    de battement artificiel."""
    premiere = await client.post(
        f"/equipes/{equipe['id']}/aeronefs",
        json={"aeronef_id": aeronef_a["id"], "date_debut": "2026-06-01", "date_fin": "2026-07-01"},
        headers=admin_headers,
    )
    assert premiere.status_code == 201, premiere.text

    suivante = await client.post(
        f"/equipes/{autre_equipe['id']}/aeronefs",
        json={"aeronef_id": aeronef_a["id"], "date_debut": "2026-07-01"},
        headers=admin_headers,
    )
    assert suivante.status_code == 201, suivante.text


@pytest.mark.asyncio
async def test_equipe_deja_pourvue_sur_la_periode_422(
    client: AsyncClient, admin_headers: dict, equipe: dict, aeronef_a: dict, aeronef_b: dict
):
    """Les appareils d'une équipe se succèdent, ils ne se cumulent pas : sans cette
    règle « l'affectation active » n'aurait pas de sens."""
    await client.post(
        f"/equipes/{equipe['id']}/aeronefs",
        json={"aeronef_id": aeronef_a["id"], "date_debut": "2026-06-01"},
        headers=admin_headers,
    )
    conflit = await client.post(
        f"/equipes/{equipe['id']}/aeronefs",
        json={"aeronef_id": aeronef_b["id"], "date_debut": "2026-06-15"},
        headers=admin_headers,
    )
    assert conflit.status_code == 422, conflit.text
    assert "déjà un aéronef" in conflit.json()["detail"]


@pytest.mark.asyncio
async def test_date_fin_anterieure_a_date_debut_422(
    client: AsyncClient, admin_headers: dict, equipe: dict, aeronef_a: dict
):
    reponse = await client.post(
        f"/equipes/{equipe['id']}/aeronefs",
        json={"aeronef_id": aeronef_a["id"], "date_debut": "2026-07-01", "date_fin": "2026-06-01"},
        headers=admin_headers,
    )
    assert reponse.status_code == 422, reponse.text


@pytest.mark.asyncio
async def test_cloture_avant_le_debut_422(
    client: AsyncClient, admin_headers: dict, equipe: dict, aeronef_a: dict
):
    affectation = (
        await client.post(
            f"/equipes/{equipe['id']}/aeronefs",
            json={"aeronef_id": aeronef_a["id"], "date_debut": "2026-07-01"},
            headers=admin_headers,
        )
    ).json()
    reponse = await client.put(
        f"/equipes/{equipe['id']}/aeronefs/{affectation['id']}",
        json={"date_fin": "2026-06-01"},
        headers=admin_headers,
    )
    assert reponse.status_code == 422, reponse.text


@pytest.mark.asyncio
async def test_equipe_terrestre_refusee_422(
    client: AsyncClient, admin_headers: dict, equipe_terrestre_creee: dict, aeronef_a: dict
):
    reponse = await client.post(
        f"/equipes/{equipe_terrestre_creee['id']}/aeronefs",
        json={"aeronef_id": aeronef_a["id"], "date_debut": "2026-06-01"},
        headers=admin_headers,
    )
    assert reponse.status_code == 422, reponse.text


@pytest.mark.asyncio
async def test_equipe_inconnue_404(client: AsyncClient, admin_headers: dict, aeronef_a: dict):
    reponse = await client.post(
        f"/equipes/{uuid.uuid4()}/aeronefs",
        json={"aeronef_id": aeronef_a["id"], "date_debut": "2026-06-01"},
        headers=admin_headers,
    )
    assert reponse.status_code == 404, reponse.text

    historique = await client.get(f"/equipes/{uuid.uuid4()}/aeronefs", headers=admin_headers)
    assert historique.status_code == 404


@pytest.mark.asyncio
async def test_aeronef_inconnu_404(client: AsyncClient, admin_headers: dict, equipe: dict):
    reponse = await client.post(
        f"/equipes/{equipe['id']}/aeronefs",
        json={"aeronef_id": str(uuid.uuid4()), "date_debut": "2026-06-01"},
        headers=admin_headers,
    )
    assert reponse.status_code == 404, reponse.text


@pytest.mark.asyncio
async def test_cloturer_une_affectation_d_une_autre_equipe_404(
    client: AsyncClient, admin_headers: dict, equipe: dict, autre_equipe: dict, aeronef_a: dict
):
    """L'identifiant d'affectation ne suffit pas : il doit appartenir à l'équipe de
    l'URL, sinon n'importe qui borne l'appareil du voisin."""
    affectation = (
        await client.post(
            f"/equipes/{equipe['id']}/aeronefs",
            json={"aeronef_id": aeronef_a["id"], "date_debut": "2026-06-01"},
            headers=admin_headers,
        )
    ).json()
    reponse = await client.put(
        f"/equipes/{autre_equipe['id']}/aeronefs/{affectation['id']}",
        json={"date_fin": "2026-07-01"},
        headers=admin_headers,
    )
    assert reponse.status_code == 404, reponse.text


@pytest.mark.asyncio
async def test_equipe_creee_avec_son_aeronef_a_une_affectation_ouverte(
    client: AsyncClient, admin_headers: dict, chef_de_base
):
    """La forme historique de `POST /equipes` continue de marcher, et pose désormais
    une affectation ouverte plutôt qu'une colonne."""
    creee = await client.post(
        "/equipes",
        json={
            "nom": "Équipe Ihosy",
            "type": "aerien",
            "membres": [{"user_id": str(chef_de_base.id), "fonction": "chef"}],
            "aeronef": AERONEF_A,
        },
        headers=admin_headers,
    )
    assert creee.status_code == 201, creee.text

    historique = await client.get(f"/equipes/{creee.json()['id']}/aeronefs", headers=admin_headers)
    assert len(historique.json()) == 1
    assert historique.json()[0]["date_fin"] is None
    assert historique.json()[0]["aeronef"]["immatriculation"] == "5R-MJA"


@pytest.mark.asyncio
async def test_recloturer_une_affectation_deja_close_409(
    client: AsyncClient, admin_headers: dict, equipe: dict, aeronef_a: dict
):
    """Retirer un appareil est un geste qui ne se rejoue pas : déplacer une borne déjà
    posée réécrirait l'historique, qui est l'objet même de la table."""
    affectation = (
        await client.post(
            f"/equipes/{equipe['id']}/aeronefs",
            json={"aeronef_id": aeronef_a["id"], "date_debut": "2026-06-01"},
            headers=admin_headers,
        )
    ).json()
    premiere = await client.put(
        f"/equipes/{equipe['id']}/aeronefs/{affectation['id']}",
        json={"date_fin": "2026-07-01"},
        headers=admin_headers,
    )
    assert premiere.status_code == 200, premiere.text

    seconde = await client.put(
        f"/equipes/{equipe['id']}/aeronefs/{affectation['id']}",
        json={"date_fin": "2026-06-15"},
        headers=admin_headers,
    )
    assert seconde.status_code == 409, seconde.text

    historique = await client.get(f"/equipes/{equipe['id']}/aeronefs", headers=admin_headers)
    assert historique.json()[0]["date_fin"] == "2026-07-01"


# --- historique côté appareil (#621) : pendant de GET /equipes/{id}/aeronefs ------------------


@pytest.mark.asyncio
async def test_historique_d_un_aeronef_liste_les_equipes_qui_l_ont_utilise(
    client: AsyncClient,
    admin_headers: dict,
    equipe: dict,
    autre_equipe: dict,
    aeronef_a: dict,
    aeronef_b: dict,
):
    """Un appareil passe d'une équipe à l'autre : l'historique se lit des deux côtés."""
    premiere = await client.post(
        f"/equipes/{equipe['id']}/aeronefs",
        json={"aeronef_id": aeronef_a["id"], "date_debut": "2026-06-01"},
        headers=admin_headers,
    )
    assert premiere.status_code == 201, premiere.text
    await client.put(
        f"/equipes/{equipe['id']}/aeronefs/{premiere.json()['id']}",
        json={"date_fin": "2026-07-01"},
        headers=admin_headers,
    )
    seconde = await client.post(
        f"/equipes/{autre_equipe['id']}/aeronefs",
        json={"aeronef_id": aeronef_a["id"], "date_debut": "2026-07-01"},
        headers=admin_headers,
    )
    assert seconde.status_code == 201, seconde.text
    # Une affectation d'un AUTRE appareil ne doit pas apparaître dans l'historique de A.
    autre = await client.post(
        f"/equipes/{equipe['id']}/aeronefs",
        json={"aeronef_id": aeronef_b["id"], "date_debut": "2026-07-01"},
        headers=admin_headers,
    )
    assert autre.status_code == 201, autre.text

    historique = await client.get(
        f"/aeronefs/{aeronef_a['id']}/affectations", headers=admin_headers
    )

    assert historique.status_code == 200, historique.text
    lignes = historique.json()
    # La plus récente d'abord : l'équipe Betroka (en cours), puis Ihosy (close).
    assert [ligne["equipe_id"] for ligne in lignes] == [autre_equipe["id"], equipe["id"]]
    assert [ligne["date_fin"] for ligne in lignes] == [None, "2026-07-01"]
    assert {ligne["aeronef_id"] for ligne in lignes} == {aeronef_a["id"]}
    assert lignes[0]["aeronef"]["immatriculation"] == "5R-MJA"


@pytest.mark.asyncio
async def test_historique_d_un_aeronef_jamais_affecte_est_vide(
    client: AsyncClient, admin_headers: dict, aeronef_a: dict
):
    historique = await client.get(
        f"/aeronefs/{aeronef_a['id']}/affectations", headers=admin_headers
    )

    assert historique.status_code == 200
    assert historique.json() == []


@pytest.mark.asyncio
async def test_historique_d_un_aeronef_inconnu_404(client: AsyncClient, admin_headers: dict):
    historique = await client.get(f"/aeronefs/{uuid.uuid4()}/affectations", headers=admin_headers)

    assert historique.status_code == 404
    assert historique.json()["detail"] == "Aéronef non trouvé"


@pytest.mark.asyncio
async def test_historique_d_un_aeronef_exige_une_authentification(
    client: AsyncClient, aeronef_a: dict
):
    historique = await client.get(f"/aeronefs/{aeronef_a['id']}/affectations")

    assert historique.status_code in (401, 403)
