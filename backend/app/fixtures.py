"""
Fixtures pour les postes acridiens et stations fixes de Madagascar.

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

# ~5 PA et ~15 stations représentatives de Madagascar
REFERENTIEL_DATA = {
    "postes_acridiens": [
        {"code": "PA-BL-01", "nom": "Bekily", "region": "Androy"},
        {"code": "PA-AN-01", "nom": "Amboasary", "region": "Androy"},
        {"code": "PA-TN-01", "nom": "Toliara", "region": "Atsimo-Andrefana"},
        {"code": "PA-MN-01", "nom": "Mananjary", "region": "Vatovavy-Fitovinany"},
        {"code": "PA-AN-02", "nom": "Antsirabe", "region": "Vakinankaratra"},
    ],
    "stations_fixes": [
        # PA-BL-01 : Bekily
        {
            "code": "ST-BL-001",
            "nom": "Manambaro Nord",
            "pa_code": "PA-BL-01",
            "latitude": -24.7833,
            "longitude": 45.6167,
            "altitude": 320,
        },
        {
            "code": "ST-BL-002",
            "nom": "Bekily Centre",
            "pa_code": "PA-BL-01",
            "latitude": -24.2333,
            "longitude": 45.3833,
            "altitude": 410,
        },
        {
            "code": "ST-BL-003",
            "nom": "Morombe Sud",
            "pa_code": "PA-BL-01",
            "latitude": -25.1500,
            "longitude": 45.3000,
            "altitude": 80,
        },
        # PA-AN-01 : Amboasary
        {
            "code": "ST-AN-001",
            "nom": "Amboasary Bas",
            "pa_code": "PA-AN-01",
            "latitude": -24.0333,
            "longitude": 46.4333,
            "altitude": 45,
        },
        {
            "code": "ST-AN-002",
            "nom": "Beheloka",
            "pa_code": "PA-AN-01",
            "latitude": -24.5500,
            "longitude": 46.7500,
            "altitude": 15,
        },
        {
            "code": "ST-AN-003",
            "nom": "Tolanaro Port",
            "pa_code": "PA-AN-01",
            "latitude": -25.0333,
            "longitude": 46.9833,
            "altitude": 10,
        },
        # PA-TN-01 : Toliara
        {
            "code": "ST-TN-001",
            "nom": "Toliara Ville",
            "pa_code": "PA-TN-01",
            "latitude": -23.3500,
            "longitude": 43.6667,
            "altitude": 8,
        },
        {
            "code": "ST-TN-002",
            "nom": "Morondava Nord",
            "pa_code": "PA-TN-01",
            "latitude": -20.4833,
            "longitude": 44.3167,
            "altitude": 5,
        },
        {
            "code": "ST-TN-003",
            "nom": "Beloha",
            "pa_code": "PA-TN-01",
            "latitude": -25.1667,
            "longitude": 45.0500,
            "altitude": 150,
        },
        # PA-MN-01 : Mananjary
        {
            "code": "ST-MN-001",
            "nom": "Mananjary Centre",
            "pa_code": "PA-MN-01",
            "latitude": -21.2167,
            "longitude": 48.3333,
            "altitude": 10,
        },
        {
            "code": "ST-MN-002",
            "nom": "Nosy Varika",
            "pa_code": "PA-MN-01",
            "latitude": -20.5833,
            "longitude": 48.5333,
            "altitude": 5,
        },
        {
            "code": "ST-MN-003",
            "nom": "Vatomandry",
            "pa_code": "PA-MN-01",
            "latitude": -19.3333,
            "longitude": 48.9500,
            "altitude": 15,
        },
        # PA-AN-02 : Antsirabe
        {
            "code": "ST-AN-004",
            "nom": "Antsirabe Nord",
            "pa_code": "PA-AN-02",
            "latitude": -19.8500,
            "longitude": 47.0333,
            "altitude": 1500,
        },
        {
            "code": "ST-AN-005",
            "nom": "Ambositra",
            "pa_code": "PA-AN-02",
            "latitude": -20.5167,
            "longitude": 47.2500,
            "altitude": 1350,
        },
        {
            "code": "ST-AN-006",
            "nom": "Fianarantsoa",
            "pa_code": "PA-AN-02",
            "latitude": -21.4500,
            "longitude": 47.0833,
            "altitude": 1100,
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
    "codes_stades": [
        {"code": "A1", "espece": "LMC", "libelle": "Imago stade A1"},
        {"code": "A2", "espece": "LMC", "libelle": "Imago stade A2"},
        {"code": "A3", "espece": "LMC", "libelle": "Imago stade A3"},
        {"code": "A4", "espece": "LMC", "libelle": "Imago stade A4"},
        {"code": "A5", "espece": "LMC", "libelle": "Imago stade A5"},
        {"code": "A1b", "espece": "LMC", "libelle": "Imago mâle stade A1"},
        {"code": "A2b", "espece": "LMC", "libelle": "Imago mâle stade A2"},
        {"code": "A5b", "espece": "LMC", "libelle": "Imago mâle stade A5"},
        {"code": "L1", "espece": "NSE", "libelle": "Larve stade L1"},
        {"code": "L2", "espece": "NSE", "libelle": "Larve stade L2"},
        {"code": "L3", "espece": "NSE", "libelle": "Larve stade L3"},
        {"code": "L4", "espece": "NSE", "libelle": "Larve stade L4"},
        {"code": "L5", "espece": "NSE", "libelle": "Larve stade L5"},
        {"code": "L6", "espece": "NSE", "libelle": "Larve stade L6"},
        {"code": "L7", "espece": "NSE", "libelle": "Larve stade L7"},
    ],
}


async def load_fixtures():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)

    async with engine.begin() as conn:
        # Charger les postes acridiens
        for pa in REFERENTIEL_DATA["postes_acridiens"]:
            await conn.execute(
                text("""
                    INSERT INTO poste_acridien (code, nom, region)
                    VALUES (:code, :nom, :region)
                    ON CONFLICT (code) DO UPDATE SET
                        nom = EXCLUDED.nom,
                        region = EXCLUDED.region,
                        updated_at = now()
                """),
                pa,
            )

        # Charger les stations fixes (nécessite de résoudre pa_code -> pa_id)
        for st in REFERENTIEL_DATA["stations_fixes"]:
            result = await conn.execute(
                text("SELECT id FROM poste_acridien WHERE code = :pa_code"),
                {"pa_code": st["pa_code"]},
            )
            pa_row = result.fetchone()
            if pa_row is None:
                print(f"⚠ PA {st['pa_code']} non trouvé, station {st['code']} ignorée")
                continue

            await conn.execute(
                text("""
                    INSERT INTO station_fixe (code, nom, pa_id, latitude, longitude, altitude)
                    VALUES (:code, :nom, :pa_id, :latitude, :longitude, :altitude)
                    ON CONFLICT (code) DO UPDATE SET
                        nom = EXCLUDED.nom,
                        pa_id = EXCLUDED.pa_id,
                        latitude = EXCLUDED.latitude,
                        longitude = EXCLUDED.longitude,
                        altitude = EXCLUDED.altitude,
                        updated_at = now()
                """),
                {
                    "code": st["code"],
                    "nom": st["nom"],
                    "pa_id": pa_row[0],
                    "latitude": st["latitude"],
                    "longitude": st["longitude"],
                    "altitude": st.get("altitude"),
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

        # Charger les codes stades
        for cs in REFERENTIEL_DATA["codes_stades"]:
            await conn.execute(
                text("""
                    INSERT INTO code_stade (code, espece, libelle)
                    VALUES (:code, :espece, :libelle)
                    ON CONFLICT (code) DO UPDATE SET
                        espece = EXCLUDED.espece,
                        libelle = EXCLUDED.libelle,
                        updated_at = now()
                """),
                cs,
            )

    await engine.dispose()
    print(f"✓ {len(REFERENTIEL_DATA['postes_acridiens'])} postes acridiens chargés")
    print(f"✓ {len(REFERENTIEL_DATA['stations_fixes'])} stations fixes chargées")
    print(f"✓ {len(REFERENTIEL_DATA['pesticides'])} pesticides chargés")
    print(f"✓ {len(REFERENTIEL_DATA['cultures'])} cultures chargées")
    print(f"✓ {len(REFERENTIEL_DATA['codes_stades'])} codes stades chargés")


if __name__ == "__main__":
    asyncio.run(load_fixtures())
