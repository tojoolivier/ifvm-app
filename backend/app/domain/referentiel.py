import uuid
from dataclasses import dataclass, field
from datetime import datetime


class StationNotFoundError(Exception):
    """station_id ne référence pas une station fixe existante."""

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
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


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
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    code: str = ""
    nom: str = ""
    actif: bool = True
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
