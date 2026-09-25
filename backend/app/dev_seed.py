"""
Jeu de données de développement : comptes, aéronefs, équipes et affectations.

Reprend les personnages des maquettes Figma « Parcours - Équipe & Opérations aériennes »
(Équipe Sud / Équipe Nord / EMT Toliara, aéronefs 5R-MHR, 5R-MJK, 5R-MLP, 5R-MQR) pour
pouvoir parcourir le mobile et le web sur une base neuve.

Idempotent : ré-exécutable sans doublon (recherche par e-mail, immatriculation, nom
d'équipe, couple équipe/appareil/date de début, couple équipe/membre).

Comptes (mot de passe commun : `ifvm2026!`, comme `app.seed`) :
    admin@ifvm.mg                    admin           (créé par `app.seed`, repris ici si absent)
    rakoto.jean@ifvm.test            chef_de_base    chef de l'Équipe Sud
    rabe.michel@ifvm.test            pilote          Équipe Sud
    andria.sophie@ifvm.test          mecanicien      Équipe Sud
    razafy.paul@ifvm.test            chef_de_base    chef de l'Équipe Nord
    randria.hery@ifvm.test           chef_equipe     chef de l'EMT Toliara
    prospecteur@ifvm.test            prospecteur     hors équipe

Aéronefs : 5R-MHR (Équipe Sud, en service depuis le 01/09/2026), 5R-MJK (Équipe Nord),
5R-MLP (libre), 5R-MQR (ancien appareil de l'Équipe Sud, affectation terminée le 31/08/2026).

Usage :
    docker compose exec backend python -m app.dev_seed
"""

from __future__ import annotations

import asyncio
from datetime import date
from typing import TypeVar

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import app.models  # noqa: F401  (résout le cycle d'import app.models <-> app.infrastructure)
from app.auth import hash_password
from app.database import AsyncSessionLocal
from app.infrastructure.referentiel_model import (
    AeronefModel,
    EquipeAeronefModel,
    EquipeMembreModel,
    EquipeModel,
)
from app.models.base import Base
from app.models.users import Utilisateur

DEV_PASSWORD = "ifvm2026!"

T = TypeVar("T", bound=Base)

# (email, prénom, nom, rôle)
UTILISATEURS = [
    ("admin@ifvm.mg", "IFVM", "Admin", "admin"),
    ("rakoto.jean@ifvm.test", "Jean", "Rakoto", "chef_de_base"),
    ("rabe.michel@ifvm.test", "Michel", "Rabe", "pilote"),
    ("andria.sophie@ifvm.test", "Sophie", "Andria", "mecanicien"),
    ("razafy.paul@ifvm.test", "Paul", "Razafy", "chef_de_base"),
    ("randria.hery@ifvm.test", "Hery", "Randria", "chef_equipe"),
    ("prospecteur@ifvm.test", "Lala", "Rasoa", "prospecteur"),
]

# (immatriculation, société / modèle, volume de cuve en litres)
AERONEFS = [
    ("5R-MHR", "Cessna 188 AGwagon", 700),
    ("5R-MJK", "Cessna 188", 700),
    ("5R-MLP", "Air Tractor AT-802", 3000),
    ("5R-MQR", "Cessna 188", 700),
]

# (nom, type, [(email du membre, fonction)])
EQUIPES = [
    (
        "Équipe Sud",
        "aerien",
        [
            ("rakoto.jean@ifvm.test", "chef"),
            ("rabe.michel@ifvm.test", "pilote"),
            ("andria.sophie@ifvm.test", "mecanicien"),
        ],
    ),
    ("Équipe Nord", "aerien", [("razafy.paul@ifvm.test", "chef")]),
    ("EMT Toliara", "terrestre", [("randria.hery@ifvm.test", "chef")]),
]

# (équipe, immatriculation, début, fin — `None` : affectation en cours)
AFFECTATIONS = [
    ("Équipe Sud", "5R-MQR", date(2026, 5, 1), date(2026, 8, 31)),
    ("Équipe Sud", "5R-MHR", date(2026, 9, 1), None),
    ("Équipe Nord", "5R-MJK", date(2026, 6, 1), None),
]


async def _get_or_create(db: AsyncSession, model: type[T], where, factory) -> T:
    existant = (await db.execute(select(model).where(where).limit(1))).scalars().first()
    if existant is not None:
        return existant
    cree = factory()
    db.add(cree)
    await db.flush()
    return cree


async def seed_dev(db: AsyncSession) -> None:
    hash_commun = hash_password(DEV_PASSWORD)
    utilisateurs: dict[str, Utilisateur] = {}
    for email, prenom, nom, role in UTILISATEURS:
        utilisateurs[email] = await _get_or_create(
            db,
            Utilisateur,
            Utilisateur.email == email,
            lambda e=email, p=prenom, n=nom, r=role: Utilisateur(
                email=e, prenom=p, nom=n, role=r, password_hash=hash_commun
            ),
        )

    aeronefs: dict[str, AeronefModel] = {}
    for immatriculation, societe, volume in AERONEFS:
        aeronefs[immatriculation] = await _get_or_create(
            db,
            AeronefModel,
            AeronefModel.immatriculation == immatriculation,
            lambda i=immatriculation, s=societe, v=volume: AeronefModel(
                immatriculation=i, societe=s, volume_cuve_l=v
            ),
        )

    equipes: dict[str, EquipeModel] = {}
    for nom, type_, membres in EQUIPES:
        equipe = await _get_or_create(
            db,
            EquipeModel,
            EquipeModel.nom == nom,
            lambda n=nom, t=type_: EquipeModel(nom=n, type=t),
        )
        equipes[nom] = equipe
        for email, fonction in membres:
            user_id = utilisateurs[email].id
            await _get_or_create(
                db,
                EquipeMembreModel,
                (EquipeMembreModel.equipe_id == equipe.id) & (EquipeMembreModel.user_id == user_id),
                lambda e=equipe, u=user_id, f=fonction: EquipeMembreModel(
                    equipe_id=e.id, user_id=u, fonction=f
                ),
            )

    for nom_equipe, immatriculation, debut, fin in AFFECTATIONS:
        equipe, aeronef = equipes[nom_equipe], aeronefs[immatriculation]
        await _get_or_create(
            db,
            EquipeAeronefModel,
            (EquipeAeronefModel.equipe_id == equipe.id)
            & (EquipeAeronefModel.aeronef_id == aeronef.id)
            & (EquipeAeronefModel.date_debut == debut),
            lambda e=equipe, a=aeronef, d=debut, f=fin: EquipeAeronefModel(
                equipe_id=e.id, aeronef_id=a.id, date_debut=d, date_fin=f
            ),
        )

    await db.commit()


async def main() -> None:
    async with AsyncSessionLocal() as db:
        await seed_dev(db)
    print(
        f"Seed dev terminé : {len(UTILISATEURS)} comptes, {len(AERONEFS)} aéronefs, "
        f"{len(EQUIPES)} équipes, {len(AFFECTATIONS)} affectations."
    )


if __name__ == "__main__":
    asyncio.run(main())
