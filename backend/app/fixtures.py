"""
Fixtures pour le référentiel géographique (zones anti-acridiennes, postes acridiens,
stations fixes) et les autres référentiels de base (pesticides, cultures, codes stades).

Le référentiel géographique (zones_anti_acridiennes / postes_acridiens / stations_fixes)
est l'export réel du réseau intensif (fichier `Station_intensive.xlsx`, station météo/
extensif exclues, `Code_nature == 'int'`) : 6 zones anti-acridiennes (ZA), 17 postes
acridiens (PA), 97 stations fixes. Codes générés depuis les noms (pas de code source dans
le fichier) : `PA-<NOM-SLUG>` pour un poste, `ST-<PA-SLUG>-<NN>` pour une station (numérotée
dans l'ordre du fichier au sein de son PA).

Usage:
    docker compose exec backend python -m app.fixtures
    # ou
    python -m app.fixtures

Script idempotent : utilise INSERT ... ON CONFLICT DO UPDATE SET ... pour chaque ligne.
"""

import asyncio

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import settings
from app.domain.stades import GRILLES, VOCABULAIRE

REFERENTIEL_DATA = {
    "zones_anti_acridiennes": [
        {"code": "ZA1", "nom": "Befandriana sud"},
        {"code": "ZA2", "nom": "Sakaraha"},
        {"code": "ZA3", "nom": "Ejeda"},
        {"code": "ZA4", "nom": "Ambovombe"},
        {"code": "ZA5", "nom": "Ihosy"},
        {"code": "ZA6", "nom": "Ampanihy"},
    ],
    "postes_acridiens": [
        {"code": "PA-ANKARAOBATO", "nom": "Ankaraobato", "za_code": "ZA1"},
        {"code": "PA-TANANDAVA", "nom": "Tanandava", "za_code": "ZA1"},
        {"code": "PA-ANDRANOVORY", "nom": "Andranovory", "za_code": "ZA2"},
        {"code": "PA-ANKILIVALO", "nom": "Ankilivalo", "za_code": "ZA2"},
        {"code": "PA-MIARY", "nom": "Miary", "za_code": "ZA2"},
        {"code": "PA-BEAHITSE", "nom": "Beahitse", "za_code": "ZA3"},
        {"code": "PA-BEHELOKA", "nom": "Beheloka", "za_code": "ZA3"},
        {"code": "PA-BETIOKY-SUD", "nom": "Betioky-Sud", "za_code": "ZA3"},
        {"code": "PA-AMBOASARY", "nom": "Amboasary", "za_code": "ZA4"},
        {"code": "PA-BELOHA", "nom": "Beloha", "za_code": "ZA4"},
        {"code": "PA-TSIHOMBE", "nom": "Tsihombe", "za_code": "ZA4"},
        {"code": "PA-ANDONAKA", "nom": "Andonaka", "za_code": "ZA5"},
        {"code": "PA-JANGANY", "nom": "Jangany", "za_code": "ZA5"},
        {"code": "PA-RANOHIRA", "nom": "Ranohira", "za_code": "ZA5"},
        {"code": "PA-ANDROKA", "nom": "Androka", "za_code": "ZA6"},
        {"code": "PA-BEKILY", "nom": "Bekily", "za_code": "ZA6"},
        {"code": "PA-TRANOROA", "nom": "Tranoroa", "za_code": "ZA6"},
    ],
    "stations_fixes": [
        {
            "code": "ST-ANKARAOBATO-01",
            "nom": "Ampareake",
            "pa_code": "PA-ANKARAOBATO",
            "latitude": -22.7348,
            "longitude": 43.6703,
            "commune": "Ankililoaky",
            "district": "Toliara II",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-ANKARAOBATO-02",
            "nom": "Ampeha",
            "pa_code": "PA-ANKARAOBATO",
            "latitude": -22.631389,
            "longitude": 43.692139,
            "commune": "Ankililoaky",
            "district": "Toliara II",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-ANKARAOBATO-03",
            "nom": "Antapoaka",
            "pa_code": "PA-ANKARAOBATO",
            "latitude": -22.97575,
            "longitude": 43.601111,
            "commune": "Ankilimaliniky",
            "district": "Toliara II",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-ANKARAOBATO-04",
            "nom": "Beravy-bas",
            "pa_code": "PA-ANKARAOBATO",
            "latitude": -22.892722,
            "longitude": 43.596444,
            "commune": "Tsianisiha",
            "district": "Toliara II",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-ANKARAOBATO-05",
            "nom": "Défriche Mikea",
            "pa_code": "PA-ANKARAOBATO",
            "latitude": -22.6394,
            "longitude": 43.5211,
            "commune": "Ankililoaky",
            "district": "Toliara II",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-ANKARAOBATO-06",
            "nom": "Delta Manombo",
            "pa_code": "PA-ANKARAOBATO",
            "latitude": -22.921972,
            "longitude": 43.482528,
            "commune": "Manombo",
            "district": "Toliara II",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-TANANDAVA-01",
            "nom": "Analatelo",
            "pa_code": "PA-TANANDAVA",
            "latitude": -21.940194,
            "longitude": 43.913361,
            "commune": "Ankantsakantsa",
            "district": "Morombe",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-TANANDAVA-02",
            "nom": "Andalamengoke",
            "pa_code": "PA-TANANDAVA",
            "latitude": -21.716556,
            "longitude": 43.482861,
            "commune": "Morombe",
            "district": "Morombe",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-TANANDAVA-03",
            "nom": "Ankilifolo",
            "pa_code": "PA-TANANDAVA",
            "latitude": -22.089444,
            "longitude": 43.867861,
            "commune": "Befandriana sud",
            "district": "Morombe",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-TANANDAVA-04",
            "nom": "Delta Mangoky",
            "pa_code": "PA-TANANDAVA",
            "latitude": -21.40492,
            "longitude": 43.54253,
            "commune": "Tanandava",
            "district": "Morombe",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-TANANDAVA-05",
            "nom": "Namatoa",
            "pa_code": "PA-TANANDAVA",
            "latitude": -21.606444,
            "longitude": 43.630611,
            "commune": "Ambahikily",
            "district": "Morombe",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-TANANDAVA-06",
            "nom": "Antanamanitsy",
            "pa_code": "PA-TANANDAVA",
            "latitude": -21.948,
            "longitude": 43.584556,
            "commune": "Tanandava",
            "district": "Morombe",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-ANDRANOVORY-01",
            "nom": "Anjambaky",
            "pa_code": "PA-ANDRANOVORY",
            "latitude": -23.2654,
            "longitude": 44.16616,
            "commune": "Andranovory",
            "district": "Toliara II",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-ANDRANOVORY-02",
            "nom": "Anjaraday",
            "pa_code": "PA-ANDRANOVORY",
            "latitude": -23.07493,
            "longitude": 44.15758,
            "commune": "Andranovory",
            "district": "Toliara II",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-ANKILIVALO-01",
            "nom": "Andriabe (Ankilivalo)",
            "pa_code": "PA-ANKILIVALO",
            "latitude": -22.8907,
            "longitude": 44.50673,
            "commune": "Sakaraha",
            "district": "Sakaraha",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-ANKILIVALO-02",
            "nom": "Anjaraday",
            "pa_code": "PA-ANKILIVALO",
            "latitude": -22.889417,
            "longitude": 44.35875,
            "commune": "Mahaboboka",
            "district": "Sakaraha",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-ANKILIVALO-03",
            "nom": "Ankilibe",
            "pa_code": "PA-ANKILIVALO",
            "latitude": -22.992861,
            "longitude": 44.255389,
            "commune": "Vineta",
            "district": "Sakaraha",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-ANKILIVALO-04",
            "nom": "Toetromby (Ankilivalo)",
            "pa_code": "PA-ANKILIVALO",
            "latitude": -23.10444,
            "longitude": 44.22155,
            "commune": "Vineta-Andamasiny",
            "district": "Sakaraha",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-ANKILIVALO-05",
            "nom": "Trangora",
            "pa_code": "PA-ANKILIVALO",
            "latitude": -23.061722,
            "longitude": 44.461667,
            "commune": "Beraketa",
            "district": "Sakaraha",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-MIARY-01",
            "nom": "Analamitivala (int)",
            "pa_code": "PA-MIARY",
            "latitude": -23.316778,
            "longitude": 43.968167,
            "commune": "Andranohinaly",
            "district": "Toliara II",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-MIARY-02",
            "nom": "Andranomena (int)",
            "pa_code": "PA-MIARY",
            "latitude": -23.21395,
            "longitude": 43.44089,
            "commune": "Betsinjaka",
            "district": "Toliara II",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-MIARY-03",
            "nom": "Ankilibe (int)",
            "pa_code": "PA-MIARY",
            "latitude": -23.596139,
            "longitude": 43.753944,
            "commune": "St Augustin",
            "district": "Toliara II",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-MIARY-04",
            "nom": "Betaindambo (int)",
            "pa_code": "PA-MIARY",
            "latitude": -23.3215,
            "longitude": 43.650611,
            "commune": "Belalanda",
            "district": "Toliara II",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-MIARY-05",
            "nom": "Masiakampy",
            "pa_code": "PA-MIARY",
            "latitude": -23.27072,
            "longitude": 44.00764,
            "commune": "Andranohinaly",
            "district": "Toliara II",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-MIARY-06",
            "nom": "Sakavilany (int)",
            "pa_code": "PA-MIARY",
            "latitude": -23.136139,
            "longitude": 44.086889,
            "commune": "Andranovory",
            "district": "Toliara II",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-BEAHITSE-01",
            "nom": "Andrehaoke",
            "pa_code": "PA-BEAHITSE",
            "latitude": -24.036972,
            "longitude": 44.302306,
            "commune": "Beahitse",
            "district": "Ampanihy",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-BEAHITSE-02",
            "nom": "Ankilimanintsy",
            "pa_code": "PA-BEAHITSE",
            "latitude": -24.1645,
            "longitude": 44.5825,
            "commune": "Beahitse",
            "district": "Ampanihy",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-BEAHITSE-03",
            "nom": "Antoby (Beahi)",
            "pa_code": "PA-BEAHITSE",
            "latitude": -24.167139,
            "longitude": 44.427639,
            "commune": "Beahitse",
            "district": "Ampanihy",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-BEAHITSE-04",
            "nom": "Belobaka",
            "pa_code": "PA-BEAHITSE",
            "latitude": -24.016833,
            "longitude": 44.611861,
            "commune": "Beroy",
            "district": "Ampanihy",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-BEAHITSE-05",
            "nom": "Edo",
            "pa_code": "PA-BEAHITSE",
            "latitude": -24.315694,
            "longitude": 44.424972,
            "commune": "Beahitse",
            "district": "Ampanihy",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-BEAHITSE-06",
            "nom": "Sainta",
            "pa_code": "PA-BEAHITSE",
            "latitude": -24.066694,
            "longitude": 44.398472,
            "commune": "Beahitse",
            "district": "Ampanihy",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-BEHELOKA-01",
            "nom": "Ankalindrano",
            "pa_code": "PA-BEHELOKA",
            "latitude": -23.940194,
            "longitude": 43.694694,
            "commune": "Beheloka",
            "district": "Toliara II",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-BEHELOKA-02",
            "nom": "Ankaranila",
            "pa_code": "PA-BEHELOKA",
            "latitude": -23.706583,
            "longitude": 43.705194,
            "commune": "Soalara sud",
            "district": "Toliara II",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-BEHELOKA-03",
            "nom": "Ankilimivony",
            "pa_code": "PA-BEHELOKA",
            "latitude": -23.81075,
            "longitude": 43.681417,
            "commune": "Beheloka",
            "district": "Toliara II",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-BEHELOKA-04",
            "nom": "Antsirafaly",
            "pa_code": "PA-BEHELOKA",
            "latitude": -23.636778,
            "longitude": 43.706583,
            "commune": "Soalara",
            "district": "Toliara II",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-BEHELOKA-05",
            "nom": "Maromitilike",
            "pa_code": "PA-BEHELOKA",
            "latitude": -24.123222,
            "longitude": 43.702472,
            "commune": "Efoetse",
            "district": "Toliara II",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-BEHELOKA-06",
            "nom": "Tanindrato",
            "pa_code": "PA-BEHELOKA",
            "latitude": -24.309167,
            "longitude": 43.700222,
            "commune": "Itampolo",
            "district": "Ampanihy",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-BETIOKY-SUD-01",
            "nom": "Ambinjy (Betioky -sud)",
            "pa_code": "PA-BETIOKY-SUD",
            "latitude": -23.74714,
            "longitude": 44.09269,
            "commune": "Ankazomanga-ouest",
            "district": "Betioky-sud",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-BETIOKY-SUD-02",
            "nom": "Ankiliarivo (Betioky)",
            "pa_code": "PA-BETIOKY-SUD",
            "latitude": -23.78515,
            "longitude": 44.38799,
            "commune": "Beantake",
            "district": "Betioky-sud",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-BETIOKY-SUD-03",
            "nom": "Ankililegna",
            "pa_code": "PA-BETIOKY-SUD",
            "latitude": -23.964083,
            "longitude": 44.26075,
            "commune": "Maroarivo",
            "district": "Betioky-sud",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-BETIOKY-SUD-04",
            "nom": "Antoby (Betioky)",
            "pa_code": "PA-BETIOKY-SUD",
            "latitude": -23.71456,
            "longitude": 44.37236,
            "commune": "Betioky-sud",
            "district": "Betioky-sud",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-BETIOKY-SUD-05",
            "nom": "Besakoa (Betioky)",
            "pa_code": "PA-BETIOKY-SUD",
            "latitude": -23.91114,
            "longitude": 44.40961,
            "commune": "Masiaboay",
            "district": "Betioky-sud",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-BETIOKY-SUD-06",
            "nom": "Besatra (Betioky)",
            "pa_code": "PA-BETIOKY-SUD",
            "latitude": -23.791389,
            "longitude": 44.413056,
            "commune": "Betioky-sud",
            "district": "Betioky-sud",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-AMBOASARY-01",
            "nom": "Ampamolora (Ambov)",
            "pa_code": "PA-AMBOASARY",
            "latitude": -25.083333,
            "longitude": 45.983333,
            "commune": "Ambohimalaza",
            "district": "Ambovombe",
            "region": "Androy",
        },
        {
            "code": "ST-AMBOASARY-02",
            "nom": "Anarafaly (Ambov)",
            "pa_code": "PA-AMBOASARY",
            "latitude": -24.918889,
            "longitude": 46.205833,
            "commune": "Ifotaka",
            "district": "Amboasary",
            "region": "Anosy",
        },
        {
            "code": "ST-AMBOASARY-03",
            "nom": "Ankamena (Ambov)",
            "pa_code": "PA-AMBOASARY",
            "latitude": -25.02925,
            "longitude": 46.420222,
            "commune": "Amboasary",
            "district": "Amboasary",
            "region": "Anosy",
        },
        {
            "code": "ST-AMBOASARY-04",
            "nom": "Ankitry",
            "pa_code": "PA-AMBOASARY",
            "latitude": -25.08822,
            "longitude": 46.33853,
            "commune": "Amboasary",
            "district": "Amboasary",
            "region": "Anosy",
        },
        {
            "code": "ST-AMBOASARY-05",
            "nom": "Behoake (Tsivo)",
            "pa_code": "PA-AMBOASARY",
            "latitude": -25.08286,
            "longitude": 46.44658,
            "commune": "Tanandava-Sud",
            "district": "Amboasary",
            "region": "Anosy",
        },
        {
            "code": "ST-AMBOASARY-06",
            "nom": "Soatsifa (Ambov)",
            "pa_code": "PA-AMBOASARY",
            "latitude": -25.061111,
            "longitude": 46.233333,
            "commune": "Maroalopoty",
            "district": "Ambovombe",
            "region": "Androy",
        },
        {
            "code": "ST-BELOHA-01",
            "nom": "Ambatofoty",
            "pa_code": "PA-BELOHA",
            "latitude": -25.04964,
            "longitude": 45.17949,
            "commune": "Ikopoky",
            "district": "Beloha",
            "region": "Androy",
        },
        {
            "code": "ST-BELOHA-02",
            "nom": "Ankatrafay",
            "pa_code": "PA-BELOHA",
            "latitude": -25.3485,
            "longitude": 45.0338,
            "commune": "Tranovaho",
            "district": "Beloha",
            "region": "Androy",
        },
        {
            "code": "ST-BELOHA-03",
            "nom": "Ianademby (Ext)",
            "pa_code": "PA-BELOHA",
            "latitude": -25.38699,
            "longitude": 44.98552,
            "commune": "Tranovaho",
            "district": "Beloha",
            "region": "Androy",
        },
        {
            "code": "ST-BELOHA-04",
            "nom": "Ikopoky (Beloh)",
            "pa_code": "PA-BELOHA",
            "latitude": -25.20847,
            "longitude": 45.20525,
            "commune": "Ikopoky",
            "district": "Beloha",
            "region": "Androy",
        },
        {
            "code": "ST-BELOHA-05",
            "nom": "Lavanono//Vohipaho (Beloh)",
            "pa_code": "PA-BELOHA",
            "latitude": -25.47006,
            "longitude": 44.98901,
            "commune": "Tranovaho",
            "district": "Beloha",
            "region": "Androy",
        },
        {
            "code": "ST-BELOHA-06",
            "nom": "Saririaky",
            "pa_code": "PA-BELOHA",
            "latitude": -25.4645,
            "longitude": 45.0274,
            "commune": "Tranovaho",
            "district": "Beloha",
            "region": "Androy",
        },
        {
            "code": "ST-TSIHOMBE-01",
            "nom": "Agnahidrano",
            "pa_code": "PA-TSIHOMBE",
            "latitude": -25.12925,
            "longitude": 45.532944,
            "commune": "Antaritarika",
            "district": "Tsihombe",
            "region": "Androy",
        },
        {
            "code": "ST-TSIHOMBE-02",
            "nom": "Ambazoa",
            "pa_code": "PA-TSIHOMBE",
            "latitude": -25.329111,
            "longitude": 45.834083,
            "commune": "Marovato",
            "district": "Tsihombe",
            "region": "Androy",
        },
        {
            "code": "ST-TSIHOMBE-03",
            "nom": "Andranomasy",
            "pa_code": "PA-TSIHOMBE",
            "latitude": -25.262972,
            "longitude": 45.672361,
            "commune": "Tsihombe",
            "district": "Tsihombe",
            "region": "Androy",
        },
        {
            "code": "ST-TSIHOMBE-04",
            "nom": "Antalahavalala",
            "pa_code": "PA-TSIHOMBE",
            "latitude": -25.334528,
            "longitude": 45.762806,
            "commune": "Tsihombe",
            "district": "Tsihombe",
            "region": "Androy",
        },
        {
            "code": "ST-TSIHOMBE-05",
            "nom": "Berato (Ext)",
            "pa_code": "PA-TSIHOMBE",
            "latitude": -25.203,
            "longitude": 45.89428,
            "commune": "Ambonaivo",
            "district": "Ambovombe",
            "region": "Androy",
        },
        {
            "code": "ST-TSIHOMBE-06",
            "nom": "Terrain d'aviation",
            "pa_code": "PA-TSIHOMBE",
            "latitude": -25.355472,
            "longitude": 45.476139,
            "commune": "Tsihombe",
            "district": "Tsihombe",
            "region": "Androy",
        },
        {
            "code": "ST-ANDONAKA-01",
            "nom": "Andranomasy",
            "pa_code": "PA-ANDONAKA",
            "latitude": -22.36392,
            "longitude": 46.30412,
            "commune": "Zazafotsy",
            "district": "Ihosy",
            "region": "Ihorombe",
        },
        {
            "code": "ST-ANDONAKA-02",
            "nom": "Betalahaky",
            "pa_code": "PA-ANDONAKA",
            "latitude": -22.25346,
            "longitude": 46.074,
            "commune": "Mahasoa",
            "district": "Ihosy",
            "region": "Ihorombe",
        },
        {
            "code": "ST-ANDONAKA-03",
            "nom": "Kotoroy",
            "pa_code": "PA-ANDONAKA",
            "latitude": -21.9305,
            "longitude": 46.1614,
            "commune": "Antsoha",
            "district": "Ihosy",
            "region": "Ihorombe",
        },
        {
            "code": "ST-ANDONAKA-04",
            "nom": "Mahabodo",
            "pa_code": "PA-ANDONAKA",
            "latitude": -21.892,
            "longitude": 46.3272,
            "commune": "Antsoha",
            "district": "Ihosy",
            "region": "Ihorombe",
        },
        {
            "code": "ST-ANDONAKA-05",
            "nom": "Morarano (Int)",
            "pa_code": "PA-ANDONAKA",
            "latitude": -21.82292,
            "longitude": 46.45061,
            "commune": "Andonaka",
            "district": "Ambalavao",
            "region": "Haute Matriatra",
        },
        {
            "code": "ST-ANDONAKA-06",
            "nom": "Mahasoa",
            "pa_code": "PA-ANDONAKA",
            "latitude": -22.26401,
            "longitude": 46.05625,
            "commune": "Mahasoa",
            "district": "Ihosy",
            "region": "Ihorombe",
        },
        {
            "code": "ST-JANGANY-01",
            "nom": "Angara (Betro)",
            "pa_code": "PA-JANGANY",
            "latitude": -22.99383,
            "longitude": 45.72108,
            "commune": "Beapombo I",
            "district": "Betroka",
            "region": "Anosy",
        },
        {
            "code": "ST-JANGANY-02",
            "nom": "Ankary",
            "pa_code": "PA-JANGANY",
            "latitude": -22.793944,
            "longitude": 45.730667,
            "commune": "Andriandampy",
            "district": "Betroka",
            "region": "Anosy",
        },
        {
            "code": "ST-JANGANY-03",
            "nom": "Beraketa",
            "pa_code": "PA-JANGANY",
            "latitude": -22.815361,
            "longitude": 45.935611,
            "commune": "Jangany",
            "district": "Betroka",
            "region": "Anosy",
        },
        {
            "code": "ST-JANGANY-04",
            "nom": "Haut Andranovovo",
            "pa_code": "PA-JANGANY",
            "latitude": -22.87517,
            "longitude": 45.82149,
            "commune": "Jangany",
            "district": "Betroka",
            "region": "Anosy",
        },
        {
            "code": "ST-JANGANY-05",
            "nom": "Ianasatra",
            "pa_code": "PA-JANGANY",
            "latitude": -22.927,
            "longitude": 45.696306,
            "commune": "Jangany",
            "district": "Betroka",
            "region": "Anosy",
        },
        {
            "code": "ST-JANGANY-06",
            "nom": "Soaravy",
            "pa_code": "PA-JANGANY",
            "latitude": -23.076694,
            "longitude": 45.830806,
            "commune": "Benato-Toby",
            "district": "Betroka",
            "region": "Anosy",
        },
        {
            "code": "ST-RANOHIRA-01",
            "nom": "Andriamanero",
            "pa_code": "PA-RANOHIRA",
            "latitude": -22.36905,
            "longitude": 45.40214,
            "commune": "Ranohira",
            "district": "Ihosy",
            "region": "Ihorombe",
        },
        {
            "code": "ST-RANOHIRA-02",
            "nom": "Ankatsakatsaka",
            "pa_code": "PA-RANOHIRA",
            "latitude": -22.495222,
            "longitude": 45.563639,
            "commune": "Ambatolahy",
            "district": "Ihosy",
            "region": "Ihorombe",
        },
        {
            "code": "ST-RANOHIRA-03",
            "nom": "Ankazotelo",
            "pa_code": "PA-RANOHIRA",
            "latitude": -22.438194,
            "longitude": 45.858167,
            "commune": "Ambatolahy",
            "district": "Ihosy",
            "region": "Ihorombe",
        },
        {
            "code": "ST-RANOHIRA-04",
            "nom": "Belegnalegna",
            "pa_code": "PA-RANOHIRA",
            "latitude": -22.495222,
            "longitude": 45.563639,
            "commune": "Ranohira",
            "district": "Ihosy",
            "region": "Ihorombe",
        },
        {
            "code": "ST-RANOHIRA-05",
            "nom": "Sakamaningy",
            "pa_code": "PA-RANOHIRA",
            "latitude": -22.513278,
            "longitude": 45.4875,
            "commune": "Ranohira",
            "district": "Ihosy",
            "region": "Ihorombe",
        },
        {
            "code": "ST-RANOHIRA-06",
            "nom": "Satrokala",
            "pa_code": "PA-RANOHIRA",
            "latitude": -22.315056,
            "longitude": 45.693722,
            "commune": "Satrokala",
            "district": "Ihosy",
            "region": "Ihorombe",
        },
        {
            "code": "ST-ANDROKA-01",
            "nom": "Agnalagna",
            "pa_code": "PA-ANDROKA",
            "latitude": -24.218472,
            "longitude": 44.245556,
            "commune": "Androka",
            "district": "Ampanihy",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-ANDROKA-02",
            "nom": "Antaindolo",
            "pa_code": "PA-ANDROKA",
            "latitude": -24.83725,
            "longitude": 44.026778,
            "commune": "Androhipano",
            "district": "Ampanihy",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-ANDROKA-03",
            "nom": "Bearahake",
            "pa_code": "PA-ANDROKA",
            "latitude": -24.988139,
            "longitude": 44.227472,
            "commune": "Androka",
            "district": "Ampanihy",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-ANDROKA-04",
            "nom": "Beomby (Saodon)",
            "pa_code": "PA-ANDROKA",
            "latitude": -25.0063,
            "longitude": 44.26019,
            "commune": "Androka",
            "district": "Ampanihy",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-ANDROKA-05",
            "nom": "Emaly",
            "pa_code": "PA-ANDROKA",
            "latitude": -24.964972,
            "longitude": 44.124278,
            "commune": "Androka",
            "district": "Ampanihy",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-ANDROKA-06",
            "nom": "Nisoa (Ext)",
            "pa_code": "PA-ANDROKA",
            "latitude": -24.82826,
            "longitude": 44.02228,
            "commune": "Androhipano",
            "district": "Ampanihy",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-BEKILY-01",
            "nom": "Anadabo",
            "pa_code": "PA-BEKILY",
            "latitude": -24.21678,
            "longitude": 45.29746,
            "commune": "Bekily",
            "district": "Bekily",
            "region": "Androy",
        },
        {
            "code": "ST-BEKILY-02",
            "nom": "Ankaragnabo",
            "pa_code": "PA-BEKILY",
            "latitude": -24.1939,
            "longitude": 45.2736,
            "commune": "Ankaranabo_nord",
            "district": "Bekily",
            "region": "Androy",
        },
        {
            "code": "ST-BEKILY-03",
            "nom": "Ankilibe (Bekil)",
            "pa_code": "PA-BEKILY",
            "latitude": -24.216944,
            "longitude": 45.2475,
            "commune": "Bekily",
            "district": "Bekily",
            "region": "Androy",
        },
        {
            "code": "ST-BEKILY-04",
            "nom": "Bedona",
            "pa_code": "PA-BEKILY",
            "latitude": -24.2424,
            "longitude": 45.4118,
            "commune": "Tanandava",
            "district": "Bekily",
            "region": "Androy",
        },
        {
            "code": "ST-BEKILY-05",
            "nom": "Befangitse",
            "pa_code": "PA-BEKILY",
            "latitude": -24.2772,
            "longitude": 45.3569,
            "commune": "Manakopy",
            "district": "Bekily",
            "region": "Androy",
        },
        {
            "code": "ST-BEKILY-06",
            "nom": "Mitsinjo (Bekily)",
            "pa_code": "PA-BEKILY",
            "latitude": -24.12468,
            "longitude": 45.20877,
            "commune": "Bekily",
            "district": "Bekily",
            "region": "Androy",
        },
        {
            "code": "ST-TRANOROA-01",
            "nom": "Analamisasake",
            "pa_code": "PA-TRANOROA",
            "latitude": -24.8383,
            "longitude": 44.918,
            "commune": "Amboropotsy",
            "district": "Ampanihy",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-TRANOROA-02",
            "nom": "Ankonatse",
            "pa_code": "PA-TRANOROA",
            "latitude": -24.6689,
            "longitude": 45.0416,
            "commune": "Tranoroa",
            "district": "Beloha",
            "region": "Androy",
        },
        {
            "code": "ST-TRANOROA-03",
            "nom": "Bemoita (Tranoroa)",
            "pa_code": "PA-TRANOROA",
            "latitude": -24.755,
            "longitude": 44.9375,
            "commune": "Bekitro",
            "district": "Ampanihy",
            "region": "Atsimo Andrefana",
        },
        {
            "code": "ST-TRANOROA-04",
            "nom": "Est-tranoroa",
            "pa_code": "PA-TRANOROA",
            "latitude": -24.75142,
            "longitude": 45.22405,
            "commune": "Tranoroa",
            "district": "Beloha",
            "region": "Androy",
        },
        {
            "code": "ST-TRANOROA-05",
            "nom": "Koboary",
            "pa_code": "PA-TRANOROA",
            "latitude": -24.670083,
            "longitude": 45.1385,
            "commune": "Tranoroa",
            "district": "Beloha",
            "region": "Androy",
        },
        {
            "code": "ST-TRANOROA-06",
            "nom": "Koronga",
            "pa_code": "PA-TRANOROA",
            "latitude": -24.80075,
            "longitude": 45.260861,
            "commune": "Ambatotsivala",
            "district": "Beloha",
            "region": "Androy",
        },
    ],
    "pesticides": [
        {"code": "PEST-FEN", "nom": "Fenitrothion"},
        {"code": "PEST-MAL", "nom": "Malathion"},
        {"code": "PEST-CHL", "nom": "Chlorpyrifos"},
        {"code": "PEST-DEL", "nom": "Deltaméthrine"},
    ],
    "cultures": [
        {"code": "CULT-RIZ", "nom": "Riz"},
        {"code": "CULT-MAI", "nom": "Maïs"},
        {"code": "CULT-MAN", "nom": "Manioc"},
        {"code": "CULT-PAT", "nom": "Patate douce"},
        {"code": "CULT-VEG", "nom": "Zone non cultivée / végétation naturelle"},
    ],
    "stades": [{"code": code, "libelle": libelle} for code, libelle in VOCABULAIRE],
    "codes_stades": [
        {
            "code": p.code,
            "categorie": p.categorie,
            "sexe": p.sexe,
            "espece": p.espece,
            "libelle": p.libelle,
            "ordre": p.ordre,
        }
        for p in GRILLES
    ],
}


