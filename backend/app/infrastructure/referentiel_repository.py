import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.referentiel import PosteAcridien, StationFixe, ZoneAntiAcridien
from app.domain.repositories import (
    PosteAcridienRepository,
    StationFixeRepository,
    ZoneAntiAcridienRepository,
)
from app.infrastructure.referentiel_model import (
    CommuneModel,
    DistrictModel,
    PosteAcridienModel,
    RegionModel,
    StationFixeModel,
    ZoneAntiAcridienModel,
)


class ZoneAntiAcridienRepositoryImpl(ZoneAntiAcridienRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_all(self) -> list[ZoneAntiAcridien]:
        result = await self.session.execute(
            select(ZoneAntiAcridienModel).order_by(ZoneAntiAcridienModel.code)
        )
        return [self._to_domain(m) for m in result.scalars().all()]

    async def exists(self, za_id: uuid.UUID) -> bool:
        result = await self.session.execute(
            select(ZoneAntiAcridienModel.id).where(ZoneAntiAcridienModel.id == za_id)
        )
        return result.first() is not None

    async def list_since(self, since: datetime | None) -> list[ZoneAntiAcridien]:
        stmt = select(ZoneAntiAcridienModel).order_by(ZoneAntiAcridienModel.code)
        if since is not None:
            stmt = stmt.where(ZoneAntiAcridienModel.updated_at > since)
        result = await self.session.execute(stmt)
        return [self._to_domain(m) for m in result.scalars().all()]

    def _to_domain(self, model: ZoneAntiAcridienModel) -> ZoneAntiAcridien:
        return ZoneAntiAcridien(
            id=model.id,
            code=model.code,
            nom=model.nom,
            actif=model.actif,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )


class PosteAcridienRepositoryImpl(PosteAcridienRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_all(self, actif: bool | None = True) -> list[PosteAcridien]:
        stmt = self._select_with_zone().order_by(PosteAcridienModel.code)
        if actif is not None:
            stmt = stmt.where(PosteAcridienModel.actif == actif)
        result = await self.session.execute(stmt)
        return [self._to_domain(row) for row in result.all()]

    async def get_by_id(self, pa_id: uuid.UUID) -> PosteAcridien | None:
        result = await self.session.execute(
            self._select_with_zone().where(PosteAcridienModel.id == pa_id)
        )
        row = result.first()
        if row is None:
            return None
        return self._to_domain(row)

    async def code_pris_par_un_autre(self, code: str, exclude_id: uuid.UUID | None = None) -> bool:
        stmt = select(PosteAcridienModel.id).where(PosteAcridienModel.code == code)
        if exclude_id is not None:
            stmt = stmt.where(PosteAcridienModel.id != exclude_id)
        result = await self.session.execute(stmt)
        return result.first() is not None

    async def create(self, poste: PosteAcridien) -> PosteAcridien:
        model = PosteAcridienModel(
            id=poste.id,
            code=poste.code,
            nom=poste.nom,
            za_id=poste.za_id,
            actif=poste.actif,
            created_at=poste.created_at,
            updated_at=poste.updated_at,
        )
        self.session.add(model)
        await self.session.commit()
        return await self._relire(model.id)

    async def update(self, poste: PosteAcridien) -> PosteAcridien:
        result = await self.session.execute(
            select(PosteAcridienModel).where(PosteAcridienModel.id == poste.id)
        )
        model = result.scalar_one()
        model.code = poste.code
        model.nom = poste.nom
        model.za_id = poste.za_id
        model.actif = poste.actif
        model.updated_at = poste.updated_at
        await self.session.commit()
        return await self._relire(model.id)

    async def list_since(self, since: datetime | None) -> list[PosteAcridien]:
        stmt = self._select_with_zone().order_by(PosteAcridienModel.code)
        if since is not None:
            stmt = stmt.where(PosteAcridienModel.updated_at > since)
        result = await self.session.execute(stmt)
        return [self._to_domain(row) for row in result.all()]

    async def _relire(self, pa_id: uuid.UUID) -> PosteAcridien:
        """Une écriture ne renvoie jamais l'entité écrite telle quelle : `za_code`,
        `za_nom` et `nb_stations` sont des jointures/agrégats, absents du modèle ORM."""
        poste = await self.get_by_id(pa_id)
        if poste is None:  # pragma: no cover — on vient de l'écrire dans cette session
            raise RuntimeError(f"Poste acridien {pa_id} introuvable juste après écriture")
        return poste

    def _select_with_zone(self):
        # Nombre de stations *actives* : la colonne « Stations » de l'écran et le
        # garde-fou de désactivation doivent compter la même chose.
        nb_stations = (
            select(func.count(StationFixeModel.id))
            .where(StationFixeModel.pa_id == PosteAcridienModel.id)
            .where(StationFixeModel.actif.is_(True))
            .correlate(PosteAcridienModel)
            .scalar_subquery()
        )
        return select(
            PosteAcridienModel,
            ZoneAntiAcridienModel.code.label("za_code"),
            ZoneAntiAcridienModel.nom.label("za_nom"),
            nb_stations.label("nb_stations"),
        ).join(ZoneAntiAcridienModel, PosteAcridienModel.za_id == ZoneAntiAcridienModel.id)

    def _to_domain(self, row) -> PosteAcridien:
        model = row[0]
        return PosteAcridien(
            id=model.id,
            code=model.code,
            nom=model.nom,
            za_id=model.za_id,
            za_code=row.za_code,
            za_nom=row.za_nom,
            actif=model.actif,
            nb_stations=row.nb_stations,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )


class StationFixeRepositoryImpl(StationFixeRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    def _select_with_geo(self):
        return (
            select(
                StationFixeModel,
                PosteAcridienModel.code.label("pa_code"),
                PosteAcridienModel.nom.label("pa_nom"),
                CommuneModel.nom.label("commune_nom"),
                DistrictModel.nom.label("district_nom"),
                RegionModel.nom.label("region_nom"),
            )
            .join(PosteAcridienModel, StationFixeModel.pa_id == PosteAcridienModel.id)
            .join(CommuneModel, StationFixeModel.commune_id == CommuneModel.id)
            .join(DistrictModel, CommuneModel.district_id == DistrictModel.id)
            .join(RegionModel, DistrictModel.region_id == RegionModel.id)
        )

    def _to_domain(self, row) -> StationFixe:
        model = row[0]
        return StationFixe(
            id=model.id,
            code=model.code,
            nom=model.nom,
            pa_id=model.pa_id,
            pa_code=row.pa_code,
            pa_nom=row.pa_nom,
            latitude=float(model.latitude),
            longitude=float(model.longitude),
            altitude=float(model.altitude) if model.altitude is not None else None,
            commune=row.commune_nom,
            district=row.district_nom,
            region=row.region_nom,
            actif=model.actif,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    async def list_by_filters(
        self,
        pa_id: uuid.UUID | None = None,
        q: str | None = None,
        actif: bool | None = True,
    ) -> list[StationFixe]:
        stmt = self._select_with_geo()

        # `actif=None` = pas de filtre : l'administration a besoin des deux états.
        if actif is not None:
            stmt = stmt.where(StationFixeModel.actif == actif)

        if pa_id is not None:
            stmt = stmt.where(StationFixeModel.pa_id == pa_id)

        if q is not None:
            like_pattern = f"%{q}%"
            stmt = stmt.where(
                StationFixeModel.code.ilike(like_pattern) | StationFixeModel.nom.ilike(like_pattern)
            )

        stmt = stmt.order_by(StationFixeModel.code)
        result = await self.session.execute(stmt)

        return [self._to_domain(row) for row in result.all()]

    async def get_by_id(self, station_id: uuid.UUID) -> StationFixe | None:
        result = await self.session.execute(
            self._select_with_geo().where(StationFixeModel.id == station_id)
        )
        row = result.first()
        if row is None:
            return None

        return self._to_domain(row)

    async def exists(self, station_id: uuid.UUID) -> bool:
        result = await self.session.execute(
            select(StationFixeModel.id).where(StationFixeModel.id == station_id)
        )
        return result.scalar_one_or_none() is not None

    async def list_since(self, since: datetime | None) -> list[StationFixe]:
        stmt = self._select_with_geo().order_by(StationFixeModel.code)
        if since is not None:
            stmt = stmt.where(StationFixeModel.updated_at > since)

        result = await self.session.execute(stmt)
        return [self._to_domain(row) for row in result.all()]
