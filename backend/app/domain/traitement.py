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


class RolesAerienNonDistinctsError(ValueError):
    """Chef de base, pilote et mécanicien (aérien) ne désignent pas trois personnes
    distinctes — migration 0048 (retour de pilote/mécanicien en texte libre)."""


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


def _stock_pesticide_restant(recu: float | None, consomme: float | None) -> float | None:
    """« Reste en stock » = reçu − consommé, plancher à 0 (même convention que
    `surface_restante_ha`, CDG §9). `None` tant que « reçu » n'est pas renseigné —
    un stock ne se déduit pas d'une consommation seule."""
    if recu is None:
        return None
    return max(recu - (consomme or 0.0), 0.0)


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
    # Dérivé de `numero` (str(numero)) côté application — plus de saisie libre
    # (migration 0047) : le numéro de cuve s'incrémente automatiquement par
    # traitement, comme `numero`.
    numero_cuve: str = ""
    produit_id: uuid.UUID = field(default_factory=uuid.uuid4)
    # quantite_l -> quantite + unite (migration 0047) : une seule quantité par
    # rotation avec son unité, jamais L et kg à la fois pour une même rotation.
    quantite: float = 0.0
    unite: str = "L"
    # Superficie couverte par cette rotation — traitement_aerien.surface_traitee_ha
    # en est la somme (cf. TraitementAerien.recalculer_totaux).
    surface_ha: float = 0.0
    temperature_debut_c: float = 0.0
    temperature_fin_c: float = 0.0
    vent_debut_ms: float = 0.0
    vent_fin_ms: float = 0.0
    # heure_debut/heure_fin bornent la rotation entière (mise en place +
    # application) ; heure_ouverture_vanne/heure_fermeture_vanne bornent
    # l'application seule — distinctes depuis la migration 0047. Durée
    # d'application, durée totale et durée de mise en place s'en dérivent côté
    # application, aucune des trois n'est stockée.
    heure_debut: time = time(0, 0)
    heure_ouverture_vanne: time = time(0, 0)
    heure_fermeture_vanne: time = time(0, 1)
    heure_fin: time = time(0, 1)
    # Dérivé côté client du nom du pesticide (migration 0043) — figé à la
    # saisie, jamais recalculé à la lecture.
    nom_commercial: str | None = None


