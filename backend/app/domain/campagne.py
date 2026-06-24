import uuid
from dataclasses import dataclass, field
from datetime import date, datetime


@dataclass
class Campagne:
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    name: str = ""
    start_date: date = field(default_factory=date.today)
    end_date: date | None = None
    created_by: uuid.UUID = field(default_factory=uuid.uuid4)
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
