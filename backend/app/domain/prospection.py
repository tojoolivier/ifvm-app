import uuid
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any

# Qui peut déclencher quelle transition — `admin` peut se substituer à
# verificateur/validation_finale sur toutes les fiches (déploiements où ces
# rôles dédiés n'existent pas encore ou ne sont pas utilisés). `prospecteur`
# reste strictement le seul à pouvoir soumettre son propre brouillon.
_TRANSITIONS: dict[str, dict[str, list[str]]] = {
    "brouillon": {"en_attente": ["prospecteur"]},
    "en_attente": {"verifiee": ["verificateur", "admin"]},
    "verifiee": {
        "validee": ["validation_finale", "admin"],
        "rejetee": ["validation_finale", "admin"],
    },
}

# Au-delà de ce délai depuis `validated_at` sans traitement associé, une fiche
# extensive/validation n'est plus fiable pour déclencher un traitement (surface
# infestée et localisation des criquets peuvent avoir changé) — elle doit être
# revalidée (`ProspectionRepositoryImpl.list_by_filters`, filtres
# `disponible_pour_traitement`/`a_revalider`). Jamais l'intensive : cette règle
# est propre aux fiches qui alimentent directement une décision de traitement.
DELAI_REVALIDATION_JOURS = 5
TYPES_PROSPECTION_SOUMIS_REVALIDATION = ("extensive", "validation")


class ProspectionIntegriteError(Exception):
    """La fiche viole une contrainte de la base autre que la référence à la station."""


class ProspectionNonValideeError(PermissionError):
    """Le PDF (#494/#594) n'est disponible que pour une fiche validée — symétrique de
    `TraitementNonValideeError` (#495)."""


class StadeInconnuError(Exception):
    """Une capture référence un stade absent du référentiel."""

    def __init__(self, codes: set[str]):
        self.codes = codes
        super().__init__("stade(s) absent(s) du référentiel : " + ", ".join(sorted(codes)))


class SurfaceInfesteeSuperieureError(ValueError):
    """La surface infestée dépasse la surface prospectée — impossible quel que soit
    le type de fiche (intensive, extensive, validation) : la zone infestée relevée
    ne peut pas être plus grande que la zone effectivement parcourue."""


def valider_surfaces_prospection(
    surface_prospectee: float | None,
    surface_infestee: float | None,
    surface_station: float | None = None,
) -> None:
    """La surface infestée ne dépasse jamais la surface prospectée.

    Sur les fiches Extensif / Validation / Revalidation, l'écran mobile ne collecte
    pas `surface_prospectee` : le champ « Surface prospectée » qu'il affiche est
    enregistré dans `surface_station`. À défaut de `surface_prospectee`, c'est donc
    `surface_station` qui sert de plafond — sinon ces fiches (revalidations comprises)
    échappaient à tout contrôle. Aucun contrôle si la surface infestée ou tout plafond
    est inconnu — rien à comparer.
    """
    plafond = surface_prospectee if surface_prospectee is not None else surface_station
    if plafond is None or surface_infestee is None:
        return
    if surface_infestee > plafond:
        raise SurfaceInfesteeSuperieureError(
            f"La surface infestée ({surface_infestee} ha) dépasse la surface "
            f"prospectée ({plafond} ha)."
        )


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
    methode: str | None = None
    phase: str | None = None
    accouplement: str | None = None
    ponte: str | None = None

    # ==========================================
    # NOUVEAUX CHAMPS - Extensif Imagos (B)
    # ==========================================
    captures_sol: int | None = None
    captures_trans: int | None = None
    captures_greg: int | None = None
    stade_imago: str | None = None
    stades_imago: dict[str, int] | None = None
    essaim_observe: bool | None = None

    # ==========================================
    # NOUVEAUX CHAMPS - Extensif Larves (C)
    # ==========================================
    densites_larve: dict[str, int] | None = None
    tache_larvaire: bool | None = None
    bande_larvaire: bool | None = None
    interdistance: float | None = None
    deplacement: str | None = None
    surface_contaminee_ha: float | None = None

    # ==========================================
    # NOUVEAUX CHAMPS - Extensif Imagos : Type de cible, État/Comportement
    # ==========================================
    type_cible: list[str] = field(default_factory=list)
    direction_de: str | None = None
    direction_vers: str | None = None
    etat: str | None = None
    essaim_en_vol: bool | None = None
    essaim_pose: bool | None = None


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
    surface_totale: float | None = None
    densite_min: float | None = None
    densite_max: float | None = None
    densite_moy: float | None = None
    interdistance: float | None = None
    comportement: str | None = None
    direction_de: str | None = None
    direction_vers: str | None = None
    vent_de: str | None = None
    vent_vitesse: float | None = None
    surface_infestee_pourcent: float | None = None

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
    type_larve: str | None = None
    stade_dominant: str | None = None
    taille_groupe_m2: float | None = None
    front_longueur_m: float | None = None
    front_largeur_m: float | None = None
    densite_max_front: float | None = None
    densite_moy_arriere_front: float | None = None


@dataclass
class ProspectionOperationAerienne:
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    prospection_id: uuid.UUID = field(default_factory=uuid.uuid4)
    numero: int = 0
    type_operation: str = ""
    # Pertinent seulement si type_operation == "divers" — laissé libre sinon.
    motif_divers: str | None = None
    debut_heure: str = ""
    debut_temperature_c: float | None = None
    debut_vent_ms: float | None = None
    fin_heure: str = ""
    fin_temperature_c: float | None = None
    fin_vent_ms: float | None = None
    # Calculée par CreateProspection.execute (gère le passage de minuit) — jamais
    # fait confiance à une valeur envoyée par le client.
    duree_minutes: int = 0


