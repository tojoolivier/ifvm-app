from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.geo import PosteAcridien, Station, StationMeteo
from app.schemas.geo import (
    PosteAcridienCreate, PosteAcridienRead,
    StationCreate, StationRead,
    StationMeteoCreate, StationMeteoRead,
)

router = APIRouter()


@router.get("/postes", response_model=list[PosteAcridienRead])
async def list_postes(db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(PosteAcridien).order_by(PosteAcridien.code))
    return result.scalars().all()


@router.post("/postes", response_model=PosteAcridienRead, status_code=201)
async def create_poste(body: PosteAcridienCreate, db: Annotated[AsyncSession, Depends(get_db)]):
    pa = PosteAcridien(**body.model_dump())
    db.add(pa)
    await db.commit()
    await db.refresh(pa)
    return pa


@router.get("/stations", response_model=list[StationRead])
async def list_stations(db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(Station).order_by(Station.code))
    return result.scalars().all()


@router.post("/stations", response_model=StationRead, status_code=201)
async def create_station(body: StationCreate, db: Annotated[AsyncSession, Depends(get_db)]):
    station = Station(**body.model_dump())
    db.add(station)
    await db.commit()
    await db.refresh(station)
    return station


@router.get("/stations-meteo", response_model=list[StationMeteoRead])
async def list_stations_meteo(db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(StationMeteo).order_by(StationMeteo.code))
    return result.scalars().all()


@router.post("/stations-meteo", response_model=StationMeteoRead, status_code=201)
async def create_station_meteo(body: StationMeteoCreate, db: Annotated[AsyncSession, Depends(get_db)]):
    sm = StationMeteo(**body.model_dump())
    db.add(sm)
    await db.commit()
    await db.refresh(sm)
    return sm
