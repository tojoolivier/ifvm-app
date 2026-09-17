"""Fiche de vol — domaine pur.

Cahier des charges « Formulaire de gestion des heures de vol » ; cadrage et arbitrage
dans docs/adr/ADR-011 (§7).

Trois invariants structurent ce module :

- **Rien de dérivable n'est stocké.** Durée d'un vol, cumuls journalier / hebdomadaire /
  mensuel / total, décompte des rotations rapprochées : tous calculés ici. Les figer en
  colonnes créerait des dépendances fonctionnelles dont le déterminant n'est pas superclé,
  donc des lignes capables de se contredire après une simple correction d'horaire.
- **Le rattachement d'un vol dépend de son type.** `MEP` et `APPLICATION` pointent une
  rotation, `PROSPECTION` pointe une prospection, `CONVOYAGE` et `DIVERS` ne pointent rien.
- **Une rotation vaut au moins deux vols.** « Une rotation (une cuve) nécessite au minimum
  1 mise en place + 1 application » — c'est ce qui distingue un vol d'une rotation, et ce
  que la maquette §8 du handoff web avait manqué.
"""

import re
import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, time

TYPES_VOL: tuple[str, ...] = ("PROSPECTION", "MEP", "APPLICATION", "CONVOYAGE", "DIVERS")

# Seuls ces deux types matérialisent une rotation ; leur couple épuise une cuve.
TYPES_VOL_ROTATION: tuple[str, ...] = ("MEP", "APPLICATION")

ROLES_SIGNATURE: tuple[str, ...] = (
    "PILOTE",
    "MECANICIEN",
    "CHEF_DE_BASE",
    "CONSULTANT_INTERNATIONAL",
)

# Rôle de signature -> champ de la fiche dont le renseignement la rend obligatoire.
# Même conventions que _MATRICE_SIGNATURES côté traitement (app/domain/traitement.py).
_MATRICE_SIGNATURES: dict[str, str] = {
    "PILOTE": "pilote",
    "MECANICIEN": "mecanicien",
    "CHEF_DE_BASE": "chef_de_base_id",
    "CONSULTANT_INTERNATIONAL": "consultant_international",
}


class FicheVolIntrouvableError(LookupError):
    """La fiche de vol référencée n'existe pas."""


class VolIntrouvableError(LookupError):
    """Le vol référencé n'existe pas pour cette fiche."""


class NumeroFicheVolConflitError(Exception):
    """Le numero_fiche viole la contrainte UNIQUE — l'appelant doit réessayer avec un suffixe."""


class FicheVolVerrouilleeError(PermissionError):
    """La fiche n'est plus `brouillon` — verrouillage post-validation."""


class VolRattachementInvalideError(ValueError):
    """Le rattachement du vol est incompatible avec son type."""


class HeuresVolIncoherentesError(ValueError):
    """heure_fin n'est pas postérieure à heure_debut — un vol ne franchit pas minuit."""


class RotationsIncompletesError(ValueError):
    """Une rotation rapprochée n'a pas sa paire mise en place / application."""


class SignaturesVolManquantesError(ValueError):
    """Un ou plusieurs rôles renseignés n'ont pas de signature correspondante."""


class ChefDeBaseVolInvalideError(PermissionError):
    """chef_de_base_id ne référence pas un utilisateur avec le rôle chef_de_base."""


class RotationVolIntrouvableError(LookupError):
    """rotation_id ne référence aucune rotation de traitement aérien."""


class ProspectionVolIntrouvableError(LookupError):
    """prospection_id ne référence aucune prospection."""


class BaseVolIntrouvableError(LookupError):
    """base_id ne référence aucune base_aerienne."""


class StandVolIntrouvableError(LookupError):
    """stand_id ne référence aucun stand_remplissage."""


class CampagneVolIntrouvableError(LookupError):
    """campagne_id ne référence aucune campagne."""


class RotationDejaRapprocheeError(Exception):
    """Cette rotation a déjà un vol de ce type — une rotation vaut une MEP et une
    application, pas deux."""


class FicheVolValideeSyncRejeteError(Exception):
    """Fiche serveur déjà `validee` : rejet systématique de toute synchronisation
    entrante, avant même toute comparaison de contenu — même patron que
    `TraitementValideeSyncRejeteError` (app/domain/traitement.py). `statut_sync` reste
    `synced`, jamais `conflict`, sur une fiche verrouillée."""

    def __init__(self, fiche_vol_serveur: "FicheVol"):
        self.fiche_vol_serveur = fiche_vol_serveur


