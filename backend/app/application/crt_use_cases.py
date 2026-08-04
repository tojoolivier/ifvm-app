import datetime
import uuid
from typing import Any, Dict, Optional

from app.infrastructure.crt_repository import CRTRepository


class CRTUseCases:
    def __init__(self, repository: CRTRepository):
        self.repository = repository

    async def create_crt(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Créer un nouveau CRT"""
        # Vérifier que la prospection existe et est validée
        # Générer le numéro CRT automatiquement
        return await self.repository.create(data)

    async def get_crt(self, crt_id: uuid.UUID) -> Optional[Dict[str, Any]]:
        """Récupérer un CRT"""
        return await self.repository.get_by_id(crt_id)

    async def get_crt_by_prospection(self, prospection_id: uuid.UUID) -> Optional[Dict[str, Any]]:
        """Récupérer le CRT d'une prospection"""
        return await self.repository.get_by_prospection(prospection_id)

    async def update_crt(self, crt_id: uuid.UUID, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Mettre à jour un CRT"""
        return await self.repository.update(crt_id, data)

    async def delete_crt(self, crt_id: uuid.UUID) -> bool:
        """Supprimer un CRT"""
        return await self.repository.delete(crt_id)

    async def validate_crt(
        self, crt_id: uuid.UUID, validated_by: uuid.UUID
    ) -> Optional[Dict[str, Any]]:
        """Valider un CRT"""
        return await self.repository.update(
            crt_id,
            {"statut": "validee", "validated_by": validated_by, "validated_at": datetime.utcnow()},
        )
