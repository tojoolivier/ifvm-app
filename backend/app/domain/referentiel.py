import uuid
from dataclasses import dataclass, field
from datetime import datetime


class StationNotFoundError(Exception):
    """station_id ne référence pas une station fixe existante."""

    pass


class CodeReferentielDejaPrisError(Exception):
    """Le `code` d'une entité de référentiel est unique : un doublon est refusé."""

    pass


class ZoneAntiAcridienIntrouvableError(Exception):
    """za_id ne référence pas une zone anti-acridienne existante."""

    pass


class PosteAcridienAvecStationsActivesError(Exception):
    """Désactiver un poste n'orpheline pas ses stations.

    La désactivation ne se propage pas — laisser des stations actives rattachées à un
    poste inactif rendrait la hiérarchie incohérente sur le terrain, sans qu'aucun
    écran ne le signale. On refuse donc tant que des stations actives y pendent.
    """

    pass


class ZoneAntiAcridienAvecPostesActifsError(Exception):
    """Désactiver une zone n'orpheline pas ses postes.

    Réciproque de `PosteAcridienAvecStationsActivesError`, un niveau plus haut dans la
    hiérarchie géographique : refuse tant que des postes actifs référencent la zone.
    """

    pass


class PosteAcridienIntrouvableError(Exception):
    """pa_id ne référence pas un poste acridien existant."""

    pass


class PosteAcridienInactifError(Exception):
    """Rattachement interdit : le poste est hors service.

    Réciproque de `PosteAcridienAvecStationsActivesError` — celle-ci empêche de fermer
    un poste sous des stations actives, celle-là d'accrocher une station vivante à un
    poste déjà fermé. Ensemble, elles gardent la hiérarchie atteignable du terrain.
    """

    pass


class CommuneInconnueError(Exception):
    """commune_id ne référence pas une commune existante."""

    pass


@dataclass
class ZoneAntiAcridien:
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    code: str = ""
    nom: str = ""
    actif: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class PosteAcridien:
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    code: str = ""
    nom: str = ""
    za_id: uuid.UUID = field(default_factory=uuid.uuid4)
    za_code: str = ""
    za_nom: str = ""
    # Rattachement à une équipe terrestre (migration 0073) : nullable, plusieurs
    # postes peuvent partager la même équipe (équipe mobile, pas de UNIQUE).
    equipe_terrestre_id: uuid.UUID | None = None
    equipe_terrestre_nom: str | None = None
    actif: bool = True
    # Dérivé : nombre de stations fixes actives rattachées. Jamais saisissable — c'est
    # la colonne « Stations » de l'écran Référentiels, et le garde-fou de désactivation.
    nb_stations: int = 0
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class Commune:
    """Feuille de la hiérarchie géographique, avec ses libellés remontés — de quoi
    peupler le sélecteur de commune du formulaire de station."""

    id: uuid.UUID = field(default_factory=uuid.uuid4)
    nom: str = ""
    district: str = ""
    region: str = ""


@dataclass
class StationFixe:
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    code: str = ""
    nom: str = ""
    pa_id: uuid.UUID = field(default_factory=uuid.uuid4)
    pa_code: str = ""
    pa_nom: str = ""
    latitude: float = 0.0
    longitude: float = 0.0
    altitude: float | None = None
    # `commune_id` est la donnée écrite ; `commune`/`district`/`region` sont les
    # libellés joints, dérivés, jamais fournis par un appelant.
    commune_id: uuid.UUID = field(default_factory=uuid.uuid4)
    commune: str = ""
    district: str = ""
    region: str = ""
    actif: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class UtilisateurEquipe:
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    nom: str = ""
    prenom: str = ""
    role: str = ""
    pa_id: uuid.UUID | None = None
    actif: bool = True
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class Pesticide:
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    code: str = ""
    nom: str = ""
    matiere_active: str | None = None
    dose_reference: str | None = None
    type_produit: str | None = None
    actif: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class Culture:
    """Culture exposée aux dégâts acridiens.

    Jamais supprimée : le pull hors-ligne ne transporte que des upserts, une
    ligne effacée en base resterait indéfiniment dans le SQLite des téléphones
    déjà synchronisés. On la retire du terrain en passant `actif` à false.
    """

    id: uuid.UUID = field(default_factory=uuid.uuid4)
    code: str = ""
    nom: str = ""
    actif: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class CodeStade:
    """Place d'un code de stade dans une grille de saisie (catégorie, sexe, espèce)."""

    id: uuid.UUID = field(default_factory=uuid.uuid4)
    code: str = ""
    categorie: str = ""
    sexe: str | None = None
    espece: str | None = None
    libelle: str = ""
    ordre: int = 0
    actif: bool = True
    updated_at: datetime = field(default_factory=datetime.utcnow)


class StadeInconnuError(Exception):
    """`code_stade.code` référence `stade.code` : le code n'est pas au vocabulaire."""

    pass


class GrilleDejaOccupeeError(Exception):
    """(code, categorie, sexe, espece) identifie une place de grille — elle est prise."""

    pass


