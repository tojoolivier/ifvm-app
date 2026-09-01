"""Import pesticides from Excel file."""

import asyncio
import re
import uuid
from pathlib import Path

import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.infrastructure.referentiel_model import PesticideModel


async def import_pesticides():
    """Import pesticides from Pesticide_Homologué_IFVM.xlsx"""

    # Load Excel file
    excel_path = Path("/Users/olivierrakotondravao/Downloads/Pesticide_Homologué_IFVM.xlsx")
    df = pd.read_excel(excel_path)

    # Connect to database
    db_url = "postgresql+asyncpg://olivier:postgres@localhost:5432/ifvm_dev"
    engine = create_async_engine(db_url)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with AsyncSessionLocal() as session:
        for idx, row in df.iterrows():
            nom_commercial = str(row["Nom commercial"]).strip()
            matiere_active = (
                str(row["Matiere active_ok"]).strip()
                if pd.notna(row["Matiere active_ok"])
                else None
            )

            # Generate code from nom commercial: lowercase, replace spaces with underscore
            code = re.sub(r"[^a-z0-9]+", "_", nom_commercial.lower()).strip("_")

            # Check if code already exists
            from sqlalchemy import select

            existing = await session.execute(
                select(PesticideModel).where(PesticideModel.code == code)
            )
            if existing.scalar_one_or_none():
                print(f"Skipping {code} (already exists)")
                continue

            pesticide = PesticideModel(
                id=uuid.uuid4(),
                code=code,
                nom=nom_commercial,
                matiere_active=matiere_active,
                dose_reference=None,  # To be filled later
                actif=True,
            )
            session.add(pesticide)
            print(f"Added: {code} - {nom_commercial} ({matiere_active})")

        await session.commit()
        print(f"\nImported {len(df)} pesticides")


if __name__ == "__main__":
    asyncio.run(import_pesticides())
