import {
  apiClient,
  CampagneSync,
  CodeStadeSync,
  AeronefSync,
  CultureSync,
  EquipeAeronefSync,
  EquipeMembreSync,
  EquipeSync,
  LieuAerienSync,
  PesticideSync,
  PosteAcridienSync,
  ReferentielPullResponse,
  ReferentielSinceCursors,
  SiteAerienSync,
  StationFixeSync,
  UtilisateurEquipeSync,
} from './api-client';
import { getReferentielDb, remplacerReferentiel } from './referentiel-db';

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
  'equipes',
  'equipe_membres',
  'sites_aeriens',
  'aeronefs',
  'equipe_aeronefs',
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
  equipes: 'equipe',
  equipe_membres: 'equipe_membre',
  sites_aeriens: 'site_aerien',
  aeronefs: 'aeronef',
  equipe_aeronefs: 'equipe_aeronef',
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

async function upsertEquipes(
  db: Awaited<ReturnType<typeof getReferentielDb>>,
  upserts: EquipeSync[]
): Promise<void> {
  for (const equipe of upserts) {
    await db.runAsync(
      `INSERT INTO equipe (id, nom, type, actif, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         nom = excluded.nom, type = excluded.type,
         actif = excluded.actif, updated_at = excluded.updated_at`,
      [equipe.id, equipe.nom, equipe.type, equipe.actif ? 1 : 0, equipe.updated_at]
    );
  }
}

async function upsertEquipeMembres(
  db: Awaited<ReturnType<typeof getReferentielDb>>,
  upserts: EquipeMembreSync[]
): Promise<void> {
  for (const membre of upserts) {
    await db.runAsync(
      `INSERT INTO equipe_membre (equipe_id, user_id, fonction, nom, prenom)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(equipe_id, user_id) DO UPDATE SET
         fonction = excluded.fonction, nom = excluded.nom, prenom = excluded.prenom`,
      [membre.equipe_id, membre.user_id, membre.fonction, membre.nom ?? null, membre.prenom ?? null]
    );
  }
}

async function upsertSitesAeriens(
  db: Awaited<ReturnType<typeof getReferentielDb>>,
  upserts: SiteAerienSync[]
): Promise<void> {
  for (const site of upserts) {
    await db.runAsync(
      `INSERT INTO site_aerien
         (id, parent_site_id, equipe_id, numero, localite, actif,
          latitude, longitude, altitude, date_debut_position, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         parent_site_id = excluded.parent_site_id, equipe_id = excluded.equipe_id,
         numero = excluded.numero, localite = excluded.localite, actif = excluded.actif,
         latitude = excluded.latitude, longitude = excluded.longitude, altitude = excluded.altitude,
         date_debut_position = excluded.date_debut_position, updated_at = excluded.updated_at,
         statut_sync = 'synced'
       -- Un déplacement saisi hors-ligne et pas encore envoyé (#643) : le serveur ne connaît
       -- que l'ancienne position, la reprendre annulerait à l'écran le geste de l'agent.
       WHERE NOT EXISTS (
         SELECT 1 FROM site_aerien_deplacement d
         WHERE d.site_id = excluded.id AND d.statut_sync = 'local'
       )`,
      [
        site.id,
        site.parent_site_id,
        site.equipe_id,
        site.numero,
        site.localite,
        site.actif ? 1 : 0,
        site.latitude ?? null,
        site.longitude ?? null,
        site.altitude ?? null,
        site.date_debut_position ?? null,
        site.updated_at,
      ]
    );
  }
}

async function upsertAeronefs(
  db: Awaited<ReturnType<typeof getReferentielDb>>,
  upserts: AeronefSync[]
): Promise<void> {
  for (const aeronef of upserts) {
    await db.runAsync(
      `INSERT INTO aeronef (id, immatriculation, societe, volume_cuve_l, actif, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         immatriculation = excluded.immatriculation, societe = excluded.societe,
         volume_cuve_l = excluded.volume_cuve_l, actif = excluded.actif,
         updated_at = excluded.updated_at`,
      [
        aeronef.id,
        aeronef.immatriculation,
        aeronef.societe,
        aeronef.volume_cuve_l,
        aeronef.actif ? 1 : 0,
        aeronef.updated_at,
      ]
    );
  }
}

