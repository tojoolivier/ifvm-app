"""
Provisionne le compte et la campagne dédiés aux tests e2e mobile (« e2e-bot »).

Objectif (#194, épic #193) : donner aux tests Maestro un jeu de données isolé et
reproductible sur l'environnement staging (`https://ifvm.orakotondravao.com/api`),
sans jamais mélanger ces données avec de la prospection réelle.

Ce qui est créé / mis à jour :
  - un utilisateur `e2e-bot` (rôle prospecteur, `actif=True`) ;
  - une campagne préfixée `[E2E]` (créée par e2e-bot) ;
  - une zone anti-acridienne préfixée `[E2E]` (visible dans `GET /referentiel/pull`).

Tout est identifiable / filtrable pour être exclu des rapports réels :
  - l'utilisateur via l'email `@e2e.ifvm.test` ;
  - la campagne et la zone via le préfixe `[E2E] ` dans leur nom.

Idempotent : ré-exécutable autant de fois que voulu (lookup par email / nom / code,
jamais de doublon). Le mot de passe est ré-appliqué à chaque exécution pour que les
credentials attendus par la CI restent toujours valides.

Credentials :
  - email   : `e2e-bot@e2e.ifvm.test` (constante `E2E_BOT_EMAIL`)
  - mot de passe : variable d'environnement `E2E_BOT_PASSWORD`
    (défaut de dev non secret : `e2e-bot-local-dev` — à surcharger en CI/staging
    via un secret GitHub Actions).

GPS : `E2E_GPS_LATITUDE` / `E2E_GPS_LONGITUDE` sont des constantes (coordonnées
fixes dans une zone acridienne du Sud-Ouest malgache) à injecter dans l'émulateur
avant le flow Maestro (la saisie de prospection exige une position GPS valide).

Usage :
    # en local (backend démarré via docker compose)
    docker compose exec backend python -m app.e2e_seed

    # contre staging (depuis un runner CI, DATABASE_URL pointant sur la base staging)
    E2E_BOT_PASSWORD=*** DATABASE_URL=*** python -m app.e2e_seed
"""

from __future__ import annotations

import asyncio
import os
import sys
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date
from typing import TypeVar

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import app.models  # noqa: F401  (résout le cycle d'import app.models <-> app.infrastructure)
from app.auth import hash_password, verify_password
from app.database import AsyncSessionLocal
from app.infrastructure.campagne_model import CampagneModel
from app.infrastructure.referentiel_model import ZoneAntiAcridienModel
from app.models.base import Base
from app.models.users import Utilisateur

E2E_BOT_EMAIL = "e2e-bot@e2e.ifvm.test"
E2E_BOT_NOM = "E2E"
E2E_BOT_PRENOM = "Bot"
E2E_BOT_ROLE = "prospecteur"
E2E_PASSWORD_ENV = "E2E_BOT_PASSWORD"
E2E_PASSWORD_DEV_DEFAULT = "e2e-bot-local-dev"
# Garde-fou : sans `E2E_BOT_PASSWORD`, le CLI refuse de tourner sauf opt-in explicite,
# pour ne pas poser le mot de passe par défaut (public) sur staging.
E2E_ALLOW_DEV_DEFAULT_ENV = "E2E_SEED_ALLOW_DEV_DEFAULT"

E2E_CAMPAGNE_NAME = "[E2E] Campagne e2e-bot"
E2E_CAMPAGNE_START = date(2026, 1, 1)

E2E_ZONE_CODE = "E2E-ZAA-01"
E2E_ZONE_NOM = "[E2E] Zone acridienne de test"

# Sud-Ouest malgache (secteur Betioky / Toliara) — zone acridienne connue.
E2E_GPS_LATITUDE = -23.712
E2E_GPS_LONGITUDE = 44.401

T = TypeVar("T", bound=Base)


@dataclass
class E2ESeedSummary:
    utilisateur_id: str
    utilisateur_email: str
    utilisateur_password: str
    utilisateur_cree: bool
    campagne_id: str
    campagne_name: str
    campagne_creee: bool
    zone_id: str
    zone_code: str
    zone_creee: bool
    gps_latitude: float
    gps_longitude: float


def e2e_bot_password() -> str:
    """Mot de passe attendu pour le compte e2e-bot (env, avec défaut de dev)."""
    return os.environ.get(E2E_PASSWORD_ENV) or E2E_PASSWORD_DEV_DEFAULT


