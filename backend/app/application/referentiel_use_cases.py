import uuid
from dataclasses import dataclass
from datetime import date, datetime, timezone

from app.domain.campagne import Campagne
from app.domain.referentiel import (
    TYPES_LIEU_AERIEN,
    Aeronef,
    AeronefDejaAffecteError,
    AeronefIntrouvableError,
    AffectationAeronef,
    AffectationAeronefIntrouvableError,
    AffectationDejaCloturee,
    ChefEquipeInvalideError,
    CodeReferentielDejaPrisError,
    CodeStade,
    Commune,
    CommuneInconnueError,
    CompteALaVoleeInterditError,
    Culture,
    Equipe,
    EquipeAerienneIntrouvableError,
    EquipeDejaEquipeeError,
    EquipeIntrouvableError,
    EquipeNonAerienneError,
    EquipeNonAutoriseeError,
    EquipeRequiseError,
    EquipeTerrestreIntrouvableError,
    GrilleDejaOccupeeError,
    LieuAerien,
    MembreEquipe,
    MouvementPesticide,
    PeriodeAffectationInvalideError,
    Pesticide,
    PesticideIntrouvableError,
    PositionActiveIntrouvableError,
    PositionDejaActiveError,
    PosteAcridien,
    PosteAcridienAvecStationsActivesError,
    PosteAcridienInactifError,
    PosteAcridienIntrouvableError,
    SiteAerienne,
    SiteAerienneEquipeInvalideError,
    SiteAerienneIntrouvableError,
    SiteAerienneParentInvalideError,
    SiteAeriennePosition,
    SiteDestinationIncoherentError,
    SiteNonPrincipalError,
    SoldePesticide,
    StadeInconnuError,
    StationFixe,
    TypeLieuAerienInvalideError,
    UtilisateurEquipe,
    UtilisateurMembreIntrouvableError,
    ZoneAntiAcridien,
    ZoneAntiAcridienAvecPostesActifsError,
    ZoneAntiAcridienIntrouvableError,
)
from app.domain.repositories import (
    AeronefRepository,
    CampagneRepository,
    CodeStadeRepository,
    CommuneRepository,
    CultureRepository,
    EquipeAeronefRepository,
    EquipeRepository,
    LieuAerienRepository,
    MouvementPesticideRepository,
    PesticideRepository,
    PosteAcridienRepository,
    SiteAeriennePositionRepository,
    SiteAerienneRepository,
    StationFixeRepository,
    UtilisateurEquipeRepository,
    ZoneAntiAcridienRepository,
)
from app.models.users import ROLES_A_LA_VOLEE


class ListZonesAntiAcridiennes:
    def __init__(self, repository: ZoneAntiAcridienRepository):
        self.repository = repository

    async def execute(self, actif: bool | None = True) -> list[ZoneAntiAcridien]:
        return await self.repository.list_all(actif=actif)


class CreateZoneAntiAcridien:
    def __init__(self, repository: ZoneAntiAcridienRepository):
        self.repository = repository

    async def execute(self, code: str, nom: str) -> ZoneAntiAcridien:
        if await self.repository.code_pris_par_un_autre(code):
            raise CodeReferentielDejaPrisError(code)

        maintenant = datetime.now(timezone.utc)
        zone = ZoneAntiAcridien(
            code=code, nom=nom, actif=True, created_at=maintenant, updated_at=maintenant
        )
        return await self.repository.create(zone)


class UpdateZoneAntiAcridien:
    """Mise à jour d'une zone, `actif` compris.

    Aucune suppression physique n'est offerte, même raison que `UpdatePosteAcridien` :
    le pull hors-ligne ne transporte que des upserts.
    """

    def __init__(self, repository: ZoneAntiAcridienRepository):
        self.repository = repository

    async def execute(
        self,
        za_id: uuid.UUID,
        code: str | None = None,
        nom: str | None = None,
        actif: bool | None = None,
    ) -> ZoneAntiAcridien | None:
        zone = await self.repository.get_by_id(za_id)
        if zone is None:
            return None

        if code is not None and code != zone.code:
            if await self.repository.code_pris_par_un_autre(code, exclude_id=za_id):
                raise CodeReferentielDejaPrisError(code)
            zone.code = code

        if nom is not None:
            zone.nom = nom

        if actif is False and zone.actif and await self.repository.a_des_postes_actifs(za_id):
            raise ZoneAntiAcridienAvecPostesActifsError(za_id)
        if actif is not None:
            zone.actif = actif

        zone.updated_at = datetime.now(timezone.utc)
        return await self.repository.update(zone)


async def _equipe_du_type_existe(
    repository: EquipeRepository, equipe_id: uuid.UUID, type_attendu: str
) -> bool:
    """Le `type` est vérifié ici, pas seulement l'existence : depuis l'unification en
    une seule table `equipe` (ADR-018), un id d'équipe terrestre est un id parfaitement
    valide là où une équipe aérienne est attendue — et réciproquement. La FK composite
    `(equipe_id, equipe_type)` le refuse de toute façon, mais par une violation de
    contrainte brute (500) au lieu d'une erreur métier explicite."""
    equipe = await repository.get_by_id(equipe_id)
    return equipe is not None and equipe.type == type_attendu


async def _equipe_terrestre_existe(repository: EquipeRepository, equipe_id: uuid.UUID) -> bool:
    return await _equipe_du_type_existe(repository, equipe_id, "terrestre")


async def _equipe_aerienne_existe(repository: EquipeRepository, equipe_id: uuid.UUID) -> bool:
    return await _equipe_du_type_existe(repository, equipe_id, "aerien")


class ListPostesAcridiens:
    def __init__(self, repository: PosteAcridienRepository):
        self.repository = repository

    async def execute(self, actif: bool | None = True) -> list[PosteAcridien]:
        return await self.repository.list_all(actif=actif)


class GetPosteAcridien:
    def __init__(self, repository: PosteAcridienRepository):
        self.repository = repository

    async def execute(self, pa_id: uuid.UUID) -> PosteAcridien | None:
        return await self.repository.get_by_id(pa_id)


class CreatePosteAcridien:
    def __init__(
        self,
        repository: PosteAcridienRepository,
        zone_repository: ZoneAntiAcridienRepository,
        equipe_terrestre_repository: EquipeRepository,
    ):
        self.repository = repository
        self.zone_repository = zone_repository
        self.equipe_terrestre_repository = equipe_terrestre_repository

    async def execute(
        self,
        code: str,
        nom: str,
        za_id: uuid.UUID,
        equipe_terrestre_id: uuid.UUID | None = None,
    ) -> PosteAcridien:
        if not await self.zone_repository.exists(za_id):
            raise ZoneAntiAcridienIntrouvableError(str(za_id))
        if equipe_terrestre_id is not None and not await _equipe_terrestre_existe(
            self.equipe_terrestre_repository, equipe_terrestre_id
        ):
            raise EquipeTerrestreIntrouvableError(str(equipe_terrestre_id))
        if await self.repository.code_pris_par_un_autre(code):
            raise CodeReferentielDejaPrisError(code)

        maintenant = datetime.now(timezone.utc)
        poste = PosteAcridien(
            code=code,
            nom=nom,
            za_id=za_id,
            equipe_terrestre_id=equipe_terrestre_id,
            actif=True,
            created_at=maintenant,
            updated_at=maintenant,
        )
        return await self.repository.create(poste)


