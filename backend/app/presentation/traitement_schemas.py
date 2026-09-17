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


class UniteQuantite(str, Enum):
    L = "L"
    KG = "kg"


class MethodeEvaluationEfficacite(str, Enum):
    ESTIMATION_VISUELLE = "ESTIMATION_VISUELLE"
    COMPTAGES_PRE_POST = "COMPTAGES_PRE_POST"


class TraitementAerienCreate(BaseModel):
    # pilote/mecanicien/consultant_international redevenus texte libre
    # (migration 0048, défait la migration 0047) : pilote/mécanicien
    # obligatoires, consultant_international facultatif — même patron que
    # `TraitementTerrestreCreate.consultant_international`. chef_de_base_id
    # reste seul en FK utilisateur (référentiel).
    pilote: str = Field(..., min_length=1)
    mecanicien: str = Field(..., min_length=1)
    chef_de_base_id: uuid.UUID
    consultant_international: str | None = Field(None, max_length=255)
    # Base principale/stand/base secondaire : texte libre (migration 0054,
    # défait la partie "lieux" de la migration 0047 — même retour en arrière
    # que pilote/mécanicien/consultant_international ci-dessus, migration
    # 0048). Base principale obligatoire, stand/base secondaire facultatifs.
    base_principale: str = Field(..., min_length=1, max_length=255)
    stand: str | None = Field(None, max_length=255)
    # Date d'installation (migration 0056) — facultative et indépendante du
    # texte libre lui-même. Rien d'équivalent pour base_principale (hors
    # périmètre, #stand-base-secondaire-date-installation).
    stand_date_installation: date | None = None
    base_secondaire: str | None = Field(None, max_length=255)
    base_secondaire_date_installation: date | None = None
    immatricule_aeronef: str = Field(..., min_length=1)
    # surface_traitee_ha n'y figure plus (migration 0047) : dérivée de la somme
    # des `surface_ha` de rotation, ajoutées après coup via /rotations.
    pesticide_recu_l: float | None = Field(None, ge=0)
    # Efficacité (migration 0058, fiche CRT papier section "Traitement") : une
    # seule évaluation par fiche, après l'ensemble des rotations — pas de
    # contrainte de cohérence entre les 3 champs, chacun facultatif
    # indépendamment (même esprit que TraitementTerrestreCreate ci-dessous).
    taux_mortalite_pourcent: float | None = Field(None, ge=0, le=100)
    evaluation_efficacite_heures_apres: float | None = Field(None, ge=0)
    methode_evaluation_efficacite: MethodeEvaluationEfficacite | None = None
    # Chaînage de reprise (migration 0050) — mirroir de TraitementTerrestreCreate.
    reprise_traitement: bool = False
    traitement_origine_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def _origine_requise_si_reprise(self) -> "TraitementAerienCreate":
        if self.reprise_traitement and self.traitement_origine_id is None:
            raise ValueError(
                "traitement_origine_id est obligatoire lorsque reprise_traitement=True"
            )
        if not self.reprise_traitement and self.traitement_origine_id is not None:
            raise ValueError(
                "traitement_origine_id ne peut être renseigné que si reprise_traitement=True"
            )
        return self


class TraitementTerrestreCreate(BaseModel):
    heure_debut: time
    heure_fin: time
    vitesse_vent_ms: float = Field(..., ge=0)
    direction_vent: DirectionVent | None = None
    temperature_c: float
    # Efficacité (migration 0058, fiche CRT papier section "Traitement", juste
    # après Condition de traitement) — même patron que TraitementAerienCreate.
    taux_mortalite_pourcent: float | None = Field(None, ge=0, le=100)
    evaluation_efficacite_heures_apres: float | None = Field(None, ge=0)
    methode_evaluation_efficacite: MethodeEvaluationEfficacite | None = None
    chef_equipe_id: uuid.UUID
    agent_encadreur: str | None = Field(None, max_length=255)
    consultant_international: str | None = Field(None, max_length=255)
    surface_atomiseur_ha: float | None = Field(None, ge=0)
    surface_disque_rotatif_ha: float | None = Field(None, ge=0)
    surface_atomiseur_autoporte_ha: float | None = Field(None, ge=0)
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


