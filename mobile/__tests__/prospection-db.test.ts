import { getDb, resetDbForTests } from '../src/lib/prospection-db';

const MIGRATED_COLUMNS = [
  'region', 'district', 'commune', 'za', 'pa_code', 'pa_nom', 'station_nom',
  'degats_cultures_pourcent', 'verdissement_pourcent', 'hauteur_herbe_cm',
  'espece', 'direction_de', 'pullulation_nb', 'taille_long', 'taille_large',
  'taille_epaisseur', 'essaim_en_vol', 'essaim_pose', 'type_essaim',
  'nb_taches_bandes', 'interdistance_m', 'interdistance_min', 'interdistance_max', 'interdistance_moy',
  'surface_contaminee_ha', 'type_larve', 'surf_infestee_pourcent',
  'stade_dominant', 'taille_groupe_m2', 'front_longueur_m', 'front_largeur_m',
  'densite_max_front', 'densite_moy_arriere_front', 'heure_observation', 'densite_en_vol',
  'station_libre', 'type_station', 'verdure_strate',
  'signalement_source', 'signalement_date', 'signalement_description', 'conclusion_validation',
  'phase', 'captures_nombre', 'temps_capture',
  'captures_sol', 'captures_trans', 'captures_greg', 'stade_imago', 'essaim_observe',
  'densites_larve', 'tache_larvaire', 'bande_larvaire', 'interdistance', 'deplacement',
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

describe('prospection-db', () => {
  it('opens the local database by name', async () => {
    await getDb();

    expect(openDatabaseAsync).toHaveBeenCalledWith('ifvm.db');
  });

  it('creates the prospection, prospection_capture and prospection_population tables', async () => {
    await getDb();

    expect(execAsync).toHaveBeenCalledTimes(1);
    const sql = execAsync.mock.calls[0][0] as string;
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS prospection ');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS prospection_capture');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS prospection_population');
    expect(sql).toContain("REFERENCES prospection(id) ON DELETE CASCADE");
  });

  it('memoizes the database across calls', async () => {
    const first = await getDb();
    const second = await getDb();

    expect(first).toBe(second);
    expect(openDatabaseAsync).toHaveBeenCalledTimes(1);
  });
});
