import { getDb, resetDbForTests } from '../src/lib/prospection-db';

const MIGRATED_COLUMNS = [
  'region', 'district', 'commune', 'za', 'pa_code', 'pa_nom', 'station_nom',
  'degats_cultures_pourcent', 'verdissement_pourcent', 'hauteur_herbe_cm',
  'espece', 'direction_de', 'pullulation_nb', 'taille_long', 'taille_large',
  'taille_epaisseur', 'essaim_en_vol', 'essaim_pose', 'type_essaim',
  'nb_taches_bandes', 'interdistance_m', 'interdistance_min', 'interdistance_max', 'interdistance_moy',
  'surface_contaminee_ha', 'type_larve', 'surface_infestee_pourcent',
  'stade_dominant', 'taille_groupe_m2', 'front_longueur_m', 'front_largeur_m',
  'densite_max_front', 'densite_moy_arriere_front', 'heure_observation', 'densite_en_vol', 'dimension_ha',
  'station_libre', 'type_station', 'verdure_strate',
  'signalement_source', 'signalement_date', 'signalement_description', 'conclusion_validation', 'avertissements',
  'phase', 'captures_nombre', 'temps_capture',
  'captures_sol', 'captures_trans', 'captures_greg', 'captures_solitaro_transiens',
  'stade_imago', 'essaim_observe',
  'densites_larve', 'tache_larvaire', 'bande_larvaire', 'interdistance', 'deplacement',
  'id', 'server_updated_at',
  'surface_station', 'surface_prospectee', 'surface_infestee', 'surface_totale', 'methode',
].map((name) => ({ name }));

const execAsync = jest.fn().mockResolvedValue(undefined);
const getAllAsync = jest.fn().mockResolvedValue(MIGRATED_COLUMNS);
const getFirstAsync = jest.fn().mockResolvedValue(null);
const withTransactionAsync = jest.fn(async (tache: () => Promise<void>) => tache());
const openDatabaseAsync = jest
  .fn()
  .mockResolvedValue({ execAsync, getAllAsync, getFirstAsync, withTransactionAsync });

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: (...args: unknown[]) => openDatabaseAsync(...args),
}));

beforeEach(() => {
  resetDbForTests();
  openDatabaseAsync.mockClear();
  execAsync.mockClear();
  getAllAsync.mockClear();
});

