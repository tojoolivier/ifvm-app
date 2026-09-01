"""
Pesticides homologués IFVM (#129, #134).

Source : classeur « Pesticide Homologué IFVM » fourni avec l'issue #129 — 62 lignes
brutes (colonnes « Nom commercial », « Matiere active_ok »), réduites à 54 après
retrait des 3 lignes vides et des 5 doublons de code commercial (ex. GREEN MUSCLE et
NOMOLT 50 UL apparaissaient deux fois avec une orthographe de matière active
différente ; la première occurrence a été conservée).

`dose_reference` n'existe pas dans le classeur — laissé à NULL, à renseigner sur le
terrain (cf. arbitrage de l'issue #129).

Idempotent : ré-exécutable sans dupliquer (code unique).

Usage :
    docker compose exec backend python -m app.pesticide_seed
"""

import asyncio

from sqlalchemy import select

# `app.models` doit être importé avant tout accès direct à `app.infrastructure.*_model` :
# `app/models/__init__.py` importe lui-même depuis `app.infrastructure.referentiel_model`,
# et devenir le tout premier import de ce module (au lieu de `app.models`) fait planter ce
# cycle avec un ImportError "partially initialized module".
import app.models  # noqa: F401
from app.database import AsyncSessionLocal
from app.infrastructure.referentiel_model import PesticideModel

