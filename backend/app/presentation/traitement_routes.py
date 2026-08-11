import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.traitement_use_cases import (
    AddRotation,
    CreateTraitementAerien,
    GetTraitement,
    ListTraitements,
    RemoveRotation,
    UpdateRotation,
)
from app.auth import get_current_user
from app.database import get_db
from app.domain.traitement import (
    ChefDeBaseInvalideError,
    NumeroFicheConflitError,
    ProspectionIntrouvableError,
    RotationIntrouvableError,
    TraitementIntrouvableError,
)
from app.infrastructure.prospection_repository import ProspectionRepositoryImpl
from app.infrastructure.traitement_repository import TraitementRepositoryImpl
from app.infrastructure.utilisateur_repository import UtilisateurRepositoryImpl
from app.models.users import Utilisateur
from app.presentation.traitement_schemas import RotationCreate, TraitementCreate, TraitementRead

router = APIRouter()


def get_repository(db: AsyncSession) -> TraitementRepositoryImpl:
    return TraitementRepositoryImpl(db)


@router.get("", response_model=list[TraitementRead])
async def list_traitements(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
    type_traitement: str | None = Query(default=None),
    prospection_id: uuid.UUID | None = Query(default=None),
):
    repository = get_repository(db)
    use_case = ListTraitements(repository)
    return await use_case.execute(
        type_traitement=type_traitement,
        prospection_id=prospection_id,
    )


@router.post("", response_model=TraitementRead, status_code=201)
async def create_traitement(
    body: TraitementCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = CreateTraitementAerien(
        traitement_repository=get_repository(db),
        prospection_repository=ProspectionRepositoryImpl(db),
        utilisateur_repository=UtilisateurRepositoryImpl(db),
    )
    try:
        return await use_case.execute(
            prospection_id=body.prospection_id,
            numero_fiche=body.numero_fiche,
            mode_traitement=body.mode_traitement,
            date_traitement=body.date_traitement,
            date_validation=body.date_validation,
            localite=body.localite,
            region=body.region,
            district=body.district,
            commune=body.commune,
            latitude=body.latitude,
            longitude=body.longitude,
            altitude=body.altitude,
            kit_combinaison=body.kit_combinaison,
            kit_gants=body.kit_gants,
            kit_lunettes=body.kit_lunettes,
            kit_masques=body.kit_masques,
            kit_boite=body.kit_boite,
            zones_exposees=body.zones_exposees,
            hauteur_strate_herbeuse_m=body.hauteur_strate_herbeuse_m,
            hauteur_strate_arboree_m=body.hauteur_strate_arboree_m,
            recouvrement_percent=body.recouvrement_percent,
            empoisonnement=body.empoisonnement,
            empoisonnement_type=body.empoisonnement_type,
            empoisonnement_mode=body.empoisonnement_mode,
            empoisonnement_autre=body.empoisonnement_autre,
            evaluation_risque=body.evaluation_risque,
            comportement_anormal=body.comportement_anormal,
            comportement_non_cibles=body.comportement_non_cibles,
            mortalite=body.mortalite,
            mortalite_familles=body.mortalite_familles,
            pilote=body.aerien.pilote,
            mecanicien=body.aerien.mecanicien,
            chef_de_base_id=body.aerien.chef_de_base_id,
            consultant_international=body.aerien.consultant_international,
        )
    except ChefDeBaseInvalideError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ProspectionIntrouvableError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except NumeroFicheConflitError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.get("/{traitement_id}", response_model=TraitementRead)
async def get_traitement(
    traitement_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    repository = get_repository(db)
    use_case = GetTraitement(repository)
    traitement = await use_case.execute(traitement_id)
    if traitement is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Traitement non trouvé")
    return traitement


@router.post("/{traitement_id}/rotations", response_model=TraitementRead, status_code=201)
async def add_rotation(
    traitement_id: uuid.UUID,
    body: RotationCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = AddRotation(get_repository(db))
    try:
        return await use_case.execute(
            traitement_id=traitement_id,
            numero_cuve=body.numero_cuve,
            produit_id=body.produit_id,
            quantite_l=body.quantite_l,
            temperature_debut_c=body.temperature_debut_c,
            temperature_fin_c=body.temperature_fin_c,
            vent_debut_ms=body.vent_debut_ms,
            vent_fin_ms=body.vent_fin_ms,
        )
    except TraitementIntrouvableError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{traitement_id}/rotations/{rotation_id}", response_model=TraitementRead)
async def update_rotation(
    traitement_id: uuid.UUID,
    rotation_id: uuid.UUID,
    body: RotationCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = UpdateRotation(get_repository(db))
    try:
        return await use_case.execute(
            traitement_id=traitement_id,
            rotation_id=rotation_id,
            numero_cuve=body.numero_cuve,
            produit_id=body.produit_id,
            quantite_l=body.quantite_l,
            temperature_debut_c=body.temperature_debut_c,
            temperature_fin_c=body.temperature_fin_c,
            vent_debut_ms=body.vent_debut_ms,
            vent_fin_ms=body.vent_fin_ms,
        )
    except (TraitementIntrouvableError, RotationIntrouvableError) as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{traitement_id}/rotations/{rotation_id}", response_model=TraitementRead)
async def remove_rotation(
    traitement_id: uuid.UUID,
    rotation_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = RemoveRotation(get_repository(db))
    try:
        return await use_case.execute(traitement_id=traitement_id, rotation_id=rotation_id)
    except (TraitementIntrouvableError, RotationIntrouvableError) as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
