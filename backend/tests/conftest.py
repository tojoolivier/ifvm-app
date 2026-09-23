import os
import uuid

import asyncpg
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Import all models so metadata knows about all tables
import app.infrastructure.campagne_model  # noqa: F401
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
_DATABASE_URL_PAR_DEFAUT = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+asyncpg://ifvm:ifvm_secret@localhost:5432/ifvm_test"
)


def _url_par_worker_xdist(url: str) -> str:
    """Une base dédiée par worker `pytest -n` — même raison que le commentaire
    ci-dessus, mais pour le parallélisme *interne* à une seule invocation
    pytest : deux workers xdist partageant `TEST_DATABASE_URL` déclenchent le
    même DROP SCHEMA/TRUNCATE en course, avec des doublons de clé sur les
    tables de référentiel réensemencées à chaque test (`stade`, `code_stade`).
    `PYTEST_XDIST_WORKER` (ex. "gw0") n'existe que sous xdist ; en son absence
    (pytest sans -n), l'URL n'est pas modifiée.
    """
    worker_id = os.environ.get("PYTEST_XDIST_WORKER")
    if not worker_id:
        return url
    parsed = make_url(url)
    # `str(url)` masque le mot de passe (`***`) par défaut — `render_as_string`
    # explicite est requis pour obtenir une URL réellement utilisable.
    return parsed.set(database=f"{parsed.database}_{worker_id}").render_as_string(
        hide_password=False
    )


TEST_DATABASE_URL = _url_par_worker_xdist(_DATABASE_URL_PAR_DEFAUT)

_bases_deja_assurees: set[str] = set()


async def _assure_base_existe(url: str) -> None:
    """Crée la base du worker si elle n'existe pas encore (idempotent, mise en
    cache par process pour ne payer la connexion admin qu'une fois)."""
    if url in _bases_deja_assurees:
        return
    parsed = make_url(url)
    conn = await asyncpg.connect(
        host=parsed.host,
        port=parsed.port,
        user=parsed.username,
        password=parsed.password,
        database="postgres",
    )
    try:
        existe = await conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1", parsed.database
        )
        if not existe:
            await conn.execute(f'CREATE DATABASE "{parsed.database}"')
    finally:
        await conn.close()
    _bases_deja_assurees.add(url)


