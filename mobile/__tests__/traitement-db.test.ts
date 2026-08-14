import { getDb, resetDbForTests } from '../src/lib/prospection-db';

const MIGRATED_COLUMNS = [
  'region', 'district', 'commune', 'za', 'pa_code', 'pa_nom', 'station_nom',
  'degats_cultures_pourcent', 'verdissement_pourcent', 'hauteur_herbe_cm',
  'espece', 'direction_de', 'pullulation_nb', 'taille_long', 'taille_large',
  'taille_epaisseur', 'essaim_en_vol', 'essaim_pose', 'type_essaim',
  'nb_taches_bandes', 'interdistance_m', 'interdistance_min', 'interdistance_max', 'interdistance_moy',
  'surface_contaminee_ha', 'type_larve', 'surf_infestee_pourcent',
  'stade_dominant', 'taille_groupe_m2', 'front_longueur_m', 'front_largeur_m',
  'densite_max_front', 'densite_moy_arriere_front', 'heure_observation',
  'station_libre', 'type_station', 'verdure_strate',
  'signalement_source', 'signalement_date', 'signalement_description', 'conclusion_validation',
  'phase', 'captures_nombre', 'temps_capture',
  'captures_sol', 'captures_trans', 'captures_greg', 'stade_imago', 'essaim_observe',
  'densites_larve', 'tache_larvaire', 'bande_larvaire', 'interdistance', 'deplacement',
  'id',
].map((name) => ({ name }));

const execAsync = jest.fn().mockResolvedValue(undefined);
const getAllAsync = jest.fn().mockResolvedValue(MIGRATED_COLUMNS);
const openDatabaseAsync = jest.fn().mockResolvedValue({ execAsync, getAllAsync });

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
    expect(execAsync).toHaveBeenCalledTimes(1);
    const sql = execAsync.mock.calls[0][0] as string;

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS traitement ');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS cible ');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS traitement_aerien ');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS rotation ');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS traitement_terrestre ');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS produit_utilise ');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS traitement_signature ');
  });

  it('gives traitement a statut_sync column defaulting to local, mirroring prospection', async () => {
    await getDb();

    const sql = execAsync.mock.calls[0][0] as string;
    expect(sql).toMatch(/traitement[\s\S]*statut_sync TEXT NOT NULL DEFAULT 'local'/);
  });

  it('cascades children on traitement deletion', async () => {
    await getDb();

    const sql = execAsync.mock.calls[0][0] as string;
    expect(sql).toContain('REFERENCES traitement(id) ON DELETE CASCADE');
    expect(sql).toContain('REFERENCES traitement_aerien(traitement_id) ON DELETE CASCADE');
    expect(sql).toContain('REFERENCES traitement_terrestre(traitement_id) ON DELETE CASCADE');
  });

  it('runs the traitement migration companion, checking existing columns before altering', async () => {
    await getDb();

    expect(getAllAsync).toHaveBeenCalledWith('PRAGMA table_info(traitement)');
  });

  it('still creates the prospection tables alongside the traitement ones (shared ifvm.db)', async () => {
    await getDb();

    const sql = execAsync.mock.calls[0][0] as string;
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS prospection ');
  });
});
