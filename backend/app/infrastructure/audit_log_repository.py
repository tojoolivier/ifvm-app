import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.prospection import AuditLog
from app.domain.repositories import AuditLogRepository
from app.infrastructure.prospection_model import AuditLogModel, ProspectionModel
from app.models.users import Utilisateur

# Rôles de revue : voient toutes les fiches et toutes les actions (dont la
# création — « nouvelle fiche »). Les autres rôles (prospecteur en pratique)
# ne voient que les transitions de statut sur LEURS propres fiches : un
# prospecteur n'a pas à être notifié des actions des autres agents.
_ROLES_REVUE = frozenset({"admin", "verificateur", "validation_finale"})
_ACTIONS_STATUT = ("verification", "validation", "rejet")


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

    async def list_notifications(
        self, role: str, utilisateur_id: uuid.UUID, limit: int = 50
    ) -> list[dict[str, Any]]:
        stmt = (
            select(
                AuditLogModel.id,
                AuditLogModel.action,
                AuditLogModel.fiche_id,
                AuditLogModel.fiche_type,
                AuditLogModel.details,
                AuditLogModel.created_at,
                ProspectionModel.n_fiche,
                Utilisateur.nom.label("auteur_nom"),
                Utilisateur.prenom.label("auteur_prenom"),
            )
            .join(ProspectionModel, ProspectionModel.id == AuditLogModel.fiche_id)
            .outerjoin(Utilisateur, Utilisateur.id == AuditLogModel.auteur_id)
            .order_by(AuditLogModel.created_at.desc())
            .limit(limit)
        )
        if role not in _ROLES_REVUE:
            stmt = stmt.where(
                ProspectionModel.prospecteur_id == utilisateur_id,
                AuditLogModel.action.in_(_ACTIONS_STATUT),
            )
        result = await self.session.execute(stmt)
        lignes = []
        for row in result.all():
            m = dict(row._mapping)
            prenom = m.pop("auteur_prenom", None)
            nom = m.pop("auteur_nom", None)
            m["auteur_nom"] = f"{prenom} {nom}".strip() if (prenom or nom) else None
            lignes.append(m)
        return lignes

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
