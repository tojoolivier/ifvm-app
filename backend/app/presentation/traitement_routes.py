import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.traitement_use_cases import (
    AddBloc,
    AddProduitUtilise,
    AddRotation,
    CreateTraitementAerien,
    CreateTraitementTerrestre,
    GenererTraitementPdf,
    GetTraitement,
    ListTraitements,
    RemoveBloc,
    RemoveProduitUtilise,
    RemoveRotation,
    SyncPushTraitementAerien,
    SyncPushTraitementTerrestre,
    UpdateBloc,
    UpdateRotation,
    ValiderTraitement,
)
from app.auth import get_current_user
from app.database import get_db
from app.domain.traitement import (
    BlocIntrouvableError,
    BlocModeIncoherentError,
    BlocSurfaceDepasseInfesteeError,
    ChefDeBaseInvalideError,
    ChefEquipeInvalideError,
    EvaluationRisquePopulation,
    NumeroFicheConflitError,
    ProduitUtiliseIntrouvableError,
    ProspectionIntrouvableError,
    RotationBlocInvalideError,
    RotationIntrouvableError,
    SitePrincipalIntrouvableError,
    TraitementIntrouvableError,
    TraitementNonValideeError,
    TraitementOrigineDejaUtiliseeError,
    TraitementOrigineIntrouvableError,
    TraitementSyncConflitError,
    TraitementValideeSyncRejeteError,
    TraitementVerrouilleError,
)
from app.infrastructure.pdf_renderer import render_html_to_pdf
from app.infrastructure.prospection_repository import ProspectionRepositoryImpl
from app.infrastructure.referentiel_sync_repository import (
    EquipeRepositoryImpl,
    MouvementPesticideRepositoryImpl,
    SiteAerienneRepositoryImpl,
)
from app.infrastructure.traitement_repository import TraitementRepositoryImpl
from app.infrastructure.utilisateur_repository import UtilisateurRepositoryImpl
from app.models.users import Utilisateur
from app.presentation.traitement_pdf import build_crt_html
from app.presentation.traitement_schemas import (
    BlocCreate,
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
    statut: str | None = Query(default=None),
):
    repository = get_repository(db)
    use_case = ListTraitements(repository)
    return await use_case.execute(
        type_traitement=type_traitement,
        prospection_id=prospection_id,
        chef_equipe_id=chef_equipe_id,
        reprenable=reprenable,
        statut=statut,
    )


