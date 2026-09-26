import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.referentiel_use_cases import (
    AffecterAeronef,
    AjouterMembreEquipe,
    CloturerAffectationAeronef,
    ConsulterSoldePesticide,
    CreateAeronef,
    CreateCodeStade,
    CreateCulture,
    CreateEquipe,
    CreateLieuAerien,
    CreateMouvementPesticide,
    CreatePesticide,
    CreatePosteAcridien,
    CreateSiteAerienne,
    CreateStation,
    CreateVol,
    CreateZoneAntiAcridien,
    DemonterPositionSiteAerienne,
    DeplacerSiteAerienne,
    GetAeronef,
    GetCodeStade,
    GetCulture,
    GetEquipe,
    GetLieuAerien,
    GetPesticide,
    GetPositionActiveSiteAerienne,
    GetPosteAcridien,
    GetSiteAerienne,
    GetStation,
    GetVol,
    InstallerPositionSiteAerienne,
    ListAeronefs,
    ListCodesStades,
    ListCommunes,
    ListCultures,
    ListEquipes,
    ListerAffectationsAeronef,
    ListerAffectationsParAeronef,
    ListerMouvementsPesticide,
    ListerPositionsSiteAerienne,
    ListLieuxAeriens,
    ListPesticides,
    ListPostesAcridiens,
    ListSitesAeriens,
    ListStations,
    ListVols,
    ListZonesAntiAcridiennes,
    MembreDemande,
    PullReferentiel,
    ReferentielSinceCursors,
    UpdateAeronef,
    UpdateCodeStade,
    UpdateCulture,
    UpdateEquipe,
    UpdateLieuAerien,
    UpdatePesticide,
    UpdatePosteAcridien,
    UpdateSiteAerienne,
    UpdateStation,
    UpdateVol,
    UpdateZoneAntiAcridien,
)
from app.auth import get_current_user, require_admin, require_chef_de_base_ou_admin
from app.database import get_db
from app.domain.referentiel import (
    Aeronef,
    AeronefDejaAffecteError,
    AeronefIntrouvableError,
    AeronefNonAffecteError,
    AffectationAeronefIntrouvableError,
    AffectationDejaCloturee,
    ChefDejaDansUneAutreEquipeError,
    ChefEquipeInvalideError,
    CodeReferentielDejaPrisError,
    CommuneInconnueError,
    CompteALaVoleeInterditError,
    EquipeADejaUnChefError,
    EquipeAerienneDejaAssigneeError,
    EquipeAerienneIntrouvableError,
    EquipeDejaEquipeeError,
    EquipeIntrouvableError,
    EquipeNonAerienneError,
    EquipeNonAutoriseeError,
    EquipeTerrestreIntrouvableError,
    GrilleDejaOccupeeError,
    IdentifiantDejaUtiliseError,
    ImmatriculationAeronefDejaPriseError,
    MembreDejaDansEquipeError,
    NumeroSiteAerienneDejaPrisError,
    PeriodeAffectationInvalideError,
    PesticideIntrouvableError,
    PositionActiveIntrouvableError,
    PositionDejaActiveError,
    PosteAcridienAvecStationsActivesError,
    PosteAcridienInactifError,
    PosteAcridienIntrouvableError,
    SiteAerienneDependantInvalideError,
    SiteAerienneEquipeInvalideError,
    SiteAerienneIntrouvableError,
    SiteAerienneParentAbsentError,
    SiteAerienneParentInvalideError,
    SiteDestinationIncoherentError,
    SiteHorsBaseError,
    SiteNonPrincipalError,
    StadeInconnuError,
    TraitementAerienIntrouvableError,
    TypeLieuAerienInvalideError,
    UtilisateurMembreIntrouvableError,
    VolIntrouvableError,
    VolLieuxConvoyageRequisError,
    VolMotifRequisError,
    VolSiteObligatoireError,
    VolTypeNonApplicationError,
    ZoneAntiAcridienAvecPostesActifsError,
    ZoneAntiAcridienIntrouvableError,
)
from app.infrastructure.campagne_repository import CampagneRepositoryImpl
from app.infrastructure.referentiel_model import (
    AeronefModel,
    CodeStadeModel,
    CultureModel,
    EquipeAeronefModel,
    EquipeModel,
    LieuAerienModel,
    PesticideModel,
    PosteAcridienModel,
    SiteAerienneModel,
    StationFixeModel,
    ZoneAntiAcridienModel,
)
from app.infrastructure.referentiel_repository import (
    CommuneRepositoryImpl,
    PosteAcridienRepositoryImpl,
    StationFixeRepositoryImpl,
    ZoneAntiAcridienRepositoryImpl,
)
from app.infrastructure.referentiel_sync_repository import (
    AeronefRepositoryImpl,
    CodeStadeRepositoryImpl,
    CultureRepositoryImpl,
    EquipeAeronefRepositoryImpl,
    EquipeRepositoryImpl,
    LieuAerienRepositoryImpl,
    MouvementPesticideRepositoryImpl,
    PesticideRepositoryImpl,
    SiteAeriennePositionRepositoryImpl,
    SiteAerienneRepositoryImpl,
    UtilisateurEquipeRepositoryImpl,
    VolRepositoryImpl,
)
from app.infrastructure.traitement_repository import TraitementRepositoryImpl
from app.infrastructure.utilisateur_repository import UtilisateurRepositoryImpl
from app.models.users import Utilisateur
from app.presentation.referentiel_schemas import (
    AeronefCreate,
    AeronefRead,
    AeronefUpdate,
    AffectationAeronefCloture,
    AffectationAeronefCreate,
    AffectationAeronefRead,
    CodeStadeCreate,
    CodeStadeRead,
    CodeStadeUpdate,
    CommuneRead,
    CultureCreate,
    CultureRead,
    CultureUpdate,
    EntityPull,
    EquipeCreate,
    EquipeRead,
    EquipeUpdate,
    LieuAerienCreate,
    LieuAerienRead,
    LieuAerienUpdate,
    MembreEquipeCreate,
    MembreEquipeRead,
    MouvementPesticideCreate,
    MouvementPesticideRead,
    PesticideCreate,
    PesticideRead,
    PesticideUpdate,
    PosteAcridienCreate,
    PosteAcridienRead,
    PosteAcridienUpdate,
    ReferentielPullResponse,
    SiteAerienneCreate,
    SiteAerienneDeplacer,
    SiteAeriennePositionInstaller,
    SiteAeriennePositionRead,
    SiteAerienneRead,
    SiteAerienneSyncRead,
    SiteAerienneUpdate,
    SoldePesticideRead,
    StationFixeCreate,
    StationFixeRead,
    StationFixeUpdate,
    VolCreate,
    VolRead,
    VolUpdate,
    ZoneAntiAcridienCreate,
    ZoneAntiAcridienRead,
    ZoneAntiAcridienUpdate,
)
from app.presentation.suppression_routes import (
    ajouter_route_suppression,
    charger_ligne_vivante,
    marquer_supprime,
)

router = APIRouter()


@router.get("/zones-anti-acridiennes", response_model=list[ZoneAntiAcridienRead])
async def list_zones_anti_acridiennes(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
    inclure_inactifs: bool = Query(
        default=False,
        description="Renvoie les zones des deux états — écran d'administration.",
    ),
):
    repository = ZoneAntiAcridienRepositoryImpl(db)
    use_case = ListZonesAntiAcridiennes(repository)
    return await use_case.execute(actif=None if inclure_inactifs else True)


