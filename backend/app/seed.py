"""
Script de données initiales. Usage :
    docker compose exec backend python -m app.seed
"""
import asyncio
from app.auth import hash_password
from app.database import AsyncSessionLocal
from app.models.geo import PosteAcridien, StationMeteo
from app.models.users import Utilisateur


POSTES = [
    {"code": "AMB", "nom": "Ambovombe", "region": "Androy", "district": "Ambovombe"},
    {"code": "MRV", "nom": "Morondava", "region": "Menabe", "district": "Morondava"},
    {"code": "TUL", "nom": "Tuléar", "region": "Atsimo-Andrefana", "district": "Tuléar I"},
    {"code": "FIA", "nom": "Fianarantsoa", "region": "Haute Matsiatra", "district": "Fianarantsoa I"},
]


async def seed():
    async with AsyncSessionLocal() as db:
        # Postes acridiennes
        for data in POSTES:
            pa = PosteAcridien(**data)
            db.add(pa)
        await db.flush()

        # Admin par défaut
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
