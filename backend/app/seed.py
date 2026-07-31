"""
Script de données initiales. Usage :
    docker compose exec backend python -m app.seed
"""

import asyncio

from app.auth import hash_password
from app.database import AsyncSessionLocal
from app.models.users import Utilisateur


async def seed():
    async with AsyncSessionLocal() as db:
        admin = Utilisateur(
            nom="Admin",
            prenom="IFVM",
            email="admin@ifvm.mg",
            password_hash=hash_password("ifvm2026!"),
            role="admin",
        )
        db.add(admin)
        await db.commit()
        print("Seed terminé.")


if __name__ == "__main__":
    asyncio.run(seed())