@router.post("/zones-anti-acridiennes", response_model=ZoneAntiAcridienRead, status_code=201)
async def create_zone_anti_acridienne(
    body: ZoneAntiAcridienCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = CreateZoneAntiAcridien(ZoneAntiAcridienRepositoryImpl(db))
    try:
        return await use_case.execute(code=body.code, nom=body.nom)
    except CodeReferentielDejaPrisError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Le code « {body.code} » est déjà utilisé par une autre zone anti-acridienne",
        ) from exc


@router.put("/zones-anti-acridiennes/{za_id}", response_model=ZoneAntiAcridienRead)
async def update_zone_anti_acridienne(
    za_id: uuid.UUID,
    body: ZoneAntiAcridienUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = UpdateZoneAntiAcridien(ZoneAntiAcridienRepositoryImpl(db))
    try:
        zone = await use_case.execute(
            za_id=za_id,
            code=body.code,
            nom=body.nom,
            actif=body.actif,
        )
    except CodeReferentielDejaPrisError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Le code « {body.code} » est déjà utilisé par une autre zone anti-acridienne",
        ) from exc
    except ZoneAntiAcridienAvecPostesActifsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Des postes acridiens actifs sont rattachés à cette zone : "
                "désactivez-les d'abord, la désactivation ne se propage pas."
            ),
        ) from exc
    if zone is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Zone anti-acridienne non trouvée"
        )
    return zone


@router.get("/postes-acridiens", response_model=list[PosteAcridienRead])
async def list_postes_acridiens(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
    inclure_inactifs: bool = Query(
        default=False,
        description="Renvoie les postes des deux états — écran d'administration.",
    ),
):
    use_case = ListPostesAcridiens(PosteAcridienRepositoryImpl(db))
    return await use_case.execute(actif=None if inclure_inactifs else True)


@router.get("/postes-acridiens/{pa_id}", response_model=PosteAcridienRead)
async def get_poste_acridien(
    pa_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = GetPosteAcridien(PosteAcridienRepositoryImpl(db))
    poste = await use_case.execute(pa_id)
    if poste is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Poste acridien non trouvé"
        )
    return poste


@router.post("/postes-acridiens", response_model=PosteAcridienRead, status_code=201)
async def create_poste_acridien(
    body: PosteAcridienCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = CreatePosteAcridien(
        repository=PosteAcridienRepositoryImpl(db),
        zone_repository=ZoneAntiAcridienRepositoryImpl(db),
        equipe_terrestre_repository=EquipeRepositoryImpl(db),
    )
    try:
        return await use_case.execute(
            code=body.code,
            nom=body.nom,
            za_id=body.za_id,
            equipe_terrestre_id=body.equipe_terrestre_id,
        )
    except ZoneAntiAcridienIntrouvableError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Zone anti-acridienne inconnue",
        ) from exc
    except EquipeTerrestreIntrouvableError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Équipe terrestre inconnue",
        ) from exc
    except CodeReferentielDejaPrisError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Le code « {body.code} » est déjà utilisé par un autre poste acridien",
        ) from exc


# Suppression : soft-delete `deleted_at` (#674) — cf. `suppression_routes.py`. Le pull
# renvoie la ligne avec `deleted_at`, les mobiles la purgent. `PUT actif:false` reste la
# désactivation restaurable.
@router.put("/postes-acridiens/{pa_id}", response_model=PosteAcridienRead)
async def update_poste_acridien(
    pa_id: uuid.UUID,
    body: PosteAcridienUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = UpdatePosteAcridien(
        repository=PosteAcridienRepositoryImpl(db),
        zone_repository=ZoneAntiAcridienRepositoryImpl(db),
        equipe_terrestre_repository=EquipeRepositoryImpl(db),
    )
    try:
        poste = await use_case.execute(
            pa_id=pa_id,
            code=body.code,
            nom=body.nom,
            za_id=body.za_id,
            equipe_terrestre_id=body.equipe_terrestre_id,
            actif=body.actif,
            champs_fournis=body.model_fields_set,
        )
    except ZoneAntiAcridienIntrouvableError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Zone anti-acridienne inconnue",
        ) from exc
    except EquipeTerrestreIntrouvableError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Équipe terrestre inconnue",
        ) from exc
    except CodeReferentielDejaPrisError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Le code « {body.code} » est déjà utilisé par un autre poste acridien",
        ) from exc
    except PosteAcridienAvecStationsActivesError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"{exc.args[0]} station(s) active(s) sont rattachées à ce poste : "
                "désactivez-les d'abord, la désactivation ne se propage pas."
            ),
        ) from exc
    if poste is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Poste acridien non trouvé"
        )
    return poste


