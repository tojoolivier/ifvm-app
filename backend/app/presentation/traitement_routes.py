import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.traitement_use_cases import (
    CreateTraitementAerien,
    GetTraitement,
    ListTraitements,
)
from app.auth import get_current_user
from app.database import get_db
from app.domain.traitement import (
    ChefDeBaseInvalideError,
    NumeroFicheConflitError,
    ProspectionIntrouvableError,
)
from app.infrastructure.prospection_repository import ProspectionRepositoryImpl
from app.infrastructure.traitement_repository import TraitementRepositoryImpl
from app.infrastructure.utilisateur_repository import UtilisateurRepositoryImpl
from app.models.users import Utilisateur
from app.presentation.traitement_schemas import TraitementCreate, TraitementRead

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
