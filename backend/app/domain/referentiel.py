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
    email: str = ""
    role: str = ""
    pa_id: uuid.UUID | None = None
    actif: bool = True
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class Pesticide:
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    code: str = ""
    nom: str = ""
    actif: bool = True
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