@router.get("/communes", response_model=list[CommuneRead])
async def list_communes(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = ListCommunes(CommuneRepositoryImpl(db))
    return await use_case.execute()


@router.get("/stations", response_model=list[StationFixeRead])
async def list_stations(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
    pa_id: uuid.UUID | None = Query(default=None),
    q: str | None = Query(default=None),
    actif: bool = Query(default=True),
    inclure_inactifs: bool = Query(
        default=False,
        description="Renvoie les stations des deux états — écran d'administration.",
    ),
):
    repository = StationFixeRepositoryImpl(db)
    use_case = ListStations(repository)
    return await use_case.execute(pa_id=pa_id, q=q, actif=None if inclure_inactifs else actif)


@router.get("/stations/{station_id}", response_model=StationFixeRead)
async def get_station(
    station_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    repository = StationFixeRepositoryImpl(db)
    use_case = GetStation(repository)
    station = await use_case.execute(station_id)
    if station is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Station non trouvée")
    return station


def _conflit_ecriture_station(exc: Exception, code: str | None) -> HTTPException:
    """Les quatre refus d'écriture d'une station, en 409 avec le motif en clair."""
    if isinstance(exc, PosteAcridienIntrouvableError):
        detail = "Poste acridien inconnu"
    elif isinstance(exc, PosteAcridienInactifError):
        detail = (
            f"Le poste acridien « {exc.args[0]} » est désactivé : "
            "aucun nouveau rattachement possible"
        )
    elif isinstance(exc, CommuneInconnueError):
        detail = "Commune inconnue"
    else:
        detail = f"Le code « {code} » est déjà utilisé par une autre station"
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)


ERREURS_ECRITURE_STATION = (
    PosteAcridienIntrouvableError,
    PosteAcridienInactifError,
    CommuneInconnueError,
    CodeReferentielDejaPrisError,
)


@router.post("/stations", response_model=StationFixeRead, status_code=201)
async def create_station(
    body: StationFixeCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = CreateStation(
        repository=StationFixeRepositoryImpl(db),
        poste_repository=PosteAcridienRepositoryImpl(db),
        commune_repository=CommuneRepositoryImpl(db),
    )
    try:
        return await use_case.execute(
            code=body.code,
            nom=body.nom,
            pa_id=body.pa_id,
            latitude=body.latitude,
            longitude=body.longitude,
            altitude=body.altitude,
            commune_id=body.commune_id,
        )
    except ERREURS_ECRITURE_STATION as exc:
        raise _conflit_ecriture_station(exc, body.code) from exc


# Aucune route DELETE, volontairement : `GET /referentiel/pull` ne transporte que des
# upserts, une suppression physique resterait sur les téléphones déjà synchronisés —
# et une station est référencée par des prospections. La désactivation logique passe
# par `PUT` avec `actif: false` (issue #133).
@router.put("/stations/{station_id}", response_model=StationFixeRead)
async def update_station(
    station_id: uuid.UUID,
    body: StationFixeUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = UpdateStation(
        repository=StationFixeRepositoryImpl(db),
        poste_repository=PosteAcridienRepositoryImpl(db),
        commune_repository=CommuneRepositoryImpl(db),
    )
    try:
        station = await use_case.execute(
            station_id=station_id,
            code=body.code,
            nom=body.nom,
            pa_id=body.pa_id,
            latitude=body.latitude,
            longitude=body.longitude,
            altitude=body.altitude,
            commune_id=body.commune_id,
            actif=body.actif,
            # `altitude` est nullable : seul le corps reçu distingue « absent » de
            # « mis à NULL ».
            champs_fournis=body.model_fields_set,
        )
    except ERREURS_ECRITURE_STATION as exc:
        raise _conflit_ecriture_station(exc, body.code) from exc
    if station is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Station non trouvée")
    return station


# --- code_stade -------------------------------------------------------------------
#
# Aucune route DELETE, volontairement : `GET /referentiel/pull` ne transporte que des
# upserts, une suppression physique resterait indéfiniment sur les téléphones déjà
# synchronisés. La sortie de service passe par `actif=false` (issue #131).


def _conflit_code_stade(error: Exception) -> HTTPException:
    """Les deux invariants de `code_stade` refusés en 409, avec le motif en clair."""
    if isinstance(error, StadeInconnuError):
        detail = f"Stade inconnu du vocabulaire : {error.args[0]}"
    else:
        detail = (
            f"Une place de grille existe déjà pour {error.args[0]} (code, catégorie, sexe, espèce)"
        )
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)


@router.get("/codes-stades", response_model=list[CodeStadeRead])
async def list_codes_stades(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
    actif: bool = Query(default=True),
    inclure_inactifs: bool = Query(
        default=False,
        description="Renvoie les codes stades des deux états — écran d'administration.",
    ),
):
    use_case = ListCodesStades(CodeStadeRepositoryImpl(db))
    return await use_case.execute(actif=None if inclure_inactifs else actif)


@router.post("/codes-stades", response_model=CodeStadeRead, status_code=201)
async def create_code_stade(
    body: CodeStadeCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = CreateCodeStade(CodeStadeRepositoryImpl(db))
    try:
        return await use_case.execute(
            code=body.code,
            categorie=body.categorie,
            sexe=body.sexe,
            espece=body.espece,
            libelle=body.libelle,
            ordre=body.ordre,
        )
    except (StadeInconnuError, GrilleDejaOccupeeError) as error:
        raise _conflit_code_stade(error) from error


@router.get("/codes-stades/{code_stade_id}", response_model=CodeStadeRead)
async def get_code_stade(
    code_stade_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = GetCodeStade(CodeStadeRepositoryImpl(db))
    code_stade = await use_case.execute(code_stade_id)
    if code_stade is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Code stade non trouvé")
    return code_stade


@router.put("/codes-stades/{code_stade_id}", response_model=CodeStadeRead)
async def update_code_stade(
    code_stade_id: uuid.UUID,
    body: CodeStadeUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = UpdateCodeStade(CodeStadeRepositoryImpl(db))
    try:
        code_stade = await use_case.execute(
            code_stade_id=code_stade_id,
            code=body.code,
            categorie=body.categorie,
            sexe=body.sexe,
            espece=body.espece,
            libelle=body.libelle,
            ordre=body.ordre,
            actif=body.actif,
            # `sexe`/`espece` sont nullables : seul le corps reçu distingue « absent »
            # de « mis à NULL ».
            champs_fournis=body.model_fields_set,
        )
    except (StadeInconnuError, GrilleDejaOccupeeError) as error:
        raise _conflit_code_stade(error) from error

    if code_stade is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Code stade non trouvé")
    return code_stade


# --- culture ----------------------------------------------------------------------
#
# Aucune route DELETE, volontairement : `GET /referentiel/pull` ne transporte que des
# upserts, une suppression physique resterait indéfiniment sur les téléphones déjà
# synchronisés. La sortie de service passe par `actif=false` (issue #130).


@router.get("/cultures", response_model=list[CultureRead])
async def list_cultures(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
    actif: bool = Query(default=True),
    inclure_inactifs: bool = Query(
        default=False,
        description="Renvoie les cultures des deux états — écran d'administration.",
    ),
):
    use_case = ListCultures(CultureRepositoryImpl(db))
    return await use_case.execute(actif=None if inclure_inactifs else actif)


@router.post("/cultures", response_model=CultureRead, status_code=201)
async def create_culture(
    body: CultureCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = CreateCulture(CultureRepositoryImpl(db))
    try:
        return await use_case.execute(code=body.code, nom=body.nom)
    except CodeReferentielDejaPrisError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Le code « {body.code} » est déjà utilisé par une autre culture",
        ) from exc


@router.get("/cultures/{culture_id}", response_model=CultureRead)
async def get_culture(
    culture_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = GetCulture(CultureRepositoryImpl(db))
    culture = await use_case.execute(culture_id)
    if culture is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Culture non trouvée")
    return culture


@router.put("/cultures/{culture_id}", response_model=CultureRead)
async def update_culture(
    culture_id: uuid.UUID,
    body: CultureUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = UpdateCulture(CultureRepositoryImpl(db))
    try:
        culture = await use_case.execute(
            culture_id=culture_id, code=body.code, nom=body.nom, actif=body.actif
        )
    except CodeReferentielDejaPrisError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Le code « {body.code} » est déjà utilisé par une autre culture",
        ) from exc

    if culture is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Culture non trouvée")
    return culture


# --- lieu_aerien -------------------------------------------------------------------
#
# Aucune route DELETE, volontairement : `GET /referentiel/pull` ne transporte que des
# upserts, une suppression physique resterait indéfiniment sur les téléphones déjà
# synchronisés. La sortie de service passe par `actif=false`.


@router.get("/lieux-aeriens", response_model=list[LieuAerienRead])
async def list_lieux_aeriens(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
    type_lieu: str | None = Query(default=None),
    inclure_inactifs: bool = Query(
        default=False,
        description="Renvoie les lieux des deux états — écran d'administration.",
    ),
):
    use_case = ListLieuxAeriens(LieuAerienRepositoryImpl(db))
    return await use_case.execute(type_lieu=type_lieu, actif=None if inclure_inactifs else True)


@router.post("/lieux-aeriens", response_model=LieuAerienRead, status_code=201)
async def create_lieu_aerien(
    body: LieuAerienCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    acteur: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = CreateLieuAerien(LieuAerienRepositoryImpl(db), EquipeRepositoryImpl(db))
    try:
        return await use_case.execute(
            acteur=acteur,
            type_lieu=body.type_lieu,
            nom=body.nom,
            latitude=body.latitude,
            longitude=body.longitude,
            altitude=body.altitude,
            equipe_aerienne_id=body.equipe_aerienne_id,
        )
    except TypeLieuAerienInvalideError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"type_lieu invalide : {exc.args[0]}",
        ) from exc
    except EquipeNonAutoriseeError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except EquipeAerienneIntrouvableError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Équipe aérienne inconnue",
        ) from exc


@router.get("/lieux-aeriens/{lieu_id}", response_model=LieuAerienRead)
async def get_lieu_aerien(
    lieu_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = GetLieuAerien(LieuAerienRepositoryImpl(db))
    lieu = await use_case.execute(lieu_id)
    if lieu is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lieu aérien non trouvé")
    return lieu


@router.put("/lieux-aeriens/{lieu_id}", response_model=LieuAerienRead)
async def update_lieu_aerien(
    lieu_id: uuid.UUID,
    body: LieuAerienUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    acteur: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = UpdateLieuAerien(LieuAerienRepositoryImpl(db), EquipeRepositoryImpl(db))
    try:
        lieu = await use_case.execute(
            acteur=acteur,
            lieu_id=lieu_id,
            type_lieu=body.type_lieu,
            nom=body.nom,
            latitude=body.latitude,
            longitude=body.longitude,
            altitude=body.altitude,
            equipe_aerienne_id=body.equipe_aerienne_id,
            actif=body.actif,
            # `altitude`/`equipe_aerienne_id` sont nullables : seul le corps reçu
            # distingue « absent » de « mis à NULL ».
            champs_fournis=body.model_fields_set,
        )
    except TypeLieuAerienInvalideError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"type_lieu invalide : {exc.args[0]}",
        ) from exc
    except EquipeNonAutoriseeError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except EquipeAerienneIntrouvableError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Équipe aérienne inconnue",
        ) from exc
    if lieu is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lieu aérien non trouvé")
    return lieu


# --- equipe_aerienne / site_aerienne (gestion d'équipe) ----------------------------
#
# --- equipe (référentiel unifié, ADR-018 / migration 0086) -------------------------
#
# Une seule table `equipe`, typée `terrestre` | `aerien`, et des membres génériques
# porteurs de leur `fonction` — à la place des deux tables asymétriques
# `equipe_terrestre` / `equipe_aerienne` et de leurs rôles nommés en dur. Aucune route
# DELETE, volontairement : la sortie de service passe par `actif=false`.


def _conflit_membre(exc: Exception) -> HTTPException:
    """Traduit les violations d'unicité de `equipe_membre` en 409 explicites."""
    if isinstance(exc, EquipeADejaUnChefError):
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="cette équipe a déjà un chef"
        )
    if isinstance(exc, ChefDejaDansUneAutreEquipeError):
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="cet utilisateur dirige déjà une autre équipe",
        )
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT, detail="cet utilisateur est déjà membre de l'équipe"
    )


def _erreur_membre_invalide(exc: Exception) -> HTTPException:
    if isinstance(exc, ChefEquipeInvalideError):
        return HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"le chef désigné n'a pas le rôle attendu pour ce type d'équipe : {exc.args[0]}",
        )
    if isinstance(exc, UtilisateurMembreIntrouvableError):
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"utilisateur inconnu : {exc.args[0]}"
        )
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"création de compte à la volée impossible : {exc.args[0]}",
    )


