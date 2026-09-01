import uuid
from datetime import date, datetime, time
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_serializer, model_validator

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


class RoleSignature(str, Enum):
    PILOTE = "PILOTE"
    MECANICIEN = "MECANICIEN"
    CHEF_DE_BASE = "CHEF_DE_BASE"
    CHEF_EQUIPE = "CHEF_EQUIPE"
    CONSULTANT_INTERNATIONAL = "CONSULTANT_INTERNATIONAL"


class DirectionVent(str, Enum):
    N = "N"
    NE = "NE"
    E = "E"
    SE = "SE"
    S = "S"
    SO = "SO"
    O = "O"  # noqa: E741 — point cardinal Ouest, pas une variable ambiguë
    NO = "NO"


class TypeTraitement(str, Enum):
    AERIEN = "AERIEN"
    TERRESTRE = "TERRESTRE"


class StatutTraitement(str, Enum):
    BROUILLON = "brouillon"
    VALIDEE = "validee"


class EspeceCible(str, Enum):
    LMC = "LMC"
    NSE = "NSE"
    MELANGE = "MELANGE"


class RepartitionPopulation(str, Enum):
    GROUPEE = "GROUPEE"
    DIFFUSE = "DIFFUSE"


class TraitementAerienCreate(BaseModel):
    pilote: str = Field(..., min_length=1, max_length=255)
    mecanicien: str = Field(..., min_length=1, max_length=255)
    chef_de_base_id: uuid.UUID
    consultant_international: str | None = Field(None, max_length=255)
    immatricule_aeronef: str | None = None
    surface_traitee_ha: float | None = Field(None, ge=0)
    pesticide_recu_l: float | None = Field(None, ge=0)


class TraitementTerrestreCreate(BaseModel):
    heure_debut: time
    heure_fin: time
    vitesse_vent_ms: float = Field(..., ge=0)
    direction_vent: DirectionVent | None = None
    temperature_c: float
    chef_equipe_id: uuid.UUID
    agent_encadreur_id: uuid.UUID | None = None
    consultant_international: str | None = Field(None, max_length=255)
    surface_atomiseur_ha: float | None = Field(None, ge=0)
    surface_disque_rotatif_ha: float | None = Field(None, ge=0)
    surface_ulvamast_ha: float | None = Field(None, ge=0)
    surface_restante_abandonnee: bool | None = None
    motif_surface_restante_abandonnee: str | None = None
    essence_litres: float | None = Field(None, ge=0)
    nb_piles: int | None = Field(None, ge=0)
    pesticide_recu_l: float | None = Field(None, ge=0)
    reprise_traitement: bool = False
    traitement_origine_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def _origine_requise_si_reprise(self) -> "TraitementTerrestreCreate":
        if self.reprise_traitement and self.traitement_origine_id is None:
            raise ValueError(
                "traitement_origine_id est obligatoire lorsque reprise_traitement=True"
            )
        if not self.reprise_traitement and self.traitement_origine_id is not None:
            raise ValueError(
                "traitement_origine_id ne peut être renseigné que si reprise_traitement=True"
            )
        return self


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
    kit_combinaison: int = Field(0, ge=0)
    kit_gants: int = Field(0, ge=0)
    kit_lunettes: int = Field(0, ge=0)
    kit_masques: int = Field(0, ge=0)
    kit_botte: int = Field(0, ge=0)
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
    observations: str | None = None

    aerien: TraitementAerienCreate | None = None
    terrestre: TraitementTerrestreCreate | None = None

    @model_validator(mode="after")
    def _un_seul_type_traitement(self) -> "TraitementCreate":
        if (self.aerien is None) == (self.terrestre is None):
            raise ValueError("Fournir exactement un des deux champs 'aerien' ou 'terrestre'")
        return self


class TraitementSyncPush(TraitementCreate):
    """Payload de push offline (ADR-002 / décision #60) : l'`id` est généré côté client au
    moment de la création hors-ligne ; `base_updated_at` porte le `updated_at` connu du
    client au moment de sa dernière lecture, utilisé pour la détection de conflit."""

    id: uuid.UUID
    base_updated_at: datetime


class CibleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    espece: EspeceCible | None
    petites_larves: str | None
    grandes_larves: str | None
    vols_clairs_essaims: str | None
    repartition_population: RepartitionPopulation | None
    surface_infestee_ha: float | None

    @field_serializer(
        "espece",
        "petites_larves",
        "grandes_larves",
        "vols_clairs_essaims",
        "repartition_population",
        "surface_infestee_ha",
    )
    def _remplacer_absent(
        self, valeur: EspeceCible | RepartitionPopulation | str | float | None
    ) -> str | float:
        return valeur if valeur is not None else NON_RENSEIGNE


class RotationCreate(BaseModel):
    numero_cuve: str = Field(..., min_length=1, max_length=50)
    produit_id: uuid.UUID
    quantite_l: float = Field(..., gt=0)
    temperature_debut_c: float
    temperature_fin_c: float
    vent_debut_ms: float = Field(..., ge=0)
    vent_fin_ms: float = Field(..., ge=0)
    heure_debut: time
    heure_fin: time


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
    heure_debut: time
    heure_fin: time


class ProduitUtiliseCreate(BaseModel):
    produit_id: uuid.UUID
    quantite_l: float = Field(..., gt=0)


class ProduitUtiliseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    numero: int
    produit_id: uuid.UUID
    quantite_l: float


class SignatureCreate(BaseModel):
    role: RoleSignature
    signataire_nom: str = Field(..., min_length=1, max_length=255)


class ValiderTraitementRequest(BaseModel):
    date_validation: date
    signatures: list[SignatureCreate] = []


class SignatureRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: RoleSignature
    signataire_nom: str
    horodatage: datetime


class TraitementAerienRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    pilote: str
    mecanicien: str
    chef_de_base_id: uuid.UUID
    consultant_international: str | None
    immatricule_aeronef: str | None
    nb_rotations: int
    total_pesticide_l: float | None
    surface_traitee_ha: float | None
    surface_restante_ha: float | None
    pesticide_recu_l: float | None
    pesticide_stock_restant_l: float | None
    rotations: list[RotationRead] = []


class TraitementTerrestreRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    heure_debut: time
    heure_fin: time
    vitesse_vent_ms: float
    direction_vent: DirectionVent | None
    temperature_c: float
    reprise_traitement: bool
    traitement_origine_id: uuid.UUID | None
    chef_equipe_id: uuid.UUID
    agent_encadreur_id: uuid.UUID | None
    consultant_international: str | None
    surface_atomiseur_ha: float | None
    surface_disque_rotatif_ha: float | None
    surface_ulvamast_ha: float | None
    surface_traitee_ha: float | None
    surface_cumulee_ha: float | None
    surface_restante_ha: float | None
    surface_restante_abandonnee: bool | None
    motif_surface_restante_abandonnee: str | None
    essence_litres: float | None
    nb_piles: int | None
    total_pesticide_l: float | None
    pesticide_recu_l: float | None
    pesticide_stock_restant_l: float | None
    produits: list[ProduitUtiliseRead] = []


class TraitementRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    prospection_id: uuid.UUID
    numero_fiche: str
    type_traitement: TypeTraitement
    mode_traitement: ModeTraitement | None
    date_traitement: date
    date_validation: date
    localite: str
    region: str | None
    district: str | None
    commune: str | None
    latitude: float | None
    longitude: float | None
    altitude: float | None
    kit_combinaison: int
    kit_gants: int
    kit_lunettes: int
    kit_masques: int
    kit_botte: int
    zones_exposees: dict[str, Any] | None
    hauteur_strate_herbeuse_m: float | None
    hauteur_strate_arboree_m: float | None
    recouvrement_percent: int | None
    empoisonnement: bool
    empoisonnement_type: EmpoisonnementType | None
    empoisonnement_mode: EmpoisonnementMode | None
    empoisonnement_autre: str | None
    evaluation_risque: dict[str, Any] | None
    comportement_anormal: bool
    comportement_non_cibles: dict[str, Any] | None
    mortalite: bool
    mortalite_familles: dict[str, Any] | None
    observations: str | None
    statut: StatutTraitement
    statut_sync: str
    created_at: datetime
    updated_at: datetime

    cible: CibleRead | None
    aerien: TraitementAerienRead | None
    terrestre: TraitementTerrestreRead | None
    signatures: list[SignatureRead] = []
