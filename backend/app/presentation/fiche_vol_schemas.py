import uuid
from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

TypeVol = Literal["PROSPECTION", "MEP", "APPLICATION", "CONVOYAGE", "DIVERS"]
RoleSignatureVol = Literal["PILOTE", "MECANICIEN", "CHEF_DE_BASE", "CONSULTANT_INTERNATIONAL"]


class VolCreate(BaseModel):
    numero: int = Field(ge=1)
    type_vol: TypeVol
    heure_debut: time
    heure_fin: time
    rotation_id: uuid.UUID | None = None
    prospection_id: uuid.UUID | None = None
    observations: str | None = None


class VolRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    numero: int
    type_vol: str
    heure_debut: time
    heure_fin: time
    rotation_id: uuid.UUID | None = None
    prospection_id: uuid.UUID | None = None
    observations: str | None = None
    # Dérivée de heure_fin - heure_debut, jamais stockée.
    duree_minutes: int


class SignatureVolUpsert(BaseModel):
    role: RoleSignatureVol
    signataire_nom: str = Field(min_length=1, max_length=255)
    # Tracé manuscrit (data URI). Facultatif : la fiche est enregistrable avant signature.
    signature_image: str | None = None


class SignatureVolRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: str
    signataire_nom: str
    signature_image: str | None = None
    horodatage: datetime | None = None


class FicheVolCreate(BaseModel):
    date_vol: date
    compagnie: str = Field(min_length=1, max_length=255)
    immatriculation: str = Field(min_length=1, max_length=20)
    base_code: str = Field(min_length=1, max_length=20)
    base_nom: str = Field(min_length=1, max_length=255)
    base_latitude: float | None = None
    base_longitude: float | None = None
    base_altitude: float | None = None
    stand_nom: str = Field(min_length=1, max_length=255)
    stand_latitude: float | None = None
    stand_longitude: float | None = None
    stand_altitude: float | None = None
    pilote: str = Field(min_length=1, max_length=255)
    mecanicien: str = Field(min_length=1, max_length=255)
    chef_de_base_id: uuid.UUID
    consultant_international: str | None = None
    observations: str | None = None
    vols: list[VolCreate] = Field(default_factory=list)


class FicheVolRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    # [Date]-[Base numérotée]-[Immatriculation], suffixé à partir de la 2e fiche du jour.
    numero: str
    date_vol: date
    compagnie: str
    immatriculation: str
    base_code: str
    base_nom: str
    base_latitude: float | None = None
    base_longitude: float | None = None
    base_altitude: float | None = None
    stand_nom: str
    stand_latitude: float | None = None
    stand_longitude: float | None = None
    stand_altitude: float | None = None
    pilote: str
    mecanicien: str
    chef_de_base_id: uuid.UUID
    consultant_international: str | None = None
    observations: str | None = None
    statut: str
    statut_sync: str
    vols: list[VolRead] = Field(default_factory=list)
    signatures: list[SignatureVolRead] = Field(default_factory=list)
    duree_totale_minutes: int
    created_at: datetime | None = None
    updated_at: datetime | None = None


class CumulsRead(BaseModel):
    jour: int
    semaine: int
    mois: int
    total: int
