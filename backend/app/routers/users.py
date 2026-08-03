import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user, hash_password
from app.database import get_db
from app.models.users import Utilisateur
from app.schemas.users import UtilisateurCreate, UtilisateurRead, UtilisateurUpdate

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
    result = await db.execute(select(Utilisateur).order_by(Utilisateur.nom))
    return result.scalars().all()


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


@router.patch("/{user_id}", response_model=UtilisateurRead)
async def update_user(
    user_id: uuid.UUID,
    body: UtilisateurUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(require_admin)],
):
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
