import uuid
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import text

from app.main import app as fastapi_app
from app.database import get_db
from app.models.base import Base
from app.models.users import Utilisateur
from app.auth import hash_password, create_access_token

# Import all models so metadata knows about all tables
import app.infrastructure.campagne_model  # noqa: F401
import app.infrastructure.prospection_model  # noqa: F401

TEST_DATABASE_URL = "postgresql+asyncpg://ifvm:ifvm_secret@localhost:5432/ifvm_test"


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
async def campagne_id(db_session: AsyncSession, utilisateur: Utilisateur) -> uuid.UUID:
    from app.infrastructure.campagne_model import CampagneModel
    from datetime import date

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
