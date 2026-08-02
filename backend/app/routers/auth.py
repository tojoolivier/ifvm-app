from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import (
    create_access_token,
    create_refresh_token,
    get_user_from_refresh_token,
    verify_password,
)
from app.database import get_db
from app.models.users import Utilisateur
from app.schemas.auth import AccessTokenResponse, LoginRequest, RefreshRequest, TokenResponse

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(Utilisateur).where(Utilisateur.email == body.email))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Identifiants invalides"
        )
    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/refresh", response_model=AccessTokenResponse)
async def refresh(body: RefreshRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    user = await get_user_from_refresh_token(body.refresh_token, db)
    return AccessTokenResponse(access_token=create_access_token(user.id))
