import uuid
from abc import ABC, abstractmethod

from app.domain.campagne import Campagne
from app.domain.prospection import Prospection


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


class ProspectionRepository(ABC):
    @abstractmethod
    async def get_by_id(self, prospection_id: uuid.UUID) -> Prospection | None:
        pass

    @abstractmethod
    async def list_by_filters(
        self,
        type_prospection: str | None = None,
        statut: str | None = None,
        campagne_id: uuid.UUID | None = None,
        station_id: uuid.UUID | None = None,
        prospecteur_id: uuid.UUID | None = None,
    ) -> list[Prospection]:
        pass

    @abstractmethod
    async def create(self, prospection: Prospection) -> Prospection:
        pass

    @abstractmethod
    async def update(self, prospection: Prospection) -> Prospection:
        pass

    @abstractmethod
    async def delete(self, prospection_id: uuid.UUID) -> bool:
        pass
