import uuid
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any


@dataclass
class ProspectionPopulation:
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    prospection_id: uuid.UUID = field(default_factory=uuid.uuid4)
    espece: str = ""
    categorie: str = ""
    densite_diffuse: float | None = None
    densite_groupee: float | None = None
    captures_nombre: int | None = None
    temps_capture: int | None = None
    accouplement: str | None = None
    ponte: str | None = None


@dataclass
class ProspectionCapture:
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    prospection_id: uuid.UUID = field(default_factory=uuid.uuid4)
    espece: str = ""
    categorie: str = ""
    sexe: str | None = None
    phase: str = ""
    stade: str = ""
    effectif: int = 0


@dataclass
class ProspectionInfestation:
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    prospection_id: uuid.UUID = field(default_factory=uuid.uuid4)
    espece: str | None = None
    type_cible: str = ""
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


@dataclass
class Prospection:
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    type_prospection: str = ""
    campagne_id: uuid.UUID = field(default_factory=uuid.uuid4)
    prospecteur_id: uuid.UUID = field(default_factory=uuid.uuid4)
    station_id: uuid.UUID | None = None
    n_releve: str | None = None
    n_fiche: str | None = None
    n_message: str | None = None
    date_prospection: date = field(default_factory=date.today)
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
    statut_sync: str = "local"
    verified_by: uuid.UUID | None = None
    verified_at: datetime | None = None
    validated_by: uuid.UUID | None = None
    validated_at: datetime | None = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    populations: list[ProspectionPopulation] = field(default_factory=list)
    captures: list[ProspectionCapture] = field(default_factory=list)
    infestations: list[ProspectionInfestation] = field(default_factory=list)


@dataclass
class AuditLog:
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    fiche_type: str = ""
    fiche_id: uuid.UUID = field(default_factory=uuid.uuid4)
    auteur_id: uuid.UUID = field(default_factory=uuid.uuid4)
    action: str = ""
    details: dict[str, Any] | None = None
    created_at: datetime = field(default_factory=datetime.utcnow)
