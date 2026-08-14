import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, time
from typing import Any

from app.domain.prospection import Prospection

# Matrice de signatures (CDG section 3) : rôle de signature -> champ de saisie dont le
# renseignement rend la signature obligatoire, par type de traitement. L'agent encadreur
# est volontairement absent des deux branches : il ne signe jamais, même renseigné — déjà
# garanti structurellement par la contrainte CHECK sur traitement_signature.role (migration
# 0010), qui n'énumère pas AGENT_ENCADREUR.
_MATRICE_SIGNATURES: dict[str, dict[str, str]] = {
    "AERIEN": {
        "PILOTE": "pilote",
        "MECANICIEN": "mecanicien",
        "CHEF_DE_BASE": "chef_de_base_id",
        "CONSULTANT_INTERNATIONAL": "consultant_international",
    },
    "TERRESTRE": {
        "CHEF_EQUIPE": "chef_equipe_id",
        "CONSULTANT_INTERNATIONAL": "consultant_international",
    },
}


class ProspectionIntrouvableError(LookupError):
    """La prospection liée au traitement n'existe pas."""


class ChefDeBaseInvalideError(PermissionError):
    """chef_de_base_id ne référence pas un utilisateur avec le rôle chef_de_base."""


class ChefEquipeInvalideError(PermissionError):
    """chef_equipe_id ne référence pas un utilisateur avec le rôle chef_equipe."""


class NumeroFicheConflitError(Exception):
    """Le numero_fiche viole la contrainte UNIQUE — l'appelant doit réessayer avec un suffixe."""


class TraitementIntrouvableError(LookupError):
    """Le traitement référencé n'existe pas, ou n'est pas de type aérien."""


class RotationIntrouvableError(LookupError):
    """La rotation référencée n'existe pas pour ce traitement aérien."""


class ProduitUtiliseIntrouvableError(LookupError):
    """Le produit utilisé référencé n'existe pas pour ce traitement terrestre."""


class TraitementOrigineIntrouvableError(LookupError):
    """traitement_origine_id ne référence pas un traitement terrestre existant."""


class TraitementOrigineDejaUtiliseeError(Exception):
    """La fiche d'origine est déjà désignée comme origine par une autre fiche (chaîne linéaire)."""


class TraitementVerrouilleError(PermissionError):
    """La fiche n'est plus `brouillon` — verrouillage post-validation."""


class SignaturesManquantesError(ValueError):
    """Un ou plusieurs rôles renseignés n'ont pas de signature correspondante (CDG §9)."""


class MotifAbandonManquantError(ValueError):
    """surface_restante_abandonnee=True sans motif renseigné (CDG §9)."""


class TraitementValideeSyncRejeteError(Exception):
    """Fiche serveur déjà `validee` : rejet systématique de toute synchronisation entrante,
    avant même toute comparaison de contenu (ADR-002 / décision #60) — `statut_sync` reste
    `synced`, jamais `conflict`, sur une fiche verrouillée."""

    def __init__(self, traitement_serveur: "Traitement"):
        self.traitement_serveur = traitement_serveur
        super().__init__("La fiche est verrouillée (validée) — synchronisation rejetée")


class TraitementSyncConflitError(Exception):
    """Conflit de synchronisation (décision #60) : `updated_at` serveur postérieur au
    `base_updated_at` connu du client, et contenu divergent. La fiche entrante est
    rejetée, `statut_sync` passe à `conflict` côté serveur, jamais de résolution
    automatique."""

    def __init__(self, traitement_serveur: "Traitement"):
        self.traitement_serveur = traitement_serveur
        super().__init__("Conflit de synchronisation — la version serveur fait foi")


@dataclass
class Cible:
    traitement_id: uuid.UUID = field(default_factory=uuid.uuid4)
    espece: str | None = None
    petites_larves: str | None = None
    grandes_larves: str | None = None
    vols_clairs_essaims: str | None = None
    repartition_population: str | None = None
    surface_infestee_ha: float | None = None


