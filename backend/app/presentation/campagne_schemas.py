import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class CampagneCreate(BaseModel):
    name: str
    start_date: date
    end_date: date | None = None


class CampagneUpdate(BaseModel):
    name: str | None = None
    start_date: date | None = None
    end_date: date | None = None


class CampagneRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    start_date: date
    end_date: date | None
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