def _erreur_affectation(exc: Exception) -> HTTPException:
    """422 pour toutes : ce ne sont pas des collisions de clé mais des périodes qui ne
    tiennent pas ensemble — le corps est recevable, le calendrier ne l'est pas (#603)."""
    if isinstance(exc, AeronefDejaAffecteError):
        detail = f"aéronef déjà affecté sur une période qui se chevauche : {exc.args[0]}"
    elif isinstance(exc, EquipeDejaEquipeeError):
        detail = f"l'équipe a déjà un aéronef sur cette période : {exc.args[0]}"
    elif isinstance(exc, EquipeNonAerienneError):
        detail = f"un aéronef ne s'affecte qu'à une équipe aérienne : {exc.args[0]}"
    else:
        detail = f"période d'affectation invalide : {exc.args[0]}"
    return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)


def _demande(membre: MembreEquipeCreate) -> MembreDemande:
    return MembreDemande(
        fonction=membre.fonction, user_id=membre.user_id, nom=membre.nom, prenom=membre.prenom
    )


@router.get("/equipes", response_model=list[EquipeRead])
async def list_equipes(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
    type: Annotated[
        Literal["terrestre", "aerien"] | None,
        Query(description="Filtre sur le type d'équipe ; toutes si absent."),
    ] = None,
    inclure_inactifs: bool = Query(
        default=False,
        description="Renvoie les équipes des deux états — écran d'administration.",
    ),
):
    use_case = ListEquipes(EquipeRepositoryImpl(db))
    return await use_case.execute(actif=None if inclure_inactifs else True, type_equipe=type)


@router.post("/equipes", response_model=EquipeRead, status_code=201)
async def create_equipe(
    body: EquipeCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = CreateEquipe(
        EquipeRepositoryImpl(db),
        UtilisateurRepositoryImpl(db),
        AeronefRepositoryImpl(db),
        EquipeAeronefRepositoryImpl(db),
    )
    try:
        return await use_case.execute(
            nom=body.nom,
            type_equipe=body.type,
            membres=[_demande(m) for m in body.membres],
            aeronef=(
                None
                if body.aeronef is None
                else Aeronef(
                    immatriculation=body.aeronef.immatriculation,
                    societe=body.aeronef.societe,
                    volume_cuve_l=body.aeronef.volume_cuve_l,
                )
            ),
            aeronef_id=body.aeronef_id,
        )
    except (
        ChefEquipeInvalideError,
        UtilisateurMembreIntrouvableError,
        CompteALaVoleeInterditError,
    ) as exc:
        raise _erreur_membre_invalide(exc) from exc
    except (
        EquipeADejaUnChefError,
        ChefDejaDansUneAutreEquipeError,
        MembreDejaDansEquipeError,
    ) as exc:
        raise _conflit_membre(exc) from exc
    except AeronefIntrouvableError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"aéronef inconnu : {exc.args[0]}"
        ) from exc
    except ImmatriculationAeronefDejaPriseError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"immatriculation déjà utilisée par un autre aéronef : {exc.args[0]}",
        ) from exc
    except (AeronefDejaAffecteError, EquipeDejaEquipeeError) as exc:
        # 409 et non le 422 de `POST /equipes/{id}/aeronefs` : ici l'appelant ne choisit
        # pas de période — il n'a donc rien à corriger dans son calendrier, c'est bien
        # une collision avec l'état du parc (#621).
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"aéronef déjà affecté à une autre équipe : {exc.args[0]}",
        ) from exc


