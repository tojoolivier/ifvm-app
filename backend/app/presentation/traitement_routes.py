from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.traitement_use_cases import AjouterRotationUseCase, SupprimerRotationUseCase
from app.database import get_db
from app.infrastructure.traitement_repository import TraitementRepository
from app.presentation.traitement_schemas import RotationAerienneCreate, RotationAerienneResponse

router = APIRouter(prefix="/traitements", tags=["traitements"])


@router.post(
    "/{traitement_aerien_id}/rotations",
    response_model=RotationAerienneResponse,
    status_code=status.HTTP_201_CREATED,
)
async def ajouter_rotation(
    traitement_aerien_id: UUID,
    data: RotationAerienneCreate,
    session: AsyncSession = Depends(get_db),
):
    repository = TraitementRepository(session)
    use_case = AjouterRotationUseCase(repository)

    try:
        rotation = await use_case.execute(
            traitement_aerien_id=traitement_aerien_id,
            numero_cuve=data.numero_cuve,
            produit_id=data.produit_id,
            quantite_l=data.quantite_l,
            temperature_debut_c=data.temperature_debut_c,
            temperature_fin_c=data.temperature_fin_c,
            vent_debut_ms=data.vent_debut_ms,
            vent_fin_ms=data.vent_fin_ms,
        )
        return RotationAerienneResponse(
            id=rotation.id,
            numero=rotation.numero,
            numero_cuve=rotation.numero_cuve,
            produit_id=rotation.produit_id,
            quantite_l=rotation.quantite_l,
            temperature_debut_c=rotation.temperature_debut_c,
            temperature_fin_c=rotation.temperature_fin_c,
            vent_debut_ms=rotation.vent_debut_ms,
            vent_fin_ms=rotation.vent_fin_ms,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete(
    "/{traitement_aerien_id}/rotations/{rotation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def supprimer_rotation(
    traitement_aerien_id: UUID,
    rotation_id: UUID,
    session: AsyncSession = Depends(get_db),
):
    repository = TraitementRepository(session)
    use_case = SupprimerRotationUseCase(repository)

    try:
        await use_case.execute(traitement_aerien_id, rotation_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
