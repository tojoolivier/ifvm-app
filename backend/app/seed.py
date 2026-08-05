"""
Script de données initiales. Usage :
    docker compose exec backend python -m app.seed
"""
import asyncio
from sqlalchemy import select
from app.auth import hash_password
from app.database import AsyncSessionLocal
import app.models  # Enregistre tous les modèles
from app.models.users import Utilisateur


async def seed():
    async with AsyncSessionLocal() as db:
        # 1. Vérifier si l'admin existe déjà dans la base
        result = await db.execute(
            select(Utilisateur).where(Utilisateur.email == "admin@ifvm.mg")
        )
        existing_admin = result.scalars().first()

        if existing_admin:
            print("L'utilisateur admin (admin@ifvm.mg) existe déjà. Skip.")
            return

        # 2. S'il n'existe pas, on le crée
        admin = Utilisateur(
            nom="Admin",
            prenom="IFVM",
            email="admin@ifvm.mg",
            password_hash=hash_password("ifvm2026!"),
            role="admin",
        )
        db.add(admin)
        await db.commit()
        print("Seed terminé avec succès ! Admin créé.")


if __name__ == "__main__":
    asyncio.run(seed())