class FicheVolSyncConflitError(Exception):
    """Conflit de synchronisation : `updated_at` serveur postérieur au
    `base_updated_at` connu du client, et contenu divergent. La fiche entrante est
    rejetée, `statut_sync` passe à `conflict` côté serveur, jamais de résolution
    automatique — même patron que `TraitementSyncConflitError`."""

    def __init__(self, fiche_vol_serveur: "FicheVol"):
        self.fiche_vol_serveur = fiche_vol_serveur


def composer_numero_fiche(compteur: int, date_vol: date, equipe: str, immatriculation: str) -> str:
    """`[Compteur 3 chiffres]-[Date]-[Équipe]-[Immatriculation]` — arbitrage du 2026-09-15,
    remplace le format `[Date]-[Base]-[Immatriculation]` d'ADR-011 §7.2/§5.

    `compteur` est **continu sur toute la campagne**, jamais réinitialisé : il vient de
    `campagne_fiche_vol_compteur`, incrémenté atomiquement côté serveur (jamais côté
    client) — voir `FicheVolRepositoryImpl.next_compteur`. C'est lui, pas ce fragment de
    texte, qui porte l'unicité (`UNIQUE(campagne_id, compteur)`) ; l'ancien mécanisme de
    suffixe en cas de collision n'est donc plus nécessaire. `equipe` est le `numero` de la
    base référencée par `fiche_vol.base_id`.
    """
    equipe_normalisee = _normaliser_fragment(equipe)
    immat = _normaliser_fragment(immatriculation)
    return f"{compteur:03d}-{date_vol.isoformat()}-{equipe_normalisee}-{immat}"


def _normaliser_fragment(valeur: str) -> str:
    """Majuscules, sans séparateur : `mdg a21` et `MDG-A21` désignent le même appareil."""
    return re.sub(r"[^A-Z0-9]", "", valeur.upper())


def valider_rattachement(
    type_vol: str, rotation_id: uuid.UUID | None, prospection_id: uuid.UUID | None
) -> None:
    if type_vol not in TYPES_VOL:
        raise VolRattachementInvalideError(
            f"type_vol inconnu : {type_vol!r} (attendu : {', '.join(TYPES_VOL)})"
        )
    if rotation_id is not None and type_vol not in TYPES_VOL_ROTATION:
        raise VolRattachementInvalideError(
            f"un vol {type_vol} ne se rattache pas à une rotation "
            f"(réservé à {', '.join(TYPES_VOL_ROTATION)})"
        )
    if prospection_id is not None and type_vol != "PROSPECTION":
        raise VolRattachementInvalideError(
            f"un vol {type_vol} ne se rattache pas à une prospection"
        )


def valider_heures(heure_debut: time, heure_fin: time) -> None:
    if heure_fin <= heure_debut:
        raise HeuresVolIncoherentesError(
            f"heure_fin ({heure_fin}) doit être postérieure à heure_debut ({heure_debut}) : "
            "un vol ne franchit pas minuit"
        )


def valider_rotations_completes(vols: "list[Vol]") -> None:
    """« Si l'aéronef effectue N rotations, il faut N mises en place + N applications. »"""
    par_rotation: dict[uuid.UUID, set[str]] = {}
    for vol in vols:
        if vol.rotation_id is not None:
            par_rotation.setdefault(vol.rotation_id, set()).add(vol.type_vol)

    incompletes = {
        rotation_id: sorted(set(TYPES_VOL_ROTATION) - types)
        for rotation_id, types in par_rotation.items()
        if not set(TYPES_VOL_ROTATION) <= types
    }
    if incompletes:
        detail = "; ".join(
            f"rotation {rotation_id} : {', '.join(manquants)} manquant(s)"
            for rotation_id, manquants in incompletes.items()
        )
        raise RotationsIncompletesError(detail)


def roles_signature_requis(fiche: "FicheVol") -> set[str]:
    return {role for role, champ in _MATRICE_SIGNATURES.items() if getattr(fiche, champ, None)}


def valider_signatures(fiche: "FicheVol") -> None:
    manquants = roles_signature_requis(fiche) - {s.role for s in fiche.signatures}
    if manquants:
        raise SignaturesVolManquantesError(
            f"signatures manquantes : {', '.join(sorted(manquants))}"
        )


