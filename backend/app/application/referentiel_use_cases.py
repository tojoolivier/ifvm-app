import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from app.domain.campagne import Campagne
from app.domain.referentiel import (
    CodeStade,
    Culture,
    Pesticide,
    PosteAcridien,
    StationFixe,
    UtilisateurEquipe,
    ZoneAntiAcridien,
)
from app.domain.repositories import (
    CampagneRepository,
    CodeStadeRepository,
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

    async def execute(self) -> list[PosteAcridien]:
        return await self.repository.list_all()


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
