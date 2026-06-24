import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.prospection_use_cases import (
    CreateProspection,
    DeleteProspection,
    GetProspection,
    ListProspections,
    UpdateProspection,
)
from app.auth import get_current_user
from app.database import get_db
from app.infrastructure.prospection_repository import ProspectionRepositoryImpl
from app.models.users import Utilisateur
from app.presentation.prospection_schemas import ProspectionCreate, ProspectionRead, ProspectionUpdate

router = APIRouter()


def get_repository(db: AsyncSession) -> ProspectionRepositoryImpl:
    return ProspectionRepositoryImpl(db)


@router.get("", response_model=list[ProspectionRead])
async def list_prospections(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
    type: str | None = Query(default=None),
    statut: str | None = Query(default=None),
    campagne_id: uuid.UUID | None = Query(default=None),
    station_id: uuid.UUID | None = Query(default=None),
    prospecteur_id: uuid.UUID | None = Query(default=None),
):
    repository = get_repository(db)
    use_case = ListProspections(repository)
    return await use_case.execute(
        type_prospection=type,
        statut=statut,
        campagne_id=campagne_id,
        station_id=station_id,
        prospecteur_id=prospecteur_id,
    )


@router.post("", response_model=ProspectionRead, status_code=201)
async def create_prospection(
    body: ProspectionCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Utilisateur, Depends(get_current_user)],
):
    repository = get_repository(db)
    use_case = CreateProspection(repository)
    try:
        return await use_case.execute(
            type_prospection=body.type_prospection,
            campagne_id=body.campagne_id,
            prospecteur_id=current_user.id,
            date_prospection=body.date_prospection,
            station_id=body.station_id,
            n_releve=body.n_releve,
            n_fiche=body.n_fiche,
            n_message=body.n_message,
            latitude=body.latitude,
            longitude=body.longitude,
            altitude=body.altitude,
            biotope=body.biotope,
            surf_station=body.surf_station,
            surf_prospectee=body.surf_prospectee,
            surf_infestee=body.surf_infestee,
            degats_cultures=body.degats_cultures,
            derniere_pluie=body.derniere_pluie,
            intensite_pluie=body.intensite_pluie,
            vegetation=body.vegetation,
            sol=body.sol,
            ennemis_naturels=body.ennemis_naturels,
            observations=body.observations,
            statut=body.statut,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.get("/{prospection_id}", response_model=ProspectionRead)
async def get_prospection(
    prospection_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    repository = get_repository(db)
    use_case = GetProspection(repository)
    prospection = await use_case.execute(prospection_id)
    if prospection is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prospection non trouvée")
    return prospection


@router.put("/{prospection_id}", response_model=ProspectionRead)
async def update_prospection(
    prospection_id: uuid.UUID,
    body: ProspectionUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    repository = get_repository(db)
    use_case = UpdateProspection(repository)
    try:
        prospection = await use_case.execute(
            prospection_id=prospection_id,
            station_id=body.station_id,
            n_releve=body.n_releve,
            n_fiche=body.n_fiche,
            n_message=body.n_message,
            date_prospection=body.date_prospection,
            latitude=body.latitude,
            longitude=body.longitude,
            altitude=body.altitude,
            biotope=body.biotope,
            surf_station=body.surf_station,
            surf_prospectee=body.surf_prospectee,
            surf_infestee=body.surf_infestee,
            degats_cultures=body.degats_cultures,
            derniere_pluie=body.derniere_pluie,
            intensite_pluie=body.intensite_pluie,
            vegetation=body.vegetation,
            sol=body.sol,
            ennemis_naturels=body.ennemis_naturels,
            observations=body.observations,
            statut=body.statut,
        )
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    if prospection is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prospection non trouvée")
    return prospection


@router.delete("/{prospection_id}", status_code=204)
async def delete_prospection(
    prospection_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    repository = get_repository(db)
    use_case = DeleteProspection(repository)
    try:
        deleted = await use_case.execute(prospection_id)
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prospection non trouvée")
