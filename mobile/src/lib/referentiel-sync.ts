import {
  apiClient,
  CampagneSync,
  CodeStadeSync,
  CultureSync,
  LieuAerienSync,
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
  'lieux_aeriens',
];

const TABLE_PAR_ENTITE: Record<EntityType, string> = {
  postes_acridiens: 'poste_acridien',
  stations_fixes: 'station_fixe',
  utilisateurs_equipe: 'utilisateur_equipe',
  pesticides: 'pesticide',
  cultures: 'culture',
  codes_stades: 'code_stade',
  campagnes: 'campagne',
  lieux_aeriens: 'lieu_aerien',
};

/**
 * ADR-007 : chaque table référentiel se rafraîchit indépendamment — un curseur par type
 * d'entité.
 *
 * Un curseur ne vaut que si la table qu'il décrit contient quelque chose. Table vide et
 * curseur avancé, c'est l'impasse : le serveur ne renvoie que les modifications depuis
 * le curseur, donc rien, et la synchro « réussit » sans jamais repeupler la table. On
 * ignore donc le curseur d'une table vide, ce qui répare l'appareil tout seul (#201).
 */
async function getPerEntityCursors(
  db: Awaited<ReturnType<typeof getReferentielDb>>
): Promise<ReferentielSinceCursors> {
  const rows = await db.getAllAsync<{ entity_type: string; last_pull_at: string | null }>(
    'SELECT entity_type, last_pull_at FROM referentiel_sync_meta'
  );
  const stored = new Map(rows.map((row) => [row.entity_type, row.last_pull_at]));

  const cursors = {} as ReferentielSinceCursors;
  for (const entity of ENTITY_TYPES) {
    const curseur = stored.get(entity) ?? null;
    cursors[entity] = curseur !== null && (await estVide(db, TABLE_PAR_ENTITE[entity]))
      ? null
      : curseur;
  }
  return cursors;
}

async function estVide(
  db: Awaited<ReturnType<typeof getReferentielDb>>,
  table: string
): Promise<boolean> {
  const row = await db.getFirstAsync<{ n: number }>(`SELECT count(*) AS n FROM ${table}`);
  return (row?.n ?? 0) === 0;
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
      `INSERT INTO utilisateur_equipe (id, nom, prenom, role, pa_id, actif, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         nom = excluded.nom, prenom = excluded.prenom, role = excluded.role,
         pa_id = excluded.pa_id, actif = excluded.actif, updated_at = excluded.updated_at`,
      [user.id, user.nom, user.prenom, user.role, user.pa_id, user.actif ? 1 : 0, user.updated_at]
    );
  }
}

async function upsertPesticides(
  db: Awaited<ReturnType<typeof getReferentielDb>>,
  upserts: PesticideSync[]
): Promise<void> {
  for (const pesticide of upserts) {
    // matiere_active/dose_reference/type_produit n'étaient pas descendus ici alors que
    // le pull les envoie déjà et que la colonne locale existe (#129/#134, migration
    // 0044) — un pesticide déjà synchronisé les gardait à NULL indéfiniment. Nécessaire
    // ici pour que le filtrage par mode_traitement (BARRIERE/TOTAL/IRREGULIER) dispose
    // de type_produit en local.
    await db.runAsync(
      `INSERT INTO pesticide (id, code, nom, matiere_active, dose_reference, type_produit, actif, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         code = excluded.code, nom = excluded.nom, matiere_active = excluded.matiere_active,
         dose_reference = excluded.dose_reference, type_produit = excluded.type_produit,
         actif = excluded.actif, updated_at = excluded.updated_at`,
      [
        pesticide.id,
        pesticide.code,
        pesticide.nom,
        pesticide.matiere_active ?? null,
        pesticide.dose_reference ?? null,
        pesticide.type_produit ?? null,
        pesticide.actif ? 1 : 0,
        pesticide.updated_at,
      ]
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

async function upsertLieuxAeriens(
  db: Awaited<ReturnType<typeof getReferentielDb>>,
  upserts: LieuAerienSync[]
): Promise<void> {
  for (const lieu of upserts) {
    await db.runAsync(
      `INSERT INTO lieu_aerien (id, type_lieu, nom, latitude, longitude, altitude, actif, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         type_lieu = excluded.type_lieu, nom = excluded.nom, latitude = excluded.latitude,
         longitude = excluded.longitude, altitude = excluded.altitude, actif = excluded.actif,
         updated_at = excluded.updated_at`,
      [
        lieu.id,
        lieu.type_lieu,
        lieu.nom,
        lieu.latitude,
        lieu.longitude,
        lieu.altitude,
        lieu.actif ? 1 : 0,
        lieu.updated_at,
      ]
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
  await upsertLieuxAeriens(db, response.lieux_aeriens.upserts);

  for (const entityType of ENTITY_TYPES) {
    await updateSyncCursor(db, entityType, response[entityType].server_time);
  }
}
