import uuid
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any

# Qui peut déclencher quelle transition
_TRANSITIONS: dict[str, dict[str, list[str]]] = {
    "brouillon": {"en_attente": ["prospecteur"]},
    "en_attente": {"verifiee": ["verificateur"]},
    "verifiee": {
        "validee": ["validation_finale"],
        "rejetee": ["validation_finale"],
    },
}

_ACTION_MAP: dict[str, str] = {
    "en_attente": "soumission",
    "verifiee": "verification",
    "validee": "validation",
    "rejetee": "rejet",
}


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
    
    # ==========================================
    # NOUVEAUX CHAMPS - Imagos (B)
    # ==========================================
    pullulation_nb: int | None = None
    taille_long: float | None = None
    taille_large: float | None = None
    taille_epaisseur: float | None = None
    essaim_en_vol: bool | None = None
    essaim_pose: bool | None = None
    type_essaim: str | None = None  # vol_clair, dense, tres_dense
    
    # ==========================================
    # NOUVEAUX CHAMPS - Larves (C)
    # ==========================================
    nb_taches_bandes: int | None = None
    interdistance_m: float | None = None
    surface_contaminee_ha: float | None = None
    type_larve: str | None = None  # tache_larvaire, bande_larvaire


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
    verdissement: float | None = None
    hauteur_strate: float | None = None
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
    
    # ==========================================
    # NOUVEAUX CHAMPS - Références (A)
    # ==========================================
    region: str | None = None
    district: str | None = None
    commune: str | None = None
    za: str | None = None  # Zone Antiacridienne
    pa_code: str | None = None  # Poste Acridien
    
    # ==========================================
    # NOUVEAUX CHAMPS - Observations (D)
    # ==========================================
    degats_cultures_pourcent: int | None = None
    verdissement_pourcent: int | None = None
    hauteur_herbe_cm: float | None = None
    
    # ==========================================
    # RELATIONSHIPS
    # ==========================================
    populations: list[ProspectionPopulation] = field(default_factory=list)
    captures: list[ProspectionCapture] = field(default_factory=list)
    infestations: list[ProspectionInfestation] = field(default_factory=list)

    def apply_transition(self, nouveau_statut: str, acteur_role: str) -> str:
        """Valide et applique une transition de statut. Retourne l'action d'audit.

        Raises ValueError pour transition inexistante, PermissionError pour rôle non autorisé.
        """
        transitions = _TRANSITIONS.get(self.statut, {})
        if nouveau_statut not in transitions:
            raise ValueError(
                f"Transition '{self.statut}' → '{nouveau_statut}' invalide"
            )
        roles_autorises = transitions[nouveau_statut]
        if acteur_role not in roles_autorises:
            raise PermissionError(
                f"Rôle '{acteur_role}' non autorisé pour passer de '{self.statut}' à '{nouveau_statut}'"
            )
        self.statut = nouveau_statut
        self.updated_at = datetime.utcnow()
        return _ACTION_MAP[nouveau_statut]


@dataclass
class AuditLog:
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    fiche_type: str = ""
    fiche_id: uuid.UUID = field(default_factory=uuid.uuid4)
    auteur_id: uuid.UUID = field(default_factory=uuid.uuid4)
    action: str = ""
    details: dict[str, Any] | None = None
    created_at: datetime = field(default_factory=datetime.utcnow)