TYPES_LIEU_AERIEN = ("principale", "secondaire", "stand")


class TypeLieuAerienInvalideError(Exception):
    """`type_lieu` n'appartient pas à `TYPES_LIEU_AERIEN`."""

    pass


@dataclass
class LieuAerien:
    """Base aérienne principale, base secondaire ou stand de remplissage.

    Table unique typée par `type_lieu` plutôt que trois entités séparées — même
    choix que `Prospection.type_prospection` (ADR-006). Durable, indépendant
    de la campagne. Jamais supprimé : on le retire du terrain en passant
    `actif` à false.
    """

    id: uuid.UUID = field(default_factory=uuid.uuid4)
    type_lieu: str = "principale"
    nom: str = ""
    latitude: float = 0.0
    longitude: float = 0.0
    altitude: float | None = None
    actif: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    # Rattachement à l'équipe aérienne propriétaire du lieu (migration 0074) —
    # nullable (lieux existants "sans équipe"), obligatoire côté application pour
    # toute nouvelle création (cf. CreateLieuAerien).
    equipe_aerienne_id: uuid.UUID | None = None
    # Dérivé par jointure à la lecture, jamais stocké (même statut que
    # `equipe_terrestre_nom` sur `PosteAcridien`).
    equipe_aerienne_nom: str | None = None


class NumeroBaseAerienneDejaPrisError(Exception):
    """`numero` d'une base_aerienne est déjà pris (contrainte UNIQUE)."""

    pass


class NumeroStandRemplissageDejaPrisError(Exception):
    """`numero` d'un stand_remplissage est déjà pris (contrainte UNIQUE)."""

    pass


class BaseAerienneParentInvalideError(Exception):
    """`parent_base_id` ne référence pas une base principale existante.

    Couvre deux cas : l'id ne référence aucune base_aerienne, ou il en référence une
    qui est elle-même une secondaire (`parent_base_id` non nul) — la hiérarchie
    s'arrête à 2 niveaux, pas de secondaire d'une secondaire.
    """

    pass


class BaseAerienneEquipeInvalideError(Exception):
    """`equipe_id` incohérent avec la hiérarchie (#equipe-aerienne, migration 0066).

    Deux cas : une base principale (`parent_base_id is None`) sans `equipe_id`, ou une
    base secondaire (`parent_base_id` non nul) à laquelle on tente d'assigner sa propre
    `equipe_id` — elle hérite de celle de sa principale, elle n'en porte pas une à elle.
    """

    pass


class EquipeAerienneIntrouvableError(Exception):
    """`equipe_id` ne référence aucune `equipe_aerienne` existante."""

    pass


class EquipeAerienneDejaAssigneeError(Exception):
    """L'équipe référencée possède déjà une base aérienne principale (UNIQUE
    `base_aerienne.equipe_id`, une équipe = une base principale)."""

    pass


class ChefDeBaseEquipeInvalideError(Exception):
    """`chef_de_base_id` ne référence pas un utilisateur avec le rôle `chef_de_base`."""

    pass


class ChefDeBaseDejaEquipeError(Exception):
    """L'utilisateur référencé dirige déjà une autre équipe aérienne (UNIQUE
    `equipe_aerienne.chef_de_base_id`, un chef de base = une équipe)."""

    pass


class ImmatriculationAeronefDejaPriseError(Exception):
    """`immatriculation` d'un aéronef est déjà prise (UNIQUE `aeronef.immatriculation`)."""

    pass


class AeronefIntrouvableError(Exception):
    """`aeronef_id` ne référence aucun `aeronef` existant."""

    pass


class AeronefDejaAffecteError(Exception):
    """L'aéronef référencé est déjà affecté à une autre équipe aérienne (UNIQUE
    `equipe_aerienne.aeronef_id`, un aéronef = une équipe)."""

    pass


class EquipeNonAutoriseeError(PermissionError):
    """L'utilisateur n'a pas le droit d'agir pour cette équipe aérienne : seul le chef de
    base de l'équipe (ou un admin) crée les lieux aériens de SON équipe."""

    pass


class EquipeRequiseError(ValueError):
    """Un admin agit pour le compte d'une équipe sans la désigner : contrairement au chef
    de base (qui n'en a qu'une, la sienne), rien ne permet de la déduire."""

    pass


@dataclass
class Aeronef:
    """Hélicoptère d'une équipe aérienne (migration 0078). `immatriculation` est sa clé
    candidate : `societe` (exploitant) et `volume_cuve_l` en dépendent, d'où une entité à
    part plutôt que des colonnes de `EquipeAerienne`. Jamais supprimé : `actif=false`."""

    id: uuid.UUID = field(default_factory=uuid.uuid4)
    immatriculation: str = ""
    societe: str = ""
    volume_cuve_l: float = 0.0
    actif: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class MembreEquipeAerienne:
    """Membre d'une équipe aérienne au-delà des rôles nommés (chef de base, pilote,
    mécanicien, consultant international) — migration 0072. Entité faible de
    `EquipeAerienne`, un nom en nombre variable."""

    id: uuid.UUID = field(default_factory=uuid.uuid4)
    equipe_aerienne_id: uuid.UUID = field(default_factory=uuid.uuid4)
    nom: str = ""