@router.get("/equipes/{equipe_id}", response_model=EquipeRead)
async def get_equipe(
    equipe_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    equipe = await GetEquipe(EquipeRepositoryImpl(db)).execute(equipe_id)
    if equipe is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Équipe non trouvée")
    return equipe


@router.put("/equipes/{equipe_id}", response_model=EquipeRead)
async def update_equipe(
    equipe_id: uuid.UUID,
    body: EquipeUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    try:
        return await UpdateEquipe(EquipeRepositoryImpl(db)).execute(
            equipe_id=equipe_id, nom=body.nom, actif=body.actif
        )
    except EquipeIntrouvableError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Équipe non trouvée"
        ) from exc


@router.post("/equipes/{equipe_id}/membres", response_model=MembreEquipeRead, status_code=201)
async def ajouter_membre_equipe(
    equipe_id: uuid.UUID,
    body: MembreEquipeCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = AjouterMembreEquipe(EquipeRepositoryImpl(db), UtilisateurRepositoryImpl(db))
    try:
        return await use_case.execute(equipe_id, _demande(body))
    except EquipeIntrouvableError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Équipe non trouvée"
        ) from exc
    except (
        ChefEquipeInvalideError,
        UtilisateurMembreIntrouvableError,
        CompteALaVoleeInterditError,
    ) as exc:
        raise _erreur_membre_invalide(exc) from exc
    except (
        EquipeADejaUnChefError,
        ChefDejaDansUneAutreEquipeError,
        MembreDejaDansEquipeError,
    ) as exc:
        raise _conflit_membre(exc) from exc


# --- affectations d'aéronefs (equipe_aeronef, migration 0087, #603) ---------------
#
# Une équipe aérienne dispose de 2 à 3 appareils utilisés l'un après l'autre. Affecter
# ouvre une période, retirer la borne ; la ligne reste, c'est l'historique. Pas de
# DELETE : une affectation effacée ne se distinguerait plus d'une qui n'a jamais eu
# lieu.


@router.get("/equipes/{equipe_id}/aeronefs", response_model=list[AffectationAeronefRead])
async def list_affectations_aeronef(
    equipe_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = ListerAffectationsAeronef(EquipeRepositoryImpl(db), EquipeAeronefRepositoryImpl(db))
    try:
        return await use_case.execute(equipe_id)
    except EquipeIntrouvableError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Équipe non trouvée"
        ) from exc


@router.post(
    "/equipes/{equipe_id}/aeronefs", response_model=AffectationAeronefRead, status_code=201
)
async def affecter_aeronef(
    equipe_id: uuid.UUID,
    body: AffectationAeronefCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = AffecterAeronef(
        EquipeRepositoryImpl(db), AeronefRepositoryImpl(db), EquipeAeronefRepositoryImpl(db)
    )
    try:
        return await use_case.execute(
            equipe_id=equipe_id,
            aeronef_id=body.aeronef_id,
            date_debut=body.date_debut,
            date_fin=body.date_fin,
        )
    except EquipeIntrouvableError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Équipe non trouvée"
        ) from exc
    except AeronefIntrouvableError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"aéronef inconnu : {exc.args[0]}"
        ) from exc
    except (
        EquipeNonAerienneError,
        AeronefDejaAffecteError,
        EquipeDejaEquipeeError,
        PeriodeAffectationInvalideError,
    ) as exc:
        raise _erreur_affectation(exc) from exc


@router.put("/equipes/{equipe_id}/aeronefs/{affectation_id}", response_model=AffectationAeronefRead)
async def cloturer_affectation_aeronef(
    equipe_id: uuid.UUID,
    affectation_id: uuid.UUID,
    body: AffectationAeronefCloture,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = CloturerAffectationAeronef(EquipeAeronefRepositoryImpl(db))
    try:
        return await use_case.execute(
            equipe_id=equipe_id, affectation_id=affectation_id, date_fin=body.date_fin
        )
    except AffectationAeronefIntrouvableError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Affectation non trouvée"
        ) from exc
    except AffectationDejaCloturee as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"affectation déjà clôturée : {exc.args[0]}",
        ) from exc
    except (
        AeronefDejaAffecteError,
        EquipeDejaEquipeeError,
        PeriodeAffectationInvalideError,
    ) as exc:
        raise _erreur_affectation(exc) from exc


# --- aeronef (parc d'hélicoptères, migration 0078 ; référentiel autonome #621) -----
#
# Référentiel à part entière : un appareil s'enregistre sans équipe, arrive sur la
# campagne avant sa première affectation et reste au parc entre deux (#603). Il reste
# créable dans la foulée d'une équipe (POST /equipes, champ `aeronef`) pour les
# formulaires existants. Pas de DELETE : la sortie de service est `actif=false`.
#
# Écriture réservée aux admins : le parc est une donnée d'administration.


@router.post("/aeronefs", response_model=AeronefRead, status_code=201)
async def create_aeronef(
    body: AeronefCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(require_admin)],
):
    try:
        return await CreateAeronef(AeronefRepositoryImpl(db)).execute(
            immatriculation=body.immatriculation,
            societe=body.societe,
            volume_cuve_l=body.volume_cuve_l,
        )
    except ImmatriculationAeronefDejaPriseError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"immatriculation déjà utilisée par un autre aéronef : {exc.args[0]}",
        ) from exc


@router.get("/aeronefs/{aeronef_id}", response_model=AeronefRead)
async def get_aeronef(
    aeronef_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    aeronef = await GetAeronef(AeronefRepositoryImpl(db)).execute(aeronef_id)
    if aeronef is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aéronef non trouvé")
    return aeronef


@router.get("/aeronefs/{aeronef_id}/affectations", response_model=list[AffectationAeronefRead])
async def list_affectations_par_aeronef(
    aeronef_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    """Historique d'un appareil : les équipes qui l'ont utilisé (#621), en regard de
    `GET /equipes/{id}/aeronefs` qui donne l'historique côté équipe."""
    use_case = ListerAffectationsParAeronef(
        AeronefRepositoryImpl(db), EquipeAeronefRepositoryImpl(db)
    )
    try:
        return await use_case.execute(aeronef_id)
    except AeronefIntrouvableError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Aéronef non trouvé"
        ) from exc


@router.get("/aeronefs", response_model=list[AeronefRead])
async def list_aeronefs(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
    inclure_inactifs: bool = Query(
        default=False,
        description="Renvoie les aéronefs des deux états — écran d'administration.",
    ),
):
    use_case = ListAeronefs(AeronefRepositoryImpl(db))
    return await use_case.execute(actif=None if inclure_inactifs else True)


@router.put("/aeronefs/{aeronef_id}", response_model=AeronefRead)
async def update_aeronef(
    aeronef_id: uuid.UUID,
    body: AeronefUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(require_admin)],
):
    # Le parc d'hélicoptères est une donnée d'administration : réservé aux admins.
    use_case = UpdateAeronef(AeronefRepositoryImpl(db))
    try:
        return await use_case.execute(
            aeronef_id=aeronef_id,
            immatriculation=body.immatriculation,
            societe=body.societe,
            volume_cuve_l=body.volume_cuve_l,
            actif=body.actif,
        )
    except AeronefIntrouvableError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Aéronef non trouvé"
        ) from exc
    except ImmatriculationAeronefDejaPriseError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"immatriculation déjà utilisée par un autre aéronef : {exc.args[0]}",
        ) from exc


@router.get("/sites-aeriens", response_model=list[SiteAerienneRead])
async def list_sites_aeriens(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
    inclure_inactifs: bool = Query(
        default=False,
        description="Renvoie les sites des deux états — écran d'administration.",
    ),
):
    use_case = ListSitesAeriens(SiteAerienneRepositoryImpl(db))
    return await use_case.execute(actif=None if inclure_inactifs else True)


