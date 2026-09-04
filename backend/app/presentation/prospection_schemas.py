import uuid
from datetime import date, datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator


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


class StatutProspection(str, Enum):
    BROUILLON = "brouillon"
    EN_ATTENTE = "en_attente"
    VERIFIEE = "verifiee"
    VALIDEE = "validee"
    REJETEE = "rejetee"


class StatutSync(str, Enum):
    LOCAL = "local"
    SYNCED = "synced"
    CONFLICT = "conflict"


class TypeStation(str, Enum):
    XEROPHYLE = "xerophyle"
    MESOPHYLE = "mesophyle"
    HYDROPHYLE = "hydrophyle"


class VerdureStrate(str, Enum):
    FAIBLE = "faible"
    MOYENNE = "moyenne"
    FORTE = "forte"


class ConclusionValidation(str, Enum):
    CONFIRMEE = "confirmee"
    INFIRMEE = "infirmee"


class EspeceAcridienne(str, Enum):
    LMC = "LMC"
    NSE = "NSE"


class CategorieCapture(str, Enum):
    IMAGO = "imago"
    LARVE = "larve"


class NiveauPopulation(str, Enum):
    NEANT = "neant"
    RARE = "rare"
    PEU = "peu"
    BEAUCOUP = "beaucoup"
    DOMINANT = "dominant"


class MethodePopulation(str, Enum):
    VISUEL = "visuel"
    COMPTAGE_DIRECT = "comptage_direct"


class StadeImago(str, Enum):
    A1 = "A1"
    A2 = "A2"
    A3 = "A3"
    A4 = "A4"
    A5 = "A5"


class Deplacement(str, Enum):
    REPOS = "repos"
    PERCHEE = "perchee"


class Sexe(str, Enum):
    F = "F"
    M = "M"


class PhaseAcridienne(str, Enum):
    SOLITAIRE = "solitaire"
    SOLITARO_TRANS = "solitaro_trans"
    TRANSIENS = "transiens"
    GREGAIRE = "gregaire"


class TypeCible(str, Enum):
    TACHE_LARVAIRE = "tache_larvaire"
    BANDE_LARVAIRE = "bande_larvaire"
    VOL_CLAIR = "vol_clair"
    DENSE = "dense"
    TRES_DENSE = "tres_dense"


class TypeCibleImago(str, Enum):
    """`prospection_population.type_cible` (extensif, par espèce) : l'extensif n'a pas
    d'écran Infestation séparé — sous-ensemble de TypeCible pertinent pour un imago
    (pas tache_larvaire/bande_larvaire, réservées aux larves)."""

    VOL_CLAIR = "vol_clair"
    DENSE = "dense"
    TRES_DENSE = "tres_dense"


class ComportementInfestation(str, Enum):
    REPOS = "repos"
    DEPLACEMENT = "deplacement"


class FicheType(str, Enum):
    INTENSIVE = "intensive"
    EXTENSIVE = "extensive"
    VALIDATION = "validation"
    CRT = "crt"
    VOL = "vol"
    METEO = "meteo"


class ActionAudit(str, Enum):
    CREATION = "creation"
    MODIFICATION = "modification"
    SOUMISSION = "soumission"
    VERIFICATION = "verification"
    VALIDATION = "validation"
    REJET = "rejet"
    COMMENTAIRE = "commentaire"


class PopulationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    espece: EspeceAcridienne
    categorie: CategorieCapture
    densite_diffuse: float | None
    densite_groupee: float | None
    captures_nombre: int | None
    temps_capture: int | None
    methode: MethodePopulation | None = None
    phase: str | None = None
    accouplement: NiveauPopulation | None
    ponte: NiveauPopulation | None

    # ==========================================
    # NOUVEAUX CHAMPS - Extensif Imagos (B)
    # ==========================================
    captures_sol: int | None = None
    captures_trans: int | None = None
    captures_greg: int | None = None
    stade_imago: StadeImago | None = None
    essaim_observe: bool | None = None

    # ==========================================
    # NOUVEAUX CHAMPS - Extensif Larves (C)
    # ==========================================
    densites_larve: dict[str, int] | None = None
    tache_larvaire: bool | None = None
    bande_larvaire: bool | None = None
    interdistance: float | None = None
    deplacement: Deplacement | None = None
    surface_contaminee_ha: float | None = None

    # ==========================================
    # NOUVEAUX CHAMPS - Extensif Imagos : Type de cible, État/Comportement
    # ==========================================
    # Multi-select (migration 0044) : plusieurs cibles simultanées (ex. Vol clair +
    # Dense), même pattern que `biotope` (liste, tolérante aux anciennes fiches sans
    # validator sur ce schéma de lecture).
    type_cible: list[TypeCibleImago] = []
    direction_de: str | None = None
    direction_vers: str | None = None
    etat: ComportementInfestation | None = None
    essaim_en_vol: bool | None = None
    essaim_pose: bool | None = None


class CaptureRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    espece: EspeceAcridienne
    categorie: CategorieCapture
    sexe: Sexe | None
    phase: PhaseAcridienne
    stade: str
    effectif: int


class InfestationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    espece: EspeceAcridienne | None
    type_cible: TypeCible
    taille_min: float | None
    taille_max: float | None
    taille_moy: float | None
    surface_totale: float | None
    densite_min: float | None
    densite_max: float | None
    densite_moy: float | None
    interdistance: float | None
    comportement: ComportementInfestation | None
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
    type_essaim: TypeEssaim | None = None
    heure_observation: str | None = None
    densite_en_vol: float | None = None
    dimension_ha: float | None = None

    # ==========================================
    # NOUVEAUX CHAMPS - Larves (C)
    # ==========================================
    nb_taches_bandes: int | None = None
    interdistance_m: float | None = None
    interdistance_min: float | None = None
    interdistance_max: float | None = None
    interdistance_moy: float | None = None
    surface_contaminee_ha: float | None = None
    type_larve: TypeLarve | None = None
    surface_infestee_pourcent: float | None = None
    stade_dominant: StadeDominant | None = None
    taille_groupe_m2: float | None = None
    front_longueur_m: float | None = None
    front_largeur_m: float | None = None
    densite_max_front: float | None = None
    densite_moy_arriere_front: float | None = None


class PopulationCreate(BaseModel):
    espece: EspeceAcridienne
    categorie: CategorieCapture
    densite_diffuse: float | None = Field(None, ge=0, allow_inf_nan=False)
    densite_groupee: float | None = Field(None, ge=0, allow_inf_nan=False)
    captures_nombre: int | None = None
    temps_capture: int | None = None
    methode: MethodePopulation | None = None
    phase: str | None = None
    accouplement: NiveauPopulation | None = None
    ponte: NiveauPopulation | None = None

    # ==========================================
    # NOUVEAUX CHAMPS - Extensif Imagos (B)
    # ==========================================
    captures_sol: int | None = Field(None, ge=0)
    captures_trans: int | None = Field(None, ge=0)
    captures_greg: int | None = Field(None, ge=0)
    stade_imago: StadeImago | None = None
    essaim_observe: bool | None = None

    # ==========================================
    # NOUVEAUX CHAMPS - Extensif Larves (C)
    # ==========================================
    densites_larve: dict[str, int] | None = None
    tache_larvaire: bool | None = None
    bande_larvaire: bool | None = None
    interdistance: float | None = Field(None, ge=0)
    deplacement: Deplacement | None = None
    surface_contaminee_ha: float | None = Field(None, ge=0, allow_inf_nan=False)

    # ==========================================
    # NOUVEAUX CHAMPS - Extensif Imagos : Type de cible, État/Comportement
    # ==========================================
    # Multi-select (migration 0044) : plusieurs cibles simultanées (ex. Vol clair +
    # Dense) — même pattern que `biotope`.
    type_cible: list[TypeCibleImago] = []
    direction_de: str | None = None
    direction_vers: str | None = None
    etat: ComportementInfestation | None = None
    essaim_en_vol: bool | None = None
    essaim_pose: bool | None = None

    @model_validator(mode="after")
    def _densite_groupee_obligatoire(self) -> "PopulationCreate":
        # #densite-groupee-obligatoire : sur les 4 types de fiche. `densite_diffuse`
        # reste typé Optional (comme avant) pour laisser passer la validation Pydantic
        # de champ puis produire ici le message FR dédié, plutôt que le "Field
        # required" générique qu'un `Field(...)` obligatoire aurait renvoyé.
        if self.densite_groupee is None:
            raise ValueError("La densité groupée (/m²) est obligatoire.")
        return self

    @model_validator(mode="after")
    def _densite_diffuse_obligatoire(self) -> "PopulationCreate":
        # #densite-diffuse-obligatoire : même mécanisme que _densite_groupee_obligatoire
        # ci-dessus (validation applicative, aucune contrainte DB — tolérance aux
        # fiches historiques préservée via PopulationRead, non contraint).
        if self.densite_diffuse is None:
            raise ValueError("La densité diffuse (D/ha) est obligatoire.")
        return self