@dataclass
class TraitementAerien:
    traitement_id: uuid.UUID = field(default_factory=uuid.uuid4)
    # pilote/mecanicien/consultant_international sont redevenus du texte libre
    # (migration 0048) : le passage en FK utilisateur (migration 0047) a été
    # défait à la demande — pilote/mécanicien restent obligatoires,
    # consultant_international facultatif, comme `TraitementTerrestre.
    # consultant_international` déjà. chef_de_base_id reste seul en FK
    # (référentiel utilisateur), donc seul comparable par id ; la distinction
    # avec pilote/mécanicien se fait par nom (cf. `valider_roles_aerien_distincts`),
    # le texte libre ne garantissant pas l'identité comme un id.
    pilote: str = ""
    mecanicien: str = ""
    chef_de_base_id: uuid.UUID = field(default_factory=uuid.uuid4)
    consultant_international: str | None = None
    # Bases aériennes/stands (migration 0047) : base principale obligatoire pour
    # tout traitement aérien (aucune exception, contrairement à la prospection
    # généralisée) ; stand nullable (NULL = ravitaillement fait directement à
    # une base) ; base secondaire facultative.
    lieu_base_principale_id: uuid.UUID = field(default_factory=uuid.uuid4)
    lieu_stand_id: uuid.UUID | None = None
    lieu_base_secondaire_id: uuid.UUID | None = None
    immatricule_aeronef: str | None = None
    nb_rotations: int = 0
    # Deux cumuls distincts par unité (une rotation en L ne s'additionne jamais
    # à une rotation en kg) ; surface_traitee_ha n'est plus une saisie directe :
    # les trois sont dérivés des rotations, recalculés à chaque écriture sur
    # `traitement_rotation` — jamais None depuis la migration 0047 (NOT NULL,
    # défaut 0).
    total_pesticide_l: float = 0.0
    total_pesticide_kg: float = 0.0
    surface_traitee_ha: float = 0.0
    surface_restante_ha: float | None = None
    # Chaînage de reprise (migration 0050) — mirroir de TraitementTerrestre,
    # généralisé à l'Aérien : une prospection partiellement traitée par une
    # première fiche aérienne peut être reprise par une fiche suivante.
    reprise_traitement: bool = False
    traitement_origine_id: uuid.UUID | None = None
    # NOT NULL défaut 0, contrairement à son équivalent Terrestre (nullable) —
    # même choix que les autres champs dérivés ci-dessus.
    surface_cumulee_ha: float = 0.0
    # Stock de pesticide par fiche (pas de suivi cumulatif par aéronef/opération) :
    # « reçu » saisi, « consommé » = total_pesticide_l (dérivé des rotations),
    # « reste en stock » dérivé des deux.
    pesticide_recu_l: float | None = None
    pesticide_stock_restant_l: float | None = None
    rotations: list[Rotation] = field(default_factory=list)

    def recalculer_totaux(self) -> None:
        """Seul chemin d'écriture pour nb_rotations/total_pesticide_l/
        total_pesticide_kg/surface_traitee_ha — jamais en lecture."""
        self.nb_rotations = len(self.rotations)
        self.total_pesticide_l = sum(r.quantite for r in self.rotations if r.unite == "L")
        self.total_pesticide_kg = sum(r.quantite for r in self.rotations if r.unite == "kg")
        self.surface_traitee_ha = sum(r.surface_ha for r in self.rotations)
        self.recalculer_stock_pesticide()

    def recalculer_surfaces(
        self, surface_infestee_ha: float | None, surface_cumulee_precedente: float = 0.0
    ) -> None:
        """Seul chemin d'écriture pour surface_cumulee_ha/surface_restante_ha — jamais
        en lecture.

        Doit être appelée après `recalculer_totaux()` (ou après un ré-épinglage de
        `surface_traitee_ha` en synchronisation) : c'est `self.surface_traitee_ha`,
        dérivé des rotations, qui alimente ce calcul.

        `surface_cumulee_precedente` (migration 0050) : chaînage de reprise,
        mirroir de `TraitementTerrestre.recalculer_surfaces` — 0.0 par défaut
        (fiche indépendante, pas de reprise), sinon `surface_cumulee_ha` de la
        fiche d'origine. Plancher à 0 (CDG §9).
        """
        self.surface_cumulee_ha = surface_cumulee_precedente + self.surface_traitee_ha
        self.surface_restante_ha = (
            max(surface_infestee_ha - self.surface_cumulee_ha, 0.0)
            if surface_infestee_ha is not None
            else None
        )

    def recalculer_stock_pesticide(self) -> None:
        """Seul chemin d'écriture pour pesticide_stock_restant_l — jamais en lecture.

        Basé sur `total_pesticide_l` déjà à jour, pas recalculé depuis les rotations
        directement : reste utilisable lors d'une synchronisation où les rotations
        existantes ne sont pas rechargées (elles ne font pas partie du corps du push).
        """
        self.pesticide_stock_restant_l = _stock_pesticide_restant(
            self.pesticide_recu_l, self.total_pesticide_l
        )


