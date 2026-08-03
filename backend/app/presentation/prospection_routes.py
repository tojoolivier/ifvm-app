import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.prospection_use_cases import (
    AjouterCommentaire,
    ChangerStatut,
    CreateProspection,
    DeleteProspection,
    GetAuditLog,
    GetProspection,
    ListProspections,
    UpdateProspection,
)
from app.auth import get_current_user
from app.database import get_db
from app.domain.prospection import (
    ProspectionCapture,
    ProspectionInfestation,
    ProspectionPopulation,
)
from app.domain.referentiel import StationNotFoundError
from app.infrastructure.audit_log_repository import AuditLogRepositoryImpl
from app.infrastructure.prospection_repository import ProspectionRepositoryImpl
from app.models.users import Utilisateur
from app.presentation.prospection_schemas import (
    AuditLogRead,
    CommentaireCreate,
    ProspectionCreate,
    ProspectionRead,
    ProspectionUpdate,
    StatutChange,
)

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
            verdissement=body.verdissement,
            hauteur_strate=body.hauteur_strate,
            ennemis_naturels=body.ennemis_naturels,
            observations=body.observations,
            statut=body.statut,
            populations=[ProspectionPopulation(**p.model_dump()) for p in body.populations],
            captures=[ProspectionCapture(**c.model_dump()) for c in body.captures],
            infestations=[ProspectionInfestation(**i.model_dump()) for i in body.infestations],
            # ==========================================
            # NOUVEAUX CHAMPS - Références (A)
            # ==========================================
            region=body.region,
            district=body.district,
            commune=body.commune,
            za=body.za,
            pa_code=body.pa_code,
            # ==========================================
            # NOUVEAUX CHAMPS - Observations (D)
            # ==========================================
            degats_cultures_pourcent=body.degats_cultures_pourcent,
            verdissement_pourcent=body.verdissement_pourcent,
            hauteur_herbe_cm=body.hauteur_herbe_cm,
            # ==========================================
            # NOUVEAUX CHAMPS - Extensif & Validation
            # ==========================================
            station_libre=body.station_libre,
            type_station=body.type_station,
            verdure_strate=body.verdure_strate,
            signalement_source=body.signalement_source,
            signalement_date=body.signalement_date,
            signalement_description=body.signalement_description,
            conclusion_validation=body.conclusion_validation,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except StationNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


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
            verdissement=body.verdissement,
            hauteur_strate=body.hauteur_strate,
            ennemis_naturels=body.ennemis_naturels,
            observations=body.observations,
            statut=body.statut,
            # ==========================================
            # NOUVEAUX CHAMPS - Références (A)
            # ==========================================
            region=body.region,
            district=body.district,
            commune=body.commune,
            za=body.za,
            pa_code=body.pa_code,
            # ==========================================
            # NOUVEAUX CHAMPS - Observations (D)
            # ==========================================
            degats_cultures_pourcent=body.degats_cultures_pourcent,
            verdissement_pourcent=body.verdissement_pourcent,
            hauteur_herbe_cm=body.hauteur_herbe_cm,
            # ==========================================
            # NOUVEAUX CHAMPS - Extensif & Validation
            # ==========================================
            station_libre=body.station_libre,
            type_station=body.type_station,
            verdure_strate=body.verdure_strate,
            signalement_source=body.signalement_source,
            signalement_date=body.signalement_date,
            signalement_description=body.signalement_description,
            conclusion_validation=body.conclusion_validation,
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


@router.patch("/{prospection_id}/statut", response_model=ProspectionRead)
async def changer_statut(
    prospection_id: uuid.UUID,
    body: StatutChange,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Utilisateur, Depends(get_current_user)],
):
    prospection_repo = get_repository(db)
    audit_repo = AuditLogRepositoryImpl(db)
    use_case = ChangerStatut(prospection_repo, audit_repo)
    try:
        return await use_case.execute(
            prospection_id=prospection_id,
            nouveau_statut=body.statut,
            acteur_id=current_user.id,
            acteur_role=current_user.role,
        )
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.post("/{prospection_id}/commentaire", response_model=AuditLogRead, status_code=201)
async def ajouter_commentaire(
    prospection_id: uuid.UUID,
    body: CommentaireCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Utilisateur, Depends(get_current_user)],
):
    prospection_repo = get_repository(db)
    audit_repo = AuditLogRepositoryImpl(db)
    use_case = AjouterCommentaire(prospection_repo, audit_repo)
    try:
        return await use_case.execute(
            prospection_id=prospection_id,
            auteur_id=current_user.id,
            texte=body.texte,
        )
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/{prospection_id}/audit-log", response_model=list[AuditLogRead])
async def get_audit_log(
    prospection_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    prospection_repo = get_repository(db)
    audit_repo = AuditLogRepositoryImpl(db)
    use_case = GetAuditLog(prospection_repo, audit_repo)
    try:
        return await use_case.execute(prospection_id)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
