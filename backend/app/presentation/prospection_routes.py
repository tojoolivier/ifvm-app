import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.prospection_use_cases import (
    AjouterCommentaire,
    ChangerStatut,
    CreateProspection,
    DeleteProspection,
    GenererProspectionPdf,
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
    ProspectionIntegriteError,
    ProspectionNonValideeError,
    ProspectionOperationAerienne,
    ProspectionPopulation,
    StadeInconnuError,
)
from app.domain.referentiel import StationNotFoundError
from app.infrastructure.audit_log_repository import AuditLogRepositoryImpl
from app.infrastructure.pdf_renderer import render_html_to_pdf
from app.infrastructure.prospection_repository import ProspectionRepositoryImpl
from app.infrastructure.referentiel_sync_repository import EquipeRepositoryImpl
from app.models.users import Utilisateur
from app.presentation.prospection_pdf import build_prospection_html
from app.presentation.prospection_schemas import (
    AuditLogRead,
    CommentaireCreate,
    NotificationRead,
    NotificationsResponse,
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
    equipe_id: uuid.UUID | None = Query(
        default=None,
        description=(
            "Interventions menées par cette équipe, triées par date_prospection "
            "décroissante (#607) — la position courante d'une équipe mobile "
            "terrestre se déduit de la première ligne."
        ),
    ),
    disponible_pour_traitement: bool = Query(
        default=False,
        description=(
            "N'inclut que les fiches sans traitement associé, ni périmées "
            "(#revalidation-prospection : extensive/validation validées depuis "
            "plus de 5 jours sans traitement) — « Fiches de traitement → "
            "Consulter une fiche validée » (mobile), combiné à statut=validee."
        ),
    ),
    a_revalider: bool = Query(
        default=False,
        description=(
            "N'inclut que les fiches périmées (#revalidation-prospection) — "
            "exactement celles qu'exclut disponible_pour_traitement pour cette "
            "raison, sans traitement associé et pas déjà revalidées."
        ),
    ),
):
    repository = get_repository(db)
    use_case = ListProspections(repository)
    return await use_case.execute(
        type_prospection=type,
        statut=statut,
        campagne_id=campagne_id,
        station_id=station_id,
        prospecteur_id=prospecteur_id,
        equipe_id=equipe_id,
        disponible_pour_traitement=disponible_pour_traitement,
        a_revalider=a_revalider,
    )


