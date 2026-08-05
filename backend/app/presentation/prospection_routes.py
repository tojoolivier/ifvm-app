import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List

from app.database import get_db
from app.auth import get_current_user
from app.models.users import Utilisateur
from app.infrastructure.referentiel_model import StationFixeModel
from app.infrastructure.prospection_model import (
    ProspectionModel,
    ProspectionPopulationModel,
    ProspectionCaptureModel,
    ProspectionInfestationModel,
)
from app.presentation.prospection_schemas import ProspectionRead, ProspectionCreate

router = APIRouter()


@router.get("", response_model=List[ProspectionRead])
async def get_prospections(
    type: str | None = Query(None),
    db: AsyncSession = Depends(get_db)
):
    query = select(ProspectionModel).options(
        selectinload(ProspectionModel.station).selectinload(StationFixeModel.poste),
        selectinload(ProspectionModel.populations),
        selectinload(ProspectionModel.captures),
        selectinload(ProspectionModel.infestations),
    )

    if type:
        query = query.where(ProspectionModel.type_prospection == type)

    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=ProspectionRead, status_code=201)
async def create_prospection(
    payload: ProspectionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    data = payload.model_dump(exclude={"populations", "captures", "infestations"})

    prospection = ProspectionModel(
        id=uuid.uuid4(),
        prospecteur_id=current_user.id,
        **data,
    )

    for pop in payload.populations:
        prospection.populations.append(ProspectionPopulationModel(**pop.model_dump()))

    for cap in payload.captures:
        prospection.captures.append(ProspectionCaptureModel(**cap.model_dump()))

    for inf in payload.infestations:
        prospection.infestations.append(ProspectionInfestationModel(**inf.model_dump()))

    db.add(prospection)
    await db.commit()

    result = await db.execute(
        select(ProspectionModel)
        .options(
            selectinload(ProspectionModel.station).selectinload(StationFixeModel.poste),
            selectinload(ProspectionModel.populations),
            selectinload(ProspectionModel.captures),
            selectinload(ProspectionModel.infestations),
        )
        .where(ProspectionModel.id == prospection.id)
    )
    return result.scalar_one()