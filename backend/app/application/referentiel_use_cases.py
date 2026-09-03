import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from app.domain.campagne import Campagne
from app.domain.referentiel import (
    CodeReferentielDejaPrisError,
    CodeStade,
    Commune,
    CommuneInconnueError,
    Culture,
    GrilleDejaOccupeeError,
    Pesticide,
    PosteAcridien,
    PosteAcridienAvecStationsActivesError,
    PosteAcridienInactifError,
    PosteAcridienIntrouvableError,
    StadeInconnuError,
    StationFixe,
    UtilisateurEquipe,
    ZoneAntiAcridien,
    ZoneAntiAcridienIntrouvableError,
)
from app.domain.repositories import (
    CampagneRepository,
    CodeStadeRepository,
    CommuneRepository,
    CultureRepository,
    PesticideRepository,
    PosteAcridienRepository,
    StationFixeRepository,
    UtilisateurEquipeRepository,
    ZoneAntiAcridienRepository,
)


class ListZonesAntiAcridiennes:
    def __init__(self, repository: ZoneAntiAcridienRepository):
        self.repository = repository

    async def execute(self) -> list[ZoneAntiAcridien]:
        return await self.repository.list_all()


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
    ):
        self.repository = repository
        self.zone_repository = zone_repository

    async def execute(self, code: str, nom: str, za_id: uuid.UUID) -> PosteAcridien:
        if not await self.zone_repository.exists(za_id):
            raise ZoneAntiAcridienIntrouvableError(str(za_id))
        if await self.repository.code_pris_par_un_autre(code):
            raise CodeReferentielDejaPrisError(code)

        maintenant = datetime.now(timezone.utc)
        poste = PosteAcridien(
            code=code,
            nom=nom,
            za_id=za_id,
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
    ):
        self.repository = repository
        self.zone_repository = zone_repository

    async def execute(
        self,
        pa_id: uuid.UUID,
        code: str | None = None,
        nom: str | None = None,
        za_id: uuid.UUID | None = None,
        actif: bool | None = None,
    ) -> PosteAcridien | None:
        poste = await self.repository.get_by_id(pa_id)
        if poste is None:
            return None

        if za_id is not None and za_id != poste.za_id:
            if not await self.zone_repository.exists(za_id):
                raise ZoneAntiAcridienIntrouvableError(str(za_id))
            poste.za_id = za_id

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
    ):
        self.zone_repository = zone_repository
        self.poste_repository = poste_repository
        self.station_repository = station_repository
        self.equipe_repository = equipe_repository
        self.pesticide_repository = pesticide_repository
        self.culture_repository = culture_repository
        self.code_stade_repository = code_stade_repository
        self.campagne_repository = campagne_repository

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
            server_time=server_time,
        )
