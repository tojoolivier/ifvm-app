import { DatabaseSync } from 'node:sqlite';

import { resetDbForTests } from '../src/lib/prospection-db';
import { getReferentielDb, resetReferentielDbForTests } from '../src/lib/referentiel-db';
import { REFERENTIEL_SCHEMA_VERSION } from '../src/lib/referentiel-schema.generated';
import { pullReferentiel } from '../src/lib/referentiel-sync';

/** SQLite réel (Node) derrière l'API async d'expo-sqlite : ce test vérifie du SQL, pas des mocks. */
let sqlite: DatabaseSync;
let profondeurTransaction = 0;

function ouvrirBaseEnMemoire() {
  sqlite = new DatabaseSync(':memory:');
  return {
    execAsync: async (sql: string) => void sqlite.exec(sql),
    runAsync: async (sql: string, params: unknown[] = []) =>
      void sqlite.prepare(sql).run(...(params as never[])),
    getAllAsync: async (sql: string, params: unknown[] = []) =>
      sqlite.prepare(sql).all(...(params as never[])),
    getFirstAsync: async (sql: string, params: unknown[] = []) =>
      sqlite.prepare(sql).get(...(params as never[])) ?? null,
    withTransactionAsync: async (tache: () => Promise<void>) => {
      profondeurTransaction += 1;
      sqlite.exec('BEGIN');
      try {
        await tache();
        sqlite.exec('COMMIT');
      } catch (erreur) {
        sqlite.exec('ROLLBACK');
        throw erreur;
      } finally {
        profondeurTransaction -= 1;
      }
    },
  };
}

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: () => Promise.resolve(mockBase),
}));
let mockBase: ReturnType<typeof ouvrirBaseEnMemoire>;

const mockPullReferentiel = jest.fn();
jest.mock('../src/lib/api-client', () => ({
  apiClient: { pullReferentiel: (...args: unknown[]) => mockPullReferentiel(...args) },
}));

function reouvrir() {
  resetDbForTests();
  resetReferentielDbForTests();
}

