import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.crt_use_cases import CRTUseCases
from app.database import get_db
from app.infrastructure.crt_repository import CRTRepository
from app.presentation.crt_schemas import CRTCreate, CRTResponse, CRTUpdate

router = APIRouter(prefix="/crt", tags=["crt"])


async def get_crt_use_cases(session: AsyncSession = Depends(get_db)):
    repository = CRTRepository(session)
    return CRTUseCases(repository)


@router.post("/", response_model=CRTResponse, status_code=status.HTTP_201_CREATED)
async def create_crt(data: CRTCreate, use_cases: CRTUseCases = Depends(get_crt_use_cases)):
    """Créer un nouveau CRT"""
    result = await use_cases.create_crt(data.model_dump())
    return result


@router.get("/{crt_id}", response_model=CRTResponse)
async def get_crt(crt_id: uuid.UUID, use_cases: CRTUseCases = Depends(get_crt_use_cases)):
    """Récupérer un CRT par son ID"""
    result = await use_cases.get_crt(crt_id)
    if not result:
        raise HTTPException(status_code=404, detail="CRT non trouvé")
    return result


@router.get("/prospection/{prospection_id}", response_model=CRTResponse)
async def get_crt_by_prospection(
    prospection_id: uuid.UUID, use_cases: CRTUseCases = Depends(get_crt_use_cases)
):
    """Récupérer le CRT associé à une prospection"""
    result = await use_cases.get_crt_by_prospection(prospection_id)
    if not result:
        raise HTTPException(status_code=404, detail="Aucun CRT trouvé pour cette prospection")
    return result


@router.put("/{crt_id}", response_model=CRTResponse)
async def update_crt(
    crt_id: uuid.UUID, data: CRTUpdate, use_cases: CRTUseCases = Depends(get_crt_use_cases)
):
    """Mettre à jour un CRT"""
    result = await use_cases.update_crt(crt_id, data.model_dump(exclude_unset=True))
    if not result:
        raise HTTPException(status_code=404, detail="CRT non trouvé")
    return result


@router.delete("/{crt_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_crt(crt_id: uuid.UUID, use_cases: CRTUseCases = Depends(get_crt_use_cases)):
    """Supprimer un CRT"""
    deleted = await use_cases.delete_crt(crt_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="CRT non trouvé")


@router.post("/{crt_id}/validate", response_model=CRTResponse)
async def validate_crt(
    crt_id: uuid.UUID, validated_by: uuid.UUID, use_cases: CRTUseCases = Depends(get_crt_use_cases)
):
    """Valider un CRT"""
    result = await use_cases.validate_crt(crt_id, validated_by)
    if not result:
        raise HTTPException(status_code=404, detail="CRT non trouvé")
    return result


@router.get("/", response_model=List[CRTResponse])
async def list_crt(
    limit: int = 100,
    offset: int = 0,
    statut: str | None = None,
    use_cases: CRTUseCases = Depends(get_crt_use_cases),
):
    """Lister les CRT"""
    return await use_cases.repository.get_all(limit=limit, offset=offset, statut=statut)