class UpdatePosteAcridien:
    """Mise à jour d'un poste, `actif` compris.

    Aucune suppression physique n'est offerte : le pull hors-ligne ne transporte que
    des upserts, une ligne supprimée resterait sur les téléphones déjà synchronisés.
    """

    def __init__(
        self,
        repository: PosteAcridienRepository,
        zone_repository: ZoneAntiAcridienRepository,
        equipe_terrestre_repository: EquipeRepository,
    ):
        self.repository = repository
        self.zone_repository = zone_repository
        self.equipe_terrestre_repository = equipe_terrestre_repository

    async def execute(
        self,
        pa_id: uuid.UUID,
        code: str | None = None,
        nom: str | None = None,
        za_id: uuid.UUID | None = None,
        equipe_terrestre_id: uuid.UUID | None = None,
        actif: bool | None = None,
        champs_fournis: set[str] = frozenset(),
    ) -> PosteAcridien | None:
        poste = await self.repository.get_by_id(pa_id)
        if poste is None:
            return None

        if za_id is not None and za_id != poste.za_id:
            if not await self.zone_repository.exists(za_id):
                raise ZoneAntiAcridienIntrouvableError(str(za_id))
            poste.za_id = za_id

        # `equipe_terrestre_id` est nullable (un poste peut être détaché de son
        # équipe) : seul `champs_fournis` (model_fields_set côté Pydantic) distingue
        # « absent » de « mis à NULL », même patron que `UpdateSiteAerienne.equipe_id`.
        if "equipe_terrestre_id" in champs_fournis:
            if equipe_terrestre_id is not None and not await _equipe_terrestre_existe(
                self.equipe_terrestre_repository, equipe_terrestre_id
            ):
                raise EquipeTerrestreIntrouvableError(str(equipe_terrestre_id))
            poste.equipe_terrestre_id = equipe_terrestre_id

        if code is not None and code != poste.code:
            if await self.repository.code_pris_par_un_autre(code, exclude_id=pa_id):
                raise CodeReferentielDejaPrisError(code)
            poste.code = code

        if nom is not None:
            poste.nom = nom

        if actif is False and poste.actif and poste.nb_stations > 0:
            raise PosteAcridienAvecStationsActivesError(poste.nb_stations)
        if actif is not None:
            poste.actif = actif

        poste.updated_at = datetime.now(timezone.utc)
        return await self.repository.update(poste)


class ListCommunes:
    def __init__(self, repository: CommuneRepository):
        self.repository = repository

    async def execute(self) -> list[Commune]:
        return await self.repository.list_all()


class CreateStation:
    def __init__(
        self,
        repository: StationFixeRepository,
        poste_repository: PosteAcridienRepository,
        commune_repository: CommuneRepository,
    ):
        self.repository = repository
        self.poste_repository = poste_repository
        self.commune_repository = commune_repository

    async def execute(
        self,
        code: str,
        nom: str,
        pa_id: uuid.UUID,
        latitude: float,
        longitude: float,
        commune_id: uuid.UUID,
        altitude: float | None = None,
    ) -> StationFixe:
        await _valide_rattachement_station(
            poste_repository=self.poste_repository,
            commune_repository=self.commune_repository,
            pa_id=pa_id,
            commune_id=commune_id,
        )
        if await self.repository.code_pris_par_un_autre(code):
            raise CodeReferentielDejaPrisError(code)

        maintenant = datetime.now(timezone.utc)
        station = StationFixe(
            code=code,
            nom=nom,
            pa_id=pa_id,
            latitude=latitude,
            longitude=longitude,
            altitude=altitude,
            commune_id=commune_id,
            actif=True,
            created_at=maintenant,
            updated_at=maintenant,
        )
        return await self.repository.create(station)


class UpdateStation:
    """Mise à jour d'une station, `actif` compris.

    Aucune suppression physique n'est offerte : le pull hors-ligne ne transporte que
    des upserts, une ligne supprimée resterait sur les téléphones déjà synchronisés —
    et une station est référencée par des prospections.
    """

    def __init__(
        self,
        repository: StationFixeRepository,
        poste_repository: PosteAcridienRepository,
        commune_repository: CommuneRepository,
    ):
        self.repository = repository
        self.poste_repository = poste_repository
        self.commune_repository = commune_repository

    async def execute(
        self,
        station_id: uuid.UUID,
        champs_fournis: set[str],
        code: str | None = None,
        nom: str | None = None,
        pa_id: uuid.UUID | None = None,
        latitude: float | None = None,
        longitude: float | None = None,
        altitude: float | None = None,
        commune_id: uuid.UUID | None = None,
        actif: bool | None = None,
    ) -> StationFixe | None:
        station = await self.repository.get_by_id(station_id)
        if station is None:
            return None

        # Rattachements validés seulement s'ils changent : un poste fermé ne doit pas
        # rendre inéditable une station qui lui était déjà rattachée.
        if pa_id is not None and pa_id != station.pa_id:
            await _valide_rattachement_station(
                poste_repository=self.poste_repository,
                commune_repository=self.commune_repository,
                pa_id=pa_id,
            )
            station.pa_id = pa_id

        if commune_id is not None and commune_id != station.commune_id:
            await _valide_rattachement_station(
                poste_repository=self.poste_repository,
                commune_repository=self.commune_repository,
                commune_id=commune_id,
            )
            station.commune_id = commune_id

        if code is not None and code != station.code:
            if await self.repository.code_pris_par_un_autre(code, exclude_id=station_id):
                raise CodeReferentielDejaPrisError(code)
            station.code = code

        if nom is not None:
            station.nom = nom
        if latitude is not None:
            station.latitude = latitude
        if longitude is not None:
            station.longitude = longitude
        # `altitude` est nullable : seul le corps reçu distingue « absent » de
        # « mis à NULL », la comparaison de valeur ne suffit pas.
        if "altitude" in champs_fournis:
            station.altitude = altitude
        if actif is not None:
            station.actif = actif

        # Sans `updated_at` rehaussé, le pull incrémental sauterait la modification.
        station.updated_at = datetime.now(timezone.utc)
        return await self.repository.update(station)


async def _valide_rattachement_station(
    poste_repository: PosteAcridienRepository,
    commune_repository: CommuneRepository,
    pa_id: uuid.UUID | None = None,
    commune_id: uuid.UUID | None = None,
) -> None:
    """Les deux FK de `station_fixe` sont NOT NULL et sortent d'un sélecteur : on les
    contrôle ici pour rendre un 409 explicite plutôt qu'une IntegrityError 500."""
    if pa_id is not None:
        poste = await poste_repository.get_by_id(pa_id)
        if poste is None:
            raise PosteAcridienIntrouvableError(str(pa_id))
        # Réciproque de `PosteAcridienAvecStationsActivesError` : on ne ferme pas un
        # poste sous des stations actives, on n'en accroche pas une à un poste fermé.
        if not poste.actif:
            raise PosteAcridienInactifError(poste.code)

    if commune_id is not None and not await commune_repository.exists(commune_id):
        raise CommuneInconnueError(str(commune_id))


