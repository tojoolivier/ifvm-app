"""Import des pesticides homologués depuis un fichier Excel.

Usage :
    docker compose exec backend python -m scripts.import_pesticides <chemin_excel>

Le fichier attendu porte les colonnes « Nom commercial » et « Matiere active_ok »
(cf. le classeur « Pesticide Homologué IFVM » fourni par l'issue #129). Réutilise
la config DB de l'appli (`app.database.AsyncSessionLocal`) : mêmes identifiants
que le backend, pas de connexion codée en dur.
"""

import argparse
import asyncio
import re
import uuid
from pathlib import Path

import pandas as pd
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.infrastructure.referentiel_model import PesticideModel


def code_depuis_nom(nom_commercial: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", nom_commercial.lower()).strip("_")


async def import_pesticides(excel_path: Path) -> None:
    df = pd.read_excel(excel_path)

    async with AsyncSessionLocal() as session:
        for _, row in df.iterrows():
            nom_commercial = str(row["Nom commercial"]).strip()
            matiere_active = (
                str(row["Matiere active_ok"]).strip()
                if pd.notna(row["Matiere active_ok"])
                else None
            )
            code = code_depuis_nom(nom_commercial)

            existing = await session.execute(
                select(PesticideModel).where(PesticideModel.code == code)
            )
            if existing.scalar_one_or_none():
                print(f"Ignoré : {code} (déjà en base)")
                continue

            pesticide = PesticideModel(
                id=uuid.uuid4(),
                code=code,
                nom=nom_commercial,
                matiere_active=matiere_active,
                dose_reference=None,  # Absente du classeur — à renseigner sur le terrain.
                actif=True,
            )
            session.add(pesticide)
            print(f"Ajouté : {code} — {nom_commercial} ({matiere_active})")

        await session.commit()
        print(f"\n{len(df)} lignes traitées.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("excel_path", type=Path, help="Chemin du classeur Excel à importer")
    args = parser.parse_args()
    asyncio.run(import_pesticides(args.excel_path))


if __name__ == "__main__":
    main()