@dataclass
class ProduitUtilise:
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    traitement_terrestre_id: uuid.UUID = field(default_factory=uuid.uuid4)
    numero: int = 0
    produit_id: uuid.UUID = field(default_factory=uuid.uuid4)
    quantite_l: float = 0.0
    # Dérivé côté client du nom du pesticide (migration 0043) — figé à la
    # saisie, jamais recalculé à la lecture.
    nom_commercial: str | None = None


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
    # Stock de pesticide par fiche — même patron que TraitementAerien.
    pesticide_recu_l: float | None = None
    pesticide_stock_restant_l: float | None = None
    produits: list[ProduitUtilise] = field(default_factory=list)

    def recalculer_total_pesticide(self) -> None:
        """Seul chemin d'écriture pour total_pesticide_l — jamais en lecture."""
        self.total_pesticide_l = sum(p.quantite_l for p in self.produits) if self.produits else None
        self.recalculer_stock_pesticide()

    def recalculer_stock_pesticide(self) -> None:
        """Seul chemin d'écriture pour pesticide_stock_restant_l — jamais en lecture.

        Voir `TraitementAerien.recalculer_stock_pesticide` : séparé de
        `recalculer_total_pesticide` pour rester appelable seul lors d'une
        synchronisation où les produits existants ne sont pas rechargés.
        """
        self.pesticide_stock_restant_l = _stock_pesticide_restant(
            self.pesticide_recu_l, self.total_pesticide_l
        )

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
    # Tracé du pavé de signature (mobile), sérialisé en chemin SVG — migration 0049.
    # `None` pour les lignes écrites avant cette migration (rétrocompatibilité) ;
    # le mobile exige désormais un tracé avant d'autoriser la validation d'un rôle.
    signature_image: str | None = None
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
    # Nombre de personnes équipées de chaque matériel de protection (toutes les
    # personnes à bord de l'hélicoptère/dans l'équipe doivent être équipées, pas
    # seulement « au moins une ») — plus des cases à cocher depuis la migration 0036.
    kit_combinaison: int = 0
    kit_gants: int = 0
    kit_lunettes: int = 0
    kit_masques: int = 0
    kit_botte: int = 0
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
        self, date_validation: date, signatures: list[dict[str, str | None]]
    ) -> list[TraitementSignature]:
        """Applique la matrice de signatures puis transitionne vers `validee` (CDG §9).

        Dernier verrou avant verrouillage définitif — appelé juste avant la transition de
        statut et avant l'écriture des lignes `traitement_signature`, jamais après.
        """
        self.verifier_modifiable()

        if date_validation > self.date_traitement:
            raise ValueError("date_traitement doit être postérieure ou égale à date_validation")

        specialisation = self.aerien if self.type_traitement == "AERIEN" else self.terrestre
        matrice = _MATRICE_SIGNATURES[self.type_traitement]

        fournies = {s["role"]: s for s in signatures}

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
                traitement_id=self.id,
                role=role,
                signataire_nom=info["signataire_nom"],
                signature_image=info.get("signature_image"),
                horodatage=now,
            )
            for role, info in fournies.items()
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
    "kit_botte",
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


def _normaliser_nom(valeur: str) -> str:
    """Espaces superflus et casse ignorés — le texte libre ne garantit pas
    l'identité comme un id, mais « Jean RAKOTO » et « jean   rakoto » doivent
    être reconnus comme la même personne."""
    return " ".join(valeur.split()).casefold()


def valider_roles_aerien_distincts(chef_nom: str, pilote: str, mecanicien: str) -> None:
    """Chef de base, pilote et mécanicien doivent désigner trois personnes
    distinctes (migration 0048) — le consultant est exempté (facultatif, rôle
    non structurant, cf. spec #equipe-slide-aerien)."""
    roles = {"chef de base": chef_nom, "pilote": pilote, "mécanicien": mecanicien}
    normalises = {role: _normaliser_nom(nom) for role, nom in roles.items()}
    noms = list(normalises.items())
    for i in range(len(noms)):
        for j in range(i + 1, len(noms)):
            if noms[i][1] == noms[j][1]:
                raise RolesAerienNonDistinctsError(
                    "Cette personne est déjà affectée à un autre rôle. "
                    "Veuillez sélectionner une personne différente."
                )


_CHAMPS_CONTENU_AERIEN = (
    "pilote",
    "mecanicien",
    "chef_de_base_id",
    "consultant_international",
    "lieu_base_principale_id",
    "lieu_stand_id",
    "lieu_base_secondaire_id",
    "immatricule_aeronef",
    # surface_traitee_ha n'y figure plus (migration 0047) : dérivée des rotations
    # (sous-ressource distincte, absente du payload de synchronisation), au même
    # titre que nb_rotations/total_pesticide_l/total_pesticide_kg déjà exclus.
    "pesticide_recu_l",
)

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
    "pesticide_recu_l",
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