class ListStations:
    def __init__(self, repository: StationFixeRepository):
        self.repository = repository

    async def execute(
        self,
        pa_id: uuid.UUID | None = None,
        q: str | None = None,
        actif: bool | None = True,
    ) -> list[StationFixe]:
        return await self.repository.list_by_filters(pa_id=pa_id, q=q, actif=actif)


class GetStation:
    def __init__(self, repository: StationFixeRepository):
        self.repository = repository

    async def execute(self, station_id: uuid.UUID) -> StationFixe | None:
        return await self.repository.get_by_id(station_id)


class ListCodesStades:
    def __init__(self, repository: CodeStadeRepository):
        self.repository = repository

    async def execute(self, actif: bool | None = True) -> list[CodeStade]:
        return await self.repository.list_all(actif=actif)


class GetCodeStade:
    def __init__(self, repository: CodeStadeRepository):
        self.repository = repository

    async def execute(self, code_stade_id: uuid.UUID) -> CodeStade | None:
        return await self.repository.get_by_id(code_stade_id)


class CreateCodeStade:
    def __init__(self, repository: CodeStadeRepository):
        self.repository = repository

    async def execute(
        self,
        code: str,
        categorie: str,
        sexe: str | None,
        espece: str | None,
        libelle: str,
        ordre: int,
    ) -> CodeStade:
        if not await self.repository.code_au_vocabulaire(code):
            raise StadeInconnuError(code)

        occupant = await self.repository.grille_occupee_par(code, categorie, sexe, espece)
        if occupant is not None:
            raise GrilleDejaOccupeeError(code)

        return await self.repository.create(
            CodeStade(
                code=code,
                categorie=categorie,
                sexe=sexe,
                espece=espece,
                libelle=libelle,
                ordre=ordre,
                actif=True,
                updated_at=datetime.now(timezone.utc),
            )
        )


class UpdateCodeStade:
    """Mise à jour partielle. Pas de suppression : `actif=False` est la seule sortie,
    le pull hors-ligne ne transportant que des upserts."""

    def __init__(self, repository: CodeStadeRepository):
        self.repository = repository

    async def execute(
        self,
        code_stade_id: uuid.UUID,
        code: str | None = None,
        categorie: str | None = None,
        sexe: str | None = None,
        espece: str | None = None,
        libelle: str | None = None,
        ordre: int | None = None,
        actif: bool | None = None,
        champs_fournis: set[str] | None = None,
    ) -> CodeStade | None:
        # `sexe` et `espece` sont nullables : « absent du corps » et « mis à NULL » ne
        # peuvent pas se distinguer sur la valeur seule, d'où `champs_fournis`.
        fournis = champs_fournis if champs_fournis is not None else set()

        code_stade = await self.repository.get_by_id(code_stade_id)
        if code_stade is None:
            return None

        if code is not None:
            code_stade.code = code
        if categorie is not None:
            code_stade.categorie = categorie
        if "sexe" in fournis:
            code_stade.sexe = sexe
        if "espece" in fournis:
            code_stade.espece = espece
        if libelle is not None:
            code_stade.libelle = libelle
        if ordre is not None:
            code_stade.ordre = ordre
        if actif is not None:
            code_stade.actif = actif

        if not await self.repository.code_au_vocabulaire(code_stade.code):
            raise StadeInconnuError(code_stade.code)

        occupant = await self.repository.grille_occupee_par(
            code_stade.code, code_stade.categorie, code_stade.sexe, code_stade.espece
        )
        if occupant is not None and occupant != code_stade.id:
            raise GrilleDejaOccupeeError(code_stade.code)

        code_stade.updated_at = datetime.now(timezone.utc)
        return await self.repository.update(code_stade)


class ListCultures:
    def __init__(self, repository: CultureRepository):
        self.repository = repository

    async def execute(self, actif: bool | None = True) -> list[Culture]:
        return await self.repository.list_all(actif=actif)


class GetCulture:
    def __init__(self, repository: CultureRepository):
        self.repository = repository

    async def execute(self, culture_id: uuid.UUID) -> Culture | None:
        return await self.repository.get_by_id(culture_id)


class CreateCulture:
    def __init__(self, repository: CultureRepository):
        self.repository = repository

    async def execute(self, code: str, nom: str) -> Culture:
        if await self.repository.code_pris_par_un_autre(code):
            raise CodeReferentielDejaPrisError(code)

        maintenant = datetime.now(timezone.utc)
        return await self.repository.create(
            Culture(
                code=code,
                nom=nom,
                actif=True,
                created_at=maintenant,
                updated_at=maintenant,
            )
        )


class UpdateCulture:
    """Mise a jour partielle, `actif` compris. Pas de suppression : `actif=False` est
    la seule sortie, le pull hors-ligne ne transportant que des upserts."""

    def __init__(self, repository: CultureRepository):
        self.repository = repository

    async def execute(
        self,
        culture_id: uuid.UUID,
        code: str | None = None,
        nom: str | None = None,
        actif: bool | None = None,
    ) -> Culture | None:
        culture = await self.repository.get_by_id(culture_id)
        if culture is None:
            return None

        if code is not None and code != culture.code:
            if await self.repository.code_pris_par_un_autre(code, exclude_id=culture_id):
                raise CodeReferentielDejaPrisError(code)
            culture.code = code

        if nom is not None:
            culture.nom = nom
        if actif is not None:
            culture.actif = actif

        # Sans `updated_at` rehausse, le pull incremental sauterait la modification.
        culture.updated_at = datetime.now(timezone.utc)
        return await self.repository.update(culture)


class ListLieuxAeriens:
    def __init__(self, repository: LieuAerienRepository):
        self.repository = repository

    async def execute(
        self, type_lieu: str | None = None, actif: bool | None = True
    ) -> list[LieuAerien]:
        return await self.repository.list_all(type_lieu=type_lieu, actif=actif)


class GetLieuAerien:
    def __init__(self, repository: LieuAerienRepository):
        self.repository = repository

    async def execute(self, lieu_id: uuid.UUID) -> LieuAerien | None:
        return await self.repository.get_by_id(lieu_id)


class CreateLieuAerien:
    """Seul le chef de base de l'équipe (ou un admin) crée ses lieux — même règle que
    `CreateSiteAerienne`."""

    def __init__(
        self,
        repository: LieuAerienRepository,
        equipe_aerienne_repository: EquipeRepository,
    ):
        self.repository = repository
        self.equipe_aerienne_repository = equipe_aerienne_repository

    async def execute(
        self,
        acteur: object,
        type_lieu: str,
        nom: str,
        latitude: float,
        longitude: float,
        altitude: float | None,
        equipe_aerienne_id: uuid.UUID,
    ) -> LieuAerien:
        if type_lieu not in TYPES_LIEU_AERIEN:
            raise TypeLieuAerienInvalideError(type_lieu)
        equipe_aerienne_id = await _resoudre_equipe_creation(
            acteur, self.equipe_aerienne_repository, equipe_aerienne_id
        )
        if not await _equipe_aerienne_existe(self.equipe_aerienne_repository, equipe_aerienne_id):
            raise EquipeAerienneIntrouvableError(str(equipe_aerienne_id))

        maintenant = datetime.now(timezone.utc)
        return await self.repository.create(
            LieuAerien(
                type_lieu=type_lieu,
                nom=nom,
                latitude=latitude,
                longitude=longitude,
                altitude=altitude,
                actif=True,
                equipe_aerienne_id=equipe_aerienne_id,
                created_at=maintenant,
                updated_at=maintenant,
            )
        )


