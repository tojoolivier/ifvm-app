import {
  apiClient,
  CampagneSync,
  CodeStadeSync,
  CultureSync,
  PesticideSync,
  PosteAcridienSync,
  ReferentielPullResponse,
  ReferentielSinceCursors,
  StationFixeSync,
  UtilisateurEquipeSync,
} from './api-client';
import { getReferentielDb } from './referentiel-db';

type EntityType = keyof ReferentielPullResponse;

const ENTITY_TYPES: EntityType[] = [
  'postes_acridiens',
  'stations_fixes',
  'utilisateurs_equipe',
  'pesticides',
  'cultures',
  'codes_stades',
  'campagnes',
];

/** ADR-007 : chaque table référentiel se rafraîchit indépendamment — un curseur par type d'entité. */
async function getPerEntityCursors(
  db: Awaited<ReturnType<typeof getReferentielDb>>
): Promise<ReferentielSinceCursors> {
  const rows = await db.getAllAsync<{ entity_type: string; last_pull_at: string | null }>(
    'SELECT entity_type, last_pull_at FROM referentiel_sync_meta'
  );
  const stored = new Map(rows.map((row) => [row.entity_type, row.last_pull_at]));

  return {
    postes_acridiens: stored.get('postes_acridiens') ?? null,
    stations_fixes: stored.get('stations_fixes') ?? null,
    utilisateurs_equipe: stored.get('utilisateurs_equipe') ?? null,
    pesticides: stored.get('pesticides') ?? null,
    cultures: stored.get('cultures') ?? null,
    codes_stades: stored.get('codes_stades') ?? null,
    campagnes: stored.get('campagnes') ?? null,
  };
}

async function upsertPostesAcridiens(
  db: Awaited<ReturnType<typeof getReferentielDb>>,
  upserts: PosteAcridienSync[]
): Promise<void> {
  for (const pa of upserts) {
    await db.runAsync(
      `INSERT INTO poste_acridien (id, code, nom, za_id, actif, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         code = excluded.code, nom = excluded.nom, za_id = excluded.za_id,
         actif = excluded.actif, updated_at = excluded.updated_at`,
      [pa.id, pa.code, pa.nom, pa.za_id, pa.actif ? 1 : 0, pa.updated_at]
    );
  }
}

async function upsertStationsFixes(
  db: Awaited<ReturnType<typeof getReferentielDb>>,
  upserts: StationFixeSync[]
): Promise<void> {
  for (const station of upserts) {
    await db.runAsync(
      `INSERT INTO station_fixe
         (id, code, nom, pa_id, latitude, longitude, altitude, commune, district, region, actif, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         code = excluded.code, nom = excluded.nom, pa_id = excluded.pa_id,
         latitude = excluded.latitude, longitude = excluded.longitude, altitude = excluded.altitude,
         commune = excluded.commune, district = excluded.district, region = excluded.region,
         actif = excluded.actif, updated_at = excluded.updated_at`,
      [
        station.id,
        station.code,
        station.nom,
        station.pa_id,
        station.latitude,
        station.longitude,
        station.altitude,
        station.commune,
        station.district,
        station.region,
        station.actif ? 1 : 0,
        station.updated_at,
      ]
    );
  }
}

async function upsertUtilisateursEquipe(
  db: Awaited<ReturnType<typeof getReferentielDb>>,
  upserts: UtilisateurEquipeSync[]
): Promise<void> {
  for (const user of upserts) {
    await db.runAsync(
      `INSERT INTO utilisateur_equipe (id, nom, prenom, email, role, pa_id, actif, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         nom = excluded.nom, prenom = excluded.prenom, email = excluded.email, role = excluded.role,
         pa_id = excluded.pa_id, actif = excluded.actif, updated_at = excluded.updated_at`,
      [user.id, user.nom, user.prenom, user.email, user.role, user.pa_id, user.actif ? 1 : 0, user.updated_at]
    );
  }
}

