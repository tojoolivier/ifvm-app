import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.traitement_use_cases import (
    AddProduitUtilise,
    AddRotation,
    CreateTraitementAerien,
    CreateTraitementTerrestre,
    GetTraitement,
    ListTraitements,
    RemoveProduitUtilise,
    RemoveRotation,
    SyncPushTraitementAerien,
    SyncPushTraitementTerrestre,
    UpdateRotation,
    ValiderTraitement,
)
from app.auth import get_current_user
from app.database import get_db
from app.domain.traitement import (
    ChefDeBaseInvalideError,
    ChefEquipeInvalideError,
    NumeroFicheConflitError,
    ProduitUtiliseIntrouvableError,
    ProspectionIntrouvableError,
    RotationIntrouvableError,
    TraitementIntrouvableError,
    TraitementOrigineDejaUtiliseeError,
    TraitementOrigineIntrouvableError,
    TraitementSyncConflitError,
    TraitementValideeSyncRejeteError,
    TraitementVerrouilleError,
)
from app.infrastructure.prospection_repository import ProspectionRepositoryImpl
from app.infrastructure.traitement_repository import TraitementRepositoryImpl
from app.infrastructure.utilisateur_repository import UtilisateurRepositoryImpl
from app.models.users import Utilisateur
from app.presentation.traitement_schemas import (
    ProduitUtiliseCreate,
    RotationCreate,
    TraitementCreate,
    TraitementRead,
    TraitementSyncPush,
    ValiderTraitementRequest,
)

router = APIRouter()


def get_repository(db: AsyncSession) -> TraitementRepositoryImpl:
    return TraitementRepositoryImpl(db)


@router.get("", response_model=list[TraitementRead])
async def list_traitements(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
    type_traitement: str | None = Query(default=None),
    prospection_id: uuid.UUID | None = Query(default=None),
    chef_equipe_id: uuid.UUID | None = Query(default=None),
    reprenable: bool | None = Query(default=None),
):
    repository = get_repository(db)
    use_case = ListTraitements(repository)
    return await use_case.execute(
        type_traitement=type_traitement,
        prospection_id=prospection_id,
        chef_equipe_id=chef_equipe_id,
        reprenable=reprenable,
    )


def _champs_communs(body: TraitementCreate) -> dict[str, Any]:
    return dict(
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
        kit_botte=body.kit_botte,
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
        observations=body.observations,
    )