@dataclass
class EquipeAerienne:
    """Équipe aérienne (#equipe-aerienne, migration 0066) : une équipe = un chef de
    base (`chef_de_base_id` UNIQUE) = une base aérienne principale (`base_aerienne.
    equipe_id` UNIQUE, cf. `BaseAerienne`). Demande utilisateur du 2026-09-16.

    `pilote`/`mecanicien`/`consultant_international` (migration 0072) : texte libre,
    externes à l'IFVM — même patron que `TraitementAerien`. Nullable
    pour les équipes créées avant cette migration ; `pilote`/`mecanicien` sont
    exigés par `EquipeAerienneCreate` pour toute nouvelle équipe,
    `consultant_international` reste facultatif. `membres` couvre les autres
    membres de l'équipe, en nombre variable."""

    id: uuid.UUID = field(default_factory=uuid.uuid4)
    nom: str = ""
    chef_de_base_id: uuid.UUID = field(default_factory=uuid.uuid4)
    pilote: str | None = None
    mecanicien: str | None = None
    consultant_international: str | None = None
    # Hélicoptère de l'équipe (migration 0078) : 1:1, `None` pour les équipes créées
    # avant cette migration. `aeronef` est résolu par jointure à la lecture.
    aeronef_id: uuid.UUID | None = None
    aeronef: Aeronef | None = None
    actif: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    membres: list[MembreEquipeAerienne] = field(default_factory=list)


@dataclass
class BaseAerienne:
    """Base aérienne principale (`parent_base_id is None`) ou secondaire (référence sa
    principale). Référentiel dédié à la gestion d'équipe aérienne, distinct de `LieuAerien` —
    décision produit du 2026-09-15 maintenue malgré le précédent `lieu_aerien` (cf.
    migration `0064`).

    `equipe_id` (migration 0066) n'est renseigné que sur une base principale — une
    base secondaire hérite de l'équipe de sa principale via `parent_base_id`, elle ne
    porte pas sa propre `equipe_id` (cf. `BaseAerienneEquipeInvalideError`)."""

    id: uuid.UUID = field(default_factory=uuid.uuid4)
    parent_base_id: uuid.UUID | None = None
    equipe_id: uuid.UUID | None = None
    numero: str = ""
    localite: str = ""
    longitude: float | None = None
    latitude: float | None = None
    altitude: float | None = None
    actif: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class StandRemplissage:
    """Stand de remplissage d'une équipe aérienne — même forme que `BaseAerienne`, sans
    hiérarchie. `equipe_aerienne_id` (migration 0078) : équipe propriétaire, plusieurs
    stands par équipe ; `None` pour les stands antérieurs, exigé à la création."""

    id: uuid.UUID = field(default_factory=uuid.uuid4)
    numero: str = ""
    localite: str = ""
    longitude: float | None = None
    latitude: float | None = None
    altitude: float | None = None
    equipe_aerienne_id: uuid.UUID | None = None
    actif: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


class EquipeTerrestreIntrouvableError(Exception):
    """`equipe_terrestre_id` ne référence aucune `equipe_terrestre` existante."""

    pass


class ChefEquipeInvalideError(Exception):
    """`chef_equipe_id` ne référence pas un utilisateur avec le rôle `chef_equipe`."""

    pass


class ChefEquipeDejaEquipeError(Exception):
    """L'utilisateur référencé dirige déjà une autre équipe terrestre (UNIQUE
    `equipe_terrestre.chef_equipe_id`, un chef d'équipe = une équipe)."""

    pass


@dataclass
class MembreEquipeTerrestre:
    """Membre d'une équipe terrestre au-delà du chef d'équipe (migration 0073) —
    entité faible de `EquipeTerrestre`, un nom en nombre variable. Même patron que
    `MembreEquipeAerienne`."""

    id: uuid.UUID = field(default_factory=uuid.uuid4)
    equipe_terrestre_id: uuid.UUID = field(default_factory=uuid.uuid4)
    nom: str = ""


@dataclass
class EquipeTerrestre:
    """Équipe terrestre (migration 0073) : une équipe = un chef d'équipe
    (`chef_equipe_id` UNIQUE, rôle `chef_equipe`). Contrairement à l'équipe aérienne,
    pas de base physique unique : plusieurs postes acridiens peuvent partager la même
    équipe (`PosteAcridien.equipe_terrestre_id`, sans UNIQUE), une équipe terrestre
    étant mobile. `membres` couvre les autres membres de l'équipe, en nombre
    variable."""

    id: uuid.UUID = field(default_factory=uuid.uuid4)
    nom: str = ""
    chef_equipe_id: uuid.UUID = field(default_factory=uuid.uuid4)
    actif: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    membres: list[MembreEquipeTerrestre] = field(default_factory=list)
