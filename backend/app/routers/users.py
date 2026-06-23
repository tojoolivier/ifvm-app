from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user, hash_password
from app.database import get_db
from app.models.users import Utilisateur
from app.schemas.users import UtilisateurCreate, UtilisateurRead

router = APIRouter()


@router.get("/me", response_model=UtilisateurRead)
async def me(current_user: Annotated[Utilisateur, Depends(get_current_user)]):
    return current_user


@router.get("/", response_model=list[UtilisateurRead])
async def list_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    result = await db.execute(select(Utilisateur).order_by(Utilisateur.nom))
    return result.scalars().all()


@router.post("/", response_model=UtilisateurRead, status_code=201)
async def create_user(
    body: UtilisateurCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Utilisateur, Depends(get_current_user)],
):
    data = body.model_dump()
    data["password_hash"] = hash_password(data.pop("password"))
    user = Utilisateur(**data)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