@pytest_asyncio.fixture
async def db_engine():
    """Base vierge par test — schéma créé une fois, puis vidé par TRUNCATE.

    Rejouer le DDL (`DROP SCHEMA public CASCADE` + `create_all`) avant *chaque*
    test fait courser la réflexion SQLAlchemy avec le catalogue Postgres : selon
    l'ordre, `create_all` recréait une table déjà présente (violation sur
    `pg_type_typname_nsp_index`) ou `drop_all` supprimait une table déjà tombée
    par cascade — d'où des `relation "utilisateur" does not exist` erratiques.
    Le DDL n'est donc joué que lorsque le schéma n'est pas déjà complet.
    """
    await _assure_base_existe(TEST_DATABASE_URL)
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    tables = ", ".join(f'public."{table.name}"' for table in Base.metadata.sorted_tables)
    # `try/finally` obligatoire : sans lui, une erreur pendant la préparation
    # sortait de la fixture avant le `dispose()`, laissant une connexion « idle
    # in transaction » qui verrouillait le schéma et faisait échouer *tous* les
    # runs suivants, y compris après correction de l'erreur d'origine.
    try:
        async with engine.begin() as conn:
            deja_en_place = (
                await conn.execute(
                    text("SELECT count(*) FROM pg_tables WHERE schemaname = 'public'")
                )
            ).scalar()
            if deja_en_place == len(Base.metadata.tables):
                await conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
            else:
                await conn.execute(text("DROP SCHEMA public CASCADE"))
                await conn.execute(text("CREATE SCHEMA public"))
                await conn.run_sync(Base.metadata.create_all)
        yield engine
    finally:
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
async def admin(db_session: AsyncSession) -> Utilisateur:
    user = Utilisateur(
        id=uuid.uuid4(),
        nom="Soa",
        prenom="Lalao",
        email=f"lalao.soa+{uuid.uuid4().hex[:6]}@test.mg",
        password_hash=hash_password("secret"),
        role="admin",
        actif=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def admin_headers(admin: Utilisateur) -> dict:
    return {"Authorization": f"Bearer {create_access_token(admin.id)}"}


@pytest_asyncio.fixture
async def verificateur(db_session: AsyncSession) -> Utilisateur:
    user = Utilisateur(
        id=uuid.uuid4(),
        nom="Test",
        prenom="Verificateur",
        email=f"verificateur+{uuid.uuid4().hex[:6]}@test.mg",
        password_hash=hash_password("secret"),
        role="verificateur",
        actif=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def validateur(db_session: AsyncSession) -> Utilisateur:
    user = Utilisateur(
        id=uuid.uuid4(),
        nom="Test",
        prenom="Validateur",
        email=f"validateur+{uuid.uuid4().hex[:6]}@test.mg",
        password_hash=hash_password("secret"),
        role="validation_finale",
        actif=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


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
async def pilote(db_session: AsyncSession) -> Utilisateur:
    user = Utilisateur(
        id=uuid.uuid4(),
        nom="Dupont",
        prenom="Jean",
        email=f"jean.dupont+{uuid.uuid4().hex[:6]}@test.mg",
        password_hash=hash_password("secret"),
        role="pilote",
        actif=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def mecanicien(db_session: AsyncSession) -> Utilisateur:
    user = Utilisateur(
        id=uuid.uuid4(),
        nom="Rabe",
        prenom="Marc",
        email=f"marc.rabe+{uuid.uuid4().hex[:6]}@test.mg",
        password_hash=hash_password("secret"),
        role="mecanicien",
        actif=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def lieu_aerien(db_session: AsyncSession):
    from app.infrastructure.referentiel_model import LieuAerienModel

    lieu = LieuAerienModel(
        id=uuid.uuid4(),
        type_lieu="principale",
        nom="Base Betioky",
        latitude=-23.7167,
        longitude=44.3833,
        altitude=100.0,
        actif=True,
    )
    db_session.add(lieu)
    await db_session.commit()
    await db_session.refresh(lieu)
    return lieu


async def _creer_equipe(db_session: AsyncSession, nom: str, type_equipe: str, chef: Utilisateur):
    """Équipe + son chef, en une fois (ADR-018 : le chef est une ligne de
    `equipe_membre`, plus une colonne de l'équipe)."""
    from app.infrastructure.referentiel_model import EquipeMembreModel, EquipeModel

    equipe = EquipeModel(id=uuid.uuid4(), nom=nom, type=type_equipe, actif=True)
    equipe.membres = [EquipeMembreModel(user_id=chef.id, fonction="chef")]
    db_session.add(equipe)
    await db_session.commit()
    await db_session.refresh(equipe)
    # Chargé explicitement : les fixtures synchrones qui lisent `equipe.membres` ne
    # peuvent pas déclencher un lazy load (pas de greenlet asyncio).
    await db_session.refresh(equipe, attribute_names=["membres"])
    return equipe


@pytest_asyncio.fixture
async def equipe_aerienne(db_session: AsyncSession, chef_de_base: Utilisateur):
    return await _creer_equipe(db_session, "Équipe Ihosy", "aerien", chef_de_base)


@pytest_asyncio.fixture
async def equipe_aerienne_bis(db_session: AsyncSession):
    """Deuxième équipe, chef distinct — pour les tests qui ont besoin d'une équipe
    encore libre (`site_aerienne.equipe_id` UNIQUE) sans réutiliser celle de la
    fixture `base_aerienne`."""
    chef = Utilisateur(
        id=uuid.uuid4(),
        nom="Rasolo",
        prenom="Voahangy",
        email=f"voahangy.rasolo+{uuid.uuid4().hex[:6]}@test.mg",
        password_hash=hash_password("secret"),
        role="chef_de_base",
        actif=True,
    )
    db_session.add(chef)
    await db_session.commit()
    return await _creer_equipe(db_session, "Équipe Betroka", "aerien", chef)


@pytest_asyncio.fixture
async def base_aerienne(db_session: AsyncSession, equipe_aerienne):
    """Site aérien principal (migration 0086, #604 — fusion de `base_aerienne` et
    `stand_remplissage` en `site_aerienne`). Le nom de la fixture est conservé : elle
    reste sémantiquement une base principale, seules les coordonnées GPS ont bougé vers
    `site_aerienne_position` (installées via l'API par les tests qui en ont besoin)."""
    from app.infrastructure.referentiel_model import SiteAerienneModel

    # #equipe-aerienne (migration 0066) : une base principale doit avoir une
    # équipe (`ck_site_aerienne_equipe_coherente`).
    base = SiteAerienneModel(
        id=uuid.uuid4(),
        equipe_id=equipe_aerienne.id,
        numero="IHO01",
        localite="Ihosy",
        actif=True,
    )
    db_session.add(base)
    await db_session.commit()
    await db_session.refresh(base)
    return base


@pytest_asyncio.fixture
async def autre_base_aerienne(db_session: AsyncSession, equipe_aerienne_bis):
    """Second site aérien principal, équipe distincte (`site_aerienne.equipe_id`
    UNIQUE) — pour les tests de transfert entre deux sites (#606)."""
    from app.infrastructure.referentiel_model import SiteAerienneModel

    base = SiteAerienneModel(
        id=uuid.uuid4(),
        equipe_id=equipe_aerienne_bis.id,
        numero="BTK01",
        localite="Betroka",
        actif=True,
    )
    db_session.add(base)
    await db_session.commit()
    await db_session.refresh(base)
    return base


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
async def equipe_terrestre(db_session: AsyncSession, chef_equipe: Utilisateur):
    return await _creer_equipe(db_session, "Équipe Terrestre Ihosy", "terrestre", chef_equipe)


@pytest_asyncio.fixture
async def equipe_terrestre_id(equipe_terrestre) -> uuid.UUID:
    """#607 : payload le plus courant (`prospection`/`traitement` terrestre ne
    veulent qu'un id, pas l'objet équipe complet) — même patron que `station_id`."""
    return equipe_terrestre.id


@pytest_asyncio.fixture
async def equipe_aerienne_id(equipe_aerienne) -> uuid.UUID:
    """#607, pendant aérien de `equipe_terrestre_id`."""
    return equipe_aerienne.id


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