@dataclass
class Prospection:
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    type_prospection: str = ""
    campagne_id: uuid.UUID = field(default_factory=uuid.uuid4)
    prospecteur_id: uuid.UUID = field(default_factory=uuid.uuid4)
    station_id: uuid.UUID | None = None
    n_fiche: str | None = None
    n_message: str | None = None
    date_prospection: date = field(default_factory=date.today)
    latitude: float | None = None
    longitude: float | None = None
    altitude: float | None = None
    biotope: list[str] = field(default_factory=list)  # Multi-select (#biotope-multi)
    surface_station: float | None = None
    surface_prospectee: float | None = None
    surface_infestee: float | None = None
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
    # Auto-référence vers la fiche périmée que CETTE fiche revalide (extensive/
    # validation validées depuis plus de DELAI_REVALIDATION_JOURS sans
    # traitement) — mirroir de Traitement.traitement_origine_id, cf. migration
    # 0062. `None` : fiche "normale", jamais une revalidation.
    revalide_de_id: uuid.UUID | None = None
    # Équipe qui a mené la fiche (#607, ADR-018) — nullable (fiches déjà
    # enregistrées avant ce chantier), exigée côté ProspectionCreate pour
    # toute nouvelle fiche (cf. CreateProspection._valider_equipe).
    equipe_id: uuid.UUID | None = None
    # Vol de prospection ayant produit cette fiche (#610) — nullable, 1:N porté
    # ici (une sortie aérienne produit typiquement plusieurs fiches). Cf.
    # ProspectionModel.vol_id.
    vol_id: uuid.UUID | None = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

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
    type_station: list[str] = field(default_factory=list)  # Multi-select, reste facultatif
    verdure_strate: str | None = None
    signalement_source: str | None = None
    signalement_date: str | None = None
    signalement_description: str | None = None
    conclusion_validation: str | None = None

    # ==========================================
    # NOUVEAUX CHAMPS - Avertissements non bloquants (#106)
    # ==========================================
    avertissements: list[str] = field(default_factory=list)

    # ==========================================
    # NOUVEAUX CHAMPS - Extensif : mode aérien
    # ==========================================
    mode_extensif: str | None = None
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
    # Pesticides embarqués (nom commercial, quantités, fûts) supprimés par la
    # migration 0084 (#pesticide-embarque-prospection) : une prospection est une
    # reconnaissance, l'aéronef n'embarque jamais de pesticide pendant son vol.
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

    populations: list[ProspectionPopulation] = field(default_factory=list)
    captures: list[ProspectionCapture] = field(default_factory=list)
    infestations: list[ProspectionInfestation] = field(default_factory=list)
    operations_aeriennes: list[ProspectionOperationAerienne] = field(default_factory=list)

    # ==========================================
    # Champs dérivés, non stockés (#fiches-validees-multi-utilisateurs) — résolus
    # par le repository (jointure sur `utilisateur`) pour l'affichage de la liste
    # « Consulter une fiche validée » : évite un aller-retour supplémentaire par
    # fiche pour résoudre prospecteur_id/verified_by/validated_by en noms.
    # ==========================================
    prospecteur_nom: str | None = None
    verified_by_nom: str | None = None
    validated_by_nom: str | None = None

    def apply_transition(self, nouveau_statut: str, acteur_role: str, acteur_id: uuid.UUID) -> str:
        """Valide et applique une transition de statut. Retourne l'action d'audit.

        Raises ValueError pour transition inexistante, PermissionError pour rôle non autorisé.

        `verified_by`/`verified_at` et `validated_by`/`validated_at` existaient déjà
        sur le modèle (colonnes + dataclass) mais n'étaient renseignés nulle part —
        colonnes mortes depuis leur ajout. Les peupler ici, au seul endroit qui fait
        transitionner le statut, plutôt que d'ajouter une nouvelle migration/colonne
        pour « qui a validé, quand » (déjà présent, juste jamais écrit).
        """
        transitions = _TRANSITIONS.get(self.statut, {})
        if nouveau_statut not in transitions:
            raise ValueError(f"Transition '{self.statut}' → '{nouveau_statut}' invalide")
        roles_autorises = transitions[nouveau_statut]
        if acteur_role not in roles_autorises:
            raise PermissionError(
                f"Rôle '{acteur_role}' non autorisé pour passer de "
                f"'{self.statut}' à '{nouveau_statut}'"
            )
        self.statut = nouveau_statut
        now = datetime.utcnow()
        self.updated_at = now
        if nouveau_statut == "verifiee":
            self.verified_by = acteur_id
            self.verified_at = now
        elif nouveau_statut == "validee":
            self.validated_by = acteur_id
            self.validated_at = now
        return _ACTION_MAP[nouveau_statut]

    def verifier_disponible_pour_pdf(self) -> None:
        """Garde pour la génération du PDF (#494/#594) : uniquement pour une fiche
        de prospection validée, symétrique de `Traitement.verifier_disponible_pour_pdf`."""
        if self.statut != "validee":
            raise ProspectionNonValideeError("Le PDF n'est disponible que pour une fiche validée")


@dataclass
class AuditLog:
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    fiche_type: str = ""
    fiche_id: uuid.UUID = field(default_factory=uuid.uuid4)
    auteur_id: uuid.UUID = field(default_factory=uuid.uuid4)
    action: str = ""
    details: dict[str, Any] | None = None
    created_at: datetime = field(default_factory=datetime.utcnow)