@router.post("", response_model=TraitementRead, status_code=201)
async def create_traitement(
    body: TraitementCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    repository = get_repository(db)
    prospection_repository = ProspectionRepositoryImpl(db)
    utilisateur_repository = UtilisateurRepositoryImpl(db)
    try:
        if body.aerien is not None:
            use_case = CreateTraitementAerien(
                traitement_repository=repository,
                prospection_repository=prospection_repository,
                utilisateur_repository=utilisateur_repository,
            )
            return await use_case.execute(
                **_champs_communs(body),
                pilote=body.aerien.pilote,
                mecanicien=body.aerien.mecanicien,
                chef_de_base_id=body.aerien.chef_de_base_id,
                consultant_international=body.aerien.consultant_international,
                immatricule_aeronef=body.aerien.immatricule_aeronef,
                surface_traitee_ha=body.aerien.surface_traitee_ha,
                pesticide_recu_l=body.aerien.pesticide_recu_l,
            )
        use_case_terrestre = CreateTraitementTerrestre(
            traitement_repository=repository,
            prospection_repository=prospection_repository,
            utilisateur_repository=utilisateur_repository,
        )
        return await use_case_terrestre.execute(
            **_champs_communs(body),
            heure_debut=body.terrestre.heure_debut,
            heure_fin=body.terrestre.heure_fin,
            vitesse_vent_ms=body.terrestre.vitesse_vent_ms,
            direction_vent=body.terrestre.direction_vent,
            temperature_c=body.terrestre.temperature_c,
            chef_equipe_id=body.terrestre.chef_equipe_id,
            agent_encadreur_id=body.terrestre.agent_encadreur_id,
            consultant_international=body.terrestre.consultant_international,
            surface_atomiseur_ha=body.terrestre.surface_atomiseur_ha,
            surface_disque_rotatif_ha=body.terrestre.surface_disque_rotatif_ha,
            surface_ulvamast_ha=body.terrestre.surface_ulvamast_ha,
            surface_restante_abandonnee=body.terrestre.surface_restante_abandonnee,
            motif_surface_restante_abandonnee=body.terrestre.motif_surface_restante_abandonnee,
            essence_litres=body.terrestre.essence_litres,
            nb_piles=body.terrestre.nb_piles,
            pesticide_recu_l=body.terrestre.pesticide_recu_l,
            reprise_traitement=body.terrestre.reprise_traitement,
            traitement_origine_id=body.terrestre.traitement_origine_id,
        )
    except (ChefDeBaseInvalideError, ChefEquipeInvalideError) as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except (ProspectionIntrouvableError, TraitementOrigineIntrouvableError) as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except (NumeroFicheConflitError, TraitementOrigineDejaUtiliseeError) as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.post("/sync")
async def sync_traitement(
    body: TraitementSyncPush,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    """Push de synchronisation offline (ADR-002 / décision #60).

    201 si la fiche n'existait pas encore côté serveur, 200 si mise à jour synchronisée
    sans conflit, 409 (avec la version serveur complète) si la fiche est verrouillée
    (`validee`) ou en conflit (`updated_at` serveur postérieur + contenu divergent).
    """
    repository = get_repository(db)
    prospection_repository = ProspectionRepositoryImpl(db)
    utilisateur_repository = UtilisateurRepositoryImpl(db)
    try:
        if body.aerien is not None:
            use_case = SyncPushTraitementAerien(
                traitement_repository=repository,
                prospection_repository=prospection_repository,
                utilisateur_repository=utilisateur_repository,
            )
            traitement, cree = await use_case.execute(
                traitement_id=body.id,
                base_updated_at=body.base_updated_at,
                **_champs_communs(body),
                pilote=body.aerien.pilote,
                mecanicien=body.aerien.mecanicien,
                chef_de_base_id=body.aerien.chef_de_base_id,
                consultant_international=body.aerien.consultant_international,
                immatricule_aeronef=body.aerien.immatricule_aeronef,
                surface_traitee_ha=body.aerien.surface_traitee_ha,
                pesticide_recu_l=body.aerien.pesticide_recu_l,
            )
        else:
            use_case_terrestre = SyncPushTraitementTerrestre(
                traitement_repository=repository,
                prospection_repository=prospection_repository,
                utilisateur_repository=utilisateur_repository,
            )
            traitement, cree = await use_case_terrestre.execute(
                traitement_id=body.id,
                base_updated_at=body.base_updated_at,
                **_champs_communs(body),
                heure_debut=body.terrestre.heure_debut,
                heure_fin=body.terrestre.heure_fin,
                vitesse_vent_ms=body.terrestre.vitesse_vent_ms,
                direction_vent=body.terrestre.direction_vent,
                temperature_c=body.terrestre.temperature_c,
                chef_equipe_id=body.terrestre.chef_equipe_id,
                agent_encadreur_id=body.terrestre.agent_encadreur_id,
                consultant_international=body.terrestre.consultant_international,
                surface_atomiseur_ha=body.terrestre.surface_atomiseur_ha,
                surface_disque_rotatif_ha=body.terrestre.surface_disque_rotatif_ha,
                surface_ulvamast_ha=body.terrestre.surface_ulvamast_ha,
                surface_restante_abandonnee=body.terrestre.surface_restante_abandonnee,
                motif_surface_restante_abandonnee=body.terrestre.motif_surface_restante_abandonnee,
                essence_litres=body.terrestre.essence_litres,
                nb_piles=body.terrestre.nb_piles,
                pesticide_recu_l=body.terrestre.pesticide_recu_l,
                reprise_traitement=body.terrestre.reprise_traitement,
                traitement_origine_id=body.terrestre.traitement_origine_id,
            )
        status_code = status.HTTP_201_CREATED if cree else status.HTTP_200_OK
        return JSONResponse(
            status_code=status_code,
            content=jsonable_encoder(TraitementRead.model_validate(traitement)),
        )
    except (ChefDeBaseInvalideError, ChefEquipeInvalideError) as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except (ProspectionIntrouvableError, TraitementOrigineIntrouvableError) as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except (NumeroFicheConflitError, TraitementOrigineDejaUtiliseeError) as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except (TraitementValideeSyncRejeteError, TraitementSyncConflitError) as e:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content=jsonable_encoder(TraitementRead.model_validate(e.traitement_serveur)),
        )
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
            heure_debut=body.heure_debut,
            heure_fin=body.heure_fin,
            nom_commercial=body.nom_commercial,
        )
    except TraitementIntrouvableError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except TraitementVerrouilleError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


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
            heure_debut=body.heure_debut,
            heure_fin=body.heure_fin,
            nom_commercial=body.nom_commercial,
        )
    except (TraitementIntrouvableError, RotationIntrouvableError) as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except TraitementVerrouilleError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


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
    except TraitementVerrouilleError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.post("/{traitement_id}/produits", response_model=TraitementRead, status_code=201)
async def add_produit(
    traitement_id: uuid.UUID,
    body: ProduitUtiliseCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = AddProduitUtilise(get_repository(db))
    try:
        return await use_case.execute(
            traitement_id=traitement_id,
            produit_id=body.produit_id,
            quantite_l=body.quantite_l,
            nom_commercial=body.nom_commercial,
        )
    except TraitementIntrouvableError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except TraitementVerrouilleError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.delete("/{traitement_id}/produits/{produit_utilise_id}", response_model=TraitementRead)
async def remove_produit(
    traitement_id: uuid.UUID,
    produit_utilise_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = RemoveProduitUtilise(get_repository(db))
    try:
        return await use_case.execute(
            traitement_id=traitement_id, produit_utilise_id=produit_utilise_id
        )
    except (TraitementIntrouvableError, ProduitUtiliseIntrouvableError) as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except TraitementVerrouilleError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.post("/{traitement_id}/valider", response_model=TraitementRead)
async def valider_traitement(
    traitement_id: uuid.UUID,
    body: ValiderTraitementRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = ValiderTraitement(get_repository(db))
    try:
        return await use_case.execute(
            traitement_id=traitement_id,
            date_validation=body.date_validation,
            signatures=[s.model_dump(mode="json") for s in body.signatures],
        )
    except TraitementIntrouvableError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except TraitementVerrouilleError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
