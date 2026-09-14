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
    "CHEF_DE_BASE": "chef_de_base",
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


class RotationVolIntrouvableError(LookupError):
    """rotation_id ne référence aucune rotation de traitement aérien."""


class ProspectionVolIntrouvableError(LookupError):
    """prospection_id ne référence aucune prospection."""


class RotationDejaRapprocheeError(Exception):
    """Cette rotation a déjà un vol de ce type — une rotation vaut une MEP et une
    application, pas deux."""


def composer_numero_fiche(
    date_vol: date, base_code: str, immatriculation: str, suffixe: int | None = None
) -> str:
    """`[Date]-[Base numérotée]-[Immatriculation]` (cahier des charges §5).

    Le suffixe matérialise le « une seule fiche par jour **si possible** » : la convention
    reste une fiche par jour et par appareil, mais une seconde fiche n'est jamais refusée —
    bloquer un pilote hors-ligne coûterait plus cher que numéroter.
    """
    base = _normaliser_fragment(base_code)
    immat = _normaliser_fragment(immatriculation)
    numero = f"{date_vol.isoformat()}-{base}-{immat}"
    return numero if suffixe is None else f"{numero}-{suffixe:02d}"


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
    base_code: str
    base_nom: str
    stand_nom: str
    pilote: str
    mecanicien: str
    chef_de_base: str
    base_latitude: float | None = None
    base_longitude: float | None = None
    base_altitude: float | None = None
    stand_latitude: float | None = None
    stand_longitude: float | None = None
    stand_altitude: float | None = None
    consultant_international: str | None = None
    observations: str | None = None
    statut: str = "brouillon"
    statut_sync: str = "local"
    vols: list[Vol] = field(default_factory=list)
    signatures: list[SignatureVol] = field(default_factory=list)
    created_at: datetime | None = None
    updated_at: datetime | None = None
    id: uuid.UUID = field(default_factory=uuid.uuid4)

    @property
    def duree_totale_minutes(self) -> int:
        return sum(vol.duree_minutes for vol in self.vols)

    @property
    def rotations_rapprochees(self) -> set[uuid.UUID]:
        return {vol.rotation_id for vol in self.vols if vol.rotation_id is not None}
