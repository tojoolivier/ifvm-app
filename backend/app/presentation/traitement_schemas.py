import uuid
from datetime import date, datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_serializer

NON_RENSEIGNE = "non renseigné"


class ModeTraitement(str, Enum):
    TOTAL = "TOTAL"
    BARRIERE = "BARRIERE"
    IRREGULIER = "IRREGULIER"


class EmpoisonnementType(str, Enum):
    AGENT = "AGENT"
    POPULATION = "POPULATION"


class EmpoisonnementMode(str, Enum):
    INGESTION = "INGESTION"
    INHALATION = "INHALATION"
    CONTACT = "CONTACT"
    AUTRE = "AUTRE"


class TraitementAerienCreate(BaseModel):
    pilote: str = Field(..., min_length=1, max_length=255)
    mecanicien: str = Field(..., min_length=1, max_length=255)
    chef_de_base_id: uuid.UUID
    consultant_international: str | None = Field(None, max_length=255)


class TraitementCreate(BaseModel):
    prospection_id: uuid.UUID
    numero_fiche: str | None = Field(None, max_length=50)
    mode_traitement: ModeTraitement | None = None
    date_traitement: date
    date_validation: date
    localite: str = Field(..., min_length=1, max_length=255)
    region: str | None = Field(None, max_length=100)
    district: str | None = Field(None, max_length=100)
    commune: str | None = Field(None, max_length=100)
    latitude: float | None = None
    longitude: float | None = None
    altitude: float | None = None
    kit_combinaison: bool = False
    kit_gants: bool = False
    kit_lunettes: bool = False
    kit_masques: bool = False
    kit_boite: bool = False
    zones_exposees: dict[str, Any] | None = None
    hauteur_strate_herbeuse_m: float | None = Field(None, ge=0)
    hauteur_strate_arboree_m: float | None = Field(None, ge=0)
    recouvrement_percent: int | None = Field(None, ge=0, le=100)
    empoisonnement: bool = False
    empoisonnement_type: EmpoisonnementType | None = None
    empoisonnement_mode: EmpoisonnementMode | None = None
    empoisonnement_autre: str | None = None
    evaluation_risque: dict[str, Any] | None = None
    comportement_anormal: bool = False
    comportement_non_cibles: dict[str, Any] | None = None
    mortalite: bool = False
    mortalite_familles: dict[str, Any] | None = None

    aerien: TraitementAerienCreate


class CibleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    espece: str | None
    petites_larves: str | None
    grandes_larves: str | None
    vols_clairs_essaims: str | None
    repartition_population: str | None
    surface_infestee_ha: float | None

    @field_serializer(
        "espece",
        "petites_larves",
        "grandes_larves",
        "vols_clairs_essaims",
        "repartition_population",
        "surface_infestee_ha",
    )
    def _remplacer_absent(self, valeur: str | float | None) -> str | float:
        return valeur if valeur is not None else NON_RENSEIGNE


class RotationCreate(BaseModel):
    numero_cuve: str = Field(..., min_length=1, max_length=50)
    produit_id: uuid.UUID
    quantite_l: float = Field(..., gt=0)
    temperature_debut_c: float
    temperature_fin_c: float
    vent_debut_ms: float = Field(..., ge=0)
    vent_fin_ms: float = Field(..., ge=0)


class RotationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    numero: int
    numero_cuve: str
    produit_id: uuid.UUID
    quantite_l: float
    temperature_debut_c: float
    temperature_fin_c: float
    vent_debut_ms: float
    vent_fin_ms: float


class TraitementAerienRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    pilote: str
    mecanicien: str
    chef_de_base_id: uuid.UUID
    consultant_international: str | None
    nb_rotations: int
    total_pesticide_l: float | None
    rotations: list[RotationRead] = []


class TraitementRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    prospection_id: uuid.UUID
    numero_fiche: str
    type_traitement: str
    mode_traitement: str | None
    date_traitement: date
    date_validation: date
    localite: str
    region: str | None
    district: str | None
    commune: str | None
    latitude: float | None
    longitude: float | None
    altitude: float | None
    kit_combinaison: bool
    kit_gants: bool
    kit_lunettes: bool
    kit_masques: bool
    kit_boite: bool
    zones_exposees: dict[str, Any] | None
    hauteur_strate_herbeuse_m: float | None
    hauteur_strate_arboree_m: float | None
    recouvrement_percent: int | None
    empoisonnement: bool
    empoisonnement_type: str | None
    empoisonnement_mode: str | None
    empoisonnement_autre: str | None
    evaluation_risque: dict[str, Any] | None
    comportement_anormal: bool
    comportement_non_cibles: dict[str, Any] | None
    mortalite: bool
    mortalite_familles: dict[str, Any] | None
    statut: str
    statut_sync: str
    created_at: datetime
    updated_at: datetime

    cible: CibleRead | None
    aerien: TraitementAerienRead | None
