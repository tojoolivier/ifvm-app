from decimal import Decimal
from uuid import UUID, uuid4

from app.domain.traitement import RotationAerienne
from app.infrastructure.traitement_repository import TraitementRepository


class AjouterRotationUseCase:
    def __init__(self, repository: TraitementRepository):
        self.repository = repository

    async def execute(
        self,
        traitement_aerien_id: UUID,
        numero_cuve: str,
        produit_id: UUID,
        quantite_l: Decimal,
        temperature_debut_c: Decimal,
        temperature_fin_c: Decimal,
        vent_debut_ms: Decimal,
        vent_fin_ms: Decimal,
    ) -> RotationAerienne:
        traitement = await self.repository.get_aerien(traitement_aerien_id)
        if not traitement:
            raise ValueError("Traitement aérien non trouvé")

        rotation = RotationAerienne(
            id=uuid4(),
            traitement_aerien_id=traitement.id,
            numero=0,
            numero_cuve=numero_cuve,
            produit_id=produit_id,
            quantite_l=quantite_l,
            temperature_debut_c=temperature_debut_c,
            temperature_fin_c=temperature_fin_c,
            vent_debut_ms=vent_debut_ms,
            vent_fin_ms=vent_fin_ms,
        )

        traitement.ajouter_rotation(rotation)
        await self.repository.sauvegarder(traitement)
        return rotation


class SupprimerRotationUseCase:
    def __init__(self, repository: TraitementRepository):
        self.repository = repository

    async def execute(self, traitement_aerien_id: UUID, rotation_id: UUID) -> None:
        traitement = await self.repository.get_aerien(traitement_aerien_id)
        if not traitement:
            raise ValueError("Traitement aérien non trouvé")

        traitement.supprimer_rotation(rotation_id)
        await self.repository.sauvegarder(traitement)
