import uuid
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import create_access_token


@pytest_asyncio.fixture
async def autre_poste_acridien(db_session: AsyncSession):
    from app.infrastructure.referentiel_model import PosteAcridienModel

    pa = PosteAcridienModel(
        id=uuid.uuid4(), code="PA-TEST-02", nom="Autre Poste", region="Autre Region"
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
async def station_autre_pa(db_session: AsyncSession, autre_poste_acridien):
    from app.infrastructure.referentiel_model import StationFixeModel

    station = StationFixeModel(
        id=uuid.uuid4(),
        code="ST-AUTRE-001",
        nom="Station Autre PA",
        pa_id=autre_poste_acridien.id,
        latitude=-19.0,
        longitude=46.0,
        actif=True,
    )
    db_session.add(station)
    await db_session.commit()
    return station


@pytest_asyncio.fixture
async def pesticide(db_session: AsyncSession):
    from app.infrastructure.referentiel_model import PesticideModel

    p = PesticideModel(id=uuid.uuid4(), code="PEST-01", nom="Fenitrothion")
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
async def code_stade(db_session: AsyncSession):
    from app.infrastructure.referentiel_model import CodeStadeModel

    cs = CodeStadeModel(id=uuid.uuid4(), code="A1", espece="LMC", libelle="Larve stade 1")
    db_session.add(cs)
    await db_session.commit()
    return cs


@pytest.mark.asyncio
async def test_pull_since_null_returns_full_referentiel_scoped_to_agent_pa(
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
):
    token = create_access_token(utilisateur_avec_pa.id)
    response = await client.get("/referentiel/pull", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    body = response.json()

    pa_codes = {p["code"] for p in body["postes_acridiens"]["upserts"]}
    assert pa_codes == {poste_acridien.code, autre_poste_acridien.code}

    station_codes = {s["code"] for s in body["stations_fixes"]["upserts"]}
    assert station_codes == {station_fixe.code}

    equipe_emails = {u["email"] for u in body["utilisateurs_equipe"]["upserts"]}
    assert equipe_emails == {utilisateur_avec_pa.email, collegue_meme_pa.email}

    pesticide_codes = {p["code"] for p in body["pesticides"]["upserts"]}
    assert pesticide_codes == {pesticide.code}

    culture_codes = {c["code"] for c in body["cultures"]["upserts"]}
    assert culture_codes == {culture.code}

    stade_codes = {c["code"] for c in body["codes_stades"]["upserts"]}
    assert stade_codes == {code_stade.code}

    for entity in body.values():
        assert "server_time" in entity


@pytest.mark.asyncio
async def test_pull_since_timestamp_returns_only_recent_upserts(
    client: AsyncClient, auth_headers, poste_acridien
):
    future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    response = await client.get("/referentiel/pull", params={"since": future}, headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["postes_acridiens"]["upserts"] == []


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
async def test_pull_without_pa_returns_no_stations_or_equipe(
    client: AsyncClient, auth_headers, station_fixe
):
    response = await client.get("/referentiel/pull", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["stations_fixes"]["upserts"] == []
    assert body["utilisateurs_equipe"]["upserts"] == []
