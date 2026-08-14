import uuid
from datetime import date, datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class TypeProspection(str, Enum):
    INTENSIVE = "intensive"
    EXTENSIVE = "extensive"
    VALIDATION = "validation"


class Biotope(str, Enum):
    XEROPHYLE = "xerophyle"
    MESOPHYLE = "mesophyle"
    HYDROPHYLE = "hydrophyle"


class TypeEssaim(str, Enum):
    VOL_CLAIR = "vol_clair"
    DENSE = "dense"
    TRES_DENSE = "tres_dense"


class TypeLarve(str, Enum):
    TACHE_LARVAIRE = "tache_larvaire"
    BANDE_LARVAIRE = "bande_larvaire"


class StadeDominant(str, Enum):
    L1_L3 = "l1_l3"
    L4_L5 = "l4_l5"


class DegatsCultures(str, Enum):
    NULS = "nuls"
    FAIBLES = "faibles"
    MOYENS = "moyens"
    FORTS = "forts"


class PopulationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    espece: str
    categorie: str
    densite_diffuse: float | None
    densite_groupee: float | None
    captures_nombre: int | None
    temps_capture: int | None
    methode: str | None = None
    phase: str | None = None
    accouplement: str | None
    ponte: str | None

    # ==========================================
    # NOUVEAUX CHAMPS - Extensif Imagos (B)
    # ==========================================
    captures_sol: int | None = None
    captures_trans: int | None = None
    captures_greg: int | None = None
    stade_imago: str | None = None
    essaim_observe: bool | None = None

    # ==========================================
    # NOUVEAUX CHAMPS - Extensif Larves (C)
    # ==========================================
    densites_larve: dict[str, int] | None = None
    tache_larvaire: bool | None = None
    bande_larvaire: bool | None = None
    interdistance: float | None = None
    deplacement: str | None = None


class CaptureRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    espece: str
    categorie: str
    sexe: str | None
    phase: str
    stade: str
    effectif: int


class InfestationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    espece: str | None
    type_cible: str
    taille_min: float | None
    taille_max: float | None
    taille_moy: float | None
    surface_tot: float | None
    densite_min: float | None
    densite_max: float | None
    densite_moy: float | None
    interdistance: float | None
    comportement: str | None
    direction_de: str | None
    direction_vers: str | None
    vent_de: str | None
    vent_vitesse: float | None

    # ==========================================
    # NOUVEAUX CHAMPS - Imagos (B)
    # ==========================================
    pullulation_nb: int | None = None
    taille_long: float | None = None
    taille_large: float | None = None
    taille_epaisseur: float | None = None
    essaim_en_vol: bool | None = None
    essaim_pose: bool | None = None
    type_essaim: str | None = None
    heure_observation: str | None = None

    # ==========================================
    # NOUVEAUX CHAMPS - Larves (C)
    # ==========================================
    nb_taches_bandes: int | None = None
    interdistance_m: float | None = None
    interdistance_min: float | None = None
    interdistance_max: float | None = None
    interdistance_moy: float | None = None
    surface_contaminee_ha: float | None = None
    type_larve: str | None = None
    surf_infestee_pourcent: float | None = None
    stade_dominant: str | None = None
    taille_groupe_m2: float | None = None
    front_longueur_m: float | None = None
    front_largeur_m: float | None = None
    densite_max_front: float | None = None
    densite_moy_arriere_front: float | None = None


class PopulationCreate(BaseModel):
    espece: str
    categorie: str
    densite_diffuse: float | None = Field(None, ge=0, allow_inf_nan=False)
    densite_groupee: float | None = Field(None, ge=0, allow_inf_nan=False)
    captures_nombre: int | None = None
    temps_capture: int | None = None
    methode: str | None = None
    phase: str | None = None
    accouplement: str | None = None
    ponte: str | None = None

    # ==========================================
    # NOUVEAUX CHAMPS - Extensif Imagos (B)
    # ==========================================
    captures_sol: int | None = Field(None, ge=0)
    captures_trans: int | None = Field(None, ge=0)
    captures_greg: int | None = Field(None, ge=0)
    stade_imago: str | None = None
    essaim_observe: bool | None = None

    # ==========================================
    # NOUVEAUX CHAMPS - Extensif Larves (C)
    # ==========================================
    densites_larve: dict[str, int] | None = None
    tache_larvaire: bool | None = None
    bande_larvaire: bool | None = None
    interdistance: float | None = Field(None, ge=0)
    deplacement: str | None = None


