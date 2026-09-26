import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.campagne import Campagne
from app.domain.repositories import CampagneRepository
from app.infrastructure.campagne_model import CampagneModel
from app.infrastructure.soft_delete import INCLURE_SUPPRIMES


class CampagneRepositoryImpl(CampagneRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, campagne_id: uuid.UUID) -> Campagne | None:
        result = await self.session.execute(
            select(CampagneModel).where(CampagneModel.id == campagne_id)
        )
        model = result.scalar_one_or_none()
        if model is None:
            return None
        return self._to_domain(model)

    async def list_all(self) -> list[Campagne]:
        result = await self.session.execute(
            select(CampagneModel).order_by(CampagneModel.start_date.desc())
        )
        models = result.scalars().all()
        return [self._to_domain(m) for m in models]

    async def create(self, campagne: Campagne) -> Campagne:
        model = CampagneModel(
            id=campagne.id,
            name=campagne.name,
            start_date=campagne.start_date,
            end_date=campagne.end_date,
            actif=campagne.actif,
            created_by=campagne.created_by,
            created_at=campagne.created_at,
            updated_at=campagne.updated_at,
        )
        self.session.add(model)
        await self.session.commit()
        await self.session.refresh(model)
        return self._to_domain(model)

    async def update(self, campagne: Campagne) -> Campagne:
        result = await self.session.execute(
            select(CampagneModel).where(CampagneModel.id == campagne.id)
        )
        model = result.scalar_one()
        model.name = campagne.name
        model.start_date = campagne.start_date
        model.end_date = campagne.end_date
        model.actif = campagne.actif
        model.updated_at = campagne.updated_at
        await self.session.commit()
        await self.session.refresh(model)
        return self._to_domain(model)

    async def list_since(self, since: datetime | None) -> list[Campagne]:
        stmt = select(CampagneModel).order_by(CampagneModel.start_date.desc())
        if since is not None:
            stmt = stmt.where(CampagneModel.updated_at > since)
        result = await self.session.execute(stmt, execution_options=INCLURE_SUPPRIMES)
        return [self._to_domain(m) for m in result.scalars().all()]

    def _to_domain(self, model: CampagneModel) -> Campagne:
        return Campagne(
            id=model.id,
            name=model.name,
            start_date=model.start_date,
            end_date=model.end_date,
            actif=model.actif,
            created_by=model.created_by,
            created_at=model.created_at,
            updated_at=model.updated_at,
            deleted_at=model.deleted_at,
        )
