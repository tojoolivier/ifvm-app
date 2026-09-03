import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user, hash_password
from app.database import get_db
from app.infrastructure.referentiel_model import PosteAcridienModel
from app.models.users import ROLES_A_LA_VOLEE, Utilisateur
from app.schemas.users import (
    UtilisateurCreate,
    UtilisateurCreateALaVolee,
    UtilisateurRead,
    UtilisateurUpdate,
)

router = APIRouter()


@router.get("/me", response_model=UtilisateurRead)
async def me(current_user: Annotated[Utilisateur, Depends(get_current_user)]):
    return current_user


def require_admin(current_user: Annotated[Utilisateur, Depends(get_current_user)]) -> Utilisateur:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Accès réservé aux admins"
        )
    return current_user


@router.get("/", response_model=list[UtilisateurRead])
async def list_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(require_admin)],
):
    # Jointure externe : un utilisateur peut ne pas être rattaché à un poste.
    stmt = (
        select(Utilisateur, PosteAcridienModel.code, PosteAcridienModel.nom)
        .outerjoin(PosteAcridienModel, Utilisateur.pa_id == PosteAcridienModel.id)
        .order_by(Utilisateur.nom)
    )
    result = await db.execute(stmt)
    return [
        UtilisateurRead.model_validate(user).model_copy(
            update={"pa_code": pa_code, "pa_nom": pa_nom}
        )
        for user, pa_code, pa_nom in result.all()
    ]


@router.post("/", response_model=UtilisateurRead, status_code=201)
async def create_user(
    body: UtilisateurCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(require_admin)],
):
    data = body.model_dump()
    data["password_hash"] = hash_password(data.pop("password"))
    user = Utilisateur(**data)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/a-la-volee", response_model=UtilisateurRead, status_code=201)
async def create_user_a_la_volee(
    body: UtilisateurCreateALaVolee,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    """Création d'identité seule (pilote/mécanicien/consultant) depuis le
    formulaire de traitement aérien : compte non-authentifiable
    (`peut_se_connecter=False`), email/mot de passe générés et inexploitables.
    Chef de base explicitement exclu : il doit préexister (issue #319).

    Volontairement ouvert à tout utilisateur authentifié (pas `require_admin`
    comme `POST /` ci-dessus) : l'appelant est le personnel de terrain qui
    remplit la fiche de traitement, pas un admin. Le compte créé ne peut de
    toute façon ni se logger ni obtenir de droits au-delà de son rôle."""
    if body.role not in ROLES_A_LA_VOLEE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Création à la volée impossible pour le rôle '{body.role}' : "
                f"seuls {', '.join(ROLES_A_LA_VOLEE)} peuvent être créés ainsi "
                "(chef de base doit préexister)."
            ),
        )
    jeton = uuid.uuid4().hex
    user = Utilisateur(
        nom=body.nom,
        prenom=body.prenom,
        email=f"a-la-volee.{jeton}@ifvm.invalid",
        password_hash=hash_password(jeton),
        role=body.role,
        peut_se_connecter=False,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UtilisateurRead)
async def update_user(
    user_id: uuid.UUID,
    body: UtilisateurUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Utilisateur, Depends(require_admin)],
):
    # Un admin ne modifie pas son propre compte ici : il pourrait se retirer le
    # rôle admin ou se désactiver et se verrouiller hors de l'administration.
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Un admin ne peut pas modifier son propre compte",
        )
    user = await db.get(Utilisateur, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    if body.role is not None:
        user.role = body.role
    if body.actif is not None:
        user.actif = body.actif
    await db.commit()
    await db.refresh(user)
    return user
