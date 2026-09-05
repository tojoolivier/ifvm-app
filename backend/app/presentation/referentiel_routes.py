import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.referentiel_use_cases import (
    CreateCodeStade,
    CreateCulture,
    CreateLieuAerien,
    CreatePesticide,
    CreatePosteAcridien,
    CreateStation,
    GetCodeStade,
    GetCulture,
    GetLieuAerien,
    GetPesticide,
    GetPosteAcridien,
    GetStation,
    ListCodesStades,
    ListCommunes,
    ListCultures,
    ListLieuxAeriens,
    ListPesticides,
    ListPostesAcridiens,
    ListStations,
    ListZonesAntiAcridiennes,
    PullReferentiel,
    ReferentielSinceCursors,
    UpdateCodeStade,
    UpdateCulture,
    UpdateLieuAerien,
    UpdatePesticide,
    UpdatePosteAcridien,
    UpdateStation,
)
from app.auth import get_current_user
from app.database import get_db
from app.domain.referentiel import (
    CodeReferentielDejaPrisError,
    CommuneInconnueError,
    GrilleDejaOccupeeError,
    PosteAcridienAvecStationsActivesError,
    PosteAcridienInactifError,
    PosteAcridienIntrouvableError,
    StadeInconnuError,
    TypeLieuAerienInvalideError,
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
    CodeStadeRepositoryImpl,
    CultureRepositoryImpl,
    LieuAerienRepositoryImpl,
    PesticideRepositoryImpl,
    UtilisateurEquipeRepositoryImpl,
)
from app.models.users import Utilisateur
from app.presentation.referentiel_schemas import (
    CodeStadeCreate,
    CodeStadeRead,
    CodeStadeUpdate,
    CommuneRead,
    CultureCreate,
    CultureRead,
    CultureUpdate,
    EntityPull,
    LieuAerienCreate,
    LieuAerienRead,
    LieuAerienUpdate,
    PesticideCreate,
    PesticideRead,
    PesticideUpdate,
    PosteAcridienCreate,
    PosteAcridienRead,
    PosteAcridienUpdate,
    ReferentielPullResponse,
    StationFixeCreate,
    StationFixeRead,
    StationFixeUpdate,
    ZoneAntiAcridienRead,
)

router = APIRouter()


@router.get("/zones-anti-acridiennes", response_model=list[ZoneAntiAcridienRead])
async def list_zones_anti_acridiennes(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    repository = ZoneAntiAcridienRepositoryImpl(db)
    use_case = ListZonesAntiAcridiennes(repository)
    return await use_case.execute()


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
    )
    try:
        return await use_case.execute(code=body.code, nom=body.nom, za_id=body.za_id)
    except ZoneAntiAcridienIntrouvableError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Zone anti-acridienne inconnue",
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
    )
    try:
        poste = await use_case.execute(
            pa_id=pa_id,
            code=body.code,
            nom=body.nom,
            za_id=body.za_id,
            actif=body.actif,
        )
    except ZoneAntiAcridienIntrouvableError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Zone anti-acridienne inconnue",
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
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = CreateLieuAerien(LieuAerienRepositoryImpl(db))
    try:
        return await use_case.execute(
            type_lieu=body.type_lieu,
            nom=body.nom,
            latitude=body.latitude,
            longitude=body.longitude,
            altitude=body.altitude,
        )
    except TypeLieuAerienInvalideError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"type_lieu invalide : {exc.args[0]}",
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
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    use_case = UpdateLieuAerien(LieuAerienRepositoryImpl(db))
    try:
        lieu = await use_case.execute(
            lieu_id=lieu_id,
            type_lieu=body.type_lieu,
            nom=body.nom,
            latitude=body.latitude,
            longitude=body.longitude,
            altitude=body.altitude,
            actif=body.actif,
            # `altitude` est nullable : seul le corps reçu distingue « absent » de
            # « mis à NULL ».
            champs_fournis=body.model_fields_set,
        )
    except TypeLieuAerienInvalideError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"type_lieu invalide : {exc.args[0]}",
        ) from exc
    if lieu is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lieu aérien non trouvé")
    return lieu


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