@dataclass
class Rotation:
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    traitement_aerien_id: uuid.UUID = field(default_factory=uuid.uuid4)
    numero: int = 0
    numero_cuve: str = ""
    produit_id: uuid.UUID = field(default_factory=uuid.uuid4)
    quantite_l: float = 0.0
    temperature_debut_c: float = 0.0
    temperature_fin_c: float = 0.0
    vent_debut_ms: float = 0.0
    vent_fin_ms: float = 0.0


@dataclass
class TraitementAerien:
    traitement_id: uuid.UUID = field(default_factory=uuid.uuid4)
    pilote: str = ""
    mecanicien: str = ""
    chef_de_base_id: uuid.UUID = field(default_factory=uuid.uuid4)
    consultant_international: str | None = None
    nb_rotations: int = 0
    total_pesticide_l: float | None = None
    rotations: list[Rotation] = field(default_factory=list)

    def recalculer_totaux(self) -> None:
        """Seul chemin d'écriture pour nb_rotations/total_pesticide_l — jamais en lecture."""
        self.nb_rotations = len(self.rotations)
        self.total_pesticide_l = (
            sum(r.quantite_l for r in self.rotations) if self.rotations else None
        )


@dataclass
class ProduitUtilise:
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    traitement_terrestre_id: uuid.UUID = field(default_factory=uuid.uuid4)
    numero: int = 0
    produit_id: uuid.UUID = field(default_factory=uuid.uuid4)
    quantite_l: float = 0.0


@dataclass
class TraitementTerrestre:
    traitement_id: uuid.UUID = field(default_factory=uuid.uuid4)
    heure_debut: time = field(default_factory=lambda: time(0, 0))
    heure_fin: time = field(default_factory=lambda: time(0, 0))
    vitesse_vent_ms: float = 0.0
    direction_vent: str | None = None
    temperature_c: float = 0.0
    reprise_traitement: bool = False
    traitement_origine_id: uuid.UUID | None = None
    chef_equipe_id: uuid.UUID = field(default_factory=uuid.uuid4)
    agent_encadreur_id: uuid.UUID | None = None
    consultant_international: str | None = None
    surface_atomiseur_ha: float | None = None
    surface_disque_rotatif_ha: float | None = None
    surface_ulvamast_ha: float | None = None
    surface_traitee_ha: float | None = None
    surface_cumulee_ha: float | None = None
    surface_restante_ha: float | None = None
    surface_restante_abandonnee: bool | None = None
    motif_surface_restante_abandonnee: str | None = None
    essence_litres: float | None = None
    nb_piles: int | None = None
    total_pesticide_l: float | None = None
    produits: list[ProduitUtilise] = field(default_factory=list)

    def recalculer_total_pesticide(self) -> None:
        """Seul chemin d'écriture pour total_pesticide_l — jamais en lecture."""
        self.total_pesticide_l = sum(p.quantite_l for p in self.produits) if self.produits else None

    def recalculer_surfaces(
        self, surface_infestee_ha: float | None, surface_cumulee_precedente: float = 0.0
    ) -> None:
        """Seul chemin d'écriture pour surface_traitee_ha/surface_cumulee_ha/surface_restante_ha.

        surface_restante_ha est ramenée à 0 si négative (critère CDG §9).
        """
        self.surface_traitee_ha = (
            (self.surface_atomiseur_ha or 0.0)
            + (self.surface_disque_rotatif_ha or 0.0)
            + (self.surface_ulvamast_ha or 0.0)
        )
        self.surface_cumulee_ha = surface_cumulee_precedente + self.surface_traitee_ha
        self.surface_restante_ha = (
            max(surface_infestee_ha - self.surface_cumulee_ha, 0.0)
            if surface_infestee_ha is not None
            else None
        )


@dataclass
class TraitementSignature:
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    traitement_id: uuid.UUID = field(default_factory=uuid.uuid4)
    role: str = ""
    signataire_nom: str = ""
    horodatage: datetime = field(default_factory=datetime.utcnow)


