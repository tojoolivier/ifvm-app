import uuid
from abc import ABC, abstractmethod
from datetime import datetime

from app.domain.campagne import Campagne
from app.domain.prospection import AuditLog, Prospection
from app.domain.referentiel import (
    CodeStade,
    Culture,
    Pesticide,
    PosteAcridien,
    StationFixe,
    UtilisateurEquipe,
)
from app.domain.traitement import Rotation, Traitement
from app.domain.utilisateur import UtilisateurRef


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


class TraitementRepository(ABC):
    @abstractmethod
    async def get_by_id(self, traitement_id: uuid.UUID) -> Traitement | None:
        pass

    @abstractmethod
    async def list_by_filters(
        self,
        type_traitement: str | None = None,
        prospection_id: uuid.UUID | None = None,
    ) -> list[Traitement]:
        pass

    @abstractmethod
    async def create(self, traitement: Traitement) -> Traitement:
        """Raises NumeroFicheConflitError si numero_fiche existe déjà."""
        pass

    @abstractmethod
    async def add_rotation(
        self,
        traitement_id: uuid.UUID,
        rotation: Rotation,
        nb_rotations: int,
        total_pesticide_l: float | None,
    ) -> Traitement:
        pass

    @abstractmethod
    async def update_rotation(
        self,
        traitement_id: uuid.UUID,
        rotation: Rotation,
        nb_rotations: int,
        total_pesticide_l: float | None,
    ) -> Traitement:
        pass

    @abstractmethod
    async def remove_rotation(
        self,
        traitement_id: uuid.UUID,
        rotation_id: uuid.UUID,
        nb_rotations: int,
        total_pesticide_l: float | None,
    ) -> Traitement:
        pass


class UtilisateurRepository(ABC):
    @abstractmethod
    async def get_by_id(self, utilisateur_id: uuid.UUID) -> UtilisateurRef | None:
        pass


class AuditLogRepository(ABC):
    @abstractmethod
    async def create(self, entry: AuditLog) -> AuditLog:
        pass

    @abstractmethod
    async def list_by_fiche(self, fiche_id: uuid.UUID) -> list[AuditLog]:
        pass


class PosteAcridienRepository(ABC):
    @abstractmethod
    async def list_all(self) -> list[PosteAcridien]:
        pass

    @abstractmethod
    async def get_by_id(self, pa_id: uuid.UUID) -> PosteAcridien | None:
        pass

    @abstractmethod
    async def list_since(self, since: datetime | None) -> list[PosteAcridien]:
        pass


class StationFixeRepository(ABC):
    @abstractmethod
    async def list_by_filters(
        self,
        pa_id: uuid.UUID | None = None,
        q: str | None = None,
        actif: bool = True,
    ) -> list[StationFixe]:
        pass

    @abstractmethod
    async def get_by_id(self, station_id: uuid.UUID) -> StationFixe | None:
        pass

    @abstractmethod
    async def exists(self, station_id: uuid.UUID) -> bool:
        pass

    @abstractmethod
    async def list_since(self, since: datetime | None) -> list[StationFixe]:
        pass


class UtilisateurEquipeRepository(ABC):
    @abstractmethod
    async def list_since(self, since: datetime | None) -> list[UtilisateurEquipe]:
        pass


class PesticideRepository(ABC):
    @abstractmethod
    async def list_since(self, since: datetime | None) -> list[Pesticide]:
        pass


class CultureRepository(ABC):
    @abstractmethod
    async def list_since(self, since: datetime | None) -> list[Culture]:
        pass


class CodeStadeRepository(ABC):
    @abstractmethod
    async def list_since(self, since: datetime | None) -> list[CodeStade]:
        pass