async def _get_or_create(
    db: AsyncSession,
    model: type[T],
    where,
    factory: Callable[[], T],
) -> tuple[T, bool]:
    """Retourne (instance, créée) — jamais de doublon (c'est le cœur de l'idempotence)."""
    # `.first()` plutôt que `.scalar_one_or_none()` : `campagne.name` n'a pas de
    # contrainte d'unicité en base ; un doublon préexistant ne doit pas faire échouer
    # le seed (il retombe simplement sur la première ligne).
    existing = (await db.execute(select(model).where(where).limit(1))).scalars().first()
    if existing is not None:
        return existing, False
    created = factory()
    db.add(created)
    await db.flush()
    return created, True


async def _heal_bot(db: AsyncSession, bot: Utilisateur) -> None:
    """Idempotence « self-healing » : compte réactivé et mot de passe réaligné sur la
    valeur attendue (permet une rotation du secret CI sans script ad hoc)."""
    password = e2e_bot_password()
    if not bot.actif:
        bot.actif = True
    if not verify_password(password, bot.password_hash):
        bot.password_hash = hash_password(password)


async def seed_e2e(db: AsyncSession) -> E2ESeedSummary:
    """Crée/met à jour le jeu de données e2e sur la session fournie, puis commit."""
    bot, bot_cree = await _get_or_create(
        db,
        Utilisateur,
        Utilisateur.email == E2E_BOT_EMAIL,
        lambda: Utilisateur(
            nom=E2E_BOT_NOM,
            prenom=E2E_BOT_PRENOM,
            email=E2E_BOT_EMAIL,
            password_hash=hash_password(e2e_bot_password()),
            role=E2E_BOT_ROLE,
            actif=True,
        ),
    )
    if not bot_cree:
        await _heal_bot(db, bot)

    campagne, campagne_creee = await _get_or_create(
        db,
        CampagneModel,
        CampagneModel.name == E2E_CAMPAGNE_NAME,
        lambda: CampagneModel(
            name=E2E_CAMPAGNE_NAME,
            start_date=E2E_CAMPAGNE_START,
            end_date=None,
            created_by=bot.id,
        ),
    )

    zone, zone_creee = await _get_or_create(
        db,
        ZoneAntiAcridienModel,
        ZoneAntiAcridienModel.code == E2E_ZONE_CODE,
        lambda: ZoneAntiAcridienModel(code=E2E_ZONE_CODE, nom=E2E_ZONE_NOM, actif=True),
    )

    await db.commit()

    return E2ESeedSummary(
        utilisateur_id=str(bot.id),
        utilisateur_email=E2E_BOT_EMAIL,
        utilisateur_password=e2e_bot_password(),
        utilisateur_cree=bot_cree,
        campagne_id=str(campagne.id),
        campagne_name=E2E_CAMPAGNE_NAME,
        campagne_creee=campagne_creee,
        zone_id=str(zone.id),
        zone_code=E2E_ZONE_CODE,
        zone_creee=zone_creee,
        gps_latitude=E2E_GPS_LATITUDE,
        gps_longitude=E2E_GPS_LONGITUDE,
    )


def _check_password_configured() -> None:
    if os.environ.get(E2E_PASSWORD_ENV):
        return
    if os.environ.get(E2E_ALLOW_DEV_DEFAULT_ENV):
        print(
            f"[e2e_seed] {E2E_PASSWORD_ENV} absent — mot de passe par défaut de dev utilisé.",
            file=sys.stderr,
        )
        return
    sys.exit(
        f"[e2e_seed] refus : définir {E2E_PASSWORD_ENV} (secret), ou "
        f"{E2E_ALLOW_DEV_DEFAULT_ENV}=1 pour accepter le mot de passe par défaut en dev local."
    )


async def _main() -> None:
    _check_password_configured()
    async with AsyncSessionLocal() as db:
        s = await seed_e2e(db)

    def etat(cree: bool) -> str:
        return "créé" if cree else "déjà présent"

    print("Seed e2e terminé :")
    print(f"  utilisateur : {s.utilisateur_email} ({etat(s.utilisateur_cree)})")
    print(f"                id={s.utilisateur_id}")
    print(f"                mot de passe = {s.utilisateur_password}")
    print(f"  campagne    : {s.campagne_name} ({etat(s.campagne_creee)})")
    print(f"                id={s.campagne_id}")
    print(f"  zone        : {s.zone_code} ({etat(s.zone_creee)})")
    print(f"                id={s.zone_id}")
    print(f"  GPS e2e     : {s.gps_latitude}, {s.gps_longitude}")


if __name__ == "__main__":
    asyncio.run(_main())
