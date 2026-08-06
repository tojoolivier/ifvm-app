from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class RotationAerienneCreate(BaseModel):
    numero_cuve: str = Field(..., max_length=50)
    produit_id: UUID
    quantite_l: Decimal = Field(..., gt=0)
    temperature_debut_c: Decimal
    temperature_fin_c: Decimal
    vent_debut_ms: Decimal
    vent_fin_ms: Decimal


class RotationAerienneResponse(BaseModel):
    id: UUID
    numero: int
    numero_cuve: str
    produit_id: UUID
    quantite_l: Decimal
    temperature_debut_c: Decimal
    temperature_fin_c: Decimal
    vent_debut_ms: Decimal
    vent_fin_ms: Decimal