# Champs de contenu métier comparés pour détecter un conflit de synchronisation — hors
# champs techniques (statut, statut_sync, created_at, updated_at, compteur, numero_fiche,
# attribués une fois à la création, jamais renvoyés par le client) et hors champs dérivés
# en lecture seule (base_numero/..., pesticide_quantite_utilisee/restante, signatures —
# gérées par leur propre endpoint). Même patron que _CHAMPS_CONTENU_COMMUNS côté
# traitement (app/domain/traitement.py).
_CHAMPS_CONTENU_FICHE: tuple[str, ...] = (
    "date_vol",
    "compagnie",
    "immatriculation",
    "campagne_id",
    "base_id",
    "stand_id",
    "prospection_id",
    "pilote",
    "mecanicien",
    "chef_de_base_id",
    "consultant_international",
    "pesticide_nom_commercial",
    "pesticide_quantite_disponible",
    "pesticide_quantite_recue",
    "futs_disponible",
    "futs_recues",
    "futs_pleins",
    "futs_vides",
    "observations",
)

_CHAMPS_CONTENU_VOL: tuple[str, ...] = (
    "numero",
    "type_vol",
    "heure_debut",
    "heure_fin",
    "rotation_id",
    "prospection_id",
    "observations",
)


def _vol_diverge(existant: "Vol", entrant: "Vol") -> bool:
    return any(getattr(existant, champ) != getattr(entrant, champ) for champ in _CHAMPS_CONTENU_VOL)


def contenu_diverge(existante: "FicheVol", entrante: "FicheVol") -> bool:
    """Compare le contenu métier de deux fiches. Un renvoi réseau (même contenu) doit
    être traité `synced` sans jamais être vu comme un conflit (même décision que côté
    traitement) — cette fonction est le point de vérité unique pour "diverge".

    Contrairement à `traitement.contenu_diverge`, les `vols` font partie du contenu
    comparé : ce ne sont pas des sous-ressources à endpoints séparés comme
    rotations/produits, mais remplacées en bloc à chaque synchronisation (cf.
    `FicheVolRepositoryImpl.update_sync`) — comparés ici par `id` (attribué côté
    client, stable d'une synchronisation à l'autre).
    """
    if any(
        getattr(existante, champ) != getattr(entrante, champ) for champ in _CHAMPS_CONTENU_FICHE
    ):
        return True
    if len(existante.vols) != len(entrante.vols):
        return True
    vols_existants = {v.id: v for v in existante.vols}
    for vol in entrante.vols:
        pair = vols_existants.get(vol.id)
        if pair is None or _vol_diverge(pair, vol):
            return True
    return False


def cumuler_durees(fiches: "list[FicheVol]", reference: date) -> dict[str, int]:
    """Cumuls en minutes (cahier des charges §2). Dérivés — aucune colonne ne les porte.

    La semaine est la semaine **ISO** de `reference`, pas les sept derniers jours : c'est
    ce qu'attend un cumul hebdomadaire présenté sur une fiche.
    """
    semaine_ref = reference.isocalendar()[:2]
    cumuls = {"jour": 0, "semaine": 0, "mois": 0, "total": 0}
    for fiche in fiches:
        duree = fiche.duree_totale_minutes
        cumuls["total"] += duree
        if fiche.date_vol == reference:
            cumuls["jour"] += duree
        if fiche.date_vol.isocalendar()[:2] == semaine_ref:
            cumuls["semaine"] += duree
        if (fiche.date_vol.year, fiche.date_vol.month) == (reference.year, reference.month):
            cumuls["mois"] += duree
    return cumuls


@dataclass
class SignatureVol:
    role: str
    signataire_nom: str
    # Tracé manuscrit capté à l'écran (data URI). Facultatif à la saisie : la fiche doit
    # rester enregistrable avant le passage de signature.
    signature_image: str | None = None
    horodatage: datetime | None = None
    id: uuid.UUID = field(default_factory=uuid.uuid4)