class CaptureCreate(BaseModel):
    espece: EspeceAcridienne
    categorie: CategorieCapture
    sexe: Sexe | None = None
    phase: PhaseAcridienne
    stade: str
    effectif: int = 0


class InfestationCreate(BaseModel):
    espece: EspeceAcridienne | None = None
    type_cible: TypeCible
    taille_min: float | None = None
    taille_max: float | None = None
    taille_moy: float | None = None
    surface_totale: float | None = None
    densite_min: float | None = Field(None, ge=0, allow_inf_nan=False)
    densite_max: float | None = Field(None, ge=0, allow_inf_nan=False)
    densite_moy: float | None = Field(None, ge=0, allow_inf_nan=False)
    interdistance: float | None = None
    comportement: ComportementInfestation | None = None
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
    densite_en_vol: float | None = Field(None, ge=0)
    dimension_ha: float | None = Field(None, ge=0)

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
    surface_infestee_pourcent: float | None = Field(None, ge=0, le=100)
    stade_dominant: StadeDominant | None = None
    taille_groupe_m2: float | None = Field(None, ge=0)
    front_longueur_m: float | None = Field(None, ge=0)
    front_largeur_m: float | None = Field(None, ge=0)
    densite_max_front: float | None = Field(None, ge=0)
    densite_moy_arriere_front: float | None = Field(None, ge=0)


class ModeExtensif(str, Enum):
    """Axe orthogonal à TypeProspection — pertinent seulement quand
    type_prospection='extensive'. Absent (None) sur une fiche existante ou une
    fiche extensive terrestre : jamais None sur une fiche aérienne."""

    TERRESTRE = "terrestre"
    AERIEN = "aerien"


class TypeOperationAerienne(str, Enum):
    CONVOYAGE = "convoyage"
    PROSPECTION = "prospection"
    DIVERS = "divers"


# HH:MM strict (00-23:00-59) — même contrainte que côté DB (migration 0035).
_HHMM_PATTERN = r"^([01]\d|2[0-3]):[0-5]\d$"


class OperationAerienneCreate(BaseModel):
    """Pas de `numero` (assigné côté serveur, séquence par fiche) ni de
    `duree_minutes` (calculée côté serveur depuis début/fin — jamais saisie)."""

    type_operation: TypeOperationAerienne
    # Pertinent seulement si type_operation == DIVERS — laissé None sinon (jamais
    # exigé, jamais affiché pour Convoyage/Prospection).
    motif_divers: str | None = Field(None, max_length=200)
    debut_heure: str = Field(..., pattern=_HHMM_PATTERN)
    debut_temperature_c: float | None = None
    debut_vent_ms: float | None = Field(None, ge=0)
    fin_heure: str = Field(..., pattern=_HHMM_PATTERN)
    fin_temperature_c: float | None = None
    fin_vent_ms: float | None = Field(None, ge=0)


class OperationAerienneRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    numero: int
    type_operation: TypeOperationAerienne
    motif_divers: str | None = None
    debut_heure: str
    debut_temperature_c: float | None
    debut_vent_ms: float | None
    fin_heure: str
    fin_temperature_c: float | None
    fin_vent_ms: float | None
    duree_minutes: int


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
    # Multi-select (#biotope-multi) : au moins un biotope requis, cf. le validator
    # `_biotope_obligatoire` plus bas (message FR dédié, sur le modèle des validators
    # de traitement_schemas.py — Pydantic seul ne produirait qu'un "Field required" générique).
    biotope: list[Biotope] = []
    surface_station: float | None = Field(None, ge=0)
    surface_prospectee: float | None = Field(None, ge=0)
    surface_infestee: float | None = Field(None, ge=0)
    degats_cultures: DegatsCultures | None = None
    derniere_pluie: date | None = None
    intensite_pluie: str | None = None
    vegetation: dict[str, Any] | None = None
    sol: dict[str, Any] | None = None
    verdissement: float | None = Field(None, ge=0, le=100)
    hauteur_strate: float | None = Field(None, ge=0)
    ennemis_naturels: str | None = None
    observations: str | None = None
    statut: StatutProspection = StatutProspection.BROUILLON

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
    # Horodatage GPS complet (écran Observations) — distinct de l'heure_observation
    # par cible d'infestation (`InfestationCreate.heure_observation`, un HH:mm libre).
    heure_observation_at: datetime | None = None

    # ==========================================
    # NOUVEAUX CHAMPS - Extensif & Validation
    # ==========================================
    station_libre: str | None = None
    type_station: list[TypeStation] = []  # Multi-select (#biotope-multi), reste facultatif.
    verdure_strate: VerdureStrate | None = None
    signalement_source: str | None = None
    signalement_date: str | None = None
    signalement_description: str | None = None
    conclusion_validation: ConclusionValidation | None = None
    avertissements: list[str] = []

    # ==========================================
    # NOUVEAUX CHAMPS - Extensif : mode aérien
    # ==========================================
    mode_extensif: ModeExtensif | None = None
    societe: str | None = None
    immatricule_aeronef: str | None = None
    pilote: str | None = None
    mecanicien: str | None = None
    chef_de_base: str | None = None
    lieu_base_id: uuid.UUID | None = None

    # ==========================================
    # NOUVEAUX CHAMPS - Extensif : pesticides embarqués + signatures
    # ==========================================
    pesticides_embarques: bool | None = None
    pesticide_nom_commercial: str | None = None
    pesticide_quantite_disponible: float | None = Field(None, ge=0, allow_inf_nan=False)
    pesticide_quantite_recue: float | None = Field(None, ge=0, allow_inf_nan=False)
    futs_disponible: int | None = Field(None, ge=0)
    futs_pleins: int | None = Field(None, ge=0)
    futs_vides: int | None = Field(None, ge=0)
    futs_recues: int | None = Field(None, ge=0)
    signature_visa_nom: str | None = None
    signature_visa_horodatage: datetime | None = None
    signature_consultant_fao_nom: str | None = None
    signature_consultant_fao_horodatage: datetime | None = None
    signature_pilote_nom: str | None = None
    signature_pilote_horodatage: datetime | None = None
    signature_chef_base_nom: str | None = None
    signature_chef_base_horodatage: datetime | None = None

    populations: list[PopulationCreate] = []
    captures: list[CaptureCreate] = []
    infestations: list[InfestationCreate] = []
    operations_aeriennes: list[OperationAerienneCreate] = []
    surface_infestee_pourcent: float | None = Field(None, ge=0, le=100)

    @model_validator(mode="after")
    def _biotope_obligatoire(self) -> "ProspectionCreate":
        # Multi-select (#biotope-multi) : au moins un biotope, comme avant ce
        # changement — mais UNIQUEMENT pour l'intensif. `biotope` et `type_station`
        # sont deux champs distincts sur ce même schéma partagé : les fiches
        # extensif/validation ne renseignent jamais `biotope` (elles utilisent
        # `type_station`, resté facultatif) — leur réclamer `biotope` rejetterait
        # à tort toute fiche extensive/validation.
        if self.type_prospection == TypeProspection.INTENSIVE and len(self.biotope) == 0:
            raise ValueError("Le biotope est obligatoire.")
        return self


