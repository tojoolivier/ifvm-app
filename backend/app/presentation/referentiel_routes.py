import uuid
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.referentiel_use_cases import (
    AffecterAeronef,
    AjouterMembreEquipe,
    CloturerAffectationAeronef,
    CreateAeronef,
    CreateBaseAerienne,
    CreateCodeStade,
    CreateCulture,
    CreateEquipe,
    CreateLieuAerien,
    CreatePesticide,
    CreatePosteAcridien,
    CreateStandRemplissage,
    CreateStation,
    CreateZoneAntiAcridien,
    GetAeronef,
    GetBaseAerienne,
    GetCodeStade,
    GetCulture,
    GetEquipe,
    GetLieuAerien,
    GetPesticide,
    GetPosteAcridien,
    GetStandRemplissage,
    GetStation,
    ListAeronefs,
    ListBasesAeriennes,
    ListCodesStades,
    ListCommunes,
    ListCultures,
    ListEquipes,
    ListerAffectationsAeronef,
    ListLieuxAeriens,
    ListPesticides,
    ListPostesAcridiens,
    ListStandsRemplissage,
    ListStations,
    ListZonesAntiAcridiennes,
    MembreDemande,
    PullReferentiel,
    ReferentielSinceCursors,
    UpdateAeronef,
    UpdateBaseAerienne,
    UpdateCodeStade,
    UpdateCulture,
    UpdateEquipe,
    UpdateLieuAerien,
    UpdatePesticide,
    UpdatePosteAcridien,
    UpdateStandRemplissage,
    UpdateStation,
    UpdateZoneAntiAcridien,
)
from app.auth import get_current_user
from app.database import get_db
from app.domain.referentiel import (
    Aeronef,
    AeronefDejaAffecteError,
    AeronefIntrouvableError,
    AffectationAeronefIntrouvableError,
    BaseAerienneEquipeInvalideError,
    BaseAerienneParentInvalideError,
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
    EquipeRequiseError,
    EquipeTerrestreIntrouvableError,
    GrilleDejaOccupeeError,
    ImmatriculationAeronefDejaPriseError,
    MembreDejaDansEquipeError,
    NumeroBaseAerienneDejaPrisError,
    NumeroStandRemplissageDejaPrisError,
    PeriodeAffectationInvalideError,
    PosteAcridienAvecStationsActivesError,
    PosteAcridienInactifError,
    PosteAcridienIntrouvableError,
    StadeInconnuError,
    TypeLieuAerienInvalideError,
    UtilisateurMembreIntrouvableError,
    ZoneAntiAcridienAvecPostesActifsError,
    ZoneAntiAcridienIntrouvableError,
)
from app.infrastructure.campagne_repository import CampagneRepositoryImpl
from app.infrastructure.referentiel_repository import (
    CommuneRepositoryImpl,
    PosteAcridienRepositoryImpl,
    StationFixeRepositoryImpl,
    ZoneAntiAcridienRepositoryImpl,
)
from app.infrastructure.referentiel_sync_repository import (
    AeronefRepositoryImpl,
    BaseAerienneRepositoryImpl,
    CodeStadeRepositoryImpl,
    CultureRepositoryImpl,
    EquipeAeronefRepositoryImpl,
    EquipeRepositoryImpl,
    LieuAerienRepositoryImpl,
    PesticideRepositoryImpl,
    StandRemplissageRepositoryImpl,
    UtilisateurEquipeRepositoryImpl,
)
from app.infrastructure.utilisateur_repository import UtilisateurRepositoryImpl
from app.models.users import Utilisateur
from app.presentation.referentiel_schemas import (
    AeronefCreate,
    AeronefRead,
    AeronefUpdate,
    AffectationAeronefCloture,
    AffectationAeronefCreate,
    AffectationAeronefRead,
    BaseAerienneCreate,
    BaseAerienneRead,
    BaseAerienneUpdate,
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
    PesticideCreate,
    PesticideRead,
    PesticideUpdate,
    PosteAcridienCreate,
    PosteAcridienRead,
    PosteAcridienUpdate,
    ReferentielPullResponse,
    StandRemplissageCreate,
    StandRemplissageRead,
    StandRemplissageUpdate,
    StationFixeCreate,
    StationFixeRead,
    StationFixeUpdate,
    ZoneAntiAcridienCreate,
    ZoneAntiAcridienRead,
    ZoneAntiAcridienUpdate,
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


# Aucune route DELETE, volontairement : `GET /referentiel/pull` ne transporte que des
# upserts, une suppression physique resterait sur les téléphones déjà synchronisés.
# La désactivation logique passe par `PUT` avec `actif: false`.
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


# --- equipe_aerienne / base_aerienne / stand_remplissage (gestion d'équipe) ---------
#
# --- equipe (référentiel unifié, ADR-018 / migration 0082) -------------------------
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
        EquipeRepositoryImpl(db), UtilisateurRepositoryImpl(db), AeronefRepositoryImpl(db)
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
    except AeronefDejaAffecteError as exc:
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


# --- affectations d'aéronefs (equipe_aeronef, migration 0083, #603) ---------------
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
    acteur: Annotated[Utilisateur, Depends(get_current_user)],
):
    if acteur.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Réservé aux administrateurs"
        )
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
    acteur: Annotated[Utilisateur, Depends(get_current_user)],
):
    # Le parc d'hélicoptères est une donnée d'administration : réservé aux admins.
    if acteur.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Réservé aux administrateurs"
        )
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


