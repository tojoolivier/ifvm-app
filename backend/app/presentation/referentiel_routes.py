import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.referentiel_use_cases import GetStation, ListPostesAcridiens, ListStations
from app.auth import get_current_user
from app.database import get_db
from app.infrastructure.referentiel_repository import (
    PosteAcridienRepositoryImpl,
    StationFixeRepositoryImpl,
)
from app.models.users import Utilisateur
from app.presentation.referentiel_schemas import PosteAcridienRead, StationFixeRead

router = APIRouter()


@router.get("/postes-acridiens", response_model=list[PosteAcridienRead])
async def list_postes_acridiens(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    repository = PosteAcridienRepositoryImpl(db)
    use_case = ListPostesAcridiens(repository)
    return await use_case.execute()


@router.get("/stations", response_model=list[StationFixeRead])
async def list_stations(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
    pa_id: uuid.UUID | None = Query(default=None),
    q: str | None = Query(default=None),
    actif: bool = Query(default=True),
):
    repository = StationFixeRepositoryImpl(db)
    use_case = ListStations(repository)
    return await use_case.execute(pa_id=pa_id, q=q, actif=actif)


@router.get("/stations/{station_id}", response_model=StationFixeRead)
async def get_station(
    station_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    repository = StationFixeRepositoryImpl(db)
    use_case = GetStation(repository)
    station = await use_case.execute(station_id)
    if station is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Station non trouvée")
    return station
