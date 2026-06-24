import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import get_current_user
from app.database import get_db
from app.infrastructure.referentiel_model import PosteAcridienModel, StationFixeModel
from app.models.users import Utilisateur
from app.presentation.referentiel_schemas import PosteAcridienRead, StationFixeRead

router = APIRouter()


@router.get("/postes-acridiens", response_model=list[PosteAcridienRead])
async def list_postes_acridiens(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    result = await db.execute(
        select(PosteAcridienModel).order_by(PosteAcridienModel.code)
    )
    return result.scalars().all()


@router.get("/stations", response_model=list[StationFixeRead])
async def list_stations(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
    pa_id: uuid.UUID | None = Query(default=None),
    q: str | None = Query(default=None),
    actif: bool = Query(default=True),
):
    stmt = (
        select(StationFixeModel, PosteAcridienModel.code.label("pa_code"), PosteAcridienModel.nom.label("pa_nom"))
        .join(PosteAcridienModel, StationFixeModel.pa_id == PosteAcridienModel.id)
        .where(StationFixeModel.actif == actif)
    )

    if pa_id is not None:
        stmt = stmt.where(StationFixeModel.pa_id == pa_id)

    if q is not None:
        like_pattern = f"%{q}%"
        stmt = stmt.where(
            StationFixeModel.code.ilike(like_pattern) | StationFixeModel.nom.ilike(like_pattern)
        )

    stmt = stmt.order_by(StationFixeModel.code)
    result = await db.execute(stmt)

    stations = []
    for row in result.all():
        station_model = row[0]
        stations.append(
            StationFixeRead(
                id=station_model.id,
                code=station_model.code,
                nom=station_model.nom,
                pa_id=station_model.pa_id,
                pa_code=row.pa_code,
                pa_nom=row.pa_nom,
                latitude=float(station_model.latitude),
                longitude=float(station_model.longitude),
                altitude=float(station_model.altitude) if station_model.altitude is not None else None,
                actif=station_model.actif,
            )
        )
    return stations


@router.get("/stations/{station_id}", response_model=StationFixeRead)
async def get_station(
    station_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    result = await db.execute(
        select(StationFixeModel, PosteAcridienModel.code.label("pa_code"), PosteAcridienModel.nom.label("pa_nom"))
        .join(PosteAcridienModel, StationFixeModel.pa_id == PosteAcridienModel.id)
        .where(StationFixeModel.id == station_id)
    )
    row = result.first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Station non trouvée")

    station_model = row[0]
    return StationFixeRead(
        id=station_model.id,
        code=station_model.code,
        nom=station_model.nom,
        pa_id=station_model.pa_id,
        pa_code=row.pa_code,
        pa_nom=row.pa_nom,
        latitude=float(station_model.latitude),
        longitude=float(station_model.longitude),
        altitude=float(station_model.altitude) if station_model.altitude is not None else None,
        actif=station_model.actif,
    )
