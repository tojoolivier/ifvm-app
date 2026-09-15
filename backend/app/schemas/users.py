import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UtilisateurCreate(BaseModel):
    nom: str
    prenom: str
    email: str
    password: str
    role: str
    sigle: str | None = None


class UtilisateurCreateALaVolee(BaseModel):
    """Création à la volée depuis le formulaire de traitement : identité seule,
    pas d'email/mot de passe — voir `ROLES_A_LA_VOLEE`."""

    nom: str
    prenom: str
    role: str


class UtilisateurUpdate(BaseModel):
    role: str | None = None
    actif: bool | None = None
    sigle: str | None = None


class UtilisateurRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    nom: str
    prenom: str
    email: str
    role: str
    sigle: str | None = None
    actif: bool
    peut_se_connecter: bool
    created_at: datetime
    # Poste acridien de rattachement — colonne « Station » de la maquette §10.
    # `pa_code` / `pa_nom` viennent d'une jointure : ils restent optionnels pour
    # que `/users/me`, `POST /users/` et `PATCH /users/{id}` puissent continuer
    # de sérialiser directement l'objet ORM.
    pa_id: uuid.UUID | None = None
    pa_code: str | None = None
    pa_nom: str | None = None