class UpdateLieuAerien:
    """Mise à jour partielle, `actif` compris. Pas de suppression : `actif=False` est
    la seule sortie."""

    def __init__(
        self,
        repository: LieuAerienRepository,
        equipe_aerienne_repository: EquipeRepository,
    ):
        self.repository = repository
        self.equipe_aerienne_repository = equipe_aerienne_repository

    async def execute(
        self,
        acteur: object,
        lieu_id: uuid.UUID,
        type_lieu: str | None = None,
        nom: str | None = None,
        latitude: float | None = None,
        longitude: float | None = None,
        altitude: float | None = None,
        equipe_aerienne_id: uuid.UUID | None = None,
        actif: bool | None = None,
        champs_fournis: set[str] = frozenset(),
    ) -> LieuAerien | None:
        lieu = await self.repository.get_by_id(lieu_id)
        if lieu is None:
            return None

        await _exiger_droit_sur_equipe(
            acteur, self.equipe_aerienne_repository, lieu.equipe_aerienne_id
        )

        if type_lieu is not None:
            if type_lieu not in TYPES_LIEU_AERIEN:
                raise TypeLieuAerienInvalideError(type_lieu)
            lieu.type_lieu = type_lieu
        if nom is not None:
            lieu.nom = nom
        if latitude is not None:
            lieu.latitude = latitude
        if longitude is not None:
            lieu.longitude = longitude
        # `altitude` est nullable : seul le corps reçu distingue « absent » de « mis à
        # NULL » — `champs_fournis` vient de `model_fields_set` côté schéma Pydantic.
        if "altitude" in champs_fournis:
            lieu.altitude = altitude
        # `equipe_aerienne_id` est nullable en base (un lieu peut être détaché de son
        # équipe, même si le formulaire web n'expose pas cette option) — même patron
        # que `UpdatePosteAcridien.equipe_terrestre_id`.
        if "equipe_aerienne_id" in champs_fournis:
            if equipe_aerienne_id is not None and not await _equipe_aerienne_existe(
                self.equipe_aerienne_repository, equipe_aerienne_id
            ):
                raise EquipeAerienneIntrouvableError(str(equipe_aerienne_id))
            lieu.equipe_aerienne_id = equipe_aerienne_id
        if actif is not None:
            lieu.actif = actif

        # Sans `updated_at` rehaussé, un futur pull incrémental sauterait la modification.
        lieu.updated_at = datetime.now(timezone.utc)
        return await self.repository.update(lieu)


class ListSitesAeriens:
    def __init__(self, repository: SiteAerienneRepository):
        self.repository = repository

    async def execute(self, actif: bool | None = True) -> list[SiteAerienne]:
        return await self.repository.list_all(actif=actif)


class GetSiteAerienne:
    def __init__(self, repository: SiteAerienneRepository):
        self.repository = repository

    async def execute(self, site_id: uuid.UUID) -> SiteAerienne | None:
        return await self.repository.get_by_id(site_id)


def _est_admin(acteur: object) -> bool:
    return acteur.role == "admin"


async def _resoudre_equipe_creation(
    acteur: object,
    equipe_repository: EquipeRepository,
    equipe_demandee_id: uuid.UUID | None,
) -> uuid.UUID:
    """Équipe pour laquelle `acteur` crée un lieu aérien (bases, stands).

    Seul le chef de base d'une équipe crée les lieux de SON équipe — seul membre à
    pouvoir se connecter (les comptes pilote/mécanicien sont créés à la volée, sans accès
    applicatif). Il ne dirige qu'une équipe (`uq_equipe_membre_chef_par_utilisateur`) :
    on la déduit, jamais choisie. S'il en désigne
    une autre, c'est un refus, pas une correction silencieuse. Un admin agit pour le
    compte de n'importe quelle équipe, mais doit alors la désigner.
    """
    if _est_admin(acteur):
        if equipe_demandee_id is None:
            raise EquipeRequiseError("equipe_aerienne_id est requis pour un admin")
        return equipe_demandee_id
    equipe = await equipe_repository.get_by_chef_id(acteur.id)
    if equipe is None:
        raise EquipeNonAutoriseeError("seul le chef de base d'une équipe aérienne crée ses lieux")
    if equipe_demandee_id is not None and equipe_demandee_id != equipe.id:
        raise EquipeNonAutoriseeError("un lieu aérien ne se crée que pour sa propre équipe")
    return equipe.id


async def _exiger_droit_sur_equipe(
    acteur: object,
    equipe_repository: EquipeRepository,
    equipe_id: uuid.UUID | None,
) -> None:
    """Modifier un lieu existant : admin, ou chef de base de l'équipe qui le possède.
    Un lieu « sans équipe » (antérieur à la migration 0078/0074) n'est modifiable que
    par un admin — personne ne peut prétendre en être le propriétaire."""
    if _est_admin(acteur):
        return
    equipe = await equipe_repository.get_by_chef_id(acteur.id)
    if equipe is None or equipe_id is None or equipe.id != equipe_id:
        raise EquipeNonAutoriseeError("ce lieu aérien appartient à une autre équipe")


async def _valider_parent_site(
    repository: SiteAerienneRepository, parent_site_id: uuid.UUID | None
) -> None:
    """La hiérarchie s'arrête à 2 niveaux : le parent référencé doit exister et être
    lui-même un principal (pas de secondaire d'un secondaire)."""
    if parent_site_id is None:
        return
    parent = await repository.get_by_id(parent_site_id)
    if parent is None or parent.parent_site_id is not None:
        raise SiteAerienneParentInvalideError(str(parent_site_id))


def _valider_equipe_coherente(
    parent_site_id: uuid.UUID | None, equipe_id: uuid.UUID | None
) -> None:
    """#equipe-aerienne (migration 0066) : un site principal (`parent_site_id`
    NULL) doit avoir une équipe ; un site secondaire hérite de celle de son
    principal et n'en porte pas une à lui — même règle que le CHECK
    `ck_site_aerienne_equipe_coherente`, vérifiée ici en amont pour un message
    d'erreur explicite plutôt qu'une violation de contrainte brute."""
    est_principal = parent_site_id is None
    if est_principal and equipe_id is None:
        raise SiteAerienneEquipeInvalideError(
            "un site aérien principal doit appartenir à une équipe aérienne"
        )
    if not est_principal and equipe_id is not None:
        raise SiteAerienneEquipeInvalideError(
            "un site aérien secondaire hérite de l'équipe de son site principal, "
            "il ne peut pas avoir sa propre équipe"
        )