class ProspectionUpdate(BaseModel):
    station_id: uuid.UUID | None = None
    n_releve: str | None = None
    n_fiche: str | None = None
    n_message: str | None = None
    date_prospection: date | None = None
    latitude: float | None = None
    longitude: float | None = None
    altitude: float | None = None
    # Multi-select (#biotope-multi) : `None` = non modifié par cet update (distinct
    # d'un tableau vide), même convention que `avertissements` ci-dessous.
    biotope: list[Biotope] | None = None
    surface_station: float | None = Field(None, ge=0)
    surface_prospectee: float | None = Field(None, ge=0)
    surface_infestee: float | None = Field(None, ge=0)
    degats_cultures: DegatsCultures | None = None
    derniere_pluie: date | None = None
    intensite_pluie: str | None = None
    vegetation: dict[str, Any] | None = None
    sol: dict[str, Any] | None = None
    verdissement: float | None = Field(None, ge=0, le=100)
    hauteur_strate: float | None = Field(None, ge=0)
    ennemis_naturels: str | None = None
    observations: str | None = None
    statut: StatutProspection | None = None

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
    heure_observation_at: datetime | None = None

    # ==========================================
    # NOUVEAUX CHAMPS - Extensif & Validation
    # ==========================================
    station_libre: str | None = None
    type_station: list[TypeStation] | None = None  # None = non modifie par cet update.
    verdure_strate: VerdureStrate | None = None
    signalement_source: str | None = None
    signalement_date: str | None = None
    signalement_description: str | None = None
    conclusion_validation: ConclusionValidation | None = None
    avertissements: list[str] | None = None

    # ==========================================
    # NOUVEAUX CHAMPS - Extensif : mode aérien
    # ==========================================
    mode_extensif: ModeExtensif | None = None
    societe: str | None = None
    immatricule_aeronef: str | None = None
    pilote: str | None = None
    mecanicien: str | None = None
    chef_de_base: str | None = None
    lieu_base_id: uuid.UUID | None = None

    # ==========================================
    # NOUVEAUX CHAMPS - Extensif : pesticides embarqués + signatures
    # ==========================================
    pesticides_embarques: bool | None = None
    pesticide_nom_commercial: str | None = None
    pesticide_quantite_disponible: float | None = Field(None, ge=0, allow_inf_nan=False)
    pesticide_quantite_recue: float | None = Field(None, ge=0, allow_inf_nan=False)
    futs_disponible: int | None = Field(None, ge=0)
    futs_pleins: int | None = Field(None, ge=0)
    futs_vides: int | None = Field(None, ge=0)
    futs_recues: int | None = Field(None, ge=0)
    signature_visa_nom: str | None = None
    signature_visa_horodatage: datetime | None = None
    signature_consultant_fao_nom: str | None = None
    signature_consultant_fao_horodatage: datetime | None = None
    signature_pilote_nom: str | None = None
    signature_pilote_horodatage: datetime | None = None
    signature_chef_base_nom: str | None = None
    signature_chef_base_horodatage: datetime | None = None


class StatutChange(BaseModel):
    statut: StatutProspection
    commentaire: str | None = None


class CommentaireCreate(BaseModel):
    texte: str


class AuditLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    fiche_type: FicheType
    fiche_id: uuid.UUID
    auteur_id: uuid.UUID
    action: ActionAudit
    details: dict[str, Any] | None
    created_at: datetime


class ProspectionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type_prospection: TypeProspection
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
    biotope: list[Biotope] = []
    surface_station: float | None
    surface_prospectee: float | None
    surface_infestee: float | None
    degats_cultures: DegatsCultures | None
    derniere_pluie: date | None
    intensite_pluie: str | None
    vegetation: dict[str, Any] | None
    sol: dict[str, Any] | None
    verdissement: float | None
    hauteur_strate: float | None
    ennemis_naturels: str | None
    observations: str | None
    statut: StatutProspection
    statut_sync: StatutSync
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
    heure_observation_at: datetime | None = None

    # ==========================================
    # NOUVEAUX CHAMPS - Extensif & Validation
    # ==========================================
    station_libre: str | None = None
    type_station: list[TypeStation] = []
    verdure_strate: VerdureStrate | None = None
    signalement_source: str | None = None
    signalement_date: str | None = None
    signalement_description: str | None = None
    conclusion_validation: ConclusionValidation | None = None
    avertissements: list[str] = []

    # ==========================================
    # NOUVEAUX CHAMPS - Extensif : mode aérien
    # ==========================================
    mode_extensif: ModeExtensif | None = None
    societe: str | None = None
    immatricule_aeronef: str | None = None
    pilote: str | None = None
    mecanicien: str | None = None
    chef_de_base: str | None = None
    lieu_base_id: uuid.UUID | None = None

    # ==========================================
    # NOUVEAUX CHAMPS - Extensif : pesticides embarqués + signatures
    # ==========================================
    pesticides_embarques: bool | None = None
    pesticide_nom_commercial: str | None = None
    pesticide_quantite_disponible: float | None = None
    pesticide_quantite_recue: float | None = None
    futs_disponible: int | None = None
    futs_pleins: int | None = None
    futs_vides: int | None = None
    futs_recues: int | None = None
    signature_visa_nom: str | None = None
    signature_visa_horodatage: datetime | None = None
    signature_consultant_fao_nom: str | None = None
    signature_consultant_fao_horodatage: datetime | None = None
    signature_pilote_nom: str | None = None
    signature_pilote_horodatage: datetime | None = None
    signature_chef_base_nom: str | None = None
    signature_chef_base_horodatage: datetime | None = None

    populations: list[PopulationRead] = []
    captures: list[CaptureRead] = []
    infestations: list[InfestationRead] = []
    operations_aeriennes: list[OperationAerienneRead] = []