def _champs_communs(body: TraitementCreate) -> dict[str, Any]:
    return dict(
        prospection_id=body.prospection_id,
        equipe_id=body.equipe_id,
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
        nb_agents_permanents=body.nb_agents_permanents,
        nb_agents_temporaires=body.nb_agents_temporaires,
        nb_personnel_local=body.nb_personnel_local,
        moyens_atomiseur_nb=body.moyens_atomiseur_nb,
        moyens_essence_litres=body.moyens_essence_litres,
        moyens_disque_rotatif_nb=body.moyens_disque_rotatif_nb,
        moyens_piles_nb=body.moyens_piles_nb,
        moyens_ulvamast_nb=body.moyens_ulvamast_nb,
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
        # « Évaluation du risque pour la population » (migration 0055) —
        # `ordre` dérivé de la position dans la liste envoyée, jamais saisi
        # par le client (cf. EvaluationRisquePopulationCreate).
        evaluations_risque_population=[
            EvaluationRisquePopulation(ordre=i, **e.model_dump())
            for i, e in enumerate(body.evaluations_risque_population)
        ],
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
    site_aerienne_repository = SiteAerienneRepositoryImpl(db)
    equipe_repository = EquipeRepositoryImpl(db)
    try:
        if body.aerien is not None:
            use_case = CreateTraitementAerien(
                traitement_repository=repository,
                prospection_repository=prospection_repository,
                utilisateur_repository=utilisateur_repository,
                site_aerienne_repository=site_aerienne_repository,
                equipe_repository=equipe_repository,
            )
            return await use_case.execute(
                **_champs_communs(body),
                pilote=body.aerien.pilote,
                mecanicien=body.aerien.mecanicien,
                chef_de_base_id=body.aerien.chef_de_base_id,
                consultant_international=body.aerien.consultant_international,
                base_principale=body.aerien.base_principale,
                site_principal_id=body.aerien.site_principal_id,
                stand=body.aerien.stand,
                stand_date_installation=body.aerien.stand_date_installation,
                base_secondaire=body.aerien.base_secondaire,
                base_secondaire_date_installation=body.aerien.base_secondaire_date_installation,
                immatricule_aeronef=body.aerien.immatricule_aeronef,
                surface_restante_abandonnee=body.aerien.surface_restante_abandonnee,
                motif_surface_restante_abandonnee=body.aerien.motif_surface_restante_abandonnee,
                taux_mortalite_pourcent=body.aerien.taux_mortalite_pourcent,
                evaluation_efficacite_heures_apres=body.aerien.evaluation_efficacite_heures_apres,
                methode_evaluation_efficacite=body.aerien.methode_evaluation_efficacite,
                reprise_traitement=body.aerien.reprise_traitement,
                traitement_origine_id=body.aerien.traitement_origine_id,
            )
        use_case_terrestre = CreateTraitementTerrestre(
            traitement_repository=repository,
            prospection_repository=prospection_repository,
            utilisateur_repository=utilisateur_repository,
            equipe_repository=equipe_repository,
        )
        return await use_case_terrestre.execute(
            **_champs_communs(body),
            heure_debut=body.terrestre.heure_debut,
            heure_fin=body.terrestre.heure_fin,
            vitesse_vent_ms=body.terrestre.vitesse_vent_ms,
            direction_vent=body.terrestre.direction_vent,
            temperature_c=body.terrestre.temperature_c,
            chef_equipe_id=body.terrestre.chef_equipe_id,
            agent_encadreur=body.terrestre.agent_encadreur,
            consultant_international=body.terrestre.consultant_international,
            surface_atomiseur_ha=body.terrestre.surface_atomiseur_ha,
            surface_disque_rotatif_ha=body.terrestre.surface_disque_rotatif_ha,
            surface_atomiseur_autoporte_ha=body.terrestre.surface_atomiseur_autoporte_ha,
            surface_restante_abandonnee=body.terrestre.surface_restante_abandonnee,
            motif_surface_restante_abandonnee=body.terrestre.motif_surface_restante_abandonnee,
            essence_litres=body.terrestre.essence_litres,
            nb_piles=body.terrestre.nb_piles,
            pesticide_unite=body.terrestre.pesticide_unite,
            pesticide_recu_l=body.terrestre.pesticide_recu_l,
            stock_initial_l=body.terrestre.stock_initial_l,
            taux_mortalite_pourcent=body.terrestre.taux_mortalite_pourcent,
            evaluation_efficacite_heures_apres=body.terrestre.evaluation_efficacite_heures_apres,
            methode_evaluation_efficacite=body.terrestre.methode_evaluation_efficacite,
            reprise_traitement=body.terrestre.reprise_traitement,
            traitement_origine_id=body.terrestre.traitement_origine_id,
        )
    except (ChefDeBaseInvalideError, ChefEquipeInvalideError) as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except (
        ProspectionIntrouvableError,
        TraitementOrigineIntrouvableError,
        SitePrincipalIntrouvableError,
    ) as e:
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
    site_aerienne_repository = SiteAerienneRepositoryImpl(db)
    equipe_repository = EquipeRepositoryImpl(db)
    try:
        if body.aerien is not None:
            use_case = SyncPushTraitementAerien(
                traitement_repository=repository,
                prospection_repository=prospection_repository,
                utilisateur_repository=utilisateur_repository,
                site_aerienne_repository=site_aerienne_repository,
                equipe_repository=equipe_repository,
            )
            traitement, cree = await use_case.execute(
                traitement_id=body.id,
                base_updated_at=body.base_updated_at,
                **_champs_communs(body),
                pilote=body.aerien.pilote,
                mecanicien=body.aerien.mecanicien,
                chef_de_base_id=body.aerien.chef_de_base_id,
                consultant_international=body.aerien.consultant_international,
                base_principale=body.aerien.base_principale,
                site_principal_id=body.aerien.site_principal_id,
                stand=body.aerien.stand,
                stand_date_installation=body.aerien.stand_date_installation,
                base_secondaire=body.aerien.base_secondaire,
                base_secondaire_date_installation=body.aerien.base_secondaire_date_installation,
                immatricule_aeronef=body.aerien.immatricule_aeronef,
                surface_restante_abandonnee=body.aerien.surface_restante_abandonnee,
                motif_surface_restante_abandonnee=body.aerien.motif_surface_restante_abandonnee,
                taux_mortalite_pourcent=body.aerien.taux_mortalite_pourcent,
                evaluation_efficacite_heures_apres=body.aerien.evaluation_efficacite_heures_apres,
                methode_evaluation_efficacite=body.aerien.methode_evaluation_efficacite,
                reprise_traitement=body.aerien.reprise_traitement,
                traitement_origine_id=body.aerien.traitement_origine_id,
            )
        else:
            use_case_terrestre = SyncPushTraitementTerrestre(
                traitement_repository=repository,
                prospection_repository=prospection_repository,
                utilisateur_repository=utilisateur_repository,
                equipe_repository=equipe_repository,
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
                agent_encadreur=body.terrestre.agent_encadreur,
                consultant_international=body.terrestre.consultant_international,
                surface_atomiseur_ha=body.terrestre.surface_atomiseur_ha,
                surface_disque_rotatif_ha=body.terrestre.surface_disque_rotatif_ha,
                surface_atomiseur_autoporte_ha=body.terrestre.surface_atomiseur_autoporte_ha,
                surface_restante_abandonnee=body.terrestre.surface_restante_abandonnee,
                motif_surface_restante_abandonnee=body.terrestre.motif_surface_restante_abandonnee,
                essence_litres=body.terrestre.essence_litres,
                nb_piles=body.terrestre.nb_piles,
                pesticide_unite=body.terrestre.pesticide_unite,
                pesticide_recu_l=body.terrestre.pesticide_recu_l,
                stock_initial_l=body.terrestre.stock_initial_l,
                taux_mortalite_pourcent=body.terrestre.taux_mortalite_pourcent,
                evaluation_efficacite_heures_apres=body.terrestre.evaluation_efficacite_heures_apres,
                methode_evaluation_efficacite=body.terrestre.methode_evaluation_efficacite,
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
    except (
        ProspectionIntrouvableError,
        TraitementOrigineIntrouvableError,
        SitePrincipalIntrouvableError,
    ) as e:
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


@router.get("/{traitement_id}/pdf")
async def get_traitement_pdf(
    traitement_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    repository = get_repository(db)
    use_case = GenererTraitementPdf(repository)
    try:
        traitement = await use_case.execute(traitement_id)
    except TraitementIntrouvableError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except TraitementNonValideeError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))

    traitement_read = TraitementRead.model_validate(traitement)
    html = build_crt_html(traitement_read)
    pdf = render_html_to_pdf(html)
    nom_fichier = f"fiche-crt-{traitement_read.numero_fiche}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{nom_fichier}"'},
    )