class EvaluationRisquePopulationCreate(BaseModel):
    """« Impact et risque → Évaluation du risque pour la population » (migration
    0055). `ordre` n'y figure pas : dérivé de la position dans la liste (index),
    jamais saisi par le client — même principe que `numero_cuve` pour les
    rotations. Tous les champs sont facultatifs : une évaluation ajoutée puis
    partiellement remplie reste valide, seule la section entière est facultative."""

    habitat_proche: str | None = Field(None, max_length=500)
    distance_km: float | None = Field(None, ge=0)
    sensibilisation: bool | None = None


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
    # « Évaluation du risque pour la population » (migration 0055) — liste
    # dynamique ("+"), commune à Aérien et Terrestre (au même titre que
    # empoisonnement/evaluation_risque/observations ci-dessus), remplacée en
    # bloc à chaque enregistrement — jamais une sous-ressource à endpoints
    # séparés (cf. EvaluationRisquePopulationModel).
    evaluations_risque_population: list[EvaluationRisquePopulationCreate] = []

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
    # Detail par espece (migration 0066) : `None` quand cette espece n'est pas
    # presente dans la prospection liee — cf. construire_cible().
    petites_larves_lmc: float | None
    petites_larves_nse: float | None
    grandes_larves_lmc: float | None
    grandes_larves_nse: float | None
    densite_diffuse_lmc: float | None
    densite_groupee_lmc: float | None
    densite_diffuse_nse: float | None
    densite_groupee_nse: float | None

    @field_serializer(
        "espece",
        "petites_larves",
        "grandes_larves",
        "vols_clairs_essaims",
        "repartition_population",
        "surface_infestee_ha",
        "petites_larves_lmc",
        "petites_larves_nse",
        "grandes_larves_lmc",
        "grandes_larves_nse",
        "densite_diffuse_lmc",
        "densite_groupee_lmc",
        "densite_diffuse_nse",
        "densite_groupee_nse",
    )
    def _remplacer_absent(
        self, valeur: EspeceCible | RepartitionPopulation | str | float | None
    ) -> str | float:
        return valeur if valeur is not None else NON_RENSEIGNE


class BlocCreate(BaseModel):
    nom: str = Field(..., min_length=1, max_length=60)
    localite: str | None = Field(None, max_length=255)
    surface_theorique_ha: float | None = Field(None, ge=0)
    surface_reelle_ha: float | None = Field(None, ge=0)
    # Renseignée si produit de choc.
    surface_protegee_ha: float | None = Field(None, ge=0)
    # Renseignée si produit de barrière.
    surface_traitee_ha: float | None = Field(None, ge=0)
    largeur_andain_m: float | None = Field(None, ge=0)
    interpasse_m: float | None = Field(None, ge=0)
    hauteur_vol_min_m: float | None = Field(None, ge=0)
    hauteur_vol_max_m: float | None = Field(None, ge=0)
    observation: str | None = None


class BlocRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    numero: int
    nom: str
    localite: str | None = None
    surface_theorique_ha: float | None = None
    surface_reelle_ha: float | None = None
    surface_protegee_ha: float | None = None
    surface_traitee_ha: float | None = None
    largeur_andain_m: float | None = None
    interpasse_m: float | None = None
    hauteur_vol_min_m: float | None = None
    hauteur_vol_max_m: float | None = None
    observation: str | None = None


class RotationCreate(BaseModel):
    # numero_cuve n'y figure pas : dérivé côté serveur de `numero` (migration
    # 0047), jamais saisi.
    # bloc_id facultatif : une rotation peut ne pas encore être rattachée à un
    # bloc, ou le traitement n'utilise pas la subdivision par bloc.
    bloc_id: uuid.UUID | None = None
    produit_id: uuid.UUID
    quantite: float = Field(..., gt=0)
    unite: UniteQuantite
    surface_ha: float = Field(..., ge=0)
    temperature_debut_c: float
    temperature_fin_c: float
    vent_debut_ms: float = Field(..., ge=0)
    vent_fin_ms: float = Field(..., ge=0)
    heure_debut: time
    heure_fin: time
    heure_ouverture_vanne: time
    heure_fermeture_vanne: time
    # Dérivé côté client du nom du pesticide sélectionné (texte avant le
    # premier chiffre) — figé à la saisie, jamais recalculé côté serveur.
    nom_commercial: str | None = None


class RotationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    bloc_id: uuid.UUID | None = None
    numero: int
    numero_cuve: str
    produit_id: uuid.UUID
    quantite: float
    unite: UniteQuantite
    surface_ha: float
    temperature_debut_c: float
    temperature_fin_c: float
    vent_debut_ms: float
    vent_fin_ms: float
    heure_debut: time
    heure_fin: time
    heure_ouverture_vanne: time
    heure_fermeture_vanne: time
    nom_commercial: str | None = None


class ProduitUtiliseCreate(BaseModel):
    produit_id: uuid.UUID
    quantite_l: float = Field(..., gt=0)
    # Dérivé côté client du nom du pesticide sélectionné (texte avant le
    # premier chiffre) — figé à la saisie, jamais recalculé côté serveur.
    nom_commercial: str | None = None


class ProduitUtiliseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    numero: int
    produit_id: uuid.UUID
    quantite_l: float
    nom_commercial: str | None = None


class SignatureCreate(BaseModel):
    role: RoleSignature
    signataire_nom: str = Field(..., min_length=1, max_length=255)
    # Tracé du pavé de signature (mobile), chemin SVG — migration 0049. Facultatif
    # au niveau du schéma (rétrocompatibilité), la saisie mobile l'exige avant de
    # permettre la validation d'un rôle.
    signature_image: str | None = None


class ValiderTraitementRequest(BaseModel):
    date_validation: date
    signatures: list[SignatureCreate] = []


class SignatureRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: RoleSignature
    signataire_nom: str
    signature_image: str | None = None
    horodatage: datetime


class EvaluationRisquePopulationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    ordre: int
    habitat_proche: str | None
    distance_km: float | None
    sensibilisation: bool | None


class TraitementAerienRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    pilote: str
    mecanicien: str
    chef_de_base_id: uuid.UUID
    consultant_international: str | None
    base_principale: str
    stand: str | None
    stand_date_installation: date | None
    base_secondaire: str | None
    base_secondaire_date_installation: date | None
    immatricule_aeronef: str
    nb_rotations: int
    total_pesticide_l: float
    total_pesticide_kg: float
    surface_traitee_ha: float
    # Chaînage de reprise (migration 0050) — mirroir de TraitementTerrestreRead.
    reprise_traitement: bool
    traitement_origine_id: uuid.UUID | None
    surface_cumulee_ha: float
    surface_restante_ha: float | None
    pesticide_recu_l: float | None
    pesticide_stock_restant_l: float | None
    taux_mortalite_pourcent: float | None
    evaluation_efficacite_heures_apres: float | None
    methode_evaluation_efficacite: MethodeEvaluationEfficacite | None
    rotations: list[RotationRead] = []
    blocs: list[BlocRead] = []


class TraitementTerrestreRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    heure_debut: time
    heure_fin: time
    vitesse_vent_ms: float
    direction_vent: DirectionVent | None
    temperature_c: float
    taux_mortalite_pourcent: float | None
    evaluation_efficacite_heures_apres: float | None
    methode_evaluation_efficacite: MethodeEvaluationEfficacite | None
    reprise_traitement: bool
    traitement_origine_id: uuid.UUID | None
    chef_equipe_id: uuid.UUID
    agent_encadreur: str | None
    consultant_international: str | None
    surface_atomiseur_ha: float | None
    surface_disque_rotatif_ha: float | None
    surface_atomiseur_autoporte_ha: float | None
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
    evaluations_risque_population: list[EvaluationRisquePopulationRead] = []

    # Champ dérivé, non stocké (#numero-fiche-prospection-liee) — résolu par
    # TraitementRepositoryImpl à partir de `prospection_id`, jamais accepté en
    # entrée (absent de TraitementCreate/Update) : la seule relation entre les
    # deux fiches reste `prospection_id`, ce champ n'en est qu'une lecture.
    prospection_n_fiche: str | None = None
