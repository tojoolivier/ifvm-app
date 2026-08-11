import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.repositories import UtilisateurRepository
from app.domain.traitement import UtilisateurRef
from app.models.users import Utilisateur


class UtilisateurRepositoryImpl(UtilisateurRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, utilisateur_id: uuid.UUID) -> UtilisateurRef | None:
        result = await self.session.execute(
            select(Utilisateur).where(Utilisateur.id == utilisateur_id)
        )
        user = result.scalar_one_or_none()
        if user is None:
            return None
        return UtilisateurRef(id=user.id, prenom=user.prenom, role=user.role)