# (code, nom_commercial, matiere_active)
PESTICIDES = [
    ("green_muscle", "GREEN MUSCLE", "Métarhizium"),
    ("teflubenazur_50_ulv", "TEFLUBENAZUR 50 ULV", "Teflubenzuron"),
    ("deltamethrine_15_il", "DELTAMETHRINE 15 IL", "Deltaméthrine 15 UL"),
    ("agrifos_240_ulv", "AGRIFOS 240 ULV", "Chlorpyriphos-Ethyl"),
    ("avi_klorpirifos_240_ulv", "AVI-KLORPIRIFOS 240 ULV", "Chlorpyriphos-Ethyl"),
    ("avi_klorpirifos_5_dp", "AVI-KLORPIRIFOS 5 DP", "Chlorpyriphos-Ethyl"),
    ("dursban_450_ulv", "DURSBAN 450 ULV", "Chlorpyriphos-Ethyl"),
    ("dursban_5_u", "DURSBAN 5 U", "Chlorpyriphos-Ethyl"),
    ("gale_240_ul", "GALE 240 UL", "Chlorpyriphos-Ethyl"),
    ("leadear_240_ul", "LEADEAR 240 UL", "Chlorpyriphos-Ethyl"),
    ("napalm_240_ulv", "NAPALM 240 ULV", "Chlorpyriphos-Ethyl"),
    ("pychlorex_240_ulv", "PYCHLOREX 240 ULV", "Chlorpyriphos-Ethyl"),
    ("pychlorex_5_dp", "PYCHLOREX 5 DP", "Chlorpyriphos-Ethyl"),
    ("pyrical_240_ulv", "PYRICAL 240 ULV", "Chlorpyriphos-Ethyl"),
    ("pyrifox_240_ul", "PYRIFOX 240 UL", "Chlorpyriphos-Ethyl"),
    ("pyrinex_240_ulv", "PYRINEX 240 ULV", "Chlorpyriphos-Ethyl"),
    ("pyristar_240_ulv", "PYRISTAR 240 ULV", "Chlorpyriphos-Ethyl"),
    ("wopropyriphos_240_ulv", "WOPROPYRIPHOS 240 ULV", "Chlorpyriphos-Ethyl"),
    ("anaconda_134_ulv", "ANACONDA 134 ULV", "Chlorpyriphos-Ethyl - Cypermethrine"),
    ("chlorcypex_134_ulv", "CHLORCYPEX 134 ULV", "Chlorpyriphos-Ethyl - Cypermethrine"),
    ("chlorcyrine_134_ulv", "CHLORCYRINE 134 ULV", "Chlorpyriphos-Ethyl - Cypermethrine"),
    ("cyclone_134_ul", "CYCLONE 134 UL", "Chlorpyriphos-Ethyl - Cypermethrine"),
    ("cypercombi_134_ul", "CYPERCOMBI 134 UL", "Chlorpyriphos-Ethyl - Cypermethrine"),
    ("cyperfos_134_ul", "CYPERFOS 134 UL", "Chlorpyriphos-Ethyl - Cypermethrine"),
    ("klorcyfox_134_ulv", "KLORCYFOX 134 ULV", "Chlorpyriphos-Ethyl - Cypermethrine"),
    ("nurelle_d_14_120_ul", "NURELLE D 14/120 UL", "Chlorpyriphos-Ethyl - Cypermethrine"),
    ("puush_134_ul", "PUUSH 134 UL", "Chlorpyriphos-Ethyl - Cypermethrine"),
    ("deltaklor_125_ul", "DELTAKLOR 125 UL", "Chlorpyriphos-Ethyl - Deltaethrine"),
    ("reldan_170_ulv", "RELDAN 170 ULV", "Chlorpyriphos-Methyl"),
    ("reldan_500_ulv", "RELDAN 500 ULV", "Chlorpyriphos-Methyl"),
    ("decis_17_5_ulv", "DECIS 17,5 ULV", "Deltamethrine"),
    ("deltagri_17_5_ulv", "DELTAGRI 17,5 ULV", "Deltamethrine"),
    ("deltanex_15_ulv", "DELTANEX 15 ULV", "Deltamethrine"),
    ("deltanex_17_5_ulv", "DELTANEX 17,5 ULV", "Deltamethrine"),
    ("deltanica_1_5_ulv", "DELTANICA 1,5% ULV", "Deltamethrine"),
    ("deltanica_17_5_ulv", "DELTANICA 17,5 ULV", "Deltamethrine"),
    ("deltaplan_17_5_ulv", "DELTAPLAN 17,5 ULV", "Deltamethrine"),
    ("leni_15_ulv", "LENI 15 ULV", "Deltamethrine"),
    ("benazur_60_ulv", "BENAZUR 60 ULV", "Diflubenzuron"),
    ("difuse_60_ulv", "DIFUSE 60 ULV", "Diflubenzuron"),
    ("dimilin_odc_45", "DIMILIN ODC 45", "Diflubenzuron"),
    ("dimilin_of_6", "DIMILIN OF 6", "Diflubenzuron"),
    ("imidapro_plus_13_ul", "IMIDAPRO PLUS 13 UL", "Imidaclopride - Deltamethrine"),
    ("karate_2_ulv", "KARATE 2 ULV", "Lambda-Cyhalothrine"),
    ("lambdalm_3_ulv", "LAMBDALM 3 ULV", "Lambda-Cyhalothrine"),
    ("lambdastar_3_ulv", "LAMBDASTAR 3 ULV", "Lambda-Cyhalothrine"),
    ("supermala_265_ul", "SUPERMALA 265 UL", "Malathion - Cypermethrine"),
    ("sp_9", "SP-9", "Metarhizium Anisopliae Var. Acridum"),
    ("polytrine_c_220_ulv", "POLYTRINE C 220 ULV", "Profenophos - Cypermethrine"),
    ("nomolt_50_ul", "NOMOLT 50 UL", "Teflubenzuron"),
    ("wopro_teflubenzuron_50g_l_ulv", "WOPRO-TEFLUBENZURON 50G/L ULV", "Teflubenzuron"),
    ("chlorpyrriphos_240_ulv", "Chlorpyrriphos 240 ULV", "Chlorpyrifos_Ethyl"),
    ("dursban_240_ul", "Dursban 240 UL", "Chlorpyrifos_Ethyl"),
    ("avi_klorpirifos_240ulv", "Avi-klorpirifos 240ULV", "Chlropyriphos-Ethyl"),
]


async def seed_pesticides() -> None:
    async with AsyncSessionLocal() as db:
        existants = (await db.execute(select(PesticideModel.code))).scalars().all()
        deja_en_base = set(existants)

        ajoutes = 0
        for code, nom, matiere_active in PESTICIDES:
            if code in deja_en_base:
                continue
            db.add(
                PesticideModel(
                    code=code,
                    nom=nom,
                    matiere_active=matiere_active,
                    dose_reference=None,
                    actif=True,
                )
            )
            ajoutes += 1

        await db.commit()
        print(f"Pesticides : {ajoutes} ajoutés, {len(PESTICIDES) - ajoutes} déjà en base.")


if __name__ == "__main__":
    asyncio.run(seed_pesticides())
