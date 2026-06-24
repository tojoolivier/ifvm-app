import uuid
from abc import ABC, abstractmethod

from app.domain.campagne import Campagne


class CampagneRepository(ABC):
    @abstractmethod
    async def get_by_id(self, campagne_id: uuid.UUID) -> Campagne | None:
        pass

    @abstractmethod
    async def list_all(self) -> list[Campagne]:
        pass

    @abstractmethod
    async def create(self, campagne: Campagne) -> Campagne:
        pass

    @abstractmethod
    async def update(self, campagne: Campagne) -> Campagne:
        pass

    @abstractmethod
    async def delete(self, campagne_id: uuid.UUID) -> bool:
        pass