async function upsertPesticides(
  db: Awaited<ReturnType<typeof getReferentielDb>>,
  upserts: PesticideSync[]
): Promise<void> {
  for (const pesticide of upserts) {
    await db.runAsync(
      `INSERT INTO pesticide (id, code, nom, actif, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         code = excluded.code, nom = excluded.nom, actif = excluded.actif, updated_at = excluded.updated_at`,
      [pesticide.id, pesticide.code, pesticide.nom, pesticide.actif ? 1 : 0, pesticide.updated_at]
    );
  }
}

async function upsertCultures(
  db: Awaited<ReturnType<typeof getReferentielDb>>,
  upserts: CultureSync[]
): Promise<void> {
  for (const culture of upserts) {
    await db.runAsync(
      `INSERT INTO culture (id, code, nom, actif, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         code = excluded.code, nom = excluded.nom, actif = excluded.actif, updated_at = excluded.updated_at`,
      [culture.id, culture.code, culture.nom, culture.actif ? 1 : 0, culture.updated_at]
    );
  }
}

async function upsertCodesStades(
  db: Awaited<ReturnType<typeof getReferentielDb>>,
  upserts: CodeStadeSync[]
): Promise<void> {
  for (const codeStade of upserts) {
    await db.runAsync(
      `INSERT INTO code_stade (id, code, categorie, sexe, espece, libelle, ordre, actif, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         code = excluded.code, categorie = excluded.categorie, sexe = excluded.sexe,
         espece = excluded.espece, libelle = excluded.libelle, ordre = excluded.ordre,
         actif = excluded.actif, updated_at = excluded.updated_at`,
      [
        codeStade.id,
        codeStade.code,
        codeStade.categorie,
        codeStade.sexe,
        codeStade.espece,
        codeStade.libelle,
        codeStade.ordre,
        codeStade.actif ? 1 : 0,
        codeStade.updated_at,
      ]
    );
  }
}

async function upsertCampagnes(
  db: Awaited<ReturnType<typeof getReferentielDb>>,
  upserts: CampagneSync[]
): Promise<void> {
  for (const campagne of upserts) {
    await db.runAsync(
      `INSERT INTO campagne (id, name, start_date, end_date, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name, start_date = excluded.start_date, end_date = excluded.end_date,
         updated_at = excluded.updated_at`,
      [campagne.id, campagne.name, campagne.start_date, campagne.end_date, campagne.updated_at]
    );
  }
}

async function updateSyncCursor(
  db: Awaited<ReturnType<typeof getReferentielDb>>,
  entityType: EntityType,
  serverTime: string
): Promise<void> {
  await db.runAsync(
    `INSERT INTO referentiel_sync_meta (entity_type, last_pull_at)
     VALUES (?, ?)
     ON CONFLICT(entity_type) DO UPDATE SET last_pull_at = excluded.last_pull_at`,
    [entityType, serverTime]
  );
}

/**
 * Efface les curseurs locaux pour forcer un pull complet au prochain appel — nécessaire pour
 * rattraper les entités qu'un pull incrémental antérieur (curseur déjà avancé) ne redemandera
 * jamais, faute de modification depuis.
 */
export async function resetReferentielSyncCursors(): Promise<void> {
  const db = await getReferentielDb();
  await db.runAsync('DELETE FROM referentiel_sync_meta');
}

/** Tire le référentiel depuis le serveur et l'upsert localement. Lève en cas d'échec réseau/API. */
export async function pullReferentiel(token: string, onUnauthorized?: () => void): Promise<void> {
  const db = await getReferentielDb();
  const cursors = await getPerEntityCursors(db);

  const response = await apiClient.pullReferentiel(token, cursors, onUnauthorized);

  await upsertPostesAcridiens(db, response.postes_acridiens.upserts);
  await upsertStationsFixes(db, response.stations_fixes.upserts);
  await upsertUtilisateursEquipe(db, response.utilisateurs_equipe.upserts);
  await upsertPesticides(db, response.pesticides.upserts);
  await upsertCultures(db, response.cultures.upserts);
  await upsertCodesStades(db, response.codes_stades.upserts);
  await upsertCampagnes(db, response.campagnes.upserts);

  for (const entityType of ENTITY_TYPES) {
    await updateSyncCursor(db, entityType, response[entityType].server_time);
  }
}
