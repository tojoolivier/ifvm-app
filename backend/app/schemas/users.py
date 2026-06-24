import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class UtilisateurCreate(BaseModel):
    nom: str
    prenom: str
    email: str
    password: str
    role: str


class UtilisateurRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    nom: str
    prenom: str
    email: str
    role: str
    actif: bool
    created_at: datetime