@dataclass
class Vol:
    """Entité faible de `fiche_vol` : « V1 » n'a de sens que dans sa fiche.

    L'`id` de substitution suit la convention du dépôt (cf. `traitement_rotation`) ; c'est
    la contrainte `UNIQUE(fiche_vol_id, numero)` qui porte la sémantique d'entité faible.
    """

    numero: int
    type_vol: str
    heure_debut: time
    heure_fin: time
    fiche_vol_id: uuid.UUID | None = None
    rotation_id: uuid.UUID | None = None
    prospection_id: uuid.UUID | None = None
    observations: str | None = None
    id: uuid.UUID = field(default_factory=uuid.uuid4)

    def __post_init__(self) -> None:
        valider_rattachement(self.type_vol, self.rotation_id, self.prospection_id)
        valider_heures(self.heure_debut, self.heure_fin)

    @property
    def duree_minutes(self) -> int:
        debut = self.heure_debut.hour * 60 + self.heure_debut.minute
        fin = self.heure_fin.hour * 60 + self.heure_fin.minute
        return fin - debut


@dataclass
class FicheVol:
    """Journal d'une journée pour un aéronef donné.

    `compagnie` et `immatriculation` cohabitent alors que `immatriculation → compagnie`
    est une dépendance fonctionnelle dont le déterminant n'est pas superclé. C'est une
    **dénormalisation temporelle assumée** : l'exploitant d'un appareil peut changer, et
    une fiche ancienne doit conserver celui du jour. Même patron que `cible`, décrit comme
    « snapshot à la création » dans CONTEXT.md.
    """

    numero_fiche: str
    date_vol: date
    compagnie: str
    immatriculation: str
    campagne_id: uuid.UUID
    base_id: uuid.UUID
    stand_id: uuid.UUID
    pilote: str
    mecanicien: str
    chef_de_base_id: uuid.UUID
    # Prospection "principale" affichée en en-tête (Référence, migration 0070) —
    # facultative, distincte du rattachement réel des vols individuels
    # (Vol.prospection_id/rotation_id). numero_fiche_prospection/date_validation
    # ci-dessous en sont dérivés par jointure, jamais stockés.
    prospection_id: uuid.UUID | None = None
    # Attribué par FicheVolRepositoryImpl.next_compteur avant la première écriture ;
    # 0 est une valeur transitoire côté domaine (jamais persistée telle quelle, cf.
    # ck_fiche_vol_compteur_positif), pas une saisie possible.
    compteur: int = 0
    consultant_international: str | None = None
    pesticide_nom_commercial: str | None = None
    pesticide_quantite_disponible: float | None = None
    pesticide_quantite_recue: float | None = None
    futs_disponible: int | None = None
    futs_recues: int | None = None
    futs_pleins: int | None = None
    futs_vides: int | None = None
    observations: str | None = None
    statut: str = "brouillon"
    statut_sync: str = "local"
    vols: list[Vol] = field(default_factory=list)
    signatures: list[SignatureVol] = field(default_factory=list)
    created_at: datetime | None = None
    updated_at: datetime | None = None
    id: uuid.UUID = field(default_factory=uuid.uuid4)

    # ==========================================
    # Champs dérivés, non stockés — résolus par le repository (jointure sur
    # base_aerienne/stand_remplissage), même patron que Prospection.prospecteur_nom.
    # ==========================================
    base_numero: str | None = None
    base_localite: str | None = None
    base_latitude: float | None = None
    base_longitude: float | None = None
    base_altitude: float | None = None
    stand_numero: str | None = None
    stand_localite: str | None = None
    stand_latitude: float | None = None
    stand_longitude: float | None = None
    stand_altitude: float | None = None
    # Dérivés de prospection_id (jointure) — pas de "fiche de validation" distincte
    # dans le modèle : numero_fiche_validation est le même document que
    # numero_fiche_prospection, exposé une deuxième fois (cahier des charges),
    # daté par prospection.validated_at (None tant que non validée).
    prospection_numero_fiche: str | None = None
    prospection_date_validation: datetime | None = None
    # Somme de traitement_rotation.quantite pour les rotations couvertes par les vols de
    # la fiche (jointure vol.rotation_id -> traitement_rotation) — jamais stockée.
    pesticide_quantite_utilisee: float | None = None
    # disponible - utilisee, plancher 0 — jamais stockée.
    pesticide_quantite_restante: float | None = None

    @property
    def duree_totale_minutes(self) -> int:
        return sum(vol.duree_minutes for vol in self.vols)

    @property
    def rotations_rapprochees(self) -> set[uuid.UUID]:
        return {vol.rotation_id for vol in self.vols if vol.rotation_id is not None}
