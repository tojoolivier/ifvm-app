import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.referentiel import PosteAcridien, StationFixe
from app.domain.repositories import PosteAcridienRepository, StationFixeRepository
from app.infrastructure.referentiel_model import PosteAcridienModel, StationFixeModel


class PosteAcridienRepositoryImpl(PosteAcridienRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_all(self) -> list[PosteAcridien]:
        result = await self.session.execute(
            select(PosteAcridienModel).order_by(PosteAcridienModel.code)
        )
        return [self._to_domain(m) for m in result.scalars().all()]

    async def get_by_id(self, pa_id: uuid.UUID) -> PosteAcridien | None:
        result = await self.session.execute(
            select(PosteAcridienModel).where(PosteAcridienModel.id == pa_id)
        )
        model = result.scalar_one_or_none()
        if model is None:
            return None
        return self._to_domain(model)

    async def list_since(self, since: datetime | None) -> list[PosteAcridien]:
        stmt = select(PosteAcridienModel).order_by(PosteAcridienModel.code)
        if since is not None:
            stmt = stmt.where(PosteAcridienModel.updated_at > since)
        result = await self.session.execute(stmt)
        return [self._to_domain(m) for m in result.scalars().all()]

    def _to_domain(self, model: PosteAcridienModel) -> PosteAcridien:
        return PosteAcridien(
            id=model.id,
            code=model.code,
            nom=model.nom,
            region=model.region,
            actif=model.actif,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )


class StationFixeRepositoryImpl(StationFixeRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_by_filters(
        self,
        pa_id: uuid.UUID | None = None,
        q: str | None = None,
        actif: bool | None = True,
    ) -> list[StationFixe]:
        stmt = select(
            StationFixeModel,
            PosteAcridienModel.code.label("pa_code"),
            PosteAcridienModel.nom.label("pa_nom"),
        ).join(PosteAcridienModel, StationFixeModel.pa_id == PosteAcridienModel.id)

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

        return [
            StationFixe(
                id=row[0].id,
                code=row[0].code,
                nom=row[0].nom,
                pa_id=row[0].pa_id,
                pa_code=row.pa_code,
                pa_nom=row.pa_nom,
                latitude=float(row[0].latitude),
                longitude=float(row[0].longitude),
                altitude=float(row[0].altitude) if row[0].altitude is not None else None,
                actif=row[0].actif,
                created_at=row[0].created_at,
                updated_at=row[0].updated_at,
            )
            for row in result.all()
        ]

    async def get_by_id(self, station_id: uuid.UUID) -> StationFixe | None:
        result = await self.session.execute(
            select(
                StationFixeModel,
                PosteAcridienModel.code.label("pa_code"),
                PosteAcridienModel.nom.label("pa_nom"),
            )
            .join(PosteAcridienModel, StationFixeModel.pa_id == PosteAcridienModel.id)
            .where(StationFixeModel.id == station_id)
        )
        row = result.first()
        if row is None:
            return None

        return StationFixe(
            id=row[0].id,
            code=row[0].code,
            nom=row[0].nom,
            pa_id=row[0].pa_id,
            pa_code=row.pa_code,
            pa_nom=row.pa_nom,
            latitude=float(row[0].latitude),
            longitude=float(row[0].longitude),
            altitude=float(row[0].altitude) if row[0].altitude is not None else None,
            actif=row[0].actif,
            created_at=row[0].created_at,
            updated_at=row[0].updated_at,
        )

    async def exists(self, station_id: uuid.UUID) -> bool:
        result = await self.session.execute(
            select(StationFixeModel.id).where(StationFixeModel.id == station_id)
        )
        return result.scalar_one_or_none() is not None

    async def list_since(self, since: datetime | None) -> list[StationFixe]:
        stmt = (
            select(
                StationFixeModel,
                PosteAcridienModel.code.label("pa_code"),
                PosteAcridienModel.nom.label("pa_nom"),
            )
            .join(PosteAcridienModel, StationFixeModel.pa_id == PosteAcridienModel.id)
            .order_by(StationFixeModel.code)
        )
        if since is not None:
            stmt = stmt.where(StationFixeModel.updated_at > since)

        result = await self.session.execute(stmt)
        return [
            StationFixe(
                id=row[0].id,
                code=row[0].code,
                nom=row[0].nom,
                pa_id=row[0].pa_id,
                pa_code=row.pa_code,
                pa_nom=row.pa_nom,
                latitude=float(row[0].latitude),
                longitude=float(row[0].longitude),
                altitude=float(row[0].altitude) if row[0].altitude is not None else None,
                actif=row[0].actif,
                created_at=row[0].created_at,
                updated_at=row[0].updated_at,
            )
            for row in result.all()
        ]