class CaptureCreate(BaseModel):
    espece: str
    categorie: str
    sexe: str | None = None
    phase: str
    stade: str
    effectif: int = 0


class InfestationCreate(BaseModel):
    espece: str | None = None
    type_cible: str
    taille_min: float | None = None
    taille_max: float | None = None
    taille_moy: float | None = None
    surface_tot: float | None = None
    densite_min: float | None = Field(None, ge=0, allow_inf_nan=False)
    densite_max: float | None = Field(None, ge=0, allow_inf_nan=False)
    densite_moy: float | None = Field(None, ge=0, allow_inf_nan=False)
    interdistance: float | None = None
    comportement: str | None = None
    direction_de: str | None = None
    direction_vers: str | None = None
    vent_de: str | None = None
    vent_vitesse: float | None = None

    # ==========================================
    # NOUVEAUX CHAMPS - Imagos (B)
    # ==========================================
    pullulation_nb: int | None = Field(None, ge=0)
    taille_long: float | None = Field(None, ge=0)
    taille_large: float | None = Field(None, ge=0)
    taille_epaisseur: float | None = Field(None, ge=0)
    essaim_en_vol: bool | None = None
    essaim_pose: bool | None = None
    type_essaim: TypeEssaim | None = None
    heure_observation: str | None = None

    # ==========================================
    # NOUVEAUX CHAMPS - Larves (C)
    # ==========================================
    nb_taches_bandes: int | None = Field(None, ge=0)
    interdistance_m: float | None = Field(None, ge=0)
    interdistance_min: float | None = Field(None, ge=0)
    interdistance_max: float | None = Field(None, ge=0)
    interdistance_moy: float | None = Field(None, ge=0)
    surface_contaminee_ha: float | None = Field(None, ge=0)
    type_larve: TypeLarve | None = None
    surf_infestee_pourcent: float | None = Field(None, ge=0, le=100)
    stade_dominant: StadeDominant | None = None
    taille_groupe_m2: float | None = Field(None, ge=0)
    front_longueur_m: float | None = Field(None, ge=0)
    front_largeur_m: float | None = Field(None, ge=0)
    densite_max_front: float | None = Field(None, ge=0)
    densite_moy_arriere_front: float | None = Field(None, ge=0)


class ProspectionCreate(BaseModel):
    type_prospection: TypeProspection
    campagne_id: uuid.UUID
    station_id: uuid.UUID | None = None
    n_releve: str | None = None
    n_fiche: str | None = None
    n_message: str | None = None
    date_prospection: date
    latitude: float | None = None
    longitude: float | None = None
    altitude: float | None = None
    biotope: Biotope | None = None
    surf_station: float | None = Field(None, ge=0)
    surf_prospectee: float | None = Field(None, ge=0)
    surf_infestee: float | None = Field(None, ge=0)
    degats_cultures: DegatsCultures | None = None
    derniere_pluie: date | None = None
    intensite_pluie: str | None = None
    vegetation: dict[str, Any] | None = None
    sol: dict[str, Any] | None = None
    verdissement: float | None = Field(None, ge=0, le=100)
    hauteur_strate: float | None = Field(None, ge=0)
    ennemis_naturels: str | None = None
    observations: str | None = None
    statut: str = "brouillon"

    # ==========================================
    # NOUVEAUX CHAMPS - Références (A)
    # ==========================================
    region: str | None = Field(None, max_length=100)
    district: str | None = Field(None, max_length=100)
    commune: str | None = Field(None, max_length=100)
    za: str | None = Field(None, max_length=50)
    pa_code: str | None = Field(None, max_length=50)

    # ==========================================
    # NOUVEAUX CHAMPS - Observations (D)
    # ==========================================
    degats_cultures_pourcent: int | None = Field(None, ge=0, le=100)
    verdissement_pourcent: int | None = Field(None, ge=0, le=100)
    hauteur_herbe_cm: float | None = Field(None, ge=0)

    # ==========================================
    # NOUVEAUX CHAMPS - Extensif & Validation
    # ==========================================
    station_libre: str | None = None
    type_station: str | None = None
    verdure_strate: str | None = None
    signalement_source: str | None = None
    signalement_date: str | None = None
    signalement_description: str | None = None
    conclusion_validation: str | None = None

    populations: list[PopulationCreate] = []
    captures: list[CaptureCreate] = []
    infestations: list[InfestationCreate] = []
    surf_infestee_pourcent: float | None = Field(None, ge=0, le=100)