async def load_fixtures():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)

    async with engine.begin() as conn:
        # Charger les zones anti-acridiennes (ZA)
        for za in REFERENTIEL_DATA["zones_anti_acridiennes"]:
            await conn.execute(
                text("""
                    INSERT INTO zone_anti_acridien (code, nom)
                    VALUES (:code, :nom)
                    ON CONFLICT (code) DO UPDATE SET
                        nom = EXCLUDED.nom,
                        updated_at = now()
                """),
                za,
            )

        # Charger les postes acridiens (résoudre za_code -> za_id)
        for pa in REFERENTIEL_DATA["postes_acridiens"]:
            result = await conn.execute(
                text("SELECT id FROM zone_anti_acridien WHERE code = :za_code"),
                {"za_code": pa["za_code"]},
            )
            za_row = result.fetchone()
            if za_row is None:
                print(f"⚠ ZA {pa['za_code']} non trouvée, PA {pa['code']} ignoré")
                continue

            await conn.execute(
                text("""
                    INSERT INTO poste_acridien (code, nom, za_id)
                    VALUES (:code, :nom, :za_id)
                    ON CONFLICT (code) DO UPDATE SET
                        nom = EXCLUDED.nom,
                        za_id = EXCLUDED.za_id,
                        updated_at = now()
                """),
                {"code": pa["code"], "nom": pa["nom"], "za_id": za_row[0]},
            )

        # Charger les stations fixes : résoudre pa_code -> pa_id et
        # (region, district, commune) -> commune_id, en créant au passage les
        # lignes region/district/commune manquantes (hiérarchie administrative).
        for st in REFERENTIEL_DATA["stations_fixes"]:
            pa_result = await conn.execute(
                text("SELECT id FROM poste_acridien WHERE code = :pa_code"),
                {"pa_code": st["pa_code"]},
            )
            pa_row = pa_result.fetchone()
            if pa_row is None:
                print(f"⚠ PA {st['pa_code']} non trouvé, station {st['code']} ignorée")
                continue

            region_result = await conn.execute(
                text("""
                    INSERT INTO region (nom) VALUES (:nom)
                    ON CONFLICT (nom) DO UPDATE SET nom = EXCLUDED.nom
                    RETURNING id
                """),
                {"nom": st["region"]},
            )
            region_id = region_result.scalar_one()

            district_result = await conn.execute(
                text("""
                    INSERT INTO district (nom, region_id) VALUES (:nom, :region_id)
                    ON CONFLICT (region_id, nom) DO UPDATE SET nom = EXCLUDED.nom
                    RETURNING id
                """),
                {"nom": st["district"], "region_id": region_id},
            )
            district_id = district_result.scalar_one()

            commune_result = await conn.execute(
                text("""
                    INSERT INTO commune (nom, district_id) VALUES (:nom, :district_id)
                    ON CONFLICT (district_id, nom) DO UPDATE SET nom = EXCLUDED.nom
                    RETURNING id
                """),
                {"nom": st["commune"], "district_id": district_id},
            )
            commune_id = commune_result.scalar_one()

            await conn.execute(
                text("""
                    INSERT INTO station_fixe
                        (code, nom, pa_id, latitude, longitude, altitude, commune_id)
                    VALUES
                        (:code, :nom, :pa_id, :latitude, :longitude, :altitude, :commune_id)
                    ON CONFLICT (code) DO UPDATE SET
                        nom = EXCLUDED.nom,
                        pa_id = EXCLUDED.pa_id,
                        latitude = EXCLUDED.latitude,
                        longitude = EXCLUDED.longitude,
                        altitude = EXCLUDED.altitude,
                        commune_id = EXCLUDED.commune_id,
                        updated_at = now()
                """),
                {
                    "code": st["code"],
                    "nom": st["nom"],
                    "pa_id": pa_row[0],
                    "latitude": st["latitude"],
                    "longitude": st["longitude"],
                    "altitude": st.get("altitude"),
                    "commune_id": commune_id,
                },
            )

        # Charger les pesticides
        for p in REFERENTIEL_DATA["pesticides"]:
            await conn.execute(
                text("""
                    INSERT INTO pesticide (code, nom)
                    VALUES (:code, :nom)
                    ON CONFLICT (code) DO UPDATE SET
                        nom = EXCLUDED.nom,
                        updated_at = now()
                """),
                p,
            )

        # Charger les cultures
        for c in REFERENTIEL_DATA["cultures"]:
            await conn.execute(
                text("""
                    INSERT INTO culture (code, nom)
                    VALUES (:code, :nom)
                    ON CONFLICT (code) DO UPDATE SET
                        nom = EXCLUDED.nom,
                        updated_at = now()
                """),
                c,
            )

        # Charger le vocabulaire des stades, puis leur place dans les grilles de saisie
        for s in REFERENTIEL_DATA["stades"]:
            await conn.execute(
                text("""
                    INSERT INTO stade (code, libelle)
                    VALUES (:code, :libelle)
                    ON CONFLICT (code) DO UPDATE SET
                        libelle = EXCLUDED.libelle,
                        updated_at = now()
                """),
                s,
            )

        for cs in REFERENTIEL_DATA["codes_stades"]:
            await conn.execute(
                text("""
                    INSERT INTO code_stade (code, categorie, sexe, espece, libelle, ordre)
                    VALUES (:code, :categorie, :sexe, :espece, :libelle, :ordre)
                    ON CONFLICT (code, categorie, sexe, espece) DO UPDATE SET
                        libelle = EXCLUDED.libelle,
                        ordre = EXCLUDED.ordre,
                        updated_at = now()
                """),
                cs,
            )

    await engine.dispose()
    print(f"✓ {len(REFERENTIEL_DATA['zones_anti_acridiennes'])} zones anti-acridiennes chargées")
    print(f"✓ {len(REFERENTIEL_DATA['postes_acridiens'])} postes acridiens chargés")
    print(f"✓ {len(REFERENTIEL_DATA['stations_fixes'])} stations fixes chargées")
    print(f"✓ {len(REFERENTIEL_DATA['pesticides'])} pesticides chargés")
    print(f"✓ {len(REFERENTIEL_DATA['cultures'])} cultures chargées")
    print(f"✓ {len(REFERENTIEL_DATA['codes_stades'])} codes stades chargés")


if __name__ == "__main__":
    asyncio.run(load_fixtures())
