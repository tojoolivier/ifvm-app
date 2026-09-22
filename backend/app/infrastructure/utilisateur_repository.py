import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import hash_password
from app.domain.repositories import UtilisateurRepository
from app.domain.utilisateur import UtilisateurRef
from app.models.users import Utilisateur


def construire_utilisateur_a_la_volee(nom: str, prenom: str, role: str) -> Utilisateur:
    """Compte « identité seule », non authentifiable (issue #319).

    `email`/`password_hash` sont générés et inexploitables : ils n'existent que pour
    satisfaire les contraintes NOT NULL/UNIQUE de `utilisateur`. Factorisé ici parce
    que deux appelants le créent désormais : le formulaire de traitement aérien
    (`POST /users/a-la-volee`) et l'ajout d'un membre d'équipe sans compte (ADR-018).
    """
    jeton = uuid.uuid4().hex
    return Utilisateur(
        nom=nom,
        prenom=prenom,
        email=f"a-la-volee.{jeton}@ifvm.invalid",
        password_hash=hash_password(jeton),
        role=role,
        peut_se_connecter=False,
    )


class UtilisateurRepositoryImpl(UtilisateurRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, utilisateur_id: uuid.UUID) -> UtilisateurRef | None:
        result = await self.session.execute(
            select(Utilisateur).where(Utilisateur.id == utilisateur_id)
        )
        user = result.scalar_one_or_none()
        if user is None:
            return None
        return UtilisateurRef(id=user.id, prenom=user.prenom, nom=user.nom, role=user.role)

    async def creer_a_la_volee(self, nom: str, prenom: str, role: str) -> UtilisateurRef:
        """`flush` et non `commit` : le compte doit vivre ou mourir avec l'équipe dont
        il est membre — c'est le `commit` du dépôt d'équipe qui tranche."""
        user = construire_utilisateur_a_la_volee(nom=nom, prenom=prenom, role=role)
        self.session.add(user)
        await self.session.flush()
        return UtilisateurRef(id=user.id, prenom=user.prenom, nom=user.nom, role=user.role)