@router.get("/bases-aeriennes", response_model=list[BaseAerienneRead])
async def list_bases_aeriennes(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
    inclure_inactifs: bool = Query(
        default=False,
        description="Renvoie les bases des deux états — écran d'administration.",
    ),
):
    use_case = ListBasesAeriennes(BaseAerienneRepositoryImpl(db))
    return await use_case.execute(actif=None if inclure_inactifs else True)


@router.post("/bases-aeriennes", response_model=BaseAerienneRead, status_code=201)
async def create_base_aerienne(
    body: BaseAerienneCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    acteur: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = CreateBaseAerienne(BaseAerienneRepositoryImpl(db), EquipeRepositoryImpl(db))
    try:
        return await use_case.execute(
            acteur=acteur,
            numero=body.numero,
            localite=body.localite,
            parent_base_id=body.parent_base_id,
            equipe_id=body.equipe_id,
            longitude=body.longitude,
            latitude=body.latitude,
            altitude=body.altitude,
        )
    except EquipeNonAutoriseeError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except BaseAerienneParentInvalideError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"parent_base_id invalide : {exc.args[0]}",
        ) from exc
    except BaseAerienneEquipeInvalideError as exc:
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
            detail=f"equipe_id possède déjà une base principale : {exc.args[0]}",
        ) from exc
    except NumeroBaseAerienneDejaPrisError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"numero déjà pris : {exc.args[0]}",
        ) from exc


@router.get("/bases-aeriennes/{base_id}", response_model=BaseAerienneRead)
async def get_base_aerienne(
    base_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = GetBaseAerienne(BaseAerienneRepositoryImpl(db))
    base = await use_case.execute(base_id)
    if base is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Base aérienne non trouvée"
        )
    return base


@router.put("/bases-aeriennes/{base_id}", response_model=BaseAerienneRead)
async def update_base_aerienne(
    base_id: uuid.UUID,
    body: BaseAerienneUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    acteur: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = UpdateBaseAerienne(BaseAerienneRepositoryImpl(db), EquipeRepositoryImpl(db))
    try:
        base = await use_case.execute(
            acteur=acteur,
            base_id=base_id,
            numero=body.numero,
            localite=body.localite,
            parent_base_id=body.parent_base_id,
            equipe_id=body.equipe_id,
            longitude=body.longitude,
            latitude=body.latitude,
            altitude=body.altitude,
            actif=body.actif,
            # Coordonnées, parent_base_id et equipe_id nullables : seul le corps reçu
            # distingue « absent » de « mis à NULL ».
            champs_fournis=body.model_fields_set,
        )
    except EquipeNonAutoriseeError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except BaseAerienneParentInvalideError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"parent_base_id invalide : {exc.args[0]}",
        ) from exc
    except BaseAerienneEquipeInvalideError as exc:
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
            detail=f"equipe_id possède déjà une base principale : {exc.args[0]}",
        ) from exc
    except NumeroBaseAerienneDejaPrisError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"numero déjà pris : {exc.args[0]}",
        ) from exc
    if base is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Base aérienne non trouvée"
        )
    return base


@router.get("/stands-remplissage", response_model=list[StandRemplissageRead])
async def list_stands_remplissage(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
    inclure_inactifs: bool = Query(
        default=False,
        description="Renvoie les stands des deux états — écran d'administration.",
    ),
):
    use_case = ListStandsRemplissage(StandRemplissageRepositoryImpl(db))
    return await use_case.execute(actif=None if inclure_inactifs else True)


@router.post("/stands-remplissage", response_model=StandRemplissageRead, status_code=201)
async def create_stand_remplissage(
    body: StandRemplissageCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    acteur: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = CreateStandRemplissage(StandRemplissageRepositoryImpl(db), EquipeRepositoryImpl(db))
    try:
        return await use_case.execute(
            acteur=acteur,
            numero=body.numero,
            localite=body.localite,
            equipe_aerienne_id=body.equipe_aerienne_id,
            longitude=body.longitude,
            latitude=body.latitude,
            altitude=body.altitude,
        )
    except EquipeNonAutoriseeError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except EquipeRequiseError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    except EquipeAerienneIntrouvableError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"equipe_aerienne_id introuvable : {exc.args[0]}",
        ) from exc
    except NumeroStandRemplissageDejaPrisError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"numero déjà pris : {exc.args[0]}",
        ) from exc


@router.get("/stands-remplissage/{stand_id}", response_model=StandRemplissageRead)
async def get_stand_remplissage(
    stand_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = GetStandRemplissage(StandRemplissageRepositoryImpl(db))
    stand = await use_case.execute(stand_id)
    if stand is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stand non trouvé")
    return stand


@router.put("/stands-remplissage/{stand_id}", response_model=StandRemplissageRead)
async def update_stand_remplissage(
    stand_id: uuid.UUID,
    body: StandRemplissageUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    acteur: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = UpdateStandRemplissage(StandRemplissageRepositoryImpl(db), EquipeRepositoryImpl(db))
    try:
        stand = await use_case.execute(
            acteur=acteur,
            stand_id=stand_id,
            numero=body.numero,
            localite=body.localite,
            longitude=body.longitude,
            latitude=body.latitude,
            altitude=body.altitude,
            equipe_aerienne_id=body.equipe_aerienne_id,
            actif=body.actif,
            champs_fournis=body.model_fields_set,
        )
    except EquipeNonAutoriseeError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except EquipeAerienneIntrouvableError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"equipe_aerienne_id introuvable : {exc.args[0]}",
        ) from exc
    except NumeroStandRemplissageDejaPrisError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"numero déjà pris : {exc.args[0]}",
        ) from exc
    if stand is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stand non trouvé")
    return stand


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
    )