@dataclass
class Traitement:
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    prospection_id: uuid.UUID = field(default_factory=uuid.uuid4)
    numero_fiche: str = ""
    type_traitement: str = "AERIEN"
    mode_traitement: str | None = None
    date_traitement: date = field(default_factory=date.today)
    date_validation: date = field(default_factory=date.today)
    localite: str = ""
    region: str | None = None
    district: str | None = None
    commune: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    altitude: float | None = None
    kit_combinaison: bool = False
    kit_gants: bool = False
    kit_lunettes: bool = False
    kit_masques: bool = False
    kit_boite: bool = False
    zones_exposees: dict[str, Any] | None = None
    hauteur_strate_herbeuse_m: float | None = None
    hauteur_strate_arboree_m: float | None = None
    recouvrement_percent: int | None = None
    empoisonnement: bool = False
    empoisonnement_type: str | None = None
    empoisonnement_mode: str | None = None
    empoisonnement_autre: str | None = None
    evaluation_risque: dict[str, Any] | None = None
    comportement_anormal: bool = False
    comportement_non_cibles: dict[str, Any] | None = None
    mortalite: bool = False
    mortalite_familles: dict[str, Any] | None = None
    observations: str | None = None
    statut: str = "brouillon"
    statut_sync: str = "local"
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    cible: Cible | None = None
    aerien: TraitementAerien | None = None
    terrestre: TraitementTerrestre | None = None
    signatures: list[TraitementSignature] = field(default_factory=list)

    def verifier_modifiable(self) -> None:
        """Garde commune, réutilisée par tous les writes (rotations, produits, validation).

        Un seul point de vérité pour le verrouillage post-validation (décision #64).
        """
        if self.statut != "brouillon":
            raise TraitementVerrouilleError("Seules les fiches en brouillon peuvent être modifiées")

    def valider(
        self, date_validation: date, signatures: list[dict[str, str]]
    ) -> list[TraitementSignature]:
        """Applique la matrice de signatures puis transitionne vers `validee` (CDG §9).

        Dernier verrou avant verrouillage définitif — appelé juste avant la transition de
        statut et avant l'écriture des lignes `traitement_signature`, jamais après.
        """
        self.verifier_modifiable()

        if date_validation < self.date_traitement:
            raise ValueError("date_validation doit être postérieure ou égale à date_traitement")

        specialisation = self.aerien if self.type_traitement == "AERIEN" else self.terrestre
        matrice = _MATRICE_SIGNATURES[self.type_traitement]

        fournies = {s["role"]: s["signataire_nom"] for s in signatures}

        roles_invalides = set(fournies) - set(matrice)
        if roles_invalides:
            raise ValueError(
                "Rôle(s) de signature invalide(s) pour ce type de traitement : "
                + ", ".join(sorted(roles_invalides))
            )

        manquants = [
            role
            for role, champ in matrice.items()
            if getattr(specialisation, champ) and role not in fournies
        ]
        if manquants:
            raise SignaturesManquantesError(
                "Signature(s) manquante(s) pour le(s) rôle(s) renseigné(s) : "
                + ", ".join(manquants)
            )

        if (
            self.type_traitement == "TERRESTRE"
            and self.terrestre.surface_restante_abandonnee
            and not self.terrestre.motif_surface_restante_abandonnee
        ):
            raise MotifAbandonManquantError(
                "motif_surface_restante_abandonnee est obligatoire lorsque "
                "surface_restante_abandonnee=True"
            )

        now = datetime.utcnow()
        signature_objs = [
            TraitementSignature(
                traitement_id=self.id, role=role, signataire_nom=nom, horodatage=now
            )
            for role, nom in fournies.items()
        ]

        self.date_validation = date_validation
        self.statut = "validee"
        self.signatures = signature_objs
        return signature_objs


_CHAMPS_CONTENU_COMMUNS = (
    "prospection_id",
    "numero_fiche",
    "mode_traitement",
    "date_traitement",
    "date_validation",
    "localite",
    "region",
    "district",
    "commune",
    "latitude",
    "longitude",
    "altitude",
    "kit_combinaison",
    "kit_gants",
    "kit_lunettes",
    "kit_masques",
    "kit_boite",
    "zones_exposees",
    "hauteur_strate_herbeuse_m",
    "hauteur_strate_arboree_m",
    "recouvrement_percent",
    "empoisonnement",
    "empoisonnement_type",
    "empoisonnement_mode",
    "empoisonnement_autre",
    "evaluation_risque",
    "comportement_anormal",
    "comportement_non_cibles",
    "mortalite",
    "mortalite_familles",
)

