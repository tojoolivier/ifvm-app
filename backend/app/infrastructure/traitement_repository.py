from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.traitement import RotationAerienne, TraitementAerien
from app.infrastructure.traitement_model import (
    TraitementAerienModel,
    TraitementRotationModel,
)


class TraitementRepository:
    """Repository pour les traitements aériens"""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_aerien(self, traitement_aerien_id: UUID) -> Optional[TraitementAerien]:
        """Récupère un traitement aérien avec ses rotations"""
        # Requête pour récupérer le traitement et ses rotations
        stmt = select(TraitementAerienModel).where(TraitementAerienModel.id == traitement_aerien_id)
        result = await self.session.execute(stmt)
        model = result.scalar_one_or_none()

        if not model:
            return None

        # Récupérer les rotations associées
        stmt_rotations = (
            select(TraitementRotationModel)
            .where(TraitementRotationModel.traitement_aerien_id == traitement_aerien_id)
            .order_by(TraitementRotationModel.numero)
        )
        rotations_result = await self.session.execute(stmt_rotations)
        rotations_models = rotations_result.scalars().all()

        # Construire l'agrégat domaine
        return self._to_domain(model, rotations_models)

    async def sauvegarder(self, traitement: TraitementAerien) -> None:
        """Sauvegarde le traitement et ses rotations"""
        # Sauvegarder ou mettre à jour le traitement
        model = await self._get_or_create_model(traitement)

        # Mettre à jour les champs calculés
        model.nb_rotations = traitement.nb_rotations
        model.total_pesticide_l = traitement.total_pesticide_l

        # Gérer les rotations (sync)
        await self._synchroniser_rotations(traitement)

        await self.session.commit()

    async def _get_or_create_model(self, traitement: TraitementAerien) -> TraitementAerienModel:
        """Récupère ou crée le modèle SQLAlchemy"""
        model = await self.session.get(TraitementAerienModel, traitement.id)
        if not model:
            model = TraitementAerienModel(
                id=traitement.id,
                traitement_id=traitement.traitement_id,
                pilote=traitement.pilote,
                mecanicien=traitement.mecanicien,
                chef_de_base_id=traitement.chef_de_base_id,
                consultant_international=traitement.consultant_international,
            )
            self.session.add(model)
        return model

    async def _synchroniser_rotations(self, traitement: TraitementAerien) -> None:
        """Synchronise les rotations : ajout, suppression, mise à jour"""
        # Récupérer les IDs existants
        existing = await self.session.execute(
            select(TraitementRotationModel.id).where(
                TraitementRotationModel.traitement_aerien_id == traitement.id
            )
        )
        existing_ids = {row[0] for row in existing}

        # IDs des rotations dans l'agrégat
        domain_ids = {r.id for r in traitement.rotations}

        # Supprimer les rotations qui n'existent plus
        to_delete = existing_ids - domain_ids
        if to_delete:
            await self.session.execute(
                TraitementRotationModel.__table__.delete().where(
                    TraitementRotationModel.id.in_(to_delete)
                )
            )

        # Ajouter ou mettre à jour les rotations
        for rotation in traitement.rotations:
            await self._upsert_rotation(rotation)

    async def _upsert_rotation(self, rotation: RotationAerienne) -> None:
        """Ajoute ou met à jour une rotation"""
        model = await self.session.get(TraitementRotationModel, rotation.id)
        if not model:
            model = TraitementRotationModel(
                id=rotation.id,
                traitement_aerien_id=rotation.traitement_aerien_id,
            )
            self.session.add(model)

        model.numero = rotation.numero
        model.numero_cuve = rotation.numero_cuve
        model.produit_id = rotation.produit_id
        model.quantite_l = rotation.quantite_l
        model.temperature_debut_c = rotation.temperature_debut_c
        model.temperature_fin_c = rotation.temperature_fin_c
        model.vent_debut_ms = rotation.vent_debut_ms
        model.vent_fin_ms = rotation.vent_fin_ms

    def _to_domain(
        self,
        model: TraitementAerienModel,
        rotations_models: list[TraitementRotationModel],
    ) -> TraitementAerien:
        """Convertit les modèles SQLAlchemy en agrégat domaine"""
        rotations = [
            RotationAerienne(
                id=r.id,
                traitement_aerien_id=r.traitement_aerien_id,
                numero=r.numero,
                numero_cuve=r.numero_cuve,
                produit_id=r.produit_id,
                quantite_l=r.quantite_l,
                temperature_debut_c=r.temperature_debut_c,
                temperature_fin_c=r.temperature_fin_c,
                vent_debut_ms=r.vent_debut_ms,
                vent_fin_ms=r.vent_fin_ms,
            )
            for r in rotations_models
        ]

        return TraitementAerien(
            id=model.id,
            traitement_id=model.traitement_id,
            pilote=model.pilote,
            mecanicien=model.mecanicien,
            chef_de_base_id=model.chef_de_base_id,
            consultant_international=model.consultant_international,
            nb_rotations=model.nb_rotations,
            total_pesticide_l=model.total_pesticide_l,
            rotations=rotations,
        )
