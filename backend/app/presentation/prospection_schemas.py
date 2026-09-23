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
    """Accouplement/Ponte — réduit à 3 niveaux communs LMC/NSE (migration 0059,
    remplace les 5/4 niveaux d'origine issus du PDF papier)."""

    NEANT = "neant"
    RARE = "rare"
    BEAUCOUP = "beaucoup"


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
    DEPLACEMENT = "deplacement"


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
    stades_imago: dict[str, int] | None = None
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
    stades_imago: dict[str, int] | None = None
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

    # #densite-groupee-obligatoire : retiré — `densite_groupee` redevient
    # facultative (demande explicite), comme elle l'était avant l'introduction
    # de ce validateur. Laissée sans contrainte applicative, à l'image de
    # `PopulationRead` qui ne l'a jamais imposée non plus (tolérance aux
    # fiches historiques).
    #
    # #densite-diffuse-obligatoire : retiré à son tour (demande explicite du
    # 2026-09-14) — ce validateur rejetait (422) toute synchronisation portant
    # une grille non réellement prospectée (espèce cochée sur l'écran A mais
    # jamais ouverte : `captures_nombre = 0`, `densite_diffuse = null`), que le
    # mobile enregistre pourtant sans broncher (`validerDensiteDiffuseObligatoire`,
    # prospection-extensive.ts, n'exige une densité que si `totalCaptures > 0`)
    # — la fiche entière échouait à synchroniser pour une grille que l'agent
    # n'avait jamais eu l'intention de remplir. `densite_diffuse` redevient
    # donc facultative partout, comme `densite_groupee` ci-dessus.


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
    # Équipe qui a mené la fiche (#607) — nullable en base (rétro-compatibilité),
    # exigée ici pour toute nouvelle fiche. Une intensive/validation ne peut être
    # rattachée qu'à une équipe terrestre (validée côté serveur, cf.
    # CreateProspection._valider_equipe) ; une extensive suit `mode_extensif`.
    equipe_id: uuid.UUID
    station_id: uuid.UUID | None = None
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
    base: str | None = None
    base_numero: int | None = None
    base_date_installation: date | None = None
    base_latitude: float | None = None
    base_longitude: float | None = None
    base_secondaire: str | None = None
    base_secondaire_date_installation: date | None = None
    base_secondaire_latitude: float | None = None
    base_secondaire_longitude: float | None = None

    # ==========================================
    # NOUVEAUX CHAMPS - Extensif : signatures
    # ==========================================
    signature_visa_nom: str | None = None
    signature_visa_horodatage: datetime | None = None
    signature_visa_image: str | None = None
    signature_consultant_fao_nom: str | None = None
    signature_consultant_fao_horodatage: datetime | None = None
    signature_consultant_fao_image: str | None = None
    signature_pilote_nom: str | None = None
    signature_pilote_horodatage: datetime | None = None
    signature_pilote_image: str | None = None
    signature_chef_base_nom: str | None = None
    signature_chef_base_horodatage: datetime | None = None
    signature_chef_base_image: str | None = None

    populations: list[PopulationCreate] = []
    captures: list[CaptureCreate] = []
    infestations: list[InfestationCreate] = []
    operations_aeriennes: list[OperationAerienneCreate] = []
    surface_infestee_pourcent: float | None = Field(None, ge=0, le=100)
    # #revalidation-prospection : renseigné uniquement quand cette fiche
    # revalide une fiche périmée (extensive/validation validée depuis plus de
    # 5 jours sans traitement) — jamais décidé côté serveur.
    revalide_de_id: uuid.UUID | None = None
    # Vol de prospection ayant produit cette fiche (#610) — facultatif, doit
    # référencer un vol de type `prospection` (vérifié côté use case).
    vol_id: uuid.UUID | None = None

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
    base: str | None = None
    base_numero: int | None = None
    base_date_installation: date | None = None
    base_latitude: float | None = None
    base_longitude: float | None = None
    base_secondaire: str | None = None
    base_secondaire_date_installation: date | None = None
    base_secondaire_latitude: float | None = None
    base_secondaire_longitude: float | None = None

    # ==========================================
    # NOUVEAUX CHAMPS - Extensif : signatures
    # ==========================================
    signature_visa_nom: str | None = None
    signature_visa_horodatage: datetime | None = None
    signature_visa_image: str | None = None
    signature_consultant_fao_nom: str | None = None
    signature_consultant_fao_horodatage: datetime | None = None
    signature_consultant_fao_image: str | None = None
    signature_pilote_nom: str | None = None
    signature_pilote_horodatage: datetime | None = None
    signature_pilote_image: str | None = None
    signature_chef_base_nom: str | None = None
    signature_chef_base_horodatage: datetime | None = None
    signature_chef_base_image: str | None = None

    # Vol de prospection ayant produit cette fiche (#610) — doit référencer un
    # vol de type `prospection` (vérifié côté use case).
    vol_id: uuid.UUID | None = None


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