class CreateSiteAerienne:
    """Seul le chef de base de l'équipe (ou un admin) crée ses sites (bases,
    stands — le rôle est contextuel, cf. `SiteAerienneModel`). Un site principal est
    rattaché à l'équipe du chef sans qu'il la désigne ; un secondaire hérite de son
    principal, dont l'équipe doit être la sienne."""

    def __init__(
        self,
        repository: SiteAerienneRepository,
        equipe_aerienne_repository: EquipeRepository,
    ):
        self.repository = repository
        self.equipe_aerienne_repository = equipe_aerienne_repository

    async def execute(
        self,
        acteur: object,
        numero: str,
        localite: str,
        parent_site_id: uuid.UUID | None = None,
        equipe_id: uuid.UUID | None = None,
    ) -> SiteAerienne:
        await _valider_parent_site(self.repository, parent_site_id)
        if parent_site_id is None:
            # Un admin sans `equipe_id` retombe sur `_valider_equipe_coherente`
            # (422 explicite) plutôt que sur « équipe requise » : même règle qu'avant.
            if not _est_admin(acteur) or equipe_id is not None:
                equipe_id = await _resoudre_equipe_creation(
                    acteur, self.equipe_aerienne_repository, equipe_id
                )
        else:
            parent = await self.repository.get_by_id(parent_site_id)
            await _exiger_droit_sur_equipe(
                acteur, self.equipe_aerienne_repository, parent.equipe_id
            )
        _valider_equipe_coherente(parent_site_id, equipe_id)

        maintenant = datetime.now(timezone.utc)
        return await self.repository.create(
            SiteAerienne(
                parent_site_id=parent_site_id,
                equipe_id=equipe_id,
                numero=numero,
                localite=localite,
                actif=True,
                created_at=maintenant,
                updated_at=maintenant,
            )
        )


class UpdateSiteAerienne:
    """Mise à jour partielle, `actif` compris. Pas de suppression : `actif=False` est
    la seule sortie."""

    def __init__(
        self,
        repository: SiteAerienneRepository,
        equipe_aerienne_repository: EquipeRepository,
    ):
        self.repository = repository
        self.equipe_aerienne_repository = equipe_aerienne_repository

    async def execute(
        self,
        acteur: object,
        site_id: uuid.UUID,
        numero: str | None = None,
        localite: str | None = None,
        parent_site_id: uuid.UUID | None = None,
        equipe_id: uuid.UUID | None = None,
        actif: bool | None = None,
        champs_fournis: set[str] = frozenset(),
    ) -> SiteAerienne | None:
        site = await self.repository.get_by_id(site_id)
        if site is None:
            return None

        # L'équipe qui possède le site : la sienne (principal) ou celle de son principal
        # (secondaire). Contrôlée AVANT toute modification, sur l'état actuel.
        if site.parent_site_id is None:
            equipe_courante = site.equipe_id
        else:
            principal = await self.repository.get_by_id(site.parent_site_id)
            equipe_courante = principal.equipe_id if principal is not None else None
        await _exiger_droit_sur_equipe(acteur, self.equipe_aerienne_repository, equipe_courante)

        if "parent_site_id" in champs_fournis:
            if parent_site_id == site_id:
                raise SiteAerienneParentInvalideError("un site ne peut pas être son propre parent")
            await _valider_parent_site(self.repository, parent_site_id)
            if parent_site_id is not None:
                nouveau_parent = await self.repository.get_by_id(parent_site_id)
                await _exiger_droit_sur_equipe(
                    acteur, self.equipe_aerienne_repository, nouveau_parent.equipe_id
                )
            site.parent_site_id = parent_site_id
        if "equipe_id" in champs_fournis:
            if equipe_id is not None:
                await _exiger_droit_sur_equipe(acteur, self.equipe_aerienne_repository, equipe_id)
            site.equipe_id = equipe_id
        if "parent_site_id" in champs_fournis or "equipe_id" in champs_fournis:
            _valider_equipe_coherente(site.parent_site_id, site.equipe_id)
        if numero is not None:
            site.numero = numero
        if localite is not None:
            site.localite = localite
        if actif is not None:
            site.actif = actif

        site.updated_at = datetime.now(timezone.utc)
        return await self.repository.update(site)


class InstallerPositionSiteAerienne:
    """Ouvre une position (installe le site à des coordonnées GPS). Refuse s'il en
    existe déjà une active — la démonter d'abord (AC #604)."""

    def __init__(
        self,
        repository: SiteAeriennePositionRepository,
        site_repository: SiteAerienneRepository,
    ):
        self.repository = repository
        self.site_repository = site_repository

    async def execute(
        self,
        site_id: uuid.UUID,
        latitude: float,
        longitude: float,
        altitude: float | None = None,
    ) -> SiteAeriennePosition:
        if await self.site_repository.get_by_id(site_id) is None:
            raise SiteAerienneIntrouvableError(str(site_id))
        active = await self.repository.get_active(site_id)
        if active is not None:
            raise PositionDejaActiveError(str(site_id))

        maintenant = datetime.now(timezone.utc)
        return await self.repository.installer(
            SiteAeriennePosition(
                site_id=site_id,
                latitude=latitude,
                longitude=longitude,
                altitude=altitude,
                date_debut=maintenant.date(),
                date_fin=None,
                created_at=maintenant,
            )
        )


class DemonterPositionSiteAerienne:
    """Borne `date_fin` de la position active. Échoue s'il n'y en a aucune."""

    def __init__(
        self,
        repository: SiteAeriennePositionRepository,
        site_repository: SiteAerienneRepository,
    ):
        self.repository = repository
        self.site_repository = site_repository

    async def execute(self, site_id: uuid.UUID) -> SiteAeriennePosition:
        if await self.site_repository.get_by_id(site_id) is None:
            raise SiteAerienneIntrouvableError(str(site_id))
        active = await self.repository.get_active(site_id)
        if active is None:
            raise PositionActiveIntrouvableError(str(site_id))
        active.date_fin = datetime.now(timezone.utc).date()
        return await self.repository.demonter(active)


class ListerPositionsSiteAerienne:
    def __init__(self, repository: SiteAeriennePositionRepository):
        self.repository = repository

    async def execute(self, site_id: uuid.UUID) -> list[SiteAeriennePosition]:
        return await self.repository.list_par_site(site_id)


class GetPositionActiveSiteAerienne:
    def __init__(self, repository: SiteAeriennePositionRepository):
        self.repository = repository

    async def execute(self, site_id: uuid.UUID) -> SiteAeriennePosition | None:
        return await self.repository.get_active(site_id)


# Fonction de direction attendue selon le type d'équipe : `ROLES` distingue toujours
# `chef_de_base` (aérien) et `chef_equipe` (terrestre), alors que `equipe_membre` ne
# connaît plus qu'une fonction `chef`. C'est ici que la correspondance est faite.
ROLE_DU_CHEF_PAR_TYPE = {"aerien": "chef_de_base", "terrestre": "chef_equipe"}


@dataclass
class MembreDemande:
    """Membre tel que demandé par l'API : soit un compte existant (`user_id`), soit une
    identité à créer à la volée (`nom`/`prenom`)."""

    fonction: str
    user_id: uuid.UUID | None = None
    nom: str | None = None
    prenom: str | None = None