const compter = (table: string) =>
  (sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;

beforeEach(() => {
  profondeurTransaction = 0;
  mockBase = ouvrirBaseEnMemoire();
  reouvrir();
});

describe('reconstruction du référentiel par version de schéma (#675)', () => {
  it('crée le cache et enregistre la version au premier démarrage', async () => {
    await getReferentielDb();

    expect(compter('aeronef')).toBe(0);
    expect(sqlite.prepare('SELECT version FROM referentiel_schema_version').get()).toEqual({
      version: REFERENTIEL_SCHEMA_VERSION,
    });
  });

  it('même version : le cache et les curseurs sont conservés', async () => {
    await getReferentielDb();
    sqlite.exec(
      "INSERT INTO culture (id, code, nom, actif, updated_at) VALUES ('c1','MAIS','Maïs',1,'2026-01-01')"
    );
    sqlite.exec("INSERT INTO referentiel_sync_meta VALUES ('cultures', '2026-01-01T00:00:00Z')");

    reouvrir();
    await getReferentielDb();

    expect(compter('culture')).toBe(1);
    expect(compter('referentiel_sync_meta')).toBe(1);
  });

  it('version différente : vide le cache, remet les curseurs à zéro, garde les captures non envoyées', async () => {
    await getReferentielDb();
    sqlite.exec(`
      INSERT INTO culture (id, code, nom, actif, updated_at) VALUES ('c1','MAIS','Maïs',1,'2026-01-01');
      INSERT INTO referentiel_sync_meta VALUES ('cultures', '2026-01-01T00:00:00Z');
      INSERT INTO site_aerien_deplacement (id, site_id, numero, localite, latitude, longitude, cree_le)
        VALUES ('d1','s1','12','Tuléar',-23.3,43.6,'2026-01-02');
      INSERT INTO vol (id, categorie, origine, equipe_id, aeronef_id, date_vol, heure_debut, heure_fin, cree_le)
        VALUES ('v1','convoyage','saisie_directe','e1','a1','2026-01-02','08:00','09:00','2026-01-02');
      INSERT INTO mouvement_pesticide_local (id, type, pesticide_id, site_id, quantite, unite, date_mouvement, cree_le)
        VALUES ('m1','approvisionnement','p1','s1',10,'L','2026-01-02','2026-01-02');
      UPDATE referentiel_schema_version SET version = 'ancienne';
    `);

    reouvrir();
    await getReferentielDb();

    expect(compter('culture')).toBe(0);
    expect(compter('referentiel_sync_meta')).toBe(0);
    expect(compter('site_aerien_deplacement')).toBe(1);
    expect(compter('vol')).toBe(1);
    expect(compter('mouvement_pesticide_local')).toBe(1);
    expect(sqlite.prepare('SELECT version FROM referentiel_schema_version').get()).toEqual({
      version: REFERENTIEL_SCHEMA_VERSION,
    });
  });

  it('remet un ancien schéma manuel au niveau généré, sans perdre un site créé hors-ligne', async () => {
    // Appareil d'avant #675 : pas de table de version, colonnes d'une autre époque.
    sqlite.exec(`
      CREATE TABLE code_stade (id TEXT PRIMARY KEY NOT NULL, code TEXT NOT NULL, espece TEXT NOT NULL);
      CREATE TABLE site_aerien (
        id TEXT PRIMARY KEY NOT NULL, numero TEXT NOT NULL, localite TEXT NOT NULL,
        actif INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL,
        statut_sync TEXT NOT NULL DEFAULT 'synced', colonne_disparue TEXT
      );
      INSERT INTO site_aerien (id, numero, localite, updated_at, statut_sync, colonne_disparue)
        VALUES ('s-sync','1','Ancien','2025-01-01','synced','x'),
               ('s-local','2','Créé hors-ligne','2026-01-01','local','y');
    `);

    await getReferentielDb();

    const sites = sqlite.prepare('SELECT id, numero, statut_sync FROM site_aerien').all();
    expect(sites).toEqual([{ id: 's-local', numero: '2', statut_sync: 'local' }]);
    const colonnes = (sqlite.prepare('PRAGMA table_info(code_stade)').all() as { name: string }[]).map(
      (c) => c.name
    );
    expect(colonnes).toContain('categorie');
  });

  it("annule tout si la reconstruction échoue : le cache d'origine reste intact", async () => {
    await getReferentielDb();
    sqlite.exec(`
      INSERT INTO culture (id, code, nom, actif, updated_at) VALUES ('c1','MAIS','Maïs',1,'2026-01-01');
      UPDATE referentiel_schema_version SET version = 'ancienne';
      CREATE TRIGGER casse BEFORE INSERT ON referentiel_schema_version BEGIN SELECT RAISE(ABORT, 'boum'); END;
      DELETE FROM referentiel_schema_version;
    `);

    reouvrir();
    await expect(getReferentielDb()).rejects.toThrow('a échoué sur la base locale');

    expect(compter('culture')).toBe(1);
    expect(profondeurTransaction).toBe(0);
  });

  it('une suppression (deleted_at) est propagée par un pull complet après reconstruction', async () => {
    await getReferentielDb();
    sqlite.exec(`
      INSERT INTO culture (id, code, nom, actif, updated_at) VALUES ('c1','MAIS','Maïs',1,'2026-01-01');
      UPDATE referentiel_schema_version SET version = 'ancienne';
    `);
    reouvrir();

    const vide = { upserts: [], server_time: '2026-02-01T00:00:00Z' };
    mockPullReferentiel.mockResolvedValue({
      postes_acridiens: vide, stations_fixes: vide, utilisateurs_equipe: vide, pesticides: vide,
      codes_stades: vide, campagnes: vide, lieux_aeriens: vide, equipes: vide, equipe_membres: vide,
      sites_aeriens: vide, aeronefs: vide, equipe_aeronefs: vide,
      cultures: {
        server_time: '2026-02-01T00:00:00Z',
        upserts: [
          { id: 'c1', code: 'MAIS', nom: 'Maïs', actif: true, updated_at: '2026-02-01', deleted_at: '2026-02-01' },
          { id: 'c2', code: 'RIZ', nom: 'Riz', actif: true, updated_at: '2026-02-01', deleted_at: null },
        ],
      },
    });

    await pullReferentiel('token');

    // Curseurs remis à zéro par la reconstruction : le pull demande tout depuis le début.
    expect(mockPullReferentiel.mock.calls[0][1].cultures).toBeNull();
    expect(sqlite.prepare('SELECT id FROM culture').all()).toEqual([{ id: 'c2' }]);
  });
});
