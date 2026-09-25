import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.campagne_use_cases import (
    CreateCampagne,
    GetCampagne,
    ListCampagnes,
    UpdateCampagne,
)
from app.auth import get_current_user
from app.database import get_db
from app.infrastructure.campagne_model import CampagneModel
from app.infrastructure.campagne_repository import CampagneRepositoryImpl
from app.models.users import Utilisateur
from app.presentation.campagne_schemas import CampagneCreate, CampagneRead, CampagneUpdate
from app.presentation.suppression_routes import ajouter_route_suppression

router = APIRouter()


def get_repository(db: AsyncSession) -> CampagneRepositoryImpl:
    return CampagneRepositoryImpl(db)


@router.get("", response_model=list[CampagneRead])
async def list_campagnes(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    repository = get_repository(db)
    use_case = ListCampagnes(repository)
    return await use_case.execute()


@router.post("", response_model=CampagneRead, status_code=201)
async def create_campagne(
    body: CampagneCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Utilisateur, Depends(get_current_user)],
):
    repository = get_repository(db)
    use_case = CreateCampagne(repository)
    return await use_case.execute(
        name=body.name,
        start_date=body.start_date,
        end_date=body.end_date,
        created_by=current_user.id,
    )


@router.get("/{campagne_id}", response_model=CampagneRead)
async def get_campagne(
    campagne_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    repository = get_repository(db)
    use_case = GetCampagne(repository)
    campagne = await use_case.execute(campagne_id)
    if campagne is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campagne non trouvée")
    return campagne


# Suppression : soft-delete `deleted_at` (#674) — cf. `suppression_routes.py`.
@router.put("/{campagne_id}", response_model=CampagneRead)
async def update_campagne(
    campagne_id: uuid.UUID,
    body: CampagneUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    repository = get_repository(db)
    use_case = UpdateCampagne(repository)
    campagne = await use_case.execute(
        campagne_id=campagne_id,
        name=body.name,
        start_date=body.start_date,
        end_date=body.end_date,
        actif=body.actif,
    )
    if campagne is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campagne non trouvée")
    return campagne


ajouter_route_suppression(router, "/{item_id}", CampagneModel, "Campagne")