class ListEquipes:
    def __init__(self, repository: EquipeRepository):
        self.repository = repository

    async def execute(
        self, actif: bool | None = True, type_equipe: str | None = None
    ) -> list[Equipe]:
        return await self.repository.list_all(actif=actif, type_equipe=type_equipe)


class GetEquipe:
    def __init__(self, repository: EquipeRepository):
        self.repository = repository

    async def execute(self, equipe_id: uuid.UUID) -> Equipe | None:
        return await self.repository.get_by_id(equipe_id)


class ResoudreMembre:
    """Transforme un `MembreDemande` en `MembreEquipe` prêt à écrire, en créant au
    besoin le compte « à la volée ».

    `utilisateur_repo` est duck-typé (`get_by_id`, `creer_a_la_volee`) — même contrat
    souple que les anciens `CreateEquipe*`."""

    def __init__(self, utilisateur_repo: object):
        self.utilisateur_repo = utilisateur_repo

    async def execute(
        self, equipe_id: uuid.UUID, type_equipe: str, demande: MembreDemande
    ) -> MembreEquipe:
        if demande.user_id is not None:
            utilisateur = await self.utilisateur_repo.get_by_id(demande.user_id)
            if utilisateur is None:
                raise UtilisateurMembreIntrouvableError(str(demande.user_id))
            if (
                demande.fonction == "chef"
                and utilisateur.role != ROLE_DU_CHEF_PAR_TYPE[type_equipe]
            ):
                raise ChefEquipeInvalideError(str(demande.user_id))
        else:
            # Pas de compte désigné : on en crée un, mais seulement pour les fonctions
            # que le projet autorise déjà à naître ainsi (#319) — un chef doit
            # préexister.
            if demande.fonction not in ROLES_A_LA_VOLEE:
                raise CompteALaVoleeInterditError(
                    f"fonction « {demande.fonction} » : seules "
                    f"{', '.join(ROLES_A_LA_VOLEE)} naissent d'un simple nom"
                )
            if not demande.nom:
                # Inatteignable par l'API (`_exiger_compte_ou_identite` l'a déjà
                # rejeté en 422) ; garde-fou pour un appel direct du cas d'usage.
                raise CompteALaVoleeInterditError(
                    "un membre sans user_id doit au moins porter un nom"
                )
            utilisateur = await self.utilisateur_repo.creer_a_la_volee(
                nom=demande.nom, prenom=demande.prenom or "", role=demande.fonction
            )

        return MembreEquipe(
            equipe_id=equipe_id,
            user_id=utilisateur.id,
            fonction=demande.fonction,
            nom=utilisateur.nom,
            prenom=utilisateur.prenom,
            created_at=datetime.now(timezone.utc),
        )


class CreateEquipe:
    """Crée une équipe et ses membres. Le `type` est figé ici une fois pour toutes :
    aucun chemin de mise à jour ne le réécrit.

    L'appareil arrive sous deux formes exclusives (#621) : `aeronef`, créé à la volée
    dans la même transaction (forme historique, conservée pour les formulaires web et
    mobile), ou `aeronef_id`, déjà au référentiel — vérifié ici pour rendre un 404
    explicite plutôt qu'une violation de FK."""

    def __init__(
        self,
        repository: EquipeRepository,
        utilisateur_repo: object,
        aeronef_repo: AeronefRepository,
        affectation_repo: EquipeAeronefRepository,
    ):
        self.repository = repository
        self.resoudre_membre = ResoudreMembre(utilisateur_repo)
        self.aeronef_repo = aeronef_repo
        self.affectation_repo = affectation_repo

    async def execute(
        self,
        nom: str,
        type_equipe: str,
        membres: list[MembreDemande] | None = None,
        aeronef: Aeronef | None = None,
        aeronef_id: uuid.UUID | None = None,
    ) -> Equipe:
        maintenant = datetime.now(timezone.utc)
        equipe_id = uuid.uuid4()
        if aeronef_id is not None:
            if await self.aeronef_repo.get_by_id(aeronef_id) is None:
                raise AeronefIntrouvableError(str(aeronef_id))
            # Même règle qu'une affectation explicite (#603) : l'équipe naît avec une
            # affectation ouverte à partir de `maintenant`, donc un appareil déjà en
            # service ailleurs se chevaucherait. Vérifié ici plutôt que laissé à l'index
            # partiel, dont le message ne dirait pas *quel* appareil coince.
            await _refuser_chevauchement(
                self.affectation_repo, equipe_id, aeronef_id, maintenant.date(), None
            )
        membres_resolus = [
            await self.resoudre_membre.execute(equipe_id, type_equipe, demande)
            for demande in (membres or [])
        ]
        return await self.repository.create(
            Equipe(
                id=equipe_id,
                nom=nom,
                type=type_equipe,
                aeronef_id=aeronef.id if aeronef is not None else aeronef_id,
                aeronef=aeronef,
                actif=True,
                created_at=maintenant,
                updated_at=maintenant,
                membres=membres_resolus,
            )
        )


class UpdateEquipe:
    """Renommage et mise hors service. `type` est volontairement absent : le type d'une
    équipe n'est pas modifiable après création."""

    def __init__(self, repository: EquipeRepository):
        self.repository = repository

    async def execute(
        self,
        equipe_id: uuid.UUID,
        nom: str | None = None,
        actif: bool | None = None,
    ) -> Equipe:
        equipe = await self.repository.get_by_id(equipe_id)
        if equipe is None:
            raise EquipeIntrouvableError(str(equipe_id))
        if nom is not None:
            equipe.nom = nom
        if actif is not None:
            equipe.actif = actif
        equipe.updated_at = datetime.now(timezone.utc)
        return await self.repository.update(equipe)


class AjouterMembreEquipe:
    def __init__(self, repository: EquipeRepository, utilisateur_repo: object):
        self.repository = repository
        self.resoudre_membre = ResoudreMembre(utilisateur_repo)

    async def execute(self, equipe_id: uuid.UUID, demande: MembreDemande) -> MembreEquipe:
        equipe = await self.repository.get_by_id(equipe_id)
        if equipe is None:
            raise EquipeIntrouvableError(str(equipe_id))
        membre = await self.resoudre_membre.execute(equipe_id, equipe.type, demande)
        return await self.repository.ajouter_membre(membre)


async def _refuser_chevauchement(
    repository: EquipeAeronefRepository,
    equipe_id: uuid.UUID,
    aeronef_id: uuid.UUID,
    date_debut: date,
    date_fin: date | None,
    sauf_id: uuid.UUID | None = None,
) -> None:
    """Règle centrale de `equipe_aeronef` (#603), vérifiée côté application.

    Deux refus, selon le côté qui coince : l'appareil est ailleurs sur la période, ou
    l'équipe en a déjà un. Distinguer les deux est ce qui rend le message utile — « ça
    se chevauche » n'aide personne à savoir quoi corriger."""
    for existante in await repository.list_chevauchements(
        date_debut=date_debut,
        date_fin=date_fin,
        equipe_id=equipe_id,
        aeronef_id=aeronef_id,
        sauf_id=sauf_id,
    ):
        if existante.aeronef_id == aeronef_id:
            raise AeronefDejaAffecteError(str(aeronef_id))
        raise EquipeDejaEquipeeError(str(equipe_id))