@router.post("", response_model=ProspectionRead, status_code=201)
async def create_prospection(
    body: ProspectionCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Utilisateur, Depends(get_current_user)],
):
    repository = get_repository(db)
    use_case = CreateProspection(repository, EquipeRepositoryImpl(db), AuditLogRepositoryImpl(db))
    try:
        prospection = await use_case.execute(
            type_prospection=body.type_prospection,
            campagne_id=body.campagne_id,
            prospecteur_id=current_user.id,
            equipe_id=body.equipe_id,
            date_prospection=body.date_prospection,
            station_id=body.station_id,
            n_fiche=body.n_fiche,
            n_message=body.n_message,
            latitude=body.latitude,
            longitude=body.longitude,
            altitude=body.altitude,
            biotope=body.biotope,
            surface_station=body.surface_station,
            surface_prospectee=body.surface_prospectee,
            surface_infestee=body.surface_infestee,
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
            operations_aeriennes=[
                ProspectionOperationAerienne(**o.model_dump()) for o in body.operations_aeriennes
            ],
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
            heure_observation_at=body.heure_observation_at,
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
            avertissements=body.avertissements,
            # ==========================================
            # NOUVEAUX CHAMPS - Extensif : mode aérien
            # ==========================================
            mode_extensif=body.mode_extensif,
            societe=body.societe,
            immatricule_aeronef=body.immatricule_aeronef,
            pilote=body.pilote,
            mecanicien=body.mecanicien,
            chef_de_base=body.chef_de_base,
            base=body.base,
            base_numero=body.base_numero,
            base_date_installation=body.base_date_installation,
            base_latitude=body.base_latitude,
            base_longitude=body.base_longitude,
            base_secondaire=body.base_secondaire,
            base_secondaire_date_installation=body.base_secondaire_date_installation,
            base_secondaire_latitude=body.base_secondaire_latitude,
            base_secondaire_longitude=body.base_secondaire_longitude,
            # ==========================================
            # NOUVEAUX CHAMPS - Extensif : signatures
            # ==========================================
            signature_visa_nom=body.signature_visa_nom,
            signature_visa_horodatage=body.signature_visa_horodatage,
            signature_visa_image=body.signature_visa_image,
            signature_consultant_fao_nom=body.signature_consultant_fao_nom,
            signature_consultant_fao_horodatage=body.signature_consultant_fao_horodatage,
            signature_consultant_fao_image=body.signature_consultant_fao_image,
            signature_pilote_nom=body.signature_pilote_nom,
            signature_pilote_horodatage=body.signature_pilote_horodatage,
            signature_pilote_image=body.signature_pilote_image,
            signature_chef_base_nom=body.signature_chef_base_nom,
            signature_chef_base_horodatage=body.signature_chef_base_horodatage,
            signature_chef_base_image=body.signature_chef_base_image,
            revalide_de_id=body.revalide_de_id,
        )

        # 👇 AJOUTE CETTE VÉRIFICATION POUR ÉVITER L'ERREUR 500
        if prospection is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erreur interne : impossible de récupérer la prospection créée",
            )

        return prospection

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except StationNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except (ProspectionIntegriteError, StadeInconnuError) as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.get("/notifications", response_model=NotificationsResponse)
async def get_notifications(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Utilisateur, Depends(get_current_user)],
    limit: int = Query(default=50, ge=1, le=200),
):
    """Centre de notifications — dérivé de `audit_log` (aucune table dédiée) :
    admin/vérificateur/validation_finale voient toutes les fiches et actions
    (nouvelle fiche comprise) ; un prospecteur ne voit que les transitions de
    statut sur ses propres fiches. `lu` compare `created_at` au curseur
    `utilisateur.notifications_lues_at` (migration 0052) — NULL veut dire
    « jamais consulté », donc tout est non-lu.

    IMPORTANT : déclarée avant `GET /{prospection_id}` ci-dessous — sinon
    FastAPI essaierait de parser "notifications" comme un UUID (422) plutôt
    que d'atteindre cette route, l'ordre de déclaration faisant la priorité.
    """
    audit_repo = AuditLogRepositoryImpl(db)
    lignes = await audit_repo.list_notifications(
        role=current_user.role, utilisateur_id=current_user.id, limit=limit
    )
    vu_a = current_user.notifications_lues_at
    items = [
        NotificationRead(**ligne, lu=vu_a is not None and ligne["created_at"] <= vu_a)
        for ligne in lignes
    ]
    return NotificationsResponse(items=items, non_lues=sum(1 for i in items if not i.lu))


@router.post("/notifications/vu", status_code=204)
async def marquer_notifications_vues(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Utilisateur, Depends(get_current_user)],
):
    current_user.notifications_lues_at = datetime.now(timezone.utc)
    await db.commit()


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


@router.get("/{prospection_id}/pdf")
async def get_prospection_pdf(
    prospection_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    repository = get_repository(db)
    use_case = GenererProspectionPdf(repository)
    try:
        prospection = await use_case.execute(prospection_id)
    except ProspectionNonValideeError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    if prospection is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prospection non trouvée")

    prospection_read = ProspectionRead.model_validate(prospection)
    html = build_prospection_html(prospection_read)
    pdf = render_html_to_pdf(html)
    nom_fichier = f"fiche-prospection-{prospection_read.n_fiche}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{nom_fichier}"'},
    )


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
            n_fiche=body.n_fiche,
            n_message=body.n_message,
            date_prospection=body.date_prospection,
            latitude=body.latitude,
            longitude=body.longitude,
            altitude=body.altitude,
            biotope=body.biotope,
            surface_station=body.surface_station,
            surface_prospectee=body.surface_prospectee,
            surface_infestee=body.surface_infestee,
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
            heure_observation_at=body.heure_observation_at,
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
            avertissements=body.avertissements,
        )
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except StationNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except (ProspectionIntegriteError, StadeInconnuError) as e:
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
            commentaire=body.commentaire,
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
