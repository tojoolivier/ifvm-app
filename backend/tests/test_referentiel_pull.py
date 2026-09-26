import uuid
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import create_access_token
from app.domain.stades import VOCABULAIRE


@pytest_asyncio.fixture
async def autre_poste_acridien(db_session: AsyncSession, zone_anti_acridien):
    from app.infrastructure.referentiel_model import PosteAcridienModel

    pa = PosteAcridienModel(
        id=uuid.uuid4(), code="PA-TEST-02", nom="Autre Poste", za_id=zone_anti_acridien.id
    )
    db_session.add(pa)
    await db_session.commit()
    await db_session.refresh(pa)
    return pa


@pytest_asyncio.fixture
async def utilisateur_avec_pa(db_session: AsyncSession, poste_acridien):
    from app.auth import hash_password
    from app.models.users import Utilisateur

    user = Utilisateur(
        id=uuid.uuid4(),
        nom="Rasoa",
        prenom="Marie",
        email=f"marie.rasoa+{uuid.uuid4().hex[:6]}@test.mg",
        password_hash=hash_password("secret"),
        role="prospecteur",
        pa_id=poste_acridien.id,
        actif=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def collegue_meme_pa(db_session: AsyncSession, poste_acridien):
    from app.auth import hash_password
    from app.models.users import Utilisateur

    user = Utilisateur(
        id=uuid.uuid4(),
        nom="Randria",
        prenom="Paul",
        email=f"paul.randria+{uuid.uuid4().hex[:6]}@test.mg",
        password_hash=hash_password("secret"),
        role="prospecteur",
        pa_id=poste_acridien.id,
        actif=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def station_autre_pa(db_session: AsyncSession, autre_poste_acridien, commune):
    from app.infrastructure.referentiel_model import StationFixeModel

    station = StationFixeModel(
        id=uuid.uuid4(),
        code="ST-AUTRE-001",
        nom="Station Autre PA",
        pa_id=autre_poste_acridien.id,
        latitude=-19.0,
        longitude=46.0,
        commune_id=commune.id,
        actif=True,
    )
    db_session.add(station)
    await db_session.commit()
    return station


@pytest_asyncio.fixture
async def pesticide(db_session: AsyncSession):
    from app.infrastructure.referentiel_model import PesticideModel

    p = PesticideModel(
        id=uuid.uuid4(), code="PEST-01", nom="Fenitrothion", type_produit="produit_barriere"
    )
    db_session.add(p)
    await db_session.commit()
    return p


@pytest_asyncio.fixture
async def culture(db_session: AsyncSession):
    from app.infrastructure.referentiel_model import CultureModel

    c = CultureModel(id=uuid.uuid4(), code="CULT-01", nom="Riz")
    db_session.add(c)
    await db_session.commit()
    return c


@pytest_asyncio.fixture
async def lieu_aerien(db_session: AsyncSession):
    from app.infrastructure.referentiel_model import LieuAerienModel

    lieu = LieuAerienModel(
        id=uuid.uuid4(),
        type_lieu="principale",
        nom="Tuléar",
        latitude=-23.35,
        longitude=43.68,
    )
    db_session.add(lieu)
    await db_session.commit()
    return lieu


@pytest_asyncio.fixture
async def code_stade(db_session: AsyncSession):
    # Le référentiel des stades est déjà semé pour toute la session (cf. conftest) :
    # `prospection_capture.stade` le référence par clé étrangère.
    from sqlalchemy import select

    from app.infrastructure.referentiel_model import CodeStadeModel

    # A1 figure dans deux grilles (femelle et mâle) : n'importe laquelle fait l'affaire.
    result = await db_session.execute(select(CodeStadeModel).where(CodeStadeModel.code == "A1"))
    return result.scalars().first()


@pytest.mark.asyncio
async def test_pull_since_null_returns_full_referentiel_unscoped(
    client: AsyncClient,
    utilisateur_avec_pa,
    collegue_meme_pa,
    poste_acridien,
    autre_poste_acridien,
    station_fixe,
    station_autre_pa,
    pesticide,
    culture,
    code_stade,
    lieu_aerien,
):
    token = create_access_token(utilisateur_avec_pa.id)
    response = await client.get("/referentiel/pull", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    body = response.json()

    pa_codes = {p["code"] for p in body["postes_acridiens"]["upserts"]}
    assert pa_codes == {poste_acridien.code, autre_poste_acridien.code}

    station_codes = {s["code"] for s in body["stations_fixes"]["upserts"]}
    assert station_codes == {station_fixe.code, station_autre_pa.code}

    equipe_ids = {u["id"] for u in body["utilisateurs_equipe"]["upserts"]}
    assert equipe_ids == {str(utilisateur_avec_pa.id), str(collegue_meme_pa.id)}
    # L'email ne descend pas sur le terrain (ADR-014, #136).
    assert all("email" not in u for u in body["utilisateurs_equipe"]["upserts"])

    pesticide_codes = {p["code"] for p in body["pesticides"]["upserts"]}
    assert pesticide_codes == {pesticide.code}
    # Filtrage mobile du choix de pesticide par mode_traitement (BARRIERE/TOTAL/
    # IRREGULIER) : le pull doit descendre type_produit, sans quoi le mobile ne peut
    # pas savoir quels pesticides proposer.
    pesticide_sync = next(p for p in body["pesticides"]["upserts"] if p["code"] == pesticide.code)
    assert pesticide_sync["type_produit"] == "produit_barriere"

    culture_codes = {c["code"] for c in body["cultures"]["upserts"]}
    assert culture_codes == {culture.code}

    stade_codes = {c["code"] for c in body["codes_stades"]["upserts"]}
    assert stade_codes == {code for code, _ in VOCABULAIRE}
    assert code_stade.code in stade_codes

    lieu_aerien_noms = {lieu["nom"] for lieu in body["lieux_aeriens"]["upserts"]}
    assert lieu_aerien_noms == {lieu_aerien.nom}

    for entity in body.values():
        assert "server_time" in entity


@pytest.mark.asyncio
async def test_pull_since_null_returns_campagnes(client: AsyncClient, auth_headers, campagne_id):
    response = await client.get("/referentiel/pull", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    campagne_ids = {c["id"] for c in body["campagnes"]["upserts"]}
    assert campagne_ids == {str(campagne_id)}
    assert all(c["actif"] is True for c in body["campagnes"]["upserts"])


@pytest.mark.asyncio
async def test_pull_inclut_une_campagne_desactivee_comme_upsert(
    client: AsyncClient, auth_headers, campagne_id
):
    """La désactivation logique reste un upsert (#137) : un pull incrémental doit
    faire redescendre `actif: false`, jamais faire disparaître la campagne."""
    await client.put(f"/campagnes/{campagne_id}", json={"actif": False}, headers=auth_headers)

    response = await client.get("/referentiel/pull", headers=auth_headers)

    body = response.json()
    upserts = {c["id"]: c["actif"] for c in body["campagnes"]["upserts"]}
    assert upserts[str(campagne_id)] is False


@pytest.mark.asyncio
async def test_pull_campagnes_respects_since_cursor(client: AsyncClient, auth_headers, campagne_id):
    future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    response = await client.get(
        "/referentiel/pull",
        params={"since_campagnes": future},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["campagnes"]["upserts"] == []


@pytest.mark.asyncio
async def test_pull_since_timestamp_returns_only_recent_upserts(
    client: AsyncClient, auth_headers, poste_acridien
):
    future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    response = await client.get(
        "/referentiel/pull",
        params={"since_postes_acridiens": future},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["postes_acridiens"]["upserts"] == []


@pytest.mark.asyncio
async def test_pull_cursors_are_independent_per_entity(
    client: AsyncClient, auth_headers, poste_acridien, pesticide
):
    future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()

    response = await client.get(
        "/referentiel/pull",
        params={"since_postes_acridiens": future},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()

    assert body["postes_acridiens"]["upserts"] == []
    pesticide_codes = {p["code"] for p in body["pesticides"]["upserts"]}
    assert pesticide_codes == {pesticide.code}


@pytest.mark.asyncio
async def test_pull_includes_inactive_entities_for_soft_delete_sync(
    client: AsyncClient, utilisateur_avec_pa, station_fixe, db_session: AsyncSession
):
    station_fixe.actif = False
    db_session.add(station_fixe)
    await db_session.commit()

    token = create_access_token(utilisateur_avec_pa.id)
    response = await client.get("/referentiel/pull", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    body = response.json()
    stations = {s["code"]: s["actif"] for s in body["stations_fixes"]["upserts"]}
    assert stations[station_fixe.code] is False


@pytest.mark.asyncio
async def test_pull_requires_auth(client: AsyncClient):
    response = await client.get("/referentiel/pull")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_pull_without_pa_still_returns_all_stations_and_equipe(
    client: AsyncClient, auth_headers, utilisateur_avec_pa, station_fixe
):
    """Le référentiel offline n'est plus scopé au PA du demandeur (cf. besoin de sélection
    manuelle du PA/station sur la fiche, quel que soit le PA affecté à l'agent)."""
    response = await client.get("/referentiel/pull", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    station_codes = {s["code"] for s in body["stations_fixes"]["upserts"]}
    assert station_codes == {station_fixe.code}
    equipe_ids = {u["id"] for u in body["utilisateurs_equipe"]["upserts"]}
    assert str(utilisateur_avec_pa.id) in equipe_ids


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["prospecteur", "chef_de_base", "chef_equipe", "admin"])
async def test_pull_utilisateurs_equipe_est_identique_quel_que_soit_le_role(
    client: AsyncClient,
    db_session: AsyncSession,
    poste_acridien,
    collegue_meme_pa,
    role: str,
):
    """ADR-015 : aucun scope par rôle ni par poste sur `utilisateurs_equipe` — le
    demandeur reçoit l'annuaire complet quel que soit son rôle, sans email."""
    from app.auth import hash_password
    from app.models.users import Utilisateur

    demandeur = Utilisateur(
        id=uuid.uuid4(),
        nom="Demandeur",
        prenom=role,
        email=f"{role}+{uuid.uuid4().hex[:6]}@test.mg",
        password_hash=hash_password("secret"),
        role=role,
        pa_id=poste_acridien.id,
        actif=True,
    )
    db_session.add(demandeur)
    await db_session.commit()

    token = create_access_token(demandeur.id)
    response = await client.get("/referentiel/pull", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    upserts = response.json()["utilisateurs_equipe"]["upserts"]

    assert {u["id"] for u in upserts} == {str(demandeur.id), str(collegue_meme_pa.id)}
    assert all("email" not in u for u in upserts)


@pytest.mark.asyncio
async def test_pull_utilisateurs_equipe_inclut_les_comptes_inactifs(
    client: AsyncClient, utilisateur_avec_pa, collegue_meme_pa, db_session: AsyncSession
):
    """Le pull ne transporte que des upserts : une désactivation ne se propage aux
    téléphones déjà synchronisés que si la ligne `actif=false` continue de descendre
    (ADR-015, point 4)."""
    collegue_meme_pa.actif = False
    db_session.add(collegue_meme_pa)
    await db_session.commit()

    token = create_access_token(utilisateur_avec_pa.id)
    response = await client.get("/referentiel/pull", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    equipe = {u["id"]: u["actif"] for u in response.json()["utilisateurs_equipe"]["upserts"]}
    assert equipe[str(collegue_meme_pa.id)] is False


@pytest.mark.asyncio
async def test_pull_utilisateurs_equipe_transporte_le_sigle(
    client: AsyncClient, utilisateur_avec_pa, collegue_meme_pa, db_session: AsyncSession
):
    """#numero-fiche-traitement-trt : le numéro d'une fiche de traitement porte le sigle de son
    chef, que le mobile doit connaître hors ligne — il descend avec la liste des utilisateurs."""
    collegue_meme_pa.sigle = "RKT"
    db_session.add(collegue_meme_pa)
    await db_session.commit()

    token = create_access_token(utilisateur_avec_pa.id)
    response = await client.get("/referentiel/pull", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    sigles = {u["id"]: u["sigle"] for u in response.json()["utilisateurs_equipe"]["upserts"]}
    assert sigles[str(collegue_meme_pa.id)] == "RKT"
    assert sigles[str(utilisateur_avec_pa.id)] is None
