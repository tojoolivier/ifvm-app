import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class PosteAcridienCreate(BaseModel):
    code: str
    nom: str
    region: str
    district: str | None = None
    commune: str | None = None


class PosteAcridienRead(PosteAcridienCreate):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    created_at: datetime


class StationCreate(BaseModel):
    pa_id: uuid.UUID
    code: str
    nom: str | None = None
    type: str
    latitude: float
    longitude: float
    altitude_m: int | None = None
    biotope: str | None = None


class StationRead(StationCreate):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    created_at: datetime


class StationMeteoCreate(BaseModel):
    pa_id: uuid.UUID
    code: str
    nom: str | None = None
    latitude: float
    longitude: float
    altitude_m: int | None = None


class StationMeteoRead(StationMeteoCreate):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
