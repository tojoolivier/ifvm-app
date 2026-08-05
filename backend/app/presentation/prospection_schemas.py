import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict
# 🔑 Import du schéma de la station fixe
from app.presentation.referentiel_schemas import StationFixeRead


class PopulationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    espece: str
    categorie: str
    densite_diffuse: float | None
    densite_groupee: float | None
    captures_nombre: int | None
    temps_capture: int | None
    accouplement: str | None
    ponte: str | None


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


class PopulationCreate(BaseModel):
    espece: str
    categorie: str
    densite_diffuse: float | None = None
    densite_groupee: float | None = None
    captures_nombre: int | None = None
    temps_capture: int | None = None
    accouplement: str | None = None
    ponte: str | None = None


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
    densite_min: float | None = None
    densite_max: float | None = None
    densite_moy: float | None = None
    interdistance: float | None = None
    comportement: str | None = None
    direction_de: str | None = None
    direction_vers: str | None = None
    vent_de: str | None = None
    vent_vitesse: float | None = None


class ProspectionCreate(BaseModel):
    type_prospection: str
    campagne_id: uuid.UUID
    station_id: uuid.UUID | None = None
    n_releve: str | None = None
    n_fiche: str | None = None
    n_message: str | None = None
    date_prospection: date
    latitude: float | None = None
    longitude: float | None = None
    altitude: float | None = None
    biotope: str | None = None
    surf_station: float | None = None
    surf_prospectee: float | None = None
    surf_infestee: float | None = None
    degats_cultures: str | None = None
    derniere_pluie: date | None = None
    intensite_pluie: str | None = None
    vegetation: dict[str, Any] | None = None
    sol: dict[str, Any] | None = None
    ennemis_naturels: str | None = None
    observations: str | None = None
    statut: str = "brouillon"
    populations: list[PopulationCreate] = []
    captures: list[CaptureCreate] = []
    infestations: list[InfestationCreate] = []


class ProspectionUpdate(BaseModel):
    station_id: uuid.UUID | None = None
    n_releve: str | None = None
    n_fiche: str | None = None
    n_message: str | None = None
    date_prospection: date | None = None
    latitude: float | None = None
    longitude: float | None = None
    altitude: float | None = None
    biotope: str | None = None
    surf_station: float | None = None
    surf_prospectee: float | None = None
    surf_infestee: float | None = None
    degats_cultures: str | None = None
    derniere_pluie: date | None = None
    intensite_pluie: str | None = None
    vegetation: dict[str, Any] | None = None
    sol: dict[str, Any] | None = None
    ennemis_naturels: str | None = None
    observations: str | None = None
    statut: str | None = None


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
    ennemis_naturels: str | None
    observations: str | None
    statut: str
    statut_sync: str
    created_at: datetime
    updated_at: datetime
    populations: list[PopulationRead] = []
    captures: list[CaptureRead] = []
    infestations: list[InfestationRead] = []

    # 🔑 CLÉ DU SUCCÈS : Ajout de la relation station dans la réponse JSON
    station: StationFixeRead | None = None