class ListerAffectationsAeronef:
    """Historique des appareils d'une équipe, affectation en cours d'abord (#603)."""

    def __init__(self, equipe_repo: EquipeRepository, repository: EquipeAeronefRepository):
        self.equipe_repo = equipe_repo
        self.repository = repository

    async def execute(self, equipe_id: uuid.UUID) -> list[AffectationAeronef]:
        if await self.equipe_repo.get_by_id(equipe_id) is None:
            raise EquipeIntrouvableError(str(equipe_id))
        return await self.repository.list_par_equipe(equipe_id)


class AffecterAeronef:
    """Affecte un appareil à une équipe à partir d'une date (#603).

    C'est ici que vit la règle « un aéronef sur une seule équipe à la fois » — et sa
    symétrique « une équipe n'a qu'un appareil à la fois ». Aucune des deux n'est un
    `UNIQUE` : elles portent sur le chevauchement d'intervalles, que seul
    `EXCLUDE USING gist` exprimerait en SQL (hors scope, ADR-018). Les index partiels
    de la migration 0085 ne rattrapent que les courses entre deux requêtes."""

    def __init__(
        self,
        equipe_repo: EquipeRepository,
        aeronef_repo: AeronefRepository,
        repository: EquipeAeronefRepository,
    ):
        self.equipe_repo = equipe_repo
        self.aeronef_repo = aeronef_repo
        self.repository = repository

    async def execute(
        self,
        equipe_id: uuid.UUID,
        aeronef_id: uuid.UUID,
        date_debut: date,
        date_fin: date | None = None,
    ) -> AffectationAeronef:
        equipe = await self.equipe_repo.get_by_id(equipe_id)
        if equipe is None:
            raise EquipeIntrouvableError(str(equipe_id))
        if equipe.type != "aerien":
            raise EquipeNonAerienneError(str(equipe_id))
        if await self.aeronef_repo.get_by_id(aeronef_id) is None:
            raise AeronefIntrouvableError(str(aeronef_id))
        if date_fin is not None and date_fin < date_debut:
            raise PeriodeAffectationInvalideError(f"{date_fin} < {date_debut}")

        await _refuser_chevauchement(self.repository, equipe_id, aeronef_id, date_debut, date_fin)

        maintenant = datetime.now(timezone.utc)
        return await self.repository.create(
            AffectationAeronef(
                id=uuid.uuid4(),
                equipe_id=equipe_id,
                aeronef_id=aeronef_id,
                date_debut=date_debut,
                date_fin=date_fin,
                created_at=maintenant,
            )
        )


class CloturerAffectationAeronef:
    """Retire un appareil d'une équipe en bornant son affectation (#603).

    Seule `date_fin` bouge, et l'affectation reste : c'est ce qui distingue « cet
    appareil a servi jusqu'au 12 » de « cet appareil n'a jamais servi »."""

    def __init__(self, repository: EquipeAeronefRepository):
        self.repository = repository

    async def execute(
        self, equipe_id: uuid.UUID, affectation_id: uuid.UUID, date_fin: date
    ) -> AffectationAeronef:
        affectation = await self.repository.get_by_id(affectation_id)
        if affectation is None or affectation.equipe_id != equipe_id:
            raise AffectationAeronefIntrouvableError(str(affectation_id))
        if affectation.date_fin is not None:
            raise AffectationDejaCloturee(str(affectation_id))
        if date_fin < affectation.date_debut:
            raise PeriodeAffectationInvalideError(f"{date_fin} < {affectation.date_debut}")

        # Borner une affectation ouverte ne peut que *libérer* du temps : le
        # chevauchement reste pourtant vérifié, parce qu'un `EXCLUDE` en base ne le fait
        # pas et qu'une ligne concurrente a pu s'intercaler depuis la lecture.
        await _refuser_chevauchement(
            self.repository,
            equipe_id,
            affectation.aeronef_id,
            affectation.date_debut,
            date_fin,
            sauf_id=affectation.id,
        )

        affectation.date_fin = date_fin
        return await self.repository.update(affectation)


class ListAeronefs:
    def __init__(self, repository: AeronefRepository):
        self.repository = repository

    async def execute(self, actif: bool | None = True) -> list[Aeronef]:
        return await self.repository.list_all(actif=actif)


class GetAeronef:
    def __init__(self, repository: AeronefRepository):
        self.repository = repository

    async def execute(self, aeronef_id: uuid.UUID) -> Aeronef | None:
        return await self.repository.get_by_id(aeronef_id)


class CreateAeronef:
    """Enregistre un appareil au parc, sans équipe (#621)."""

    def __init__(self, repository: AeronefRepository):
        self.repository = repository

    async def execute(self, immatriculation: str, societe: str, volume_cuve_l: float) -> Aeronef:
        maintenant = datetime.now(timezone.utc)
        return await self.repository.create(
            Aeronef(
                id=uuid.uuid4(),
                immatriculation=immatriculation,
                societe=societe,
                volume_cuve_l=volume_cuve_l,
                actif=True,
                created_at=maintenant,
                updated_at=maintenant,
            )
        )


class UpdateAeronef:
    """Mise à jour partielle, `actif` compris. Pas de suppression : `actif=False` est la
    seule sortie."""

    def __init__(self, repository: AeronefRepository):
        self.repository = repository

    async def execute(
        self,
        aeronef_id: uuid.UUID,
        immatriculation: str | None = None,
        societe: str | None = None,
        volume_cuve_l: float | None = None,
        actif: bool | None = None,
    ) -> Aeronef:
        aeronef = await self.repository.get_by_id(aeronef_id)
        if aeronef is None:
            raise AeronefIntrouvableError(str(aeronef_id))

        if immatriculation is not None:
            aeronef.immatriculation = immatriculation
        if societe is not None:
            aeronef.societe = societe
        if volume_cuve_l is not None:
            aeronef.volume_cuve_l = volume_cuve_l
        if actif is not None:
            aeronef.actif = actif

        aeronef.updated_at = datetime.now(timezone.utc)
        return await self.repository.update(aeronef)


class ListPesticides:
    def __init__(self, repository: PesticideRepository):
        self.repository = repository

    async def execute(self, actif: bool | None = True) -> list[Pesticide]:
        return await self.repository.list_all(actif=actif)


class GetPesticide:
    def __init__(self, repository: PesticideRepository):
        self.repository = repository

    async def execute(self, pesticide_id: uuid.UUID) -> Pesticide | None:
        return await self.repository.get_by_id(pesticide_id)


class CreatePesticide:
    def __init__(self, repository: PesticideRepository):
        self.repository = repository

    async def execute(
        self,
        code: str,
        nom: str,
        matiere_active: str | None = None,
        dose_reference: str | None = None,
        type_produit: str | None = None,
    ) -> Pesticide:
        if await self.repository.code_pris_par_un_autre(code):
            raise CodeReferentielDejaPrisError(code)

        maintenant = datetime.now(timezone.utc)
        return await self.repository.create(
            Pesticide(
                code=code,
                nom=nom,
                matiere_active=matiere_active,
                dose_reference=dose_reference,
                type_produit=type_produit,
                actif=True,
                created_at=maintenant,
                updated_at=maintenant,
            )
        )


