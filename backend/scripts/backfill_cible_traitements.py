"""Rattrapage ponctuel : recalcule `cible` pour les fiches de traitement deja
en base, avec la logique corrigee de `construire_cible()` (commit 3cc8b3d —
lecture des larves Intensif via `ProspectionCapture` et des essaims au format
`essaim_en_vol`/`essaim_pose`, jusque-la jamais lues).

`cible` est un instantane figé a la creation du `Traitement`
(`CreateTraitementAerien`/`CreateTraitementTerrestre`, cf.
app/application/traitement_use_cases.py) : jamais recalcule ensuite, meme au
passage a `validee`. Toute fiche creee avant ce correctif garde donc pour
toujours son ancien instantane incomplet, meme une fois validee "a traiter" —
d'ou ce script, a executer une seule fois par environnement (dev, puis prod).

Idempotent : ne touche que les lignes dont au moins un champ recalcule differe
de ce qui est stocke ; une execution repetee derriere une fiche deja a jour ne
produit aucune ecriture.

Usage (dans le conteneur backend, `make shell-backend`) :
    python scripts/backfill_cible_traitements.py             # dry-run, n'ecrit rien
    python scripts/backfill_cible_traitements.py --apply     # applique et commit
"""

from __future__ import annotations

import asyncio
import sys
from dataclasses import fields
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402
from sqlalchemy.orm import selectinload  # noqa: E402

from app.database import AsyncSessionLocal  # noqa: E402
from app.domain.traitement import Cible, construire_cible  # noqa: E402
from app.infrastructure.prospection_repository import ProspectionRepositoryImpl  # noqa: E402
from app.infrastructure.traitement_model import TraitementModel  # noqa: E402

# Champs de `Cible` a comparer/ecrire — tous sauf `traitement_id` (cle, jamais
# recalculee) — derives de la dataclass elle-meme plutot que dupliques a la main.
_CHAMPS_CIBLE = [f.name for f in fields(Cible) if f.name != "traitement_id"]


async def main(apply: bool) -> int:
    async with AsyncSessionLocal() as session:
        prospection_repository = ProspectionRepositoryImpl(session)

        result = await session.execute(
            select(TraitementModel).options(selectinload(TraitementModel.cible))
        )
        traitements = result.scalars().all()

        total = len(traitements)
        a_corriger: list[tuple[TraitementModel, dict]] = []

        for traitement in traitements:
            if traitement.cible is None:
                # Ne devrait pas arriver (cible cascade avec le traitement a la
                # creation) — ignore plutot que planter tout le lot.
                continue

            prospection = await prospection_repository.get_by_id(traitement.prospection_id)
            if prospection is None:
                # Prospection supprimee entre-temps : rien a recalculer.
                continue

            cible_recalculee = construire_cible(prospection)

            differences = {}
            for champ in _CHAMPS_CIBLE:
                nouvelle_valeur = getattr(cible_recalculee, champ)
                ancienne_valeur = getattr(traitement.cible, champ)
                # Numeric SQLAlchemy renvoie un Decimal — comparaison via float
                # pour ignorer les differences de type (Decimal vs float) sans
                # consequence sur la valeur elle-meme.
                ancienne_comparable = (
                    float(ancienne_valeur)
                    if isinstance(ancienne_valeur, (int, float, Decimal))
                    and not isinstance(ancienne_valeur, bool)
                    else ancienne_valeur
                )
                nouvelle_comparable = (
                    float(nouvelle_valeur)
                    if isinstance(nouvelle_valeur, (int, float, Decimal))
                    and not isinstance(nouvelle_valeur, bool)
                    else nouvelle_valeur
                )
                if ancienne_comparable != nouvelle_comparable:
                    differences[champ] = (ancienne_valeur, nouvelle_valeur)

            if differences:
                a_corriger.append((traitement, differences))

        print(f"{total} fiche(s) de traitement examinee(s), {len(a_corriger)} a corriger.")
        for traitement, differences in a_corriger:
            print(f"  - {traitement.numero_fiche} ({traitement.statut}) :")
            for champ, (avant, apres) in differences.items():
                print(f"      {champ}: {avant!r} -> {apres!r}")

        if not apply:
            print("\nDry-run : aucune ecriture. Relancer avec --apply pour appliquer.")
            return 0

        for traitement, differences in a_corriger:
            for champ, (_avant, apres) in differences.items():
                setattr(traitement.cible, champ, apres)

        await session.commit()
        print(f"\n{len(a_corriger)} fiche(s) corrigee(s) et committee(s).")
        return 0


if __name__ == "__main__":
    apply_flag = "--apply" in sys.argv[1:]
    sys.exit(asyncio.run(main(apply_flag)))
