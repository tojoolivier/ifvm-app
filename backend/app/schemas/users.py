import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr


class UtilisateurCreate(BaseModel):
    nom: str
    prenom: str
    email: EmailStr
    password: str
    role: str
    pa_id: uuid.UUID | None = None


class UtilisateurRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    nom: str
    prenom: str
    email: str
    role: str
    pa_id: uuid.UUID | None
    actif: bool
    created_at: datetime
