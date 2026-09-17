import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class CampagneCreate(BaseModel):
    name: str
    start_date: date
    end_date: date | None = None


class CampagneUpdate(BaseModel):
    """Mise à jour partielle. Aucun champ de suppression : `actif=False` désactive
    (ADR-010, #137 — même politique que les autres référentiels)."""

    name: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    actif: bool | None = None


class CampagneRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    start_date: date
    end_date: date | None
    actif: bool
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