def _parent_absent_http(exc: SiteAerienneParentAbsentError) -> HTTPException:
    """409 rejouable : le mobile hors-ligne peut envoyer un dépendant avant son principal (#655).
    Le mobile le reconnaît au préfixe « parent_site_id inconnu » — `traduireErreurCreation`,
    mobile/src/lib/site-aerien-sync.ts. Le changer là-bas aussi."""
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=f"parent_site_id inconnu du serveur, à rejouer après son principal : {exc.args[0]}",
    )


@router.post("/sites-aeriens", response_model=SiteAerienneRead, status_code=201)
async def create_site_aerienne(
    body: SiteAerienneCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    acteur: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = CreateSiteAerienne(
        SiteAerienneRepositoryImpl(db),
        EquipeRepositoryImpl(db),
        SiteAeriennePositionRepositoryImpl(db),
    )
    position = body.position
    try:
        return await use_case.execute(
            acteur=acteur,
            numero=body.numero,
            localite=body.localite,
            parent_site_id=body.parent_site_id,
            equipe_id=body.equipe_id,
            client_id=body.id,
            position=(
                (position.latitude, position.longitude, position.altitude)
                if position is not None
                else None
            ),
        )
    except IdentifiantDejaUtiliseError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"l'identifiant {exc.args[0]} est déjà utilisé par un site différent",
        ) from exc
    except SiteAerienneParentAbsentError as exc:
        raise _parent_absent_http(exc) from exc
    except EquipeNonAutoriseeError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except SiteAerienneParentInvalideError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"parent_site_id invalide : {exc.args[0]}",
        ) from exc
    except SiteAerienneEquipeInvalideError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    except EquipeAerienneIntrouvableError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"equipe_id introuvable : {exc.args[0]}"
        ) from exc
    except EquipeAerienneDejaAssigneeError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"equipe_id possède déjà un site principal : {exc.args[0]}",
        ) from exc
    except NumeroSiteAerienneDejaPrisError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"numero déjà pris : {exc.args[0]}",
        ) from exc


@router.get("/sites-aeriens/{site_id}", response_model=SiteAerienneRead)
async def get_site_aerienne(
    site_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = GetSiteAerienne(SiteAerienneRepositoryImpl(db))
    site = await use_case.execute(site_id)
    if site is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site aérien non trouvé")
    return site


@router.put("/sites-aeriens/{site_id}", response_model=SiteAerienneRead)
async def update_site_aerienne(
    site_id: uuid.UUID,
    body: SiteAerienneUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    acteur: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = UpdateSiteAerienne(SiteAerienneRepositoryImpl(db), EquipeRepositoryImpl(db))
    try:
        site = await use_case.execute(
            acteur=acteur,
            site_id=site_id,
            numero=body.numero,
            localite=body.localite,
            parent_site_id=body.parent_site_id,
            equipe_id=body.equipe_id,
            actif=body.actif,
            # parent_site_id et equipe_id nullables : seul le corps reçu distingue
            # « absent » de « mis à NULL ».
            champs_fournis=body.model_fields_set,
        )
    except EquipeNonAutoriseeError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except SiteAerienneParentAbsentError as exc:
        raise _parent_absent_http(exc) from exc
    except SiteAerienneParentInvalideError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"parent_site_id invalide : {exc.args[0]}",
        ) from exc
    except SiteAerienneEquipeInvalideError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    except EquipeAerienneIntrouvableError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"equipe_id introuvable : {exc.args[0]}"
        ) from exc
    except EquipeAerienneDejaAssigneeError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"equipe_id possède déjà un site principal : {exc.args[0]}",
        ) from exc
    except NumeroSiteAerienneDejaPrisError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"numero déjà pris : {exc.args[0]}",
        ) from exc
    if site is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site aérien non trouvé")
    return site


def _position_read(position) -> SiteAeriennePositionRead:
    return SiteAeriennePositionRead(
        id=position.id,
        site_id=position.site_id,
        latitude=position.latitude,
        longitude=position.longitude,
        altitude=position.altitude,
        date_debut=position.date_debut,
        date_fin=position.date_fin,
        duree_jours=position.duree_jours(),
        created_at=position.created_at,
    )


@router.post(
    "/sites-aeriens/{site_id}/positions", response_model=SiteAeriennePositionRead, status_code=201
)
async def installer_position_site_aerienne(
    site_id: uuid.UUID,
    body: SiteAeriennePositionInstaller,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = InstallerPositionSiteAerienne(
        SiteAeriennePositionRepositoryImpl(db), SiteAerienneRepositoryImpl(db)
    )
    try:
        position = await use_case.execute(
            site_id=site_id,
            latitude=body.latitude,
            longitude=body.longitude,
            altitude=body.altitude,
        )
    except SiteAerienneIntrouvableError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Site aérien non trouvé : {exc.args[0]}"
        ) from exc
    except PositionDejaActiveError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"le site a déjà une position active, le démonter d'abord : {exc.args[0]}",
        ) from exc
    return _position_read(position)


@router.post("/sites-aeriens/{site_id}/deplacer", response_model=list[SiteAeriennePositionRead])
async def deplacer_site_aerienne(
    site_id: uuid.UUID,
    body: SiteAerienneDeplacer,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    """Déplace le site et ses `dependants` en une transaction (#655) : chaque position
    active est close à J-1 et remplacée. Atomique : tout est déplacé ou rien."""
    use_case = DeplacerSiteAerienne(
        SiteAeriennePositionRepositoryImpl(db), SiteAerienneRepositoryImpl(db)
    )
    try:
        positions = await use_case.execute(
            site_id=site_id,
            latitude=body.latitude,
            longitude=body.longitude,
            altitude=body.altitude,
            dependants=body.dependants,
        )
    except SiteAerienneIntrouvableError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Site aérien non trouvé : {exc.args[0]}"
        ) from exc
    except SiteAerienneDependantInvalideError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"dependants invalide (inconnu ou rattaché à un autre principal) : "
            f"{exc.args[0]}",
        ) from exc
    except PositionDejaActiveError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"conflit de position active, réessayer : {exc.args[0]}",
        ) from exc
    return [_position_read(p) for p in positions]


@router.post("/sites-aeriens/{site_id}/positions/demonter", response_model=SiteAeriennePositionRead)
async def demonter_position_site_aerienne(
    site_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = DemonterPositionSiteAerienne(
        SiteAeriennePositionRepositoryImpl(db), SiteAerienneRepositoryImpl(db)
    )
    try:
        position = await use_case.execute(site_id=site_id)
    except SiteAerienneIntrouvableError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Site aérien non trouvé : {exc.args[0]}"
        ) from exc
    except PositionActiveIntrouvableError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"aucune position active à démonter : {exc.args[0]}",
        ) from exc
    return _position_read(position)