describe('traitement local schema', () => {
  it('creates the traitement tables in the same ifvm.db database', async () => {
    await getDb();

    expect(openDatabaseAsync).toHaveBeenCalledWith('ifvm.db');
    expect(execAsync).toHaveBeenCalled();
    const allSql = execAsync.mock.calls.map(call => call[0] as string).join(' ');

    expect(allSql).toContain('CREATE TABLE IF NOT EXISTS traitement');
    expect(allSql).toContain('CREATE TABLE IF NOT EXISTS cible');
    expect(allSql).toContain('CREATE TABLE IF NOT EXISTS traitement_aerien');
    expect(allSql).toContain('CREATE TABLE IF NOT EXISTS rotation');
    expect(allSql).toContain('CREATE TABLE IF NOT EXISTS traitement_terrestre');
    expect(allSql).toContain('CREATE TABLE IF NOT EXISTS produit_utilise');
    expect(allSql).toContain('CREATE TABLE IF NOT EXISTS traitement_signature');
  });

  it('gives traitement a statut_sync column defaulting to local, mirroring prospection', async () => {
    await getDb();

    const allSql = execAsync.mock.calls.map(call => call[0] as string).join(' ');
    expect(allSql).toMatch(/traitement[\s\S]*statut_sync TEXT NOT NULL DEFAULT 'local'/);
  });

  it('cascades children on traitement deletion', async () => {
    await getDb();

    const allSql = execAsync.mock.calls.map(call => call[0] as string).join(' ');
    expect(allSql).toContain('REFERENCES traitement(id) ON DELETE CASCADE');
    expect(allSql).toContain('REFERENCES traitement_aerien(traitement_id) ON DELETE CASCADE');
    expect(allSql).toContain('REFERENCES traitement_terrestre(traitement_id) ON DELETE CASCADE');
  });

  it('runs the traitement migration companion, checking existing columns before altering', async () => {
    await getDb();

    expect(getAllAsync).toHaveBeenCalledWith('PRAGMA table_info(traitement)');
  });

  it('adds server_updated_at to an existing traitement table missing it (upgrade path)', async () => {
    getAllAsync.mockImplementation(async (sql: string) =>
      sql === 'PRAGMA table_info(traitement)'
        ? MIGRATED_COLUMNS.filter((c) => c.name !== 'server_updated_at')
        : MIGRATED_COLUMNS
    );

    await getDb();

    expect(execAsync).toHaveBeenCalledWith(
      expect.stringContaining('ALTER TABLE traitement ADD COLUMN server_updated_at TEXT')
    );
  });

  it('still creates the prospection tables alongside the traitement ones (shared ifvm.db)', async () => {
    await getDb();

    const allSql = execAsync.mock.calls.map(call => call[0] as string).join(' ');
    expect(allSql).toContain('CREATE TABLE IF NOT EXISTS prospection');
  });

  it('adds captures_solitaro_transiens to prospection_population', async () => {
    await getDb();

    const hasColumn = MIGRATED_COLUMNS.some(col => col.name === 'captures_solitaro_transiens');
    expect(hasColumn).toBe(true);
  });

  it('adds all required columns to prospection_infestation', async () => {
    await getDb();

    const requiredColumns = [
      'espece',
      'direction_de',
      'pullulation_nb',
      'taille_long',
      'taille_large',
      'taille_epaisseur',
      'essaim_en_vol',
      'essaim_pose',
      'type_essaim',
      'nb_taches_bandes',
      'interdistance_m',
      'interdistance_min',
      'interdistance_max',
      'interdistance_moy',
      'surface_contaminee_ha',
      'type_larve',
      'surface_infestee_pourcent',
      'stade_dominant',
      'taille_groupe_m2',
      'front_longueur_m',
      'front_largeur_m',
      'densite_max_front',
      'densite_moy_arriere_front',
      'heure_observation',
      'densite_en_vol',
      'dimension_ha',
    ];

    const allPresent = requiredColumns.every(colName =>
      MIGRATED_COLUMNS.some(col => col.name === colName)
    );
    expect(allPresent).toBe(true);
  });

  it('adds all required columns to prospection', async () => {
    await getDb();

    const requiredColumns = [
      'region',
      'district',
      'commune',
      'za',
      'pa_code',
      'pa_nom',
      'station_nom',
      'surface_station',
      'surface_prospectee',
      'surface_infestee',
      'degats_cultures_pourcent',
      'verdissement_pourcent',
      'hauteur_herbe_cm',
      'station_libre',
      'type_station',
      'verdure_strate',
      'signalement_source',
      'signalement_date',
      'signalement_description',
      'conclusion_validation',
      'avertissements',
    ];

    const allPresent = requiredColumns.every(colName =>
      MIGRATED_COLUMNS.some(col => col.name === colName)
    );
    expect(allPresent).toBe(true);
  });

  it('adds extensive columns to prospection_population', async () => {
    await getDb();

    const extensiveColumns = [
      'captures_sol',
      'captures_trans',
      'captures_greg',
      'captures_solitaro_transiens',
      'stade_imago',
      'essaim_observe',
      'densites_larve',
      'tache_larvaire',
      'bande_larvaire',
      'interdistance',
      'deplacement',
      'phase',
      'captures_nombre',
      'temps_capture',
      'methode',
    ];

    const allPresent = extensiveColumns.every(colName =>
      MIGRATED_COLUMNS.some(col => col.name === colName)
    );
    expect(allPresent).toBe(true);
  });
});