class UpdatePesticide:
    """Mise a update partielle, `actif` compris. Pas de suppression : `actif=False` est
    la seule sortie, le pull hors-ligne ne transportant que des upserts."""

    def __init__(self, repository: PesticideRepository):
        self.repository = repository

    async def execute(
        self,
        pesticide_id: uuid.UUID,
        code: str | None = None,
        nom: str | None = None,
        matiere_active: str | None = None,
        dose_reference: str | None = None,
        type_produit: str | None = None,
        actif: bool | None = None,
    ) -> Pesticide | None:
        pesticide = await self.repository.get_by_id(pesticide_id)
        if pesticide is None:
            return None

        if code is not None and code != pesticide.code:
            if await self.repository.code_pris_par_un_autre(code, exclude_id=pesticide_id):
                raise CodeReferentielDejaPrisError(code)
            pesticide.code = code

        if nom is not None:
            pesticide.nom = nom
        if matiere_active is not None:
            pesticide.matiere_active = matiere_active
        if dose_reference is not None:
            pesticide.dose_reference = dose_reference
        if type_produit is not None:
            pesticide.type_produit = type_produit
        if actif is not None:
            pesticide.actif = actif

        # Sans `updated_at` rehausse, le pull incremental sauterait la modification.
        pesticide.updated_at = datetime.now(timezone.utc)
        return await self.repository.update(pesticide)


@dataclass
class ReferentielSinceCursors:
    zones_anti_acridiennes: datetime | None = None
    postes_acridiens: datetime | None = None
    stations_fixes: datetime | None = None
    utilisateurs_equipe: datetime | None = None
    pesticides: datetime | None = None
    cultures: datetime | None = None
    codes_stades: datetime | None = None
    campagnes: datetime | None = None
    lieux_aeriens: datetime | None = None


@dataclass
class ReferentielPullResult:
    zones_anti_acridiennes: list[ZoneAntiAcridien]
    postes_acridiens: list[PosteAcridien]
    stations_fixes: list[StationFixe]
    utilisateurs_equipe: list[UtilisateurEquipe]
    pesticides: list[Pesticide]
    cultures: list[Culture]
    codes_stades: list[CodeStade]
    campagnes: list[Campagne]
    lieux_aeriens: list[LieuAerien]
    server_time: datetime


class PullReferentiel:
    def __init__(
        self,
        zone_repository: ZoneAntiAcridienRepository,
        poste_repository: PosteAcridienRepository,
        station_repository: StationFixeRepository,
        equipe_repository: UtilisateurEquipeRepository,
        pesticide_repository: PesticideRepository,
        culture_repository: CultureRepository,
        code_stade_repository: CodeStadeRepository,
        campagne_repository: CampagneRepository,
        lieu_aerien_repository: LieuAerienRepository,
    ):
        self.zone_repository = zone_repository
        self.poste_repository = poste_repository
        self.station_repository = station_repository
        self.equipe_repository = equipe_repository
        self.pesticide_repository = pesticide_repository
        self.culture_repository = culture_repository
        self.code_stade_repository = code_stade_repository
        self.campagne_repository = campagne_repository
        self.lieu_aerien_repository = lieu_aerien_repository

    async def execute(self, cursors: ReferentielSinceCursors) -> ReferentielPullResult:
        # Capturé avant les requêtes : une entité modifiée pendant leur exécution doit
        # rester au-dessus de ce curseur pour être reprise au pull suivant, pas sautée.
        server_time = datetime.now(timezone.utc)
        return ReferentielPullResult(
            zones_anti_acridiennes=await self.zone_repository.list_since(
                cursors.zones_anti_acridiennes
            ),
            postes_acridiens=await self.poste_repository.list_since(cursors.postes_acridiens),
            stations_fixes=await self.station_repository.list_since(cursors.stations_fixes),
            utilisateurs_equipe=await self.equipe_repository.list_since(
                cursors.utilisateurs_equipe
            ),
            pesticides=await self.pesticide_repository.list_since(cursors.pesticides),
            cultures=await self.culture_repository.list_since(cursors.cultures),
            codes_stades=await self.code_stade_repository.list_since(cursors.codes_stades),
            campagnes=await self.campagne_repository.list_since(cursors.campagnes),
            lieux_aeriens=await self.lieu_aerien_repository.list_since(cursors.lieux_aeriens),
            server_time=server_time,
        )


async def _exiger_site_principal(
    repository: SiteAerienneRepository, site_id: uuid.UUID
) -> SiteAerienne:
    """Le stock de pesticides est rattaché au site aérien principal (AC #606) : un
    mouvement visant un site secondaire/stand (`parent_site_id` non nul) est refusé."""
    site = await repository.get_by_id(site_id)
    if site is None:
        raise SiteAerienneIntrouvableError(str(site_id))
    if site.parent_site_id is not None:
        raise SiteNonPrincipalError(str(site_id))
    return site


class CreateMouvementPesticide:
    """Enregistre un approvisionnement, un transfert ou une consommation de
    pesticide — le solde s'en déduit par agrégation (`ConsulterSoldePesticide`),
    jamais stocké (#606)."""

    def __init__(
        self,
        repository: MouvementPesticideRepository,
        site_repository: SiteAerienneRepository,
        pesticide_repository: PesticideRepository,
    ):
        self.repository = repository
        self.site_repository = site_repository
        self.pesticide_repository = pesticide_repository

    async def execute(
        self,
        type: str,
        pesticide_id: uuid.UUID,
        site_id: uuid.UUID,
        quantite: float,
        unite: str,
        site_destination_id: uuid.UUID | None = None,
        date_mouvement: date | None = None,
    ) -> MouvementPesticide:
        est_transfert = type == "transfert"
        if est_transfert and site_destination_id is None:
            raise SiteDestinationIncoherentError("site_destination_id est requis pour un transfert")
        if not est_transfert and site_destination_id is not None:
            raise SiteDestinationIncoherentError(
                "site_destination_id ne doit être renseigné que pour un transfert"
            )

        await _exiger_site_principal(self.site_repository, site_id)
        if est_transfert:
            await _exiger_site_principal(self.site_repository, site_destination_id)

        if await self.pesticide_repository.get_by_id(pesticide_id) is None:
            raise PesticideIntrouvableError(str(pesticide_id))

        maintenant = datetime.now(timezone.utc)
        return await self.repository.create(
            MouvementPesticide(
                type=type,
                pesticide_id=pesticide_id,
                site_id=site_id,
                site_destination_id=site_destination_id,
                quantite=quantite,
                unite=unite,
                date_mouvement=date_mouvement or maintenant.date(),
                created_at=maintenant,
            )
        )


class ConsulterSoldePesticide:
    """Solde par (site, pesticide, unité), calculé à la volée à partir des
    mouvements — pas de colonne dénormalisée (décision actée, #606)."""

    def __init__(self, repository: MouvementPesticideRepository):
        self.repository = repository

    async def execute(
        self,
        site_id: uuid.UUID | None = None,
        pesticide_id: uuid.UUID | None = None,
    ) -> list[SoldePesticide]:
        return await self.repository.solde(site_id=site_id, pesticide_id=pesticide_id)
