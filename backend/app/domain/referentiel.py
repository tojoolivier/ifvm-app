import uuid
from dataclasses import dataclass, field
from datetime import datetime


class StationNotFoundError(Exception):
    """station_id ne référence pas une station fixe existante."""
    pass


@dataclass
class PosteAcridien:
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    code: str = ""
    nom: str = ""
    region: str | None = None
    created_at: datetime = field(default_factory=datetime.utcnow)


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
    actif: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
