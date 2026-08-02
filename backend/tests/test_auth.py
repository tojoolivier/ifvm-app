from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from jose import jwt

from app.auth import create_access_token, create_refresh_token
from app.config import settings
from app.models.users import Utilisateur


@pytest.mark.asyncio
async def test_login_returns_access_and_refresh_token(
    client: AsyncClient, utilisateur: Utilisateur
):
    response = await client.post(
        "/auth/login", json={"email": utilisateur.email, "password": "secret"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["token_type"] == "bearer"


def test_create_refresh_token_has_14_day_expiry_and_refresh_type():
    token = create_refresh_token(uuid_value := __import__("uuid").uuid4())
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    assert payload["sub"] == str(uuid_value)
    assert payload["type"] == "refresh"
    exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    expected = datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_EXPIRE_DAYS)
    assert abs((exp - expected).total_seconds()) < 5


@pytest.mark.asyncio
async def test_refresh_endpoint_issues_new_access_token(
    client: AsyncClient, utilisateur: Utilisateur
):
    refresh_token = create_refresh_token(utilisateur.id)
    response = await client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert response.status_code == 200
    body = response.json()
    assert body["access_token"]
    assert body["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_refresh_endpoint_rejects_access_token(client: AsyncClient, utilisateur: Utilisateur):
    access_token = create_access_token(utilisateur.id)
    response = await client.post("/auth/refresh", json={"refresh_token": access_token})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_refresh_endpoint_rejects_expired_refresh_token(
    client: AsyncClient, utilisateur: Utilisateur
):
    expired = jwt.encode(
        {
            "sub": str(utilisateur.id),
            "type": "refresh",
            "exp": datetime.now(timezone.utc) - timedelta(seconds=1),
        },
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )
    response = await client.post("/auth/refresh", json={"refresh_token": expired})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_refresh_endpoint_rejects_inactive_user(
    client: AsyncClient, utilisateur: Utilisateur, db_session
):
    utilisateur.actif = False
    db_session.add(utilisateur)
    await db_session.commit()

    refresh_token = create_refresh_token(utilisateur.id)
    response = await client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert response.status_code == 401
