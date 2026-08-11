import uuid
from dataclasses import dataclass


@dataclass
class UtilisateurRef:
    """Projection minimale d'un utilisateur, pour les couches domaine qui n'ont besoin
    que de son identité/rôle sans dépendre du modèle ORM."""

    id: uuid.UUID
    prenom: str
    role: str
