import uuid
from datetime import date, datetime
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict


class ZoneAntiAcridienRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    nom: str
    created_at: datetime


class PosteAcridienRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    nom: str
    za_id: uuid.UUID
    za_code: str
    za_nom: str
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
    commune: str
    district: str
    region: str
    actif: bool
    created_at: datetime


class ZoneAntiAcridienSyncRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    nom: str
    actif: bool
    updated_at: datetime


class PosteAcridienSyncRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    nom: str
    za_id: uuid.UUID
    actif: bool
    updated_at: datetime


class StationFixeSyncRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    nom: str
    pa_id: uuid.UUID
    latitude: float
    longitude: float
    altitude: float | None
    commune: str
    district: str
    region: str
    actif: bool
    updated_at: datetime


class UtilisateurEquipeSyncRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    nom: str
    prenom: str
    email: str
    role: str
    pa_id: uuid.UUID | None
    actif: bool
    updated_at: datetime


class PesticideSyncRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    nom: str
    actif: bool
    updated_at: datetime


class CultureSyncRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    nom: str
    actif: bool
    updated_at: datetime


class CodeStadeSyncRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    categorie: str
    # NULL : stade larvaire (non sexé) / applicable aux deux espèces.
    sexe: str | None
    espece: str | None
    libelle: str
    ordre: int
    actif: bool
    updated_at: datetime


class CampagneSyncRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    start_date: date
    end_date: date | None
    updated_at: datetime


T = TypeVar("T")


class EntityPull(BaseModel, Generic[T]):
    upserts: list[T]
    server_time: datetime


class ReferentielPullResponse(BaseModel):
    zones_anti_acridiennes: EntityPull[ZoneAntiAcridienSyncRead]
    postes_acridiens: EntityPull[PosteAcridienSyncRead]
    stations_fixes: EntityPull[StationFixeSyncRead]
    utilisateurs_equipe: EntityPull[UtilisateurEquipeSyncRead]
    pesticides: EntityPull[PesticideSyncRead]
    cultures: EntityPull[CultureSyncRead]
    codes_stades: EntityPull[CodeStadeSyncRead]
    campagnes: EntityPull[CampagneSyncRead]
