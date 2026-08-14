import uuid

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.prospection import (
    Prospection,
    ProspectionCapture,
    ProspectionInfestation,
    ProspectionPopulation,
)
from app.domain.referentiel import StationNotFoundError
from app.domain.repositories import ProspectionRepository
from app.infrastructure.prospection_model import (
    ProspectionCaptureModel,
    ProspectionInfestationModel,
    ProspectionModel,
    ProspectionPopulationModel,
)


class ProspectionRepositoryImpl(ProspectionRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, prospection_id: uuid.UUID) -> Prospection | None:
        result = await self.session.execute(
            select(ProspectionModel)
            .where(ProspectionModel.id == prospection_id)
            .options(
                selectinload(ProspectionModel.populations),
                selectinload(ProspectionModel.captures),
                selectinload(ProspectionModel.infestations),
            )
        )
        model = result.scalar_one_or_none()
        if model is None:
            return None
        return self._to_domain(model)

    async def list_by_filters(
        self,
        type_prospection: str | None = None,
        statut: str | None = None,
        campagne_id: uuid.UUID | None = None,
        station_id: uuid.UUID | None = None,
        prospecteur_id: uuid.UUID | None = None,
    ) -> list[Prospection]:
        stmt = select(ProspectionModel).options(
            selectinload(ProspectionModel.populations),
            selectinload(ProspectionModel.captures),
            selectinload(ProspectionModel.infestations),
        )
        if type_prospection is not None:
            stmt = stmt.where(ProspectionModel.type_prospection == type_prospection)
        if statut is not None:
            stmt = stmt.where(ProspectionModel.statut == statut)
        if campagne_id is not None:
            stmt = stmt.where(ProspectionModel.campagne_id == campagne_id)
        if station_id is not None:
            stmt = stmt.where(ProspectionModel.station_id == station_id)
        if prospecteur_id is not None:
            stmt = stmt.where(ProspectionModel.prospecteur_id == prospecteur_id)
        stmt = stmt.order_by(ProspectionModel.date_prospection.desc())
        result = await self.session.execute(stmt)
        return [self._to_domain(m) for m in result.scalars().all()]

    async def create(self, prospection: Prospection) -> Prospection:
        model = ProspectionModel(
            id=prospection.id,
            type_prospection=prospection.type_prospection,
            campagne_id=prospection.campagne_id,
            prospecteur_id=prospection.prospecteur_id,
            station_id=prospection.station_id,
            n_releve=prospection.n_releve,
            n_fiche=prospection.n_fiche,
            n_message=prospection.n_message,
            date_prospection=prospection.date_prospection,
            latitude=prospection.latitude,
            longitude=prospection.longitude,
            altitude=prospection.altitude,
            biotope=prospection.biotope,
            surf_station=prospection.surf_station,
            surf_prospectee=prospection.surf_prospectee,
            surf_infestee=prospection.surf_infestee,
            degats_cultures=prospection.degats_cultures,
            derniere_pluie=prospection.derniere_pluie,
            intensite_pluie=prospection.intensite_pluie,
            vegetation=prospection.vegetation,
            sol=prospection.sol,
            verdissement=prospection.verdissement,
            hauteur_strate=prospection.hauteur_strate,
            ennemis_naturels=prospection.ennemis_naturels,
            observations=prospection.observations,
            statut=prospection.statut,
            statut_sync=prospection.statut_sync,
            verified_by=prospection.verified_by,
            verified_at=prospection.verified_at,
            validated_by=prospection.validated_by,
            validated_at=prospection.validated_at,
            created_at=prospection.created_at,
            updated_at=prospection.updated_at,
            # ==========================================
            # NOUVEAUX CHAMPS - Références (A)
            # ==========================================
            region=prospection.region,
            district=prospection.district,
            commune=prospection.commune,
            za=prospection.za,
            pa_code=prospection.pa_code,
            # ==========================================
            # NOUVEAUX CHAMPS - Observations (D)
            # ==========================================
            degats_cultures_pourcent=prospection.degats_cultures_pourcent,
            verdissement_pourcent=prospection.verdissement_pourcent,
            hauteur_herbe_cm=prospection.hauteur_herbe_cm,
            # ==========================================
            # NOUVEAUX CHAMPS - Extensif & Validation
            # ==========================================
            station_libre=prospection.station_libre,
            type_station=prospection.type_station,
            verdure_strate=prospection.verdure_strate,
            signalement_source=prospection.signalement_source,
            signalement_date=prospection.signalement_date,
            signalement_description=prospection.signalement_description,
            conclusion_validation=prospection.conclusion_validation,
        )

        model.populations = [
            ProspectionPopulationModel(
                id=p.id,
                espece=p.espece,
                categorie=p.categorie,
                densite_diffuse=p.densite_diffuse,
                densite_groupee=p.densite_groupee,
                captures_nombre=p.captures_nombre,
                temps_capture=p.temps_capture,
                methode=p.methode,
                phase=p.phase,
                accouplement=p.accouplement,
                ponte=p.ponte,
                captures_sol=p.captures_sol,
                captures_trans=p.captures_trans,
                captures_greg=p.captures_greg,
                stade_imago=p.stade_imago,
                essaim_observe=p.essaim_observe,
                densites_larve=p.densites_larve,
                tache_larvaire=p.tache_larvaire,
                bande_larvaire=p.bande_larvaire,
                interdistance=p.interdistance,
                deplacement=p.deplacement,
            )
            for p in prospection.populations
        ]

        model.captures = [
            ProspectionCaptureModel(
                id=c.id,
                espece=c.espece,
                categorie=c.categorie,
                sexe=c.sexe,
                phase=c.phase,
                stade=c.stade,
                effectif=c.effectif,
            )
            for c in prospection.captures
        ]

        model.infestations = [
            ProspectionInfestationModel(
                id=i.id,
                prospection_id=prospection.id,
                espece=i.espece,
                type_cible=i.type_cible,
                taille_min=i.taille_min,
                taille_max=i.taille_max,
                taille_moy=i.taille_moy,
                surface_tot=i.surface_tot,
                densite_min=i.densite_min,
                densite_max=i.densite_max,
                densite_moy=i.densite_moy,
                interdistance=i.interdistance,
                comportement=i.comportement,
                direction_de=i.direction_de,
                direction_vers=i.direction_vers,
                vent_de=i.vent_de,
                vent_vitesse=i.vent_vitesse,
                surf_infestee_pourcent=i.surf_infestee_pourcent,
                # ==========================================
                # NOUVEAUX CHAMPS - Imagos (B)
                # ==========================================
                pullulation_nb=i.pullulation_nb,
                taille_long=i.taille_long,
                taille_large=i.taille_large,
                taille_epaisseur=i.taille_epaisseur,
                essaim_en_vol=i.essaim_en_vol,
                essaim_pose=i.essaim_pose,
                type_essaim=i.type_essaim,
                heure_observation=i.heure_observation,
                densite_en_vol=i.densite_en_vol,
                # ==========================================
                # NOUVEAUX CHAMPS - Larves (C)
                # ==========================================
                nb_taches_bandes=i.nb_taches_bandes,
                interdistance_m=i.interdistance_m,
                interdistance_min=i.interdistance_min,
                interdistance_max=i.interdistance_max,
                interdistance_moy=i.interdistance_moy,
                surface_contaminee_ha=i.surface_contaminee_ha,
                type_larve=i.type_larve,
                stade_dominant=i.stade_dominant,
                taille_groupe_m2=i.taille_groupe_m2,
                front_longueur_m=i.front_longueur_m,
                front_largeur_m=i.front_largeur_m,
                densite_max_front=i.densite_max_front,
                densite_moy_arriere_front=i.densite_moy_arriere_front,
            )
            for i in prospection.infestations
        ]

        self.session.add(model)
        try:
            await self.session.commit()
        except IntegrityError:
            await self.session.rollback()
            raise StationNotFoundError("station_id ne référence pas une station fixe existante")
        return await self.get_by_id(model.id)

    async def update(self, prospection: Prospection) -> Prospection:
        result = await self.session.execute(
            select(ProspectionModel).where(ProspectionModel.id == prospection.id)
        )
        model = result.scalar_one()

        model.station_id = prospection.station_id
        model.n_releve = prospection.n_releve
        model.n_fiche = prospection.n_fiche
        model.n_message = prospection.n_message
        model.date_prospection = prospection.date_prospection
        model.latitude = prospection.latitude
        model.longitude = prospection.longitude
        model.altitude = prospection.altitude
        model.biotope = prospection.biotope
        model.surf_station = prospection.surf_station
        model.surf_prospectee = prospection.surf_prospectee
        model.surf_infestee = prospection.surf_infestee
        model.degats_cultures = prospection.degats_cultures
        model.derniere_pluie = prospection.derniere_pluie
        model.intensite_pluie = prospection.intensite_pluie
        model.vegetation = prospection.vegetation
        model.sol = prospection.sol
        model.verdissement = prospection.verdissement
        model.hauteur_strate = prospection.hauteur_strate
        model.ennemis_naturels = prospection.ennemis_naturels
        model.observations = prospection.observations
        model.statut = prospection.statut
        model.updated_at = prospection.updated_at

        # ==========================================
        # NOUVEAUX CHAMPS - Références (A)
        # ==========================================
        model.region = prospection.region
        model.district = prospection.district
        model.commune = prospection.commune
        model.za = prospection.za
        model.pa_code = prospection.pa_code

        # ==========================================
        # NOUVEAUX CHAMPS - Observations (D)
        # ==========================================
        model.degats_cultures_pourcent = prospection.degats_cultures_pourcent
        model.verdissement_pourcent = prospection.verdissement_pourcent
        model.hauteur_herbe_cm = prospection.hauteur_herbe_cm

        # ==========================================
        # NOUVEAUX CHAMPS - Extensif & Validation
        # ==========================================
        model.station_libre = prospection.station_libre
        model.type_station = prospection.type_station
        model.verdure_strate = prospection.verdure_strate
        model.signalement_source = prospection.signalement_source
        model.signalement_date = prospection.signalement_date
        model.signalement_description = prospection.signalement_description
        model.conclusion_validation = prospection.conclusion_validation

        # Mise à jour des infestations
        await self.session.execute(
            delete(ProspectionInfestationModel).where(
                ProspectionInfestationModel.prospection_id == prospection.id
            )
        )

        for i in prospection.infestations:
            new_infestation = ProspectionInfestationModel(
                id=i.id,
                prospection_id=prospection.id,
                espece=i.espece,
                type_cible=i.type_cible,
                taille_min=i.taille_min,
                taille_max=i.taille_max,
                taille_moy=i.taille_moy,
                surface_tot=i.surface_tot,
                densite_min=i.densite_min,
                densite_max=i.densite_max,
                densite_moy=i.densite_moy,
                interdistance=i.interdistance,
                comportement=i.comportement,
                direction_de=i.direction_de,
                direction_vers=i.direction_vers,
                vent_de=i.vent_de,
                vent_vitesse=i.vent_vitesse,
                # ==========================================
                # NOUVEAUX CHAMPS - Imagos (B)
                # ==========================================
                pullulation_nb=i.pullulation_nb,
                taille_long=i.taille_long,
                taille_large=i.taille_large,
                taille_epaisseur=i.taille_epaisseur,
                essaim_en_vol=i.essaim_en_vol,
                essaim_pose=i.essaim_pose,
                type_essaim=i.type_essaim,
                heure_observation=i.heure_observation,
                densite_en_vol=i.densite_en_vol,
                # ==========================================
                # NOUVEAUX CHAMPS - Larves (C)
                # ==========================================
                nb_taches_bandes=i.nb_taches_bandes,
                interdistance_m=i.interdistance_m,
                surface_contaminee_ha=i.surface_contaminee_ha,
                type_larve=i.type_larve,
                stade_dominant=i.stade_dominant,
                taille_groupe_m2=i.taille_groupe_m2,
                front_longueur_m=i.front_longueur_m,
                front_largeur_m=i.front_largeur_m,
                densite_max_front=i.densite_max_front,
                densite_moy_arriere_front=i.densite_moy_arriere_front,
            )
            self.session.add(new_infestation)

        await self.session.commit()
        return await self.get_by_id(model.id)

    async def delete(self, prospection_id: uuid.UUID) -> bool:
        result = await self.session.execute(
            delete(ProspectionModel).where(ProspectionModel.id == prospection_id)
        )
        await self.session.commit()
        return result.rowcount > 0

    def _to_domain(self, model: ProspectionModel) -> Prospection:
        return Prospection(
            id=model.id,
            type_prospection=model.type_prospection,
            campagne_id=model.campagne_id,
            prospecteur_id=model.prospecteur_id,
            station_id=model.station_id,
            n_releve=model.n_releve,
            n_fiche=model.n_fiche,
            n_message=model.n_message,
            date_prospection=model.date_prospection,
            latitude=float(model.latitude) if model.latitude is not None else None,
            longitude=float(model.longitude) if model.longitude is not None else None,
            altitude=float(model.altitude) if model.altitude is not None else None,
            biotope=model.biotope,
            surf_station=float(model.surf_station) if model.surf_station is not None else None,
            surf_prospectee=float(model.surf_prospectee)
            if model.surf_prospectee is not None
            else None,
            surf_infestee=float(model.surf_infestee) if model.surf_infestee is not None else None,
            degats_cultures=model.degats_cultures,
            derniere_pluie=model.derniere_pluie,
            intensite_pluie=model.intensite_pluie,
            vegetation=model.vegetation,
            sol=model.sol,
            verdissement=float(model.verdissement) if model.verdissement is not None else None,
            hauteur_strate=float(model.hauteur_strate)
            if model.hauteur_strate is not None
            else None,
            ennemis_naturels=model.ennemis_naturels,
            observations=model.observations,
            statut=model.statut,
            statut_sync=model.statut_sync,
            verified_by=model.verified_by,
            verified_at=model.verified_at,
            validated_by=model.validated_by,
            validated_at=model.validated_at,
            created_at=model.created_at,
            updated_at=model.updated_at,
            # ==========================================
            # NOUVEAUX CHAMPS - Références (A)
            # ==========================================
            region=model.region,
            district=model.district,
            commune=model.commune,
            za=model.za,
            pa_code=model.pa_code,
            # ==========================================
            # NOUVEAUX CHAMPS - Observations (D)
            # ==========================================
            degats_cultures_pourcent=model.degats_cultures_pourcent,
            verdissement_pourcent=model.verdissement_pourcent,
            hauteur_herbe_cm=float(model.hauteur_herbe_cm)
            if model.hauteur_herbe_cm is not None
            else None,
            # ==========================================
            # NOUVEAUX CHAMPS - Extensif & Validation
            # ==========================================
            station_libre=model.station_libre,
            type_station=model.type_station,
            verdure_strate=model.verdure_strate,
            signalement_source=model.signalement_source,
            signalement_date=model.signalement_date,
            signalement_description=model.signalement_description,
            conclusion_validation=model.conclusion_validation,
            # ==========================================
            # RELATIONSHIPS
            # ==========================================
            populations=[
                ProspectionPopulation(
                    id=p.id,
                    prospection_id=p.prospection_id,
                    espece=p.espece,
                    categorie=p.categorie,
                    densite_diffuse=float(p.densite_diffuse)
                    if p.densite_diffuse is not None
                    else None,
                    densite_groupee=float(p.densite_groupee)
                    if p.densite_groupee is not None
                    else None,
                    captures_nombre=p.captures_nombre,
                    temps_capture=p.temps_capture,
                    methode=p.methode,
                    phase=p.phase,
                    accouplement=p.accouplement,
                    ponte=p.ponte,
                    captures_sol=p.captures_sol,
                    captures_trans=p.captures_trans,
                    captures_greg=p.captures_greg,
                    stade_imago=p.stade_imago,
                    essaim_observe=p.essaim_observe,
                    densites_larve=p.densites_larve,
                    tache_larvaire=p.tache_larvaire,
                    bande_larvaire=p.bande_larvaire,
                    interdistance=float(p.interdistance) if p.interdistance is not None else None,
                    deplacement=p.deplacement,
                )
                for p in model.populations
            ],
            captures=[
                ProspectionCapture(
                    id=c.id,
                    prospection_id=c.prospection_id,
                    espece=c.espece,
                    categorie=c.categorie,
                    sexe=c.sexe,
                    phase=c.phase,
                    stade=c.stade,
                    effectif=c.effectif,
                )
                for c in model.captures
            ],
            infestations=[
                ProspectionInfestation(
                    id=i.id,
                    prospection_id=i.prospection_id,
                    espece=i.espece,
                    type_cible=i.type_cible,
                    taille_min=float(i.taille_min) if i.taille_min is not None else None,
                    taille_max=float(i.taille_max) if i.taille_max is not None else None,
                    taille_moy=float(i.taille_moy) if i.taille_moy is not None else None,
                    surface_tot=float(i.surface_tot) if i.surface_tot is not None else None,
                    densite_min=float(i.densite_min) if i.densite_min is not None else None,
                    densite_max=float(i.densite_max) if i.densite_max is not None else None,
                    densite_moy=float(i.densite_moy) if i.densite_moy is not None else None,
                    interdistance=float(i.interdistance) if i.interdistance is not None else None,
                    comportement=i.comportement,
                    direction_de=i.direction_de,
                    direction_vers=i.direction_vers,
                    vent_de=i.vent_de,
                    vent_vitesse=float(i.vent_vitesse) if i.vent_vitesse is not None else None,
                    surf_infestee_pourcent=float(i.surf_infestee_pourcent)
                    if i.surf_infestee_pourcent is not None
                    else None,
                    # ==========================================
                    # NOUVEAUX CHAMPS - Imagos (B)
                    # ==========================================
                    pullulation_nb=i.pullulation_nb,
                    taille_long=float(i.taille_long) if i.taille_long is not None else None,
                    taille_large=float(i.taille_large) if i.taille_large is not None else None,
                    taille_epaisseur=float(i.taille_epaisseur)
                    if i.taille_epaisseur is not None
                    else None,
                    essaim_en_vol=i.essaim_en_vol,
                    essaim_pose=i.essaim_pose,
                    type_essaim=i.type_essaim,
                    heure_observation=i.heure_observation,
                    densite_en_vol=float(i.densite_en_vol)
                    if i.densite_en_vol is not None
                    else None,
                    # ==========================================
                    # NOUVEAUX CHAMPS - Larves (C)
                    # ==========================================
                    nb_taches_bandes=i.nb_taches_bandes,
                    interdistance_m=float(i.interdistance_m)
                    if i.interdistance_m is not None
                    else None,
                    interdistance_min=float(i.interdistance_min)
                    if i.interdistance_min is not None
                    else None,
                    interdistance_max=float(i.interdistance_max)
                    if i.interdistance_max is not None
                    else None,
                    interdistance_moy=float(i.interdistance_moy)
                    if i.interdistance_moy is not None
                    else None,
                    surface_contaminee_ha=float(i.surface_contaminee_ha)
                    if i.surface_contaminee_ha is not None
                    else None,
                    type_larve=i.type_larve,
                    stade_dominant=i.stade_dominant,
                    taille_groupe_m2=float(i.taille_groupe_m2)
                    if i.taille_groupe_m2 is not None
                    else None,
                    front_longueur_m=float(i.front_longueur_m)
                    if i.front_longueur_m is not None
                    else None,
                    front_largeur_m=float(i.front_largeur_m)
                    if i.front_largeur_m is not None
                    else None,
                    densite_max_front=float(i.densite_max_front)
                    if i.densite_max_front is not None
                    else None,
                    densite_moy_arriere_front=float(i.densite_moy_arriere_front)
                    if i.densite_moy_arriere_front is not None
                    else None,
                )
                for i in model.infestations
            ],
        )
