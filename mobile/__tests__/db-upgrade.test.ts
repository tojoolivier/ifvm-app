import { DatabaseSync } from 'node:sqlite';

import { resetDbForTests, getDb } from '../src/lib/prospection-db';
import { listUnsyncedProspections } from '../src/lib/prospection-repository';
import { resetReferentielDbForTests } from '../src/lib/referentiel-db';
import { listVolsEnAttente } from '../src/lib/vol-db';

/** SQLite réel (Node) derrière l'API async d'expo-sqlite : on vérifie du SQL sur de vraies données. */
let sqlite: DatabaseSync;
let mockBase: unknown;

function enveloppe(base: DatabaseSync) {
  return {
    execAsync: async (sql: string) => void base.exec(sql),
    runAsync: async (sql: string, p: unknown[] = []) => void base.prepare(sql).run(...(p as never[])),
    getAllAsync: async (sql: string, p: unknown[] = []) => base.prepare(sql).all(...(p as never[])),
    getFirstAsync: async (sql: string, p: unknown[] = []) =>
      base.prepare(sql).get(...(p as never[])) ?? null,
    withTransactionAsync: async (tache: () => Promise<void>) => {
      base.exec('BEGIN');
      try {
        await tache();
        base.exec('COMMIT');
      } catch (erreur) {
        base.exec('ROLLBACK');
        throw erreur;
      }
    },
  };
}

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: () => Promise.resolve(mockBase) }));

/**
 * Une base d'avant `user_version`, à un état historique ancien et **remplie de saisies non
 * envoyées** : colonnes manquantes partout, `kit_boite` avant son renommage, `quantite_l` avant
 * `quantite`, pas de colonnes facultatives de vol, pas de `renomme` sur les déplacements.
 */
function fabriquerAncienneBase(base: DatabaseSync) {
  base.exec(`
    CREATE TABLE prospection (
      id TEXT PRIMARY KEY NOT NULL, type_prospection TEXT NOT NULL, campagne_id TEXT NOT NULL,
      prospecteur_id TEXT NOT NULL, date_prospection TEXT NOT NULL,
      statut TEXT NOT NULL, statut_sync TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    INSERT INTO prospection VALUES
      ('p-local', 'intensive', 'c1', 'u1', '2026-03-01', 'en_attente', 'local', '2026-03-01', '2026-03-01'),
      ('p-brouillon', 'intensive', 'c1', 'u1', '2026-03-02', 'brouillon', 'local', '2026-03-02', '2026-03-02');

    CREATE TABLE traitement (
      id TEXT PRIMARY KEY NOT NULL, prospection_id TEXT NOT NULL, type_traitement TEXT NOT NULL,
      kit_boite INTEGER, statut_sync TEXT NOT NULL DEFAULT 'brouillon'
    );
    INSERT INTO traitement (id, prospection_id, type_traitement, kit_boite, statut_sync)
      VALUES ('t-local', 'p-local', 'terrestre', 3, 'local');

    CREATE TABLE rotation (
      id TEXT PRIMARY KEY NOT NULL, traitement_aerien_id TEXT NOT NULL, quantite_l REAL
    );
    INSERT INTO rotation VALUES ('r1', 'ta1', 42.5);

    CREATE TABLE vol (
      id TEXT PRIMARY KEY NOT NULL, categorie TEXT NOT NULL, origine TEXT NOT NULL, equipe_id TEXT NOT NULL,
      aeronef_id TEXT NOT NULL, date_vol TEXT NOT NULL, heure_debut TEXT NOT NULL, heure_fin TEXT NOT NULL,
      statut_sync TEXT NOT NULL DEFAULT 'local', cree_le TEXT NOT NULL
    );
    INSERT INTO vol VALUES ('v-local','convoyage','saisie_directe','e1','a1','2026-03-03','08:00','09:00','local','2026-03-03');

    CREATE TABLE site_aerien_deplacement (
      id TEXT PRIMARY KEY NOT NULL, site_id TEXT NOT NULL, numero TEXT NOT NULL, localite TEXT NOT NULL,
      latitude REAL NOT NULL, longitude REAL NOT NULL, altitude REAL, cree_le TEXT NOT NULL,
      statut_sync TEXT NOT NULL DEFAULT 'local'
    );
    INSERT INTO site_aerien_deplacement (id, site_id, numero, localite, latitude, longitude, cree_le)
      VALUES ('d-local','s1','12','Tuléar',-23.3,43.6,'2026-03-04');
  `);
}

const version = () =>
  (sqlite.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
const colonnes = (table: string) =>
  (sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  mockBase = enveloppe(sqlite);
  resetDbForTests();
  resetReferentielDbForTests();
});

describe("upgrade d'une ancienne base remplie de saisies non envoyées (#676)", () => {
  it('rien ne se perd : les lignes en attente sont toujours là, complétées, et synchronisables', async () => {
    fabriquerAncienneBase(sqlite);
    expect(version()).toBe(0);

    await getDb();

    expect(version()).toBeGreaterThanOrEqual(1);
    // Colonnes manquantes ajoutées, renommages sans perte de valeur.
    expect(colonnes('traitement')).toContain('kit_botte');
    expect(sqlite.prepare("SELECT kit_botte FROM traitement WHERE id = 't-local'").get()).toEqual({
      kit_botte: 3,
    });
    expect(sqlite.prepare("SELECT quantite FROM rotation WHERE id = 'r1'").get()).toEqual({
      quantite: 42.5,
    });
    expect(colonnes('vol')).toContain('site_principal_id');
    expect(colonnes('site_aerien_deplacement')).toContain('renomme');

    // La file d'envoi les voit encore, avec les requêtes mêmes de la synchro.
    expect((await listUnsyncedProspections()).map((p) => p.id)).toEqual(['p-local']);
    expect((await listVolsEnAttente()).map((v) => v.id)).toEqual(['v-local']);
    expect(
      sqlite.prepare("SELECT id FROM site_aerien_deplacement WHERE statut_sync = 'local'").all()
    ).toEqual([{ id: 'd-local' }]);
  });

  it('un second démarrage ne rejoue rien', async () => {
    fabriquerAncienneBase(sqlite);
    await getDb();
    sqlite.exec("UPDATE traitement SET kit_botte = 9 WHERE id = 't-local'");

    resetDbForTests();
    await getDb();

    expect(sqlite.prepare("SELECT kit_botte FROM traitement WHERE id = 't-local'").get()).toEqual({
      kit_botte: 9,
    });
  });

  it('une installation neuve reçoit le schéma complet', async () => {
    await getDb();

    expect(version()).toBeGreaterThanOrEqual(1);
    expect(colonnes('prospection')).toContain('statut_sync');
    expect(colonnes('vol_lien')).toContain('ref_id');
    expect(colonnes('mouvement_pesticide_local')).toContain('site_id');
  });
});
