import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.crt_model import CRTMaterielModel, CRTModel, CRTPersonnelModel


class CRTRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, data: Dict[str, Any]) -> CRTModel:
        """Créer un nouveau CRT"""
        crt = CRTModel(**data)
        self.session.add(crt)
        await self.session.flush()
        return crt

    async def get_by_id(self, crt_id: uuid.UUID) -> Optional[CRTModel]:
        """Récupérer un CRT par son ID"""
        stmt = select(CRTModel).where(CRTModel.id == crt_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_prospection(self, prospection_id: uuid.UUID) -> Optional[CRTModel]:
        """Récupérer le CRT associé à une prospection"""
        stmt = select(CRTModel).where(CRTModel.prospection_id == prospection_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all(
        self, limit: int = 100, offset: int = 0, statut: Optional[str] = None
    ) -> List[CRTModel]:
        """Récupérer tous les CRT avec filtres"""
        stmt = select(CRTModel)
        if statut:
            stmt = stmt.where(CRTModel.statut == statut)
        stmt = stmt.offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def update(self, crt_id: uuid.UUID, data: Dict[str, Any]) -> Optional[CRTModel]:
        """Mettre à jour un CRT"""
        crt = await self.get_by_id(crt_id)
        if not crt:
            return None
        for key, value in data.items():
            if hasattr(crt, key) and value is not None:
                setattr(crt, key, value)
        await self.session.flush()
        return crt

    async def delete(self, crt_id: uuid.UUID) -> bool:
        """Supprimer un CRT"""
        crt = await self.get_by_id(crt_id)
        if not crt:
            return False
        await self.session.delete(crt)
        await self.session.flush()
        return True

    async def add_personnel(self, crt_id: uuid.UUID, data: Dict[str, Any]) -> CRTPersonnelModel:
        """Ajouter du personnel à un CRT"""
        personnel = CRTPersonnelModel(crt_id=crt_id, **data)
        self.session.add(personnel)
        await self.session.flush()
        return personnel

    async def add_materiel(self, crt_id: uuid.UUID, data: Dict[str, Any]) -> CRTMaterielModel:
        """Ajouter du matériel à un CRT"""
        materiel = CRTMaterielModel(crt_id=crt_id, **data)
        self.session.add(materiel)
        await self.session.flush()
        return materiel