async function upsertEquipeAeronefs(
  db: Awaited<ReturnType<typeof getReferentielDb>>,
  upserts: EquipeAeronefSync[]
): Promise<void> {
  for (const affectation of upserts) {
    await db.runAsync(
      `INSERT INTO equipe_aeronef (id, equipe_id, aeronef_id, date_debut, date_fin, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         equipe_id = excluded.equipe_id, aeronef_id = excluded.aeronef_id,
         date_debut = excluded.date_debut, date_fin = excluded.date_fin,
         updated_at = excluded.updated_at`,
      [
        affectation.id,
        affectation.equipe_id,
        affectation.aeronef_id,
        affectation.date_debut,
        affectation.date_fin ?? null,
        affectation.updated_at,
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
      `INSERT INTO lieu_aerien (id, type_lieu, nom, latitude, longitude, altitude, equipe_aerienne_id, actif, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         type_lieu = excluded.type_lieu, nom = excluded.nom, latitude = excluded.latitude,
         longitude = excluded.longitude, altitude = excluded.altitude,
         equipe_aerienne_id = excluded.equipe_aerienne_id, actif = excluded.actif,
         updated_at = excluded.updated_at`,
      [
        lieu.id,
        lieu.type_lieu,
        lieu.nom,
        lieu.latitude,
        lieu.longitude,
        lieu.altitude,
        lieu.equipe_aerienne_id ?? null,
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
      `INSERT INTO campagne (id, name, start_date, end_date, actif, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name, start_date = excluded.start_date, end_date = excluded.end_date,
         actif = excluded.actif, updated_at = excluded.updated_at`,
      [
        campagne.id,
        campagne.name,
        campagne.start_date,
        campagne.end_date,
        campagne.actif ? 1 : 0,
        campagne.updated_at,
      ]
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
type Supprimable = { id: string; deleted_at?: string | null };

/**
 * Soft-delete du référentiel (#674) : le serveur renvoie une ligne supprimée avec
 * `deleted_at` non nul. Elle est purgée du cache local plutôt que masquée, pour que les
 * lectures n'aient rien à filtrer. Enfants avant parents (les FK locales suivent celles du
 * serveur) ; les membres d'une équipe supprimée partent avec elle.
 */
const PURGE_ENFANTS_D_ABORD: EntityType[] = [
  'equipe_aeronefs',
  'stations_fixes',
  'sites_aeriens',
  'lieux_aeriens',
  'aeronefs',
  'equipes',
  'postes_acridiens',
  'pesticides',
  'cultures',
  'codes_stades',
  'campagnes',
];

function vivantes<T extends { deleted_at?: string | null }>(upserts: T[]): T[] {
  return upserts.filter((ligne) => !ligne.deleted_at);
}

async function purgerSupprimes(
  db: Awaited<ReturnType<typeof getReferentielDb>>,
  response: ReferentielPullResponse
): Promise<void> {
  for (const entity of PURGE_ENFANTS_D_ABORD) {
    const upserts = response[entity].upserts as Supprimable[];
    for (const ligne of upserts.filter((l) => l.deleted_at)) {
      if (entity === 'equipes') {
        await db.runAsync('DELETE FROM equipe_membre WHERE equipe_id = ?', [ligne.id]);
      }
      await db.runAsync(`DELETE FROM ${TABLE_PAR_ENTITE[entity]} WHERE id = ?`, [ligne.id]);
    }
  }
}

/**
 * File d'attente des écritures du référentiel : la synchro automatique, le bouton « Synchroniser » et la
 * réinitialisation ne tournent jamais ensemble. Sans elle, un pull incrémental pouvait écrire dans des
 * tables que la réinitialisation venait de recréer, et déposer des curseurs incohérents.
 */
let file: Promise<unknown> = Promise.resolve();
function enFile<T>(tache: () => Promise<T>): Promise<T> {
  const resultat = file.then(tache, tache);
  file = resultat.catch(() => undefined);
  return resultat;
}

export function resetReferentielSyncCursors(): Promise<void> {
  // Dans la file : remis à zéro en plein pull ou en plein remplacement, un curseur perdait sa valeur
  // sous les pieds de l'écriture qui venait de le déposer.
  return enFile(async () => {
    const db = await getReferentielDb();
    await db.runAsync('DELETE FROM referentiel_sync_meta');
  });
}

export interface ProgressionTable {
  table: EntityType;
  /** Rang de la table, de 1 à `total`. */
  index: number;
  total: number;
  etat: 'en_cours' | 'fini';
  /** Entrées écrites pour cette table ; 0 tant que l'état est `en_cours`. */
  lignes: number;
}

type Base = Awaited<ReturnType<typeof getReferentielDb>>;

/**
 * Écrit une réponse du serveur dans le cache, table par table. L'ordre est libre (le DDL local n'a
 * aucune clé étrangère) ; `surProgression` annonce le début et la fin de chaque table à l'écran de
 * réinitialisation.
 */
async function appliquerReponse(
  db: Base,
  response: ReferentielPullResponse,
  surProgression?: (progression: ProgressionTable) => void
): Promise<void> {
  await purgerSupprimes(db, response);

  const etapes: [EntityType, () => Promise<void>][] = [
    ['postes_acridiens', () => upsertPostesAcridiens(db, vivantes(response.postes_acridiens.upserts))],
    ['stations_fixes', () => upsertStationsFixes(db, vivantes(response.stations_fixes.upserts))],
    ['utilisateurs_equipe', () => upsertUtilisateursEquipe(db, response.utilisateurs_equipe.upserts)],
    ['pesticides', () => upsertPesticides(db, vivantes(response.pesticides.upserts))],
    ['cultures', () => upsertCultures(db, vivantes(response.cultures.upserts))],
    ['codes_stades', () => upsertCodesStades(db, vivantes(response.codes_stades.upserts))],
    ['campagnes', () => upsertCampagnes(db, vivantes(response.campagnes.upserts))],
    ['lieux_aeriens', () => upsertLieuxAeriens(db, vivantes(response.lieux_aeriens.upserts))],
    ['equipes', () => upsertEquipes(db, vivantes(response.equipes.upserts))],
    ['equipe_membres', () => upsertEquipeMembres(db, response.equipe_membres.upserts)],
    ['sites_aeriens', () => upsertSitesAeriens(db, vivantes(response.sites_aeriens.upserts))],
    ['aeronefs', () => upsertAeronefs(db, vivantes(response.aeronefs.upserts))],
    ['equipe_aeronefs', () => upsertEquipeAeronefs(db, vivantes(response.equipe_aeronefs.upserts))],
  ];

  for (const [i, [table, ecrire]] of etapes.entries()) {
    const repere = { table, index: i + 1, total: etapes.length };
    surProgression?.({ ...repere, etat: 'en_cours', lignes: 0 });
    await ecrire();
    await updateSyncCursor(db, table, response[table].server_time);
    const lignes = (response[table].upserts as Supprimable[]).filter((l) => !l.deleted_at).length;
    surProgression?.({ ...repere, etat: 'fini', lignes });
  }
}

/** Tire le référentiel depuis le serveur et l'upsert localement. Lève en cas d'échec réseau/API. */
export function pullReferentiel(token: string, onUnauthorized?: () => void): Promise<void> {
  return enFile(async () => {
    const db = await getReferentielDb();
    const cursors = await getPerEntityCursors(db);

    const response = await apiClient.pullReferentiel(token, cursors, onUnauthorized);

    await appliquerReponse(db, response);
  });
}

export interface OptionsReinitialisation {
  surProgression?: (progression: ProgressionTable) => void;
  /** « Annuler » : coupe le téléchargement en cours. Une fois l'écriture commencée, il n'y a plus de retour. */
  signal?: AbortSignal;
  onUnauthorized?: () => void;
}

/**
 * « Tout réinitialiser » : jette le cache du référentiel et le retélécharge en entier.
 *
 * Le téléchargement passe **avant** le vidage, et le vidage et l'écriture forment une seule
 * transaction (`remplacerReferentiel`) : un échec réseau ou d'écriture laisse l'ancien cache intact.
 * C'est aussi ce qui rend « Annuler » sûr pendant le téléchargement.
 */
export function reinitialiserReferentiel(
  token: string,
  options: OptionsReinitialisation = {}
): Promise<'termine' | 'annule'> {
  return enFile(() => reinitialiser(token, options));
}

async function reinitialiser(token: string, options: OptionsReinitialisation): Promise<'termine' | 'annule'> {
  const curseursNuls = Object.fromEntries(ENTITY_TYPES.map((entite) => [entite, null])) as ReferentielSinceCursors;
  let response: ReferentielPullResponse;
  try {
    response = await apiClient.pullReferentiel(token, curseursNuls, options.onUnauthorized, options.signal);
  } catch (erreur) {
    // Une requête coupée par « Annuler » n'est pas un échec : l'agent l'a voulu.
    if (options.signal?.aborted) return 'annule';
    throw erreur;
  }

  if (options.signal?.aborted) return 'annule';

  await remplacerReferentiel((db) => appliquerReponse(db, response, options.surProgression));
  return 'termine';
}
