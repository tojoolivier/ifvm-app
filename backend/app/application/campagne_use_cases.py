import uuid
from datetime import date, datetime

from app.domain.campagne import Campagne
from app.domain.repositories import CampagneRepository


class CreateCampagne:
    def __init__(self, repository: CampagneRepository):
        self.repository = repository

    async def execute(
        self,
        name: str,
        start_date: date,
        end_date: date | None,
        created_by: uuid.UUID,
    ) -> Campagne:
        campagne = Campagne(
            name=name,
            start_date=start_date,
            end_date=end_date,
            created_by=created_by,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        return await self.repository.create(campagne)


class ListCampagnes:
    def __init__(self, repository: CampagneRepository):
        self.repository = repository

    async def execute(self) -> list[Campagne]:
        return await self.repository.list_all()


class GetCampagne:
    def __init__(self, repository: CampagneRepository):
        self.repository = repository

    async def execute(self, campagne_id: uuid.UUID) -> Campagne | None:
        return await self.repository.get_by_id(campagne_id)


class UpdateCampagne:
    def __init__(self, repository: CampagneRepository):
        self.repository = repository

    async def execute(
        self,
        campagne_id: uuid.UUID,
        name: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> Campagne | None:
        campagne = await self.repository.get_by_id(campagne_id)
        if campagne is None:
            return None

        if name is not None:
            campagne.name = name
        if start_date is not None:
            campagne.start_date = start_date
        if end_date is not None:
            campagne.end_date = end_date
        campagne.updated_at = datetime.utcnow()

        return await self.repository.update(campagne)


class DeleteCampagne:
    def __init__(self, repository: CampagneRepository):
        self.repository = repository

    async def execute(self, campagne_id: uuid.UUID) -> bool:
        return await self.repository.delete(campagne_id)