class NotificationRead(BaseModel):
    """Ligne du centre de notifications — dérivée de `audit_log`, jointe à
    `prospection` (n_fiche, type) et `utilisateur` (auteur). Pas de nouvelle
    table d'événements : voir migration 0052 pour le curseur de lecture."""

    id: uuid.UUID
    action: ActionAudit
    fiche_id: uuid.UUID
    fiche_type: FicheType
    n_fiche: str | None
    auteur_nom: str | None
    details: dict[str, Any] | None
    created_at: datetime
    lu: bool


class NotificationsResponse(BaseModel):
    items: list[NotificationRead]
    non_lues: int


class ProspectionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type_prospection: TypeProspection
    campagne_id: uuid.UUID
    prospecteur_id: uuid.UUID
    station_id: uuid.UUID | None
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
    # Traçabilité vérification/validation (#fiches-validees-multi-utilisateurs) —
    # colonnes déjà présentes en base mais jamais exposées ni renseignées avant
    # ce chantier (cf. Prospection.apply_transition côté domaine).
    # ==========================================
    verified_by: uuid.UUID | None = None
    verified_at: datetime | None = None
    validated_by: uuid.UUID | None = None
    validated_at: datetime | None = None
    # #revalidation-prospection : auto-référence vers la fiche périmée que
    # celle-ci revalide, `None` pour une fiche "normale" (cf. migration 0062).
    revalide_de_id: uuid.UUID | None = None
    equipe_id: uuid.UUID | None = None
    # Vol de prospection ayant produit cette fiche (#610).
    vol_id: uuid.UUID | None = None
    # Champs dérivés (jointure `utilisateur`, jamais stockés) — évite à chaque
    # client de résoudre lui-même id -> nom pour l'affichage.
    prospecteur_nom: str | None = None
    verified_by_nom: str | None = None
    validated_by_nom: str | None = None

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
    base: str | None = None
    base_numero: int | None = None
    base_date_installation: date | None = None
    base_latitude: float | None = None
    base_longitude: float | None = None
    base_secondaire: str | None = None
    base_secondaire_date_installation: date | None = None
    base_secondaire_latitude: float | None = None
    base_secondaire_longitude: float | None = None

    # ==========================================
    # NOUVEAUX CHAMPS - Extensif : signatures
    # ==========================================
    signature_visa_nom: str | None = None
    signature_visa_horodatage: datetime | None = None
    signature_visa_image: str | None = None
    signature_consultant_fao_nom: str | None = None
    signature_consultant_fao_horodatage: datetime | None = None
    signature_consultant_fao_image: str | None = None
    signature_pilote_nom: str | None = None
    signature_pilote_horodatage: datetime | None = None
    signature_pilote_image: str | None = None
    signature_chef_base_nom: str | None = None
    signature_chef_base_horodatage: datetime | None = None
    signature_chef_base_image: str | None = None

    populations: list[PopulationRead] = []
    captures: list[CaptureRead] = []
    infestations: list[InfestationRead] = []
    operations_aeriennes: list[OperationAerienneRead] = []
