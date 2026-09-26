"""
Données de démo pour vérifier le Lot 2 (écrans /traitements) face à la maquette.

Crée : les utilisateurs par rôle nécessaires aux fiches (pilote, mécanicien, chef de
base, chef d'équipe), une prospection validée par fiche, puis trois fiches de
traitement représentatives : une aérienne (4 rotations, 3/4 signatures), une
terrestre abandonnée (surface restante > 0, motif renseigné) et sa reprise.

Idempotent : ré-exécutable sans dupliquer (email / numero_fiche uniques).

Usage :
    docker compose exec backend python -m app.demo_traitements_seed
"""

import asyncio
from datetime import date, time

from sqlalchemy import select

from app.auth import hash_password
from app.database import AsyncSessionLocal
from app.fixtures import load_fixtures
from app.infrastructure.campagne_model import CampagneModel
from app.infrastructure.prospection_model import ProspectionModel
from app.infrastructure.referentiel_model import PesticideModel, StationFixeModel
from app.infrastructure.traitement_model import (
    CibleModel,
    ProduitUtiliseModel,
    RotationModel,
    TraitementAerienModel,
    TraitementModel,
    TraitementSignatureModel,
    TraitementTerrestreModel,
)
from app.models.users import Utilisateur


async def get_or_create_user(db, *, nom, prenom, email, role) -> Utilisateur:
    result = await db.execute(select(Utilisateur).where(Utilisateur.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        user = Utilisateur(
            nom=nom,
            prenom=prenom,
            email=email,
            password_hash=hash_password("ifvm2026!"),
            role=role,
        )
        db.add(user)
        await db.flush()
    return user


async def get_or_create_prospection(
    db, *, campagne_id, prospecteur_id, station_id, n_fiche, date_prospection
):
    result = await db.execute(select(ProspectionModel).where(ProspectionModel.n_fiche == n_fiche))
    prospection = result.scalar_one_or_none()
    if prospection is None:
        prospection = ProspectionModel(
            type_prospection="intensive",
            campagne_id=campagne_id,
            prospecteur_id=prospecteur_id,
            station_id=station_id,
            n_fiche=n_fiche,
            date_prospection=date_prospection,
            statut="validee",
            surface_prospectee=12.5,
            surface_infestee=3.2,
        )
        db.add(prospection)
        await db.flush()
    elif prospection.statut != "validee":
        prospection.statut = "validee"
    return prospection


async def get_or_create_traitement(db, *, numero_fiche, **kwargs) -> tuple[TraitementModel, bool]:
    result = await db.execute(
        select(TraitementModel).where(TraitementModel.numero_fiche == numero_fiche)
    )
    traitement = result.scalar_one_or_none()
    created = traitement is None
    if traitement is None:
        traitement = TraitementModel(numero_fiche=numero_fiche, **kwargs)
        db.add(traitement)
        await db.flush()
    return traitement, created


async def seed():
    async with AsyncSessionLocal() as db:
        pilote = await get_or_create_user(
            db, nom="Rakoto", prenom="Jean", email="pilote.demo@ifvm.mg", role="pilote"
        )
        mecanicien = await get_or_create_user(
            db, nom="Randria", prenom="Paul", email="mecanicien.demo@ifvm.mg", role="mecanicien"
        )
        chef_de_base = await get_or_create_user(
            db, nom="Rabe", prenom="Marie", email="chefdebase.demo@ifvm.mg", role="chef_de_base"
        )
        chef_equipe = await get_or_create_user(
            db, nom="Rasoa", prenom="Hery", email="chefequipe.demo@ifvm.mg", role="chef_equipe"
        )
        prospecteur = await get_or_create_user(
            db, nom="Andry", prenom="Nomena", email="prospecteur.demo@ifvm.mg", role="prospecteur"
        )
        # Note : "verificateur" et "validation_finale" existent dans ROLES (app/models/users.py)
        # mais pas dans la contrainte CHECK `ck_utilisateur_role` en base — dérive de schéma
        # hors périmètre de ce lot, non nécessaire pour peupler /traitements.
        await db.flush()

        result = await db.execute(select(CampagneModel).limit(1))
        campagne = result.scalar_one_or_none()
        if campagne is None:
            campagne = CampagneModel(
                name="Campagne 2026",
                start_date=date(2026, 5, 1),
                created_by=pilote.id,
            )
            db.add(campagne)
            await db.flush()

        result = await db.execute(select(PesticideModel))
        pesticides = result.scalars().all()
        if not pesticides:
            await load_fixtures()
            result = await db.execute(select(PesticideModel))
            pesticides = result.scalars().all()
        pesticide_a, pesticide_b = pesticides[0], pesticides[1]

        result = await db.execute(select(StationFixeModel).limit(1))
        station = result.scalar_one_or_none()

        prospection_aerien = await get_or_create_prospection(
            db,
            campagne_id=campagne.id,
            prospecteur_id=prospecteur.id,
            station_id=station.id if station else None,
            n_fiche="DEMO-PROSP-AERIEN-01",
            date_prospection=date(2026, 8, 10),
        )
        prospection_terrestre = await get_or_create_prospection(
            db,
            campagne_id=campagne.id,
            prospecteur_id=prospecteur.id,
            station_id=station.id if station else None,
            n_fiche="DEMO-PROSP-TERRESTRE-01",
            date_prospection=date(2026, 8, 9),
        )

        # --- Fiche aérienne, validée, 4 rotations, 3/4 signatures ---
        traitement_aerien, created = await get_or_create_traitement(
            db,
            numero_fiche="Jean-AERIEN-2026-08-12",
            prospection_id=prospection_aerien.id,
            type_traitement="AERIEN",
            mode_traitement="BARRIERE",
            date_traitement=date(2026, 8, 12),
            date_validation=date(2026, 8, 11),
            localite="Beroroha",
            region="Atsimo-Andrefana",
            district="Beroroha",
            commune="Beroroha",
            kit_combinaison=3,
            kit_gants=3,
            kit_lunettes=3,
            kit_masques=3,
            kit_botte=0,
            empoisonnement=False,
            evaluation_risque={"vent": "faible", "population": "eloignee"},
            comportement_anormal=False,
            mortalite=False,
            statut="validee",
        )
        if created:
            db.add(
                CibleModel(
                    traitement_id=traitement_aerien.id,
                    espece="LMC",
                    repartition_population="GROUPEE",
                    surface_infestee_ha=3.2,
                )
            )
            aerien = TraitementAerienModel(
                traitement_id=traitement_aerien.id,
                pilote=f"{pilote.prenom} {pilote.nom}",
                mecanicien=f"{mecanicien.prenom} {mecanicien.nom}",
                chef_de_base_id=chef_de_base.id,
                immatricule_aeronef="5R-MHR",
                base_principale="Base Betioky",
                nb_rotations=4,
                total_pesticide_l=1060,
            )
            db.add(aerien)
            await db.flush()
            for i in range(1, 5):
                db.add(
                    RotationModel(
                        traitement_aerien_id=traitement_aerien.id,
                        numero=i,
                        numero_cuve=f"CUVE-{i:02d}",
                        produit_id=pesticide_a.id,
                        quantite_l=265,
                        temperature_debut_c=28 + i,
                        temperature_fin_c=30 + i,
                        vent_debut_ms=2.5,
                        vent_fin_ms=3.1,
                        heure_debut=time(6 + i, 0),
                        heure_fin=time(6 + i, 30),
                    )
                )
            for role, nom in (
                ("PILOTE", pilote),
                ("MECANICIEN", mecanicien),
                ("CHEF_DE_BASE", chef_de_base),
            ):
                db.add(
                    TraitementSignatureModel(
                        traitement_id=traitement_aerien.id,
                        role=role,
                        signataire_nom=f"{nom.prenom} {nom.nom}",
                    )
                )

        # --- Fiche terrestre d'origine, abandonnée (surface restante > 0) ---
        traitement_origine, created = await get_or_create_traitement(
            db,
            numero_fiche="Hery-TERRESTRE-2026-08-05",
            prospection_id=prospection_terrestre.id,
            type_traitement="TERRESTRE",
            mode_traitement="TOTAL",
            date_traitement=date(2026, 8, 5),
            date_validation=date(2026, 8, 5),
            localite="Ihosy",
            region="Ihorombe",
            district="Ihosy",
            commune="Ihosy",
            kit_combinaison=2,
            kit_gants=2,
            kit_lunettes=0,
            kit_masques=2,
            kit_botte=0,
            empoisonnement=False,
            comportement_anormal=False,
            mortalite=False,
            statut="validee",
        )
        if created:
            db.add(
                CibleModel(
                    traitement_id=traitement_origine.id,
                    espece="NSE",
                    repartition_population="DIFFUSE",
                    surface_infestee_ha=8.0,
                )
            )
            terrestre_origine = TraitementTerrestreModel(
                traitement_id=traitement_origine.id,
                heure_debut=time(6, 30),
                heure_fin=time(10, 0),
                vitesse_vent_ms=1.8,
                direction_vent="NE",
                temperature_c=24,
                reprise_traitement=False,
                chef_equipe_id=chef_equipe.id,
                surface_traitee_ha=5.0,
                surface_cumulee_ha=5.0,
                surface_restante_ha=3.0,
                surface_restante_abandonnee=True,
                motif_surface_restante_abandonnee=(
                    "Panne matériel — reprise programmée le lendemain."
                ),
                total_pesticide_l=180,
            )
            db.add(terrestre_origine)
            await db.flush()
            db.add(
                ProduitUtiliseModel(
                    traitement_terrestre_id=traitement_origine.id,
                    numero=1,
                    produit_id=pesticide_b.id,
                    quantite_l=180,
                )
            )
            db.add(
                TraitementSignatureModel(
                    traitement_id=traitement_origine.id,
                    role="CHEF_EQUIPE",
                    signataire_nom=f"{chef_equipe.prenom} {chef_equipe.nom}",
                )
            )

        # --- Reprise de la fiche terrestre d'origine ---
        traitement_reprise, created = await get_or_create_traitement(
            db,
            numero_fiche="Hery-TERRESTRE-2026-08-06-REPRISE",
            prospection_id=prospection_terrestre.id,
            type_traitement="TERRESTRE",
            mode_traitement="TOTAL",
            date_traitement=date(2026, 8, 6),
            date_validation=date(2026, 8, 6),
            localite="Ihosy",
            region="Ihorombe",
            district="Ihosy",
            commune="Ihosy",
            kit_combinaison=2,
            kit_gants=2,
            kit_lunettes=2,
            kit_masques=2,
            kit_botte=0,
            empoisonnement=False,
            comportement_anormal=False,
            mortalite=False,
            statut="validee",
        )
        if created:
            db.add(
                CibleModel(
                    traitement_id=traitement_reprise.id,
                    espece="NSE",
                    repartition_population="DIFFUSE",
                    surface_infestee_ha=3.0,
                )
            )
            terrestre_reprise = TraitementTerrestreModel(
                traitement_id=traitement_reprise.id,
                heure_debut=time(6, 0),
                heure_fin=time(8, 30),
                vitesse_vent_ms=1.2,
                direction_vent="NE",
                temperature_c=23,
                reprise_traitement=True,
                traitement_origine_id=traitement_origine.id,
                chef_equipe_id=chef_equipe.id,
                surface_traitee_ha=3.0,
                surface_cumulee_ha=8.0,
                surface_restante_ha=0,
                total_pesticide_l=110,
            )
            db.add(terrestre_reprise)
            await db.flush()
            db.add(
                ProduitUtiliseModel(
                    traitement_terrestre_id=traitement_reprise.id,
                    numero=1,
                    produit_id=pesticide_b.id,
                    quantite_l=110,
                )
            )
            db.add(
                TraitementSignatureModel(
                    traitement_id=traitement_reprise.id,
                    role="CHEF_EQUIPE",
                    signataire_nom=f"{chef_equipe.prenom} {chef_equipe.nom}",
                )
            )

        await db.commit()
        print("✓ Démo traitements chargée : 1 fiche aérienne, 1 fiche terrestre + sa reprise.")


if __name__ == "__main__":
    asyncio.run(seed())