@router.get("/sites-aeriens/{site_id}/positions", response_model=list[SiteAeriennePositionRead])
async def lister_positions_site_aerienne(
    site_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = ListerPositionsSiteAerienne(SiteAeriennePositionRepositoryImpl(db))
    positions = await use_case.execute(site_id)
    return [_position_read(p) for p in positions]


@router.get("/sites-aeriens/{site_id}/positions/active", response_model=SiteAeriennePositionRead)
async def get_position_active_site_aerienne(
    site_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = GetPositionActiveSiteAerienne(SiteAeriennePositionRepositoryImpl(db))
    position = await use_case.execute(site_id)
    if position is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Aucune position active pour ce site"
        )
    return _position_read(position)


# --- pesticide -------------------------------------------------------------------
#
# Aucune route DELETE, volontairement : `GET /referentiel/pull` ne transporte que des
# upserts, une suppression physique resterait indéfiniment sur les téléphones déjà
# synchronisés. La sortie de service passe par `actif=false` (issue #129).


@router.get("/pesticides", response_model=list[PesticideRead])
async def list_pesticides(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
    actif: bool = Query(default=True),
    inclure_inactifs: bool = Query(
        default=False,
        description="Renvoie les pesticides des deux états — écran d'administration.",
    ),
):
    use_case = ListPesticides(PesticideRepositoryImpl(db))
    return await use_case.execute(actif=None if inclure_inactifs else actif)


@router.post("/pesticides", response_model=PesticideRead, status_code=201)
async def create_pesticide(
    body: PesticideCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = CreatePesticide(PesticideRepositoryImpl(db))
    try:
        return await use_case.execute(
            code=body.code,
            nom=body.nom,
            matiere_active=body.matiere_active,
            dose_reference=body.dose_reference,
            type_produit=body.type_produit,
        )
    except CodeReferentielDejaPrisError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Le code « {body.code} » est déjà utilisé par un autre pesticide",
        ) from exc


@router.get("/pesticides/{pesticide_id}", response_model=PesticideRead)
async def get_pesticide(
    pesticide_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = GetPesticide(PesticideRepositoryImpl(db))
    pesticide = await use_case.execute(pesticide_id)
    if pesticide is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pesticide non trouvé")
    return pesticide


@router.put("/pesticides/{pesticide_id}", response_model=PesticideRead)
async def update_pesticide(
    pesticide_id: uuid.UUID,
    body: PesticideUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = UpdatePesticide(PesticideRepositoryImpl(db))
    try:
        pesticide = await use_case.execute(
            pesticide_id=pesticide_id,
            code=body.code,
            nom=body.nom,
            matiere_active=body.matiere_active,
            dose_reference=body.dose_reference,
            type_produit=body.type_produit,
            actif=body.actif,
        )
    except CodeReferentielDejaPrisError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Le code « {body.code} » est déjà utilisé par un autre pesticide",
        ) from exc

    if pesticide is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pesticide non trouvé")
    return pesticide


@router.post("/mouvements-pesticide", response_model=MouvementPesticideRead, status_code=201)
async def create_mouvement_pesticide(
    body: MouvementPesticideCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(require_chef_de_base_ou_admin)],
):
    use_case = CreateMouvementPesticide(
        MouvementPesticideRepositoryImpl(db),
        SiteAerienneRepositoryImpl(db),
        PesticideRepositoryImpl(db),
    )
    try:
        return await use_case.execute(
            type=body.type,
            pesticide_id=body.pesticide_id,
            site_id=body.site_id,
            quantite=body.quantite,
            unite=body.unite,
            site_destination_id=body.site_destination_id,
            date_mouvement=body.date_mouvement,
            client_id=body.id,
        )
    except IdentifiantDejaUtiliseError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"l'identifiant {exc.args[0]} est déjà utilisé par un mouvement différent",
        ) from exc
    except SiteDestinationIncoherentError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    except SiteNonPrincipalError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"le stock de pesticides est rattaché au site aérien principal : "
            f"{exc.args[0]} n'en est pas un",
        ) from exc
    except SiteAerienneIntrouvableError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"site introuvable : {exc.args[0]}"
        ) from exc
    except PesticideIntrouvableError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"pesticide_id introuvable : {exc.args[0]}",
        ) from exc


@router.get("/mouvements-pesticide", response_model=list[MouvementPesticideRead])
async def list_mouvements_pesticide(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
    type: Literal["approvisionnement", "transfert", "consommation"] | None = Query(default=None),
    site_id: uuid.UUID | None = Query(
        default=None,
        description="Mouvements qui touchent ce site : ceux qu'il porte et les transferts reçus.",
    ),
    pesticide_id: uuid.UUID | None = Query(default=None),
    traitement_id: uuid.UUID | None = Query(
        default=None, description="Consommations générées par cette fiche de traitement (#609)."
    ),
    date_debut: date | None = Query(default=None, description="Borne incluse."),
    date_fin: date | None = Query(default=None, description="Borne incluse."),
):
    """Journal des mouvements, du plus récent au plus ancien (#606, #609)."""
    use_case = ListerMouvementsPesticide(MouvementPesticideRepositoryImpl(db))
    return await use_case.execute(
        type=type,
        site_id=site_id,
        pesticide_id=pesticide_id,
        traitement_id=traitement_id,
        date_debut=date_debut,
        date_fin=date_fin,
    )


@router.get("/stock-pesticide/solde", response_model=list[SoldePesticideRead])
async def get_solde_pesticide(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
    site_id: uuid.UUID | None = Query(default=None),
    pesticide_id: uuid.UUID | None = Query(default=None),
):
    use_case = ConsulterSoldePesticide(MouvementPesticideRepositoryImpl(db))
    return await use_case.execute(site_id=site_id, pesticide_id=pesticide_id)


@router.post("/vols", response_model=VolRead, status_code=201)
async def create_vol(
    body: VolCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = CreateVol(
        VolRepositoryImpl(db),
        EquipeRepositoryImpl(db),
        AeronefRepositoryImpl(db),
        EquipeAeronefRepositoryImpl(db),
        SiteAerienneRepositoryImpl(db),
    )
    try:
        return await use_case.execute(
            type=body.type,
            equipe_id=body.equipe_id,
            aeronef_id=body.aeronef_id,
            date_vol=body.date_vol,
            heure_debut=body.heure_debut,
            heure_fin=body.heure_fin,
            site_principal_id=body.site_principal_id,
            stand_id=body.stand_id,
            base_secondaire_id=body.base_secondaire_id,
            motif=body.motif,
            lieu_depart=body.lieu_depart,
            lieu_arrivee=body.lieu_arrivee,
            observations=body.observations,
            client_id=body.id,
        )
    except IdentifiantDejaUtiliseError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"l'identifiant {exc.args[0]} est déjà utilisé par un vol différent",
        ) from exc
    except EquipeIntrouvableError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"équipe introuvable : {exc.args[0]}"
        ) from exc
    except EquipeNonAerienneError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"l'équipe {exc.args[0]} n'est pas une équipe aérienne",
        ) from exc
    except AeronefIntrouvableError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"aéronef introuvable : {exc.args[0]}",
        ) from exc
    except AeronefNonAffecteError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"l'aéronef {exc.args[0]} n'est pas affecté à cette équipe à la date du vol",
        ) from exc
    except VolSiteObligatoireError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    except VolMotifRequisError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    except VolLieuxConvoyageRequisError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    except SiteHorsBaseError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"le site {exc.args[0]} n'est pas rattaché au site principal du vol",
        ) from exc
    except SiteAerienneIntrouvableError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"site introuvable : {exc.args[0]}"
        ) from exc


