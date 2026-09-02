from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

from app.e2e_seed import (
    E2E_ALLOW_DEV_DEFAULT_ENV,
    E2E_BOT_EMAIL,
    E2E_CAMPAGNE_NAME,
    E2E_PASSWORD_ENV,
    E2E_ZONE_CODE,
    _check_password_configured,
    e2e_bot_password,
    seed_e2e,
)
from app.infrastructure.campagne_model import CampagneModel
from app.infrastructure.referentiel_model import ZoneAntiAcridienModel
from app.models.users import Utilisateur


async def _count(db, model, col, val) -> int:
    return (await db.execute(select(func.count()).select_from(model).where(col == val))).scalar()


async def test_seed_cree_compte_campagne_et_zone(db_session):
    summary = await seed_e2e(db_session)

    bot = (
        await db_session.execute(select(Utilisateur).where(Utilisateur.email == E2E_BOT_EMAIL))
    ).scalar_one()
    assert bot.actif is True
    assert bot.role == "prospecteur"

    campagne = (
        await db_session.execute(
            select(CampagneModel).where(CampagneModel.name == E2E_CAMPAGNE_NAME)
        )
    ).scalar_one()
    assert campagne.created_by == bot.id

    zone = (
        await db_session.execute(
            select(ZoneAntiAcridienModel).where(ZoneAntiAcridienModel.code == E2E_ZONE_CODE)
        )
    ).scalar_one()

    assert summary.utilisateur_id == str(bot.id)
    assert summary.campagne_id == str(campagne.id)
    assert summary.zone_id == str(zone.id)
    assert summary.utilisateur_cree is True


async def test_seed_est_idempotent(db_session):
    await seed_e2e(db_session)
    second = await seed_e2e(db_session)

    assert await _count(db_session, Utilisateur, Utilisateur.email, E2E_BOT_EMAIL) == 1
    assert await _count(db_session, CampagneModel, CampagneModel.name, E2E_CAMPAGNE_NAME) == 1
    assert (
        await _count(db_session, ZoneAntiAcridienModel, ZoneAntiAcridienModel.code, E2E_ZONE_CODE)
        == 1
    )
    assert second.utilisateur_cree is False
    assert second.campagne_creee is False
    assert second.zone_creee is False


async def test_seed_tolere_une_campagne_homonyme_preexistante(db_session):
    from datetime import date

    await seed_e2e(db_session)
    bot = (
        await db_session.execute(select(Utilisateur).where(Utilisateur.email == E2E_BOT_EMAIL))
    ).scalar_one()
    # `campagne.name` n'est pas unique : un homonyme ne doit pas casser le seed.
    db_session.add(
        CampagneModel(name=E2E_CAMPAGNE_NAME, start_date=date(2025, 1, 1), created_by=bot.id)
    )
    await db_session.commit()

    summary = await seed_e2e(db_session)
    assert summary.campagne_creee is False


async def test_seed_repare_un_compte_desactive(db_session):
    await seed_e2e(db_session)
    bot = (
        await db_session.execute(select(Utilisateur).where(Utilisateur.email == E2E_BOT_EMAIL))
    ).scalar_one()
    bot.actif = False
    await db_session.commit()

    await seed_e2e(db_session)
    await db_session.refresh(bot)
    assert bot.actif is True


async def test_credentials_seedes_permettent_le_login(client: AsyncClient, db_session):
    await seed_e2e(db_session)

    resp = await client.post(
        "/auth/login",
        json={"email": E2E_BOT_EMAIL, "password": e2e_bot_password()},
    )
    assert resp.status_code == 200
    assert resp.json()["access_token"]


async def test_campagne_e2e_visible_dans_le_referentiel(client: AsyncClient, db_session):
    await seed_e2e(db_session)
    token = (
        await client.post(
            "/auth/login",
            json={"email": E2E_BOT_EMAIL, "password": e2e_bot_password()},
        )
    ).json()["access_token"]

    resp = await client.get("/referentiel/pull", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.json()
    campagne_names = [c["name"] for c in body["campagnes"]["upserts"]]
    zone_codes = [z["code"] for z in body["zones_anti_acridiennes"]["upserts"]]
    assert E2E_CAMPAGNE_NAME in campagne_names
    assert E2E_ZONE_CODE in zone_codes


def test_check_password_refuse_le_defaut_sans_opt_in(monkeypatch):
    monkeypatch.delenv(E2E_PASSWORD_ENV, raising=False)
    monkeypatch.delenv(E2E_ALLOW_DEV_DEFAULT_ENV, raising=False)
    with pytest.raises(SystemExit):
        _check_password_configured()


def test_check_password_ok_avec_opt_in(monkeypatch):
    monkeypatch.delenv(E2E_PASSWORD_ENV, raising=False)
    monkeypatch.setenv(E2E_ALLOW_DEV_DEFAULT_ENV, "1")
    _check_password_configured()  # ne lève pas


def test_check_password_ok_avec_secret(monkeypatch):
    monkeypatch.setenv(E2E_PASSWORD_ENV, "un-vrai-secret")
    _check_password_configured()  # ne lève pas
