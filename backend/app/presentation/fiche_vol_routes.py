import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.fiche_vol_use_cases import (
    AddVol,
    CreateFicheVol,
    CumulsHeuresVol,
    GetFicheVol,
    ListFichesVol,
    RemoveVol,
    UpsertSignatureVol,
    ValiderFicheVol,
)
from app.auth import get_current_user
from app.database import get_db
from app.domain.fiche_vol import (
    ChefDeBaseVolInvalideError,
    FicheVol,
    FicheVolIntrouvableError,
    FicheVolVerrouilleeError,
    HeuresVolIncoherentesError,
    NumeroFicheVolConflitError,
    ProspectionVolIntrouvableError,
    RotationDejaRapprocheeError,
    RotationsIncompletesError,
    RotationVolIntrouvableError,
    SignaturesVolManquantesError,
    SignatureVol,
    Vol,
    VolRattachementInvalideError,
)
from app.infrastructure.fiche_vol_repository import FicheVolRepositoryImpl
from app.infrastructure.utilisateur_repository import UtilisateurRepositoryImpl
from app.models.users import Utilisateur
from app.presentation.fiche_vol_schemas import (
    CumulsRead,
    FicheVolCreate,
    FicheVolRead,
    SignatureVolUpsert,
    VolCreate,
)

router = APIRouter()


def _presenter(fiche: FicheVol) -> dict:
    """Ajoute les grandeurs dérivées, qui n'existent dans aucune colonne."""
    return {
        **fiche.__dict__,
        "duree_totale_minutes": fiche.duree_totale_minutes,
        "vols": [{**vol.__dict__, "duree_minutes": vol.duree_minutes} for vol in fiche.vols],
    }


def _repo(db: AsyncSession) -> FicheVolRepositoryImpl:
    return FicheVolRepositoryImpl(db)


@router.post("", response_model=FicheVolRead, status_code=201)
async def creer_fiche_vol(
    payload: FicheVolCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    donnees = payload.model_dump()
    vols_payload = donnees.pop("vols", [])
    try:
        fiche = FicheVol(numero="", **donnees)
        fiche.vols = [Vol(fiche_vol_id=fiche.id, **v) for v in vols_payload]
    except (VolRattachementInvalideError, HeuresVolIncoherentesError) as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc

    try:
        creee = await CreateFicheVol(_repo(db), UtilisateurRepositoryImpl(db)).execute(fiche)
    except ChefDeBaseVolInvalideError as exc:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "chef_de_base_id n'a pas le rôle chef_de_base"
        ) from exc
    except RotationDejaRapprocheeError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    except (RotationVolIntrouvableError, ProspectionVolIntrouvableError) as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except NumeroFicheVolConflitError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    return _presenter(creee)


@router.get("", response_model=list[FicheVolRead])
async def lister_fiches_vol(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
    date_vol: date | None = Query(default=None),
    immatriculation: str | None = Query(default=None),
    chef_de_base_id: uuid.UUID | None = Query(default=None),
):
    fiches = await ListFichesVol(_repo(db)).execute(date_vol, immatriculation, chef_de_base_id)
    return [_presenter(f) for f in fiches]


@router.get("/cumuls", response_model=CumulsRead)
async def cumuls_heures_vol(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
    reference: date = Query(description="Jour de référence des cumuls"),
    immatriculation: str | None = Query(default=None),
    chef_de_base_id: uuid.UUID | None = Query(default=None),
):
    return await CumulsHeuresVol(_repo(db)).execute(reference, immatriculation, chef_de_base_id)


@router.get("/{fiche_vol_id}", response_model=FicheVolRead)
async def lire_fiche_vol(
    fiche_vol_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    fiche = await GetFicheVol(_repo(db)).execute(fiche_vol_id)
    if fiche is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "fiche de vol introuvable")
    return _presenter(fiche)


@router.post("/{fiche_vol_id}/vols", response_model=FicheVolRead)
async def ajouter_vol(
    fiche_vol_id: uuid.UUID,
    payload: VolCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    try:
        vol = Vol(fiche_vol_id=fiche_vol_id, **payload.model_dump())
    except (VolRattachementInvalideError, HeuresVolIncoherentesError) as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    try:
        fiche = await AddVol(_repo(db)).execute(fiche_vol_id, vol)
    except FicheVolIntrouvableError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "fiche de vol introuvable") from exc
    except FicheVolVerrouilleeError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    except RotationDejaRapprocheeError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    except (RotationVolIntrouvableError, ProspectionVolIntrouvableError) as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    return _presenter(fiche)


@router.delete("/{fiche_vol_id}/vols/{vol_id}", response_model=FicheVolRead)
async def retirer_vol(
    fiche_vol_id: uuid.UUID,
    vol_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    try:
        fiche = await RemoveVol(_repo(db)).execute(fiche_vol_id, vol_id)
    except FicheVolIntrouvableError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "fiche de vol introuvable") from exc
    except FicheVolVerrouilleeError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    return _presenter(fiche)


@router.put("/{fiche_vol_id}/signatures", response_model=FicheVolRead)
async def signer_fiche_vol(
    fiche_vol_id: uuid.UUID,
    payload: SignatureVolUpsert,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    signature = SignatureVol(**payload.model_dump())
    try:
        fiche = await UpsertSignatureVol(_repo(db)).execute(fiche_vol_id, signature)
    except FicheVolIntrouvableError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "fiche de vol introuvable") from exc
    except FicheVolVerrouilleeError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    return _presenter(fiche)


@router.put("/{fiche_vol_id}/valider", response_model=FicheVolRead)
async def valider_fiche_vol(
    fiche_vol_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    try:
        fiche = await ValiderFicheVol(_repo(db)).execute(fiche_vol_id)
    except FicheVolIntrouvableError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "fiche de vol introuvable") from exc
    except FicheVolVerrouilleeError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    except (SignaturesVolManquantesError, RotationsIncompletesError) as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    return _presenter(fiche)