@router.post("/{traitement_id}/rotations", response_model=TraitementRead, status_code=201)
async def add_rotation(
    traitement_id: uuid.UUID,
    body: RotationCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = AddRotation(get_repository(db), MouvementPesticideRepositoryImpl(db))
    try:
        return await use_case.execute(
            traitement_id=traitement_id,
            produit_id=body.produit_id,
            quantite=body.quantite,
            unite=body.unite.value,
            surface_ha=body.surface_ha,
            temperature_debut_c=body.temperature_debut_c,
            temperature_fin_c=body.temperature_fin_c,
            vent_debut_ms=body.vent_debut_ms,
            vent_fin_ms=body.vent_fin_ms,
            heure_debut=body.heure_debut,
            heure_ouverture_vanne=body.heure_ouverture_vanne,
            heure_fermeture_vanne=body.heure_fermeture_vanne,
            heure_fin=body.heure_fin,
            nom_commercial=body.nom_commercial,
            bloc_id=body.bloc_id,
        )
    except TraitementIntrouvableError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except TraitementVerrouilleError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except (ValueError, RotationBlocInvalideError) as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.put("/{traitement_id}/rotations/{rotation_id}", response_model=TraitementRead)
async def update_rotation(
    traitement_id: uuid.UUID,
    rotation_id: uuid.UUID,
    body: RotationCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = UpdateRotation(get_repository(db), MouvementPesticideRepositoryImpl(db))
    try:
        return await use_case.execute(
            traitement_id=traitement_id,
            rotation_id=rotation_id,
            produit_id=body.produit_id,
            quantite=body.quantite,
            unite=body.unite.value,
            surface_ha=body.surface_ha,
            temperature_debut_c=body.temperature_debut_c,
            temperature_fin_c=body.temperature_fin_c,
            vent_debut_ms=body.vent_debut_ms,
            vent_fin_ms=body.vent_fin_ms,
            heure_debut=body.heure_debut,
            heure_ouverture_vanne=body.heure_ouverture_vanne,
            heure_fermeture_vanne=body.heure_fermeture_vanne,
            heure_fin=body.heure_fin,
            nom_commercial=body.nom_commercial,
            bloc_id=body.bloc_id,
        )
    except (TraitementIntrouvableError, RotationIntrouvableError) as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except TraitementVerrouilleError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except (ValueError, RotationBlocInvalideError) as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.delete("/{traitement_id}/rotations/{rotation_id}", response_model=TraitementRead)
async def remove_rotation(
    traitement_id: uuid.UUID,
    rotation_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = RemoveRotation(get_repository(db), MouvementPesticideRepositoryImpl(db))
    try:
        return await use_case.execute(traitement_id=traitement_id, rotation_id=rotation_id)
    except (TraitementIntrouvableError, RotationIntrouvableError) as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except TraitementVerrouilleError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.post("/{traitement_id}/blocs", response_model=TraitementRead, status_code=201)
async def add_bloc(
    traitement_id: uuid.UUID,
    body: BlocCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = AddBloc(get_repository(db))
    try:
        return await use_case.execute(
            traitement_id=traitement_id,
            nom=body.nom,
            localite=body.localite,
            surface_theorique_ha=body.surface_theorique_ha,
            surface_reelle_ha=body.surface_reelle_ha,
            surface_protegee_ha=body.surface_protegee_ha,
            surface_traitee_ha=body.surface_traitee_ha,
            largeur_andain_m=body.largeur_andain_m,
            interpasse_m=body.interpasse_m,
            hauteur_vol_min_m=body.hauteur_vol_min_m,
            hauteur_vol_max_m=body.hauteur_vol_max_m,
            observation=body.observation,
        )
    except TraitementIntrouvableError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except TraitementVerrouilleError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except (BlocModeIncoherentError, BlocSurfaceDepasseInfesteeError) as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.put("/{traitement_id}/blocs/{bloc_id}", response_model=TraitementRead)
async def update_bloc(
    traitement_id: uuid.UUID,
    bloc_id: uuid.UUID,
    body: BlocCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = UpdateBloc(get_repository(db))
    try:
        return await use_case.execute(
            traitement_id=traitement_id,
            bloc_id=bloc_id,
            nom=body.nom,
            localite=body.localite,
            surface_theorique_ha=body.surface_theorique_ha,
            surface_reelle_ha=body.surface_reelle_ha,
            surface_protegee_ha=body.surface_protegee_ha,
            surface_traitee_ha=body.surface_traitee_ha,
            largeur_andain_m=body.largeur_andain_m,
            interpasse_m=body.interpasse_m,
            hauteur_vol_min_m=body.hauteur_vol_min_m,
            hauteur_vol_max_m=body.hauteur_vol_max_m,
            observation=body.observation,
        )
    except (TraitementIntrouvableError, BlocIntrouvableError) as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except TraitementVerrouilleError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except (BlocModeIncoherentError, BlocSurfaceDepasseInfesteeError) as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.delete("/{traitement_id}/blocs/{bloc_id}", response_model=TraitementRead)
async def remove_bloc(
    traitement_id: uuid.UUID,
    bloc_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = RemoveBloc(get_repository(db))
    try:
        return await use_case.execute(traitement_id=traitement_id, bloc_id=bloc_id)
    except (TraitementIntrouvableError, BlocIntrouvableError) as e:
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
