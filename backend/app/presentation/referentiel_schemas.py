import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class PosteAcridienRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    nom: str
    region: str | None
    created_at: datetime


class StationFixeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    nom: str
    pa_id: uuid.UUID
    pa_code: str
    pa_nom: str
    latitude: float
    longitude: float
    altitude: float | None
    actif: bool
    created_at: datetime
