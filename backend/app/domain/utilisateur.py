import uuid
from dataclasses import dataclass


@dataclass
class UtilisateurRef:
    """Projection minimale d'un utilisateur, pour les couches domaine qui n'ont besoin
    que de son identité/rôle sans dépendre du modèle ORM."""

    id: uuid.UUID
    prenom: str
    role: str
    # Ajouté pour la comparaison de nom complet (chef de base vs pilote/mécanicien
    # texte libre, migration 0048) : défaut "" pour ne pas casser les appelants
    # existants qui n'ont besoin que de prenom/role.
    nom: str = ""
    sigle: str | None = None