class ProspectionUpdate(BaseModel):
    station_id: uuid.UUID | None = None
    n_releve: str | None = None
    n_fiche: str | None = None
    n_message: str | None = None
    date_prospection: date | None = None
    latitude: float | None = None
    longitude: float | None = None
    altitude: float | None = None
    biotope: Biotope | None = None
    surf_station: float | None = Field(None, ge=0)
    surf_prospectee: float | None = Field(None, ge=0)
    surf_infestee: float | None = Field(None, ge=0)
    degats_cultures: DegatsCultures | None = None
    derniere_pluie: date | None = None
    intensite_pluie: str | None = None
    vegetation: dict[str, Any] | None = None
    sol: dict[str, Any] | None = None
    verdissement: float | None = Field(None, ge=0, le=100)
    hauteur_strate: float | None = Field(None, ge=0)
    ennemis_naturels: str | None = None
    observations: str | None = None
    statut: str | None = None

    # ==========================================
    # NOUVEAUX CHAMPS - Références (A)
    # ==========================================
    region: str | None = Field(None, max_length=100)
    district: str | None = Field(None, max_length=100)
    commune: str | None = Field(None, max_length=100)
    za: str | None = Field(None, max_length=50)
    pa_code: str | None = Field(None, max_length=50)

    # ==========================================
    # NOUVEAUX CHAMPS - Observations (D)
    # ==========================================
    degats_cultures_pourcent: int | None = Field(None, ge=0, le=100)
    verdissement_pourcent: int | None = Field(None, ge=0, le=100)
    hauteur_herbe_cm: float | None = Field(None, ge=0)

    # ==========================================
    # NOUVEAUX CHAMPS - Extensif & Validation
    # ==========================================
    station_libre: str | None = None
    type_station: str | None = None
    verdure_strate: str | None = None
    signalement_source: str | None = None
    signalement_date: str | None = None
    signalement_description: str | None = None
    conclusion_validation: str | None = None


class StatutChange(BaseModel):
    statut: str
    commentaire: str | None = None


class CommentaireCreate(BaseModel):
    texte: str


class AuditLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    fiche_type: str
    fiche_id: uuid.UUID
    auteur_id: uuid.UUID
    action: str
    details: dict[str, Any] | None
    created_at: datetime


class ProspectionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type_prospection: str
    campagne_id: uuid.UUID
    prospecteur_id: uuid.UUID
    station_id: uuid.UUID | None
    n_releve: str | None
    n_fiche: str | None
    n_message: str | None
    date_prospection: date
    latitude: float | None
    longitude: float | None
    altitude: float | None
    biotope: str | None
    surf_station: float | None
    surf_prospectee: float | None
    surf_infestee: float | None
    degats_cultures: str | None
    derniere_pluie: date | None
    intensite_pluie: str | None
    vegetation: dict[str, Any] | None
    sol: dict[str, Any] | None
    verdissement: float | None
    hauteur_strate: float | None
    ennemis_naturels: str | None
    observations: str | None
    statut: str
    statut_sync: str
    created_at: datetime
    updated_at: datetime

    # ==========================================
    # NOUVEAUX CHAMPS - Références (A)
    # ==========================================
    region: str | None = None
    district: str | None = None
    commune: str | None = None
    za: str | None = None
    pa_code: str | None = None

    # ==========================================
    # NOUVEAUX CHAMPS - Observations (D)
    # ==========================================
    degats_cultures_pourcent: int | None = None
    verdissement_pourcent: int | None = None
    hauteur_herbe_cm: float | None = None

    # ==========================================
    # NOUVEAUX CHAMPS - Extensif & Validation
    # ==========================================
    station_libre: str | None = None
    type_station: str | None = None
    verdure_strate: str | None = None
    signalement_source: str | None = None
    signalement_date: str | None = None
    signalement_description: str | None = None
    conclusion_validation: str | None = None

    populations: list[PopulationRead] = []
    captures: list[CaptureRead] = []
    infestations: list[InfestationRead] = []
