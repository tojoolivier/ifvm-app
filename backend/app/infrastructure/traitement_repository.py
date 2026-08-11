import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.repositories import TraitementRepository
from app.domain.traitement import (
    Cible,
    NumeroFicheConflitError,
    Traitement,
    TraitementAerien,
)
from app.infrastructure.traitement_model import (
    CibleModel,
    TraitementAerienModel,
    TraitementModel,
)


class TraitementRepositoryImpl(TraitementRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, traitement_id: uuid.UUID) -> Traitement | None:
        result = await self.session.execute(
            select(TraitementModel)
            .where(TraitementModel.id == traitement_id)
            .options(
                selectinload(TraitementModel.cible),
                selectinload(TraitementModel.aerien),
            )
        )
        model = result.scalar_one_or_none()
        if model is None:
            return None
        return self._to_domain(model)

    async def list_by_filters(
        self,
        type_traitement: str | None = None,
        prospection_id: uuid.UUID | None = None,
    ) -> list[Traitement]:
        stmt = select(TraitementModel).options(
            selectinload(TraitementModel.cible),
            selectinload(TraitementModel.aerien),
        )
        if type_traitement is not None:
            stmt = stmt.where(TraitementModel.type_traitement == type_traitement)
        if prospection_id is not None:
            stmt = stmt.where(TraitementModel.prospection_id == prospection_id)
        stmt = stmt.order_by(TraitementModel.date_traitement.desc())
        result = await self.session.execute(stmt)
        return [self._to_domain(m) for m in result.scalars().all()]

    async def create(self, traitement: Traitement) -> Traitement:
        model = TraitementModel(
            id=traitement.id,
            prospection_id=traitement.prospection_id,
            numero_fiche=traitement.numero_fiche,
            type_traitement=traitement.type_traitement,
            mode_traitement=traitement.mode_traitement,
            date_traitement=traitement.date_traitement,
            date_validation=traitement.date_validation,
            localite=traitement.localite,
            region=traitement.region,
            district=traitement.district,
            commune=traitement.commune,
            latitude=traitement.latitude,
            longitude=traitement.longitude,
            altitude=traitement.altitude,
            kit_combinaison=traitement.kit_combinaison,
            kit_gants=traitement.kit_gants,
            kit_lunettes=traitement.kit_lunettes,
            kit_masques=traitement.kit_masques,
            kit_boite=traitement.kit_boite,
            zones_exposees=traitement.zones_exposees,
            hauteur_strate_herbeuse_m=traitement.hauteur_strate_herbeuse_m,
            hauteur_strate_arboree_m=traitement.hauteur_strate_arboree_m,
            recouvrement_percent=traitement.recouvrement_percent,
            empoisonnement=traitement.empoisonnement,
            empoisonnement_type=traitement.empoisonnement_type,
            empoisonnement_mode=traitement.empoisonnement_mode,
            empoisonnement_autre=traitement.empoisonnement_autre,
            evaluation_risque=traitement.evaluation_risque,
            comportement_anormal=traitement.comportement_anormal,
            comportement_non_cibles=traitement.comportement_non_cibles,
            mortalite=traitement.mortalite,
            mortalite_familles=traitement.mortalite_familles,
            statut=traitement.statut,
            statut_sync=traitement.statut_sync,
            created_at=traitement.created_at,
            updated_at=traitement.updated_at,
        )

        if traitement.cible is not None:
            model.cible = CibleModel(
                espece=traitement.cible.espece,
                petites_larves=traitement.cible.petites_larves,
                grandes_larves=traitement.cible.grandes_larves,
                vols_clairs_essaims=traitement.cible.vols_clairs_essaims,
                repartition_population=traitement.cible.repartition_population,
                surface_infestee_ha=traitement.cible.surface_infestee_ha,
            )

        if traitement.aerien is not None:
            model.aerien = TraitementAerienModel(
                pilote=traitement.aerien.pilote,
                mecanicien=traitement.aerien.mecanicien,
                chef_de_base_id=traitement.aerien.chef_de_base_id,
                consultant_international=traitement.aerien.consultant_international,
                nb_rotations=traitement.aerien.nb_rotations,
                total_pesticide_l=traitement.aerien.total_pesticide_l,
            )

        self.session.add(model)
        try:
            await self.session.commit()
        except IntegrityError as e:
            await self.session.rollback()
            # asyncpg enveloppe l'erreur pilote d'origine (avec .constraint_name) dans
            # un wrapper SQLAlchemy minimal ; l'original reste accessible via __cause__.
            constraint_name = getattr(e.orig, "constraint_name", None) or getattr(
                e.orig.__cause__, "constraint_name", None
            )
            if constraint_name == "traitement_numero_fiche_key":
                raise NumeroFicheConflitError(
                    f"numero_fiche '{traitement.numero_fiche}' déjà utilisé"
                ) from e
            raise
        return await self.get_by_id(model.id)

    def _to_domain(self, model: TraitementModel) -> Traitement:
        return Traitement(
            id=model.id,
            prospection_id=model.prospection_id,
            numero_fiche=model.numero_fiche,
            type_traitement=model.type_traitement,
            mode_traitement=model.mode_traitement,
            date_traitement=model.date_traitement,
            date_validation=model.date_validation,
            localite=model.localite,
            region=model.region,
            district=model.district,
            commune=model.commune,
            latitude=float(model.latitude) if model.latitude is not None else None,
            longitude=float(model.longitude) if model.longitude is not None else None,
            altitude=float(model.altitude) if model.altitude is not None else None,
            kit_combinaison=model.kit_combinaison,
            kit_gants=model.kit_gants,
            kit_lunettes=model.kit_lunettes,
            kit_masques=model.kit_masques,
            kit_boite=model.kit_boite,
            zones_exposees=model.zones_exposees,
            hauteur_strate_herbeuse_m=float(model.hauteur_strate_herbeuse_m)
            if model.hauteur_strate_herbeuse_m is not None
            else None,
            hauteur_strate_arboree_m=float(model.hauteur_strate_arboree_m)
            if model.hauteur_strate_arboree_m is not None
            else None,
            recouvrement_percent=model.recouvrement_percent,
            empoisonnement=model.empoisonnement,
            empoisonnement_type=model.empoisonnement_type,
            empoisonnement_mode=model.empoisonnement_mode,
            empoisonnement_autre=model.empoisonnement_autre,
            evaluation_risque=model.evaluation_risque,
            comportement_anormal=model.comportement_anormal,
            comportement_non_cibles=model.comportement_non_cibles,
            mortalite=model.mortalite,
            mortalite_familles=model.mortalite_familles,
            statut=model.statut,
            statut_sync=model.statut_sync,
            created_at=model.created_at,
            updated_at=model.updated_at,
            cible=Cible(
                traitement_id=model.cible.traitement_id,
                espece=model.cible.espece,
                petites_larves=model.cible.petites_larves,
                grandes_larves=model.cible.grandes_larves,
                vols_clairs_essaims=model.cible.vols_clairs_essaims,
                repartition_population=model.cible.repartition_population,
                surface_infestee_ha=float(model.cible.surface_infestee_ha)
                if model.cible.surface_infestee_ha is not None
                else None,
            )
            if model.cible is not None
            else None,
            aerien=TraitementAerien(
                traitement_id=model.aerien.traitement_id,
                pilote=model.aerien.pilote,
                mecanicien=model.aerien.mecanicien,
                chef_de_base_id=model.aerien.chef_de_base_id,
                consultant_international=model.aerien.consultant_international,
                nb_rotations=model.aerien.nb_rotations,
                total_pesticide_l=float(model.aerien.total_pesticide_l)
                if model.aerien.total_pesticide_l is not None
                else None,
            )
            if model.aerien is not None
            else None,
        )
