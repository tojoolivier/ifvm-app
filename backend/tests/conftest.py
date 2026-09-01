import os
import uuid

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Import all models so metadata knows about all tables
import app.infrastructure.campagne_model  # noqa: F401
import app.infrastructure.fiche_vol_model  # noqa: F401
import app.infrastructure.prospection_model  # noqa: F401
import app.infrastructure.referentiel_model  # noqa: F401
import app.infrastructure.traitement_model  # noqa: F401
from app.auth import create_access_token, hash_password
from app.database import get_db
from app.domain.stades import GRILLES, VOCABULAIRE
from app.infrastructure.referentiel_model import CodeStadeModel, StadeModel
from app.main import app as fastapi_app
from app.models.base import Base
from app.models.users import Utilisateur

# `db_engine` recrée le schéma à chaque test (DROP SCHEMA ... CASCADE). Deux suites
# lancées en parallèle sur la même base se prennent donc des deadlocks de catalogue :
# surchargez cette URL pour donner sa propre base à chaque worktree.
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+asyncpg://ifvm:ifvm_secret@localhost:5432/ifvm_test"
)


@pytest_asyncio.fixture
async def db_engine():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine):
    session_factory = async_sessionmaker(db_engine, expire_on_commit=False)
    async with session_factory() as session:
        # `prospection_capture.stade` référence `stade` : sans le référentiel, aucune
        # capture n'est insérable.
        session.add_all(StadeModel(code=code, libelle=libelle) for code, libelle in VOCABULAIRE)
        # `code_stade.code` référence `stade.code` — aucune relation ORM ne l'indique à
        # l'unit of work, il faut donc écrire le vocabulaire avant les grilles.
        await session.flush()
        session.add_all(
            CodeStadeModel(
                code=p.code,
                categorie=p.categorie,
                sexe=p.sexe,
                espece=p.espece,
                libelle=p.libelle,
                ordre=p.ordre,
            )
            for p in GRILLES
        )
        await session.commit()
        yield session


@pytest_asyncio.fixture
async def client(db_session: AsyncSession):
    async def override_get_db():
        yield db_session

    fastapi_app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=fastapi_app), base_url="http://test") as c:
        yield c
    fastapi_app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def utilisateur(db_session: AsyncSession) -> Utilisateur:
    user = Utilisateur(
        id=uuid.uuid4(),
        nom="Rakoto",
        prenom="Jean",
        email=f"jean.rakoto+{uuid.uuid4().hex[:6]}@test.mg",
        password_hash=hash_password("secret"),
        role="prospecteur",
        actif=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def auth_headers(utilisateur: Utilisateur) -> dict:
    token = create_access_token(utilisateur.id)
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def chef_de_base(db_session: AsyncSession) -> Utilisateur:
    user = Utilisateur(
        id=uuid.uuid4(),
        nom="Andria",
        prenom="Hery",
        email=f"hery.andria+{uuid.uuid4().hex[:6]}@test.mg",
        password_hash=hash_password("secret"),
        role="chef_de_base",
        actif=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def chef_equipe(db_session: AsyncSession) -> Utilisateur:
    user = Utilisateur(
        id=uuid.uuid4(),
        nom="Andria",
        prenom="Hery",
        email=f"hery.chefequipe+{uuid.uuid4().hex[:6]}@test.mg",
        password_hash=hash_password("secret"),
        role="chef_equipe",
        actif=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def campagne_id(db_session: AsyncSession, utilisateur: Utilisateur) -> uuid.UUID:
    from datetime import date

    from app.infrastructure.campagne_model import CampagneModel

    c = CampagneModel(
        id=uuid.uuid4(),
        name="Campagne Test 2026",
        start_date=date(2026, 1, 1),
        end_date=None,
        created_by=utilisateur.id,
    )
    db_session.add(c)
    await db_session.commit()
    return c.id


@pytest_asyncio.fixture
async def zone_anti_acridien(db_session: AsyncSession):
    from app.infrastructure.referentiel_model import ZoneAntiAcridienModel

    za = ZoneAntiAcridienModel(
        id=uuid.uuid4(),
        code="ZA-TEST-01",
        nom="Zone Test",
    )
    db_session.add(za)
    await db_session.commit()
    await db_session.refresh(za)
    return za


@pytest_asyncio.fixture
async def poste_acridien(db_session: AsyncSession, zone_anti_acridien):
    from app.infrastructure.referentiel_model import PosteAcridienModel

    pa = PosteAcridienModel(
        id=uuid.uuid4(),
        code="PA-TEST-01",
        nom="Poste Test",
        za_id=zone_anti_acridien.id,
    )
    db_session.add(pa)
    await db_session.commit()
    await db_session.refresh(pa)
    return pa


@pytest_asyncio.fixture
async def commune(db_session: AsyncSession):
    from app.infrastructure.referentiel_model import CommuneModel, DistrictModel, RegionModel

    region = RegionModel(id=uuid.uuid4(), nom="Région Test")
    db_session.add(region)
    await db_session.flush()

    district = DistrictModel(id=uuid.uuid4(), nom="District Test", region_id=region.id)
    db_session.add(district)
    await db_session.flush()

    commune = CommuneModel(id=uuid.uuid4(), nom="Commune Test", district_id=district.id)
    db_session.add(commune)
    await db_session.commit()
    await db_session.refresh(commune)
    return commune


@pytest_asyncio.fixture
async def station_fixe(db_session: AsyncSession, poste_acridien, commune):
    from app.infrastructure.referentiel_model import StationFixeModel

    station = StationFixeModel(
        id=uuid.uuid4(),
        code="ST-TEST-001",
        nom="Station Test",
        pa_id=poste_acridien.id,
        latitude=-20.0,
        longitude=45.0,
        altitude=500,
        commune_id=commune.id,
        actif=True,
    )
    db_session.add(station)
    await db_session.commit()
    await db_session.refresh(station)
    return station


@pytest_asyncio.fixture
async def station_id(station_fixe) -> uuid.UUID:
    return station_fixe.id


@pytest_asyncio.fixture
async def pesticide(db_session: AsyncSession):
    from app.infrastructure.referentiel_model import PesticideModel

    p = PesticideModel(
        id=uuid.uuid4(),
        code=f"PEST-{uuid.uuid4().hex[:6]}",
        nom="Fenitrothion",
    )
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)
    return p