_CHAMPS_CONTENU_AERIEN = ("pilote", "mecanicien", "chef_de_base_id", "consultant_international")

_CHAMPS_CONTENU_TERRESTRE = (
    "heure_debut",
    "heure_fin",
    "vitesse_vent_ms",
    "direction_vent",
    "temperature_c",
    "reprise_traitement",
    "traitement_origine_id",
    "chef_equipe_id",
    "agent_encadreur_id",
    "consultant_international",
    "surface_atomiseur_ha",
    "surface_disque_rotatif_ha",
    "surface_ulvamast_ha",
    "surface_restante_abandonnee",
    "motif_surface_restante_abandonnee",
    "essence_litres",
    "nb_piles",
)


def contenu_diverge(existant: "Traitement", entrant: "Traitement") -> bool:
    """Compare le contenu métier de deux fiches, hors champs techniques (`statut`,
    `statut_sync`, `created_at`, `updated_at`) et hors champs dérivés en lecture seule
    (`cible`, surfaces calculées, rotations/produits/signatures — gérés par leurs propres
    endpoints, absents du payload de synchronisation).

    Un renvoi réseau (même contenu) doit être traité `synced` sans jamais être vu comme un
    conflit (décision #60) — cette fonction est le point de vérité unique pour "diverge".
    """
    if any(
        getattr(existant, champ) != getattr(entrant, champ) for champ in _CHAMPS_CONTENU_COMMUNS
    ):
        return True
    if existant.type_traitement == "AERIEN":
        return any(
            getattr(existant.aerien, champ) != getattr(entrant.aerien, champ)
            for champ in _CHAMPS_CONTENU_AERIEN
        )
    return any(
        getattr(existant.terrestre, champ) != getattr(entrant.terrestre, champ)
        for champ in _CHAMPS_CONTENU_TERRESTRE
    )


def generer_numero_fiche(
    prenom_chef: str,
    date_traitement: date,
    suffixe: int | None = None,
    type_traitement: str = "Aerien",
) -> str:
    """Numéro de fiche lisible: [Prénom du chef]-[Aerien|Terrestre]-[Date], suffixe si collision."""
    base = f"{prenom_chef}-{type_traitement}-{date_traitement.isoformat()}"
    if suffixe is None:
        return base
    return f"{base}-{suffixe}"


def construire_cible(prospection: Prospection) -> Cible:
    """Snapshot en lecture seule de la cible depuis la fiche de prospection liée.

    Les champs absents côté prospection restent à None (affichés « non renseigné »
    côté présentation). surface_infestee_ha est NOT NULL en base: 0 si inconnue.
    """
    especes = {p.espece for p in prospection.populations if p.espece}
    especes |= {i.espece for i in prospection.infestations if i.espece}
    if not especes:
        espece = None
    elif len(especes) == 1:
        espece = especes.pop()
    else:
        espece = "MELANGE"

    petites_total = 0
    grandes_total = 0
    larves_renseignees = False
    for p in prospection.populations:
        if p.categorie != "larve" or not p.densites_larve:
            continue
        for stade, densite in p.densites_larve.items():
            larves_renseignees = True
            if stade.upper() in ("L1", "L2"):
                petites_total += densite
            else:
                grandes_total += densite

    essaims = [p.essaim_observe for p in prospection.populations if p.essaim_observe is not None]
    if any(essaims):
        vols_clairs_essaims = "oui"
    elif essaims:
        vols_clairs_essaims = "non"
    else:
        vols_clairs_essaims = None

    if any(p.densite_groupee is not None for p in prospection.populations):
        repartition = "GROUPEE"
    elif any(p.densite_diffuse is not None for p in prospection.populations):
        repartition = "DIFFUSE"
    else:
        repartition = None

    return Cible(
        espece=espece,
        petites_larves=str(petites_total) if larves_renseignees else None,
        grandes_larves=str(grandes_total) if larves_renseignees else None,
        vols_clairs_essaims=vols_clairs_essaims,
        repartition_population=repartition,
        surface_infestee_ha=prospection.surface_infestee,
    )
