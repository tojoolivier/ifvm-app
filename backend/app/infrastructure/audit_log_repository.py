import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.prospection import AuditLog
from app.domain.repositories import AuditLogRepository
from app.infrastructure.prospection_model import AuditLogModel


class AuditLogRepositoryImpl(AuditLogRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, entry: AuditLog) -> AuditLog:
        model = AuditLogModel(
            id=entry.id,
            fiche_type=entry.fiche_type,
            fiche_id=entry.fiche_id,
            auteur_id=entry.auteur_id,
            action=entry.action,
            details=entry.details,
            created_at=entry.created_at,
        )
        self.session.add(model)
        await self.session.commit()
        await self.session.refresh(model)
        return self._to_domain(model)

    async def list_by_fiche(self, fiche_id: uuid.UUID) -> list[AuditLog]:
        result = await self.session.execute(
            select(AuditLogModel)
            .where(AuditLogModel.fiche_id == fiche_id)
            .order_by(AuditLogModel.created_at.asc())
        )
        return [self._to_domain(m) for m in result.scalars().all()]

    def _to_domain(self, model: AuditLogModel) -> AuditLog:
        return AuditLog(
            id=model.id,
            fiche_type=model.fiche_type,
            fiche_id=model.fiche_id,
            auteur_id=model.auteur_id,
            action=model.action,
            details=model.details,
            created_at=model.created_at,
        )