@router.patch("/vols/{vol_id}", response_model=VolRead)
async def update_vol(
    vol_id: uuid.UUID,
    body: VolUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = UpdateVol(VolRepositoryImpl(db), TraitementRepositoryImpl(db))
    try:
        return await use_case.execute(vol_id=vol_id, traitement_id=body.traitement_id)
    except VolIntrouvableError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"vol introuvable : {exc.args[0]}"
        ) from exc
    except VolTypeNonApplicationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"le vol {exc.args[0]} n'est pas de type application, "
            "il ne peut pas porter de traitement",
        ) from exc
    except TraitementAerienIntrouvableError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"traitement aérien introuvable : {exc.args[0]}",
        ) from exc


@router.get("/vols/{vol_id}", response_model=VolRead)
async def get_vol(
    vol_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    vol = await GetVol(VolRepositoryImpl(db)).execute(vol_id)
    if vol is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vol non trouvé")
    return vol


@router.get("/vols", response_model=list[VolRead])
async def list_vols(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
    equipe_id: uuid.UUID | None = Query(default=None),
):
    return await ListVols(VolRepositoryImpl(db)).execute(equipe_id=equipe_id)


def _site_sync_read(site) -> SiteAerienneSyncRead:
    p = site.position_active
    return SiteAerienneSyncRead(
        id=site.id,
        parent_site_id=site.parent_site_id,
        equipe_id=site.equipe_id,
        numero=site.numero,
        localite=site.localite,
        actif=site.actif,
        latitude=p.latitude if p else None,
        longitude=p.longitude if p else None,
        altitude=p.altitude if p else None,
        date_debut_position=p.date_debut if p else None,
        updated_at=site.updated_at,
    )


@router.get("/referentiel/pull", response_model=ReferentielPullResponse)
async def pull_referentiel(
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Utilisateur, Depends(get_current_user)],
    since_zones_anti_acridiennes: datetime | None = Query(default=None),
    since_postes_acridiens: datetime | None = Query(default=None),
    since_stations_fixes: datetime | None = Query(default=None),
    since_utilisateurs_equipe: datetime | None = Query(default=None),
    since_pesticides: datetime | None = Query(default=None),
    since_cultures: datetime | None = Query(default=None),
    since_codes_stades: datetime | None = Query(default=None),
    since_campagnes: datetime | None = Query(default=None),
    since_lieux_aeriens: datetime | None = Query(default=None),
    since_sites_aeriens: datetime | None = Query(default=None),
    since_equipes: datetime | None = Query(default=None),
    since_equipe_membres: datetime | None = Query(default=None),
    since_aeronefs: datetime | None = Query(default=None),
    since_equipe_aeronefs: datetime | None = Query(default=None),
):
    use_case = PullReferentiel(
        zone_repository=ZoneAntiAcridienRepositoryImpl(db),
        poste_repository=PosteAcridienRepositoryImpl(db),
        station_repository=StationFixeRepositoryImpl(db),
        equipe_repository=UtilisateurEquipeRepositoryImpl(db),
        pesticide_repository=PesticideRepositoryImpl(db),
        culture_repository=CultureRepositoryImpl(db),
        code_stade_repository=CodeStadeRepositoryImpl(db),
        campagne_repository=CampagneRepositoryImpl(db),
        lieu_aerien_repository=LieuAerienRepositoryImpl(db),
        site_aerien_repository=SiteAerienneRepositoryImpl(db),
        equipe_unifiee_repository=EquipeRepositoryImpl(db),
        aeronef_repository=AeronefRepositoryImpl(db),
        affectation_aeronef_repository=EquipeAeronefRepositoryImpl(db),
    )
    cursors = ReferentielSinceCursors(
        zones_anti_acridiennes=since_zones_anti_acridiennes,
        postes_acridiens=since_postes_acridiens,
        stations_fixes=since_stations_fixes,
        utilisateurs_equipe=since_utilisateurs_equipe,
        pesticides=since_pesticides,
        cultures=since_cultures,
        codes_stades=since_codes_stades,
        campagnes=since_campagnes,
        lieux_aeriens=since_lieux_aeriens,
        sites_aeriens=since_sites_aeriens,
        equipes=since_equipes,
        equipe_membres=since_equipe_membres,
        aeronefs=since_aeronefs,
        equipe_aeronefs=since_equipe_aeronefs,
    )
    result = await use_case.execute(cursors=cursors)

    return ReferentielPullResponse(
        zones_anti_acridiennes=EntityPull(
            upserts=result.zones_anti_acridiennes, server_time=result.server_time
        ),
        postes_acridiens=EntityPull(
            upserts=result.postes_acridiens, server_time=result.server_time
        ),
        stations_fixes=EntityPull(upserts=result.stations_fixes, server_time=result.server_time),
        utilisateurs_equipe=EntityPull(
            upserts=result.utilisateurs_equipe, server_time=result.server_time
        ),
        pesticides=EntityPull(upserts=result.pesticides, server_time=result.server_time),
        cultures=EntityPull(upserts=result.cultures, server_time=result.server_time),
        codes_stades=EntityPull(upserts=result.codes_stades, server_time=result.server_time),
        campagnes=EntityPull(upserts=result.campagnes, server_time=result.server_time),
        lieux_aeriens=EntityPull(upserts=result.lieux_aeriens, server_time=result.server_time),
        sites_aeriens=EntityPull(
            upserts=[_site_sync_read(s) for s in result.sites_aeriens],
            server_time=result.server_time,
        ),
        equipes=EntityPull(upserts=result.equipes, server_time=result.server_time),
        equipe_membres=EntityPull(upserts=result.equipe_membres, server_time=result.server_time),
        aeronefs=EntityPull(upserts=result.aeronefs, server_time=result.server_time),
        equipe_aeronefs=EntityPull(upserts=result.equipe_aeronefs, server_time=result.server_time),
    )


ajouter_route_suppression(
    router,
    "/zones-anti-acridiennes/{item_id}",
    ZoneAntiAcridienModel,
    "Zone anti-acridienne",
    enfants=((PosteAcridienModel, "za_id", "postes acridiens"),),
)
ajouter_route_suppression(
    router,
    "/postes-acridiens/{item_id}",
    PosteAcridienModel,
    "Poste acridien",
    enfants=((StationFixeModel, "pa_id", "stations"),),
)
ajouter_route_suppression(router, "/stations/{item_id}", StationFixeModel, "Station")
ajouter_route_suppression(router, "/codes-stades/{item_id}", CodeStadeModel, "Code stade")
ajouter_route_suppression(router, "/cultures/{item_id}", CultureModel, "Culture")
ajouter_route_suppression(router, "/lieux-aeriens/{item_id}", LieuAerienModel, "Lieu aérien")
ajouter_route_suppression(router, "/equipes/{item_id}", EquipeModel, "Équipe")
ajouter_route_suppression(router, "/aeronefs/{item_id}", AeronefModel, "Aéronef")
ajouter_route_suppression(router, "/sites-aeriens/{item_id}", SiteAerienneModel, "Site aérien")
ajouter_route_suppression(router, "/pesticides/{item_id}", PesticideModel, "Pesticide")


@router.delete(
    "/equipes/{equipe_id}/aeronefs/{affectation_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def supprimer_affectation_aeronef(
    equipe_id: uuid.UUID,
    affectation_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(require_admin)],
) -> Response:
    ligne = await charger_ligne_vivante(db, EquipeAeronefModel, affectation_id, "Affectation")
    if ligne.equipe_id != equipe_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Affectation non trouvée")
    await marquer_supprime(db, ligne)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
