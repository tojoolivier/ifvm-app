"""Soft-delete `deleted_at` du référentiel (#674)."""

import re
from datetime import datetime, timedelta
from pathlib import Path

import pytest

APP = Path(__file__).resolve().parents[1] / "app"


def _pull_depuis(entite: str, since: datetime):
    return {f"since_{entite}": since.isoformat()}


async def _upserts(client, headers, entite: str, since: datetime | None = None):
    params = _pull_depuis(entite, since) if since else {}
    reponse = await client.get("/referentiel/pull", headers=headers, params=params)
    assert reponse.status_code == 200
    return reponse.json()[entite]["upserts"]


def test_aucun_delete_physique_sur_le_referentiel():
    """Le référentiel ne s'efface jamais physiquement : ni `session.delete`, ni `delete()`."""
    fichiers = [
        APP / "infrastructure" / "referentiel_repository.py",
        APP / "infrastructure" / "referentiel_sync_repository.py",
        APP / "infrastructure" / "campagne_repository.py",
        APP / "presentation" / "referentiel_routes.py",
        APP / "presentation" / "campagne_routes.py",
        APP / "presentation" / "suppression_routes.py",
    ]
    # `MouvementPesticideModel` est un journal de stock (donnée transactionnelle), pas du
    # référentiel synchronisé.
    motif = re.compile(
        r"session\.delete\(|\bdb\.delete\("
        r"|\bdelete\(\s*(?!MouvementPesticideModel)\w*Model|DELETE FROM"
    )
    for fichier in fichiers:
        assert not motif.search(fichier.read_text()), f"DELETE physique dans {fichier.name}"


async def test_supprimer_un_poste_le_sort_de_la_liste_et_le_renvoie_dans_le_pull(
    client, admin_headers, poste_acridien
):
    avant = datetime.utcnow() - timedelta(minutes=1)

    reponse = await client.delete(f"/postes-acridiens/{poste_acridien.id}", headers=admin_headers)
    assert reponse.status_code == 204

    liste = await client.get("/postes-acridiens", headers=admin_headers)
    assert str(poste_acridien.id) not in [p["id"] for p in liste.json()]
    detail = await client.get(f"/postes-acridiens/{poste_acridien.id}", headers=admin_headers)
    assert detail.status_code == 404

    upserts = await _upserts(client, admin_headers, "postes_acridiens", avant)
    ligne = next(p for p in upserts if p["id"] == str(poste_acridien.id))
    assert ligne["deleted_at"] is not None


async def test_le_pull_normal_expose_deleted_at_null_pour_une_ligne_vivante(
    client, admin_headers, poste_acridien
):
    upserts = await _upserts(client, admin_headers, "postes_acridiens")
    ligne = next(p for p in upserts if p["id"] == str(poste_acridien.id))
    assert ligne["deleted_at"] is None


async def test_supprimer_deux_fois_donne_404(client, admin_headers, poste_acridien):
    await client.delete(f"/postes-acridiens/{poste_acridien.id}", headers=admin_headers)
    reponse = await client.delete(f"/postes-acridiens/{poste_acridien.id}", headers=admin_headers)
    assert reponse.status_code == 404


async def test_supprimer_reserve_a_ladmin(client, auth_headers, poste_acridien):
    reponse = await client.delete(f"/postes-acridiens/{poste_acridien.id}", headers=auth_headers)
    assert reponse.status_code == 403


async def test_un_poste_avec_stations_vivantes_ne_se_supprime_pas(
    client, admin_headers, poste_acridien, station_fixe
):
    reponse = await client.delete(f"/postes-acridiens/{poste_acridien.id}", headers=admin_headers)
    assert reponse.status_code == 409


async def test_la_station_supprimee_libere_son_poste(
    client, admin_headers, poste_acridien, station_fixe
):
    assert (
        await client.delete(f"/stations/{station_fixe.id}", headers=admin_headers)
    ).status_code == 204
    assert (
        await client.delete(f"/postes-acridiens/{poste_acridien.id}", headers=admin_headers)
    ).status_code == 204


@pytest.mark.parametrize(
    ("chemin", "entite"),
    [("/zones-anti-acridiennes", "zones_anti_acridiennes")],
)
async def test_supprimer_une_zone_sans_poste(client, admin_headers, db_session, chemin, entite):
    from app.infrastructure.referentiel_model import ZoneAntiAcridienModel

    zone = ZoneAntiAcridienModel(code="ZA-DEL", nom="Zone à supprimer")
    db_session.add(zone)
    await db_session.commit()
    avant = datetime.utcnow() - timedelta(minutes=1)

    assert (await client.delete(f"{chemin}/{zone.id}", headers=admin_headers)).status_code == 204
    upserts = await _upserts(client, admin_headers, entite, avant)
    assert next(z for z in upserts if z["id"] == str(zone.id))["deleted_at"] is not None


async def test_le_code_dun_poste_supprime_est_reutilisable(
    client, admin_headers, poste_acridien, zone_anti_acridien
):
    """Unicité limitée aux lignes vivantes (index partiel `WHERE deleted_at IS NULL`)."""
    code = poste_acridien.code
    await client.delete(f"/postes-acridiens/{poste_acridien.id}", headers=admin_headers)

    reponse = await client.post(
        "/postes-acridiens",
        headers=admin_headers,
        json={"code": code, "nom": "Recréé", "za_id": str(zone_anti_acridien.id)},
    )

    assert reponse.status_code == 201, reponse.text


async def test_un_code_vivant_reste_unique(
    client, admin_headers, poste_acridien, zone_anti_acridien
):
    reponse = await client.post(
        "/postes-acridiens",
        headers=admin_headers,
        json={
            "code": poste_acridien.code,
            "nom": "Doublon",
            "za_id": str(zone_anti_acridien.id),
        },
    )

    assert reponse.status_code == 409


async def test_la_liste_des_utilisateurs_garde_le_poste_dun_agent_apres_suppression(
    client, admin_headers, admin, db_session, poste_acridien
):
    """L'affectation d'un agent est de l'historique : la jointure ne doit pas la perdre."""
    admin.pa_id = poste_acridien.id
    await db_session.commit()
    await client.delete(f"/postes-acridiens/{poste_acridien.id}", headers=admin_headers)

    reponse = await client.get("/users/", headers=admin_headers)

    ligne = next(u for u in reponse.json() if u["id"] == str(admin.id))
    assert ligne["pa_code"] == poste_acridien.code
