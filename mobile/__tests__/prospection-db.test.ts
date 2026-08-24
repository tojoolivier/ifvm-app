import { getDb, resetDbForTests } from '../src/lib/prospection-db';
import { LocalWriteError } from '../src/lib/errors';
import {
  lignesEnAttente,
  resetLoggerForTests,
} from '../src/lib/logger';

// Liste complète des colonnes migrées pour les tests
const MIGRATED_COLUMNS = [
  // Colonnes de prospection
  { name: 'region' },
  { name: 'district' },
  { name: 'commune' },
  { name: 'za' },
  { name: 'pa_code' },
  { name: 'pa_nom' },
  { name: 'station_nom' },
  { name: 'degats_cultures_pourcent' },
  { name: 'verdissement_pourcent' },
  { name: 'hauteur_herbe_cm' },
  { name: 'station_libre' },
  { name: 'type_station' },
  { name: 'verdure_strate' },
  { name: 'signalement_source' },
  { name: 'signalement_date' },
  { name: 'signalement_description' },
  { name: 'conclusion_validation' },
  { name: 'avertissements' },
  
  // Colonnes de prospection_infestation
  { name: 'espece' },
  { name: 'direction_de' },
  { name: 'pullulation_nb' },
  { name: 'taille_long' },
  { name: 'taille_large' },
  { name: 'taille_epaisseur' },
  { name: 'essaim_en_vol' },
  { name: 'essaim_pose' },
  { name: 'type_essaim' },
  { name: 'nb_taches_bandes' },
  { name: 'interdistance_m' },
  { name: 'interdistance_min' },
  { name: 'interdistance_max' },
  { name: 'interdistance_moy' },
  { name: 'surface_contaminee_ha' },
  { name: 'type_larve' },
  { name: 'surface_infestee_pourcent' },
  { name: 'stade_dominant' },
  { name: 'taille_groupe_m2' },
  { name: 'front_longueur_m' },
  { name: 'front_largeur_m' },
  { name: 'densite_max_front' },
  { name: 'densite_moy_arriere_front' },
  { name: 'heure_observation' },
  { name: 'densite_en_vol' },
  { name: 'dimension_ha' },
  
  // Colonnes de prospection_population (mises à jour)
  { name: 'phase' },
  { name: 'captures_nombre' },
  { name: 'temps_capture' },
  { name: 'methode' },
  { name: 'captures_sol' },
  { name: 'captures_trans' },
  { name: 'captures_greg' },
  { name: 'captures_solitaro_transiens' }, // NOUVEAU
  { name: 'stade_imago' },
  { name: 'essaim_observe' },
  { name: 'densites_larve' },
  { name: 'tache_larvaire' },
  { name: 'bande_larvaire' },
  { name: 'interdistance' },
  { name: 'deplacement' },
  
  // Autres colonnes
  { name: 'server_updated_at' },
  { name: 'surface_station' },
  { name: 'surface_prospectee' },
  { name: 'surface_infestee' },
  { name: 'surface_totale' },
];

const execAsync = jest.fn().mockResolvedValue(undefined);
const getAllAsync = jest.fn().mockResolvedValue(MIGRATED_COLUMNS);
const openDatabaseAsync = jest.fn().mockResolvedValue({ execAsync, getAllAsync });

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: (...args: unknown[]) => openDatabaseAsync(...args),
}));

beforeEach(() => {
  resetDbForTests();
  resetLoggerForTests();
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

  // Nouveau test pour vérifier la migration des colonnes de prospection_population
  it('adds captures_solitaro_transiens column to prospection_population', async () => {
    await getDb();

    // Vérifier que getAllAsync a été appelé pour vérifier les colonnes
    // Les appels à getAllAsync sont pour PRAGMA table_info des différentes tables
    expect(getAllAsync).toHaveBeenCalled();
    
    // Vérifier que la colonne existe dans la liste des colonnes migrées
    const hasColumn = MIGRATED_COLUMNS.some(col => col.name === 'captures_solitaro_transiens');
    expect(hasColumn).toBe(true);
  });

  // Nouveau test pour vérifier la migration des colonnes de prospection_infestation
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

  // Nouveau test pour vérifier la migration des colonnes de prospection
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

  // Nouveau test pour s'assurer que les colonnes extensives sont présentes
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

/*
 * Ces tests protègent la décision 2 d'ADR-012 (issue #173) sur l'endroit du
 * mobile où un silence coûte le plus cher : une migration ratée laisse une
 * colonne absente, et c'est cette dérive-là qui a produit l'écran blanc.
 */
describe('prospection-db — typage à la source (#173)', () => {
  it('lève LocalWriteError quand la base ne peut pas être ouverte', async () => {
    openDatabaseAsync.mockRejectedValueOnce(new Error('disk I/O error'));

    await expect(getDb()).rejects.toBeInstanceOf(LocalWriteError);
  });

  it('lève LocalWriteError quand la création des tables échoue', async () => {
    execAsync.mockRejectedValueOnce(new Error('database is locked'));

    await expect(getDb()).rejects.toBeInstanceOf(LocalWriteError);
  });

  it('lève LocalWriteError au lieu d’avaler un ALTER TABLE refusé', async () => {
    // La colonne manque, donc l'ALTER part — et il échoue.
    getAllAsync.mockResolvedValue([]);
    execAsync
      .mockResolvedValueOnce(undefined) // CREATE TABLE
      .mockRejectedValueOnce(new Error('cannot add column'));

    await expect(getDb()).rejects.toBeInstanceOf(LocalWriteError);
  });

  it('journalise l’ouverture et les colonnes ajoutées, pas en console', async () => {
    getAllAsync.mockResolvedValue([]);

    await getDb();

    const evenements = lignesEnAttente().map((ligne) => ligne.event);
    expect(evenements).toContain('db.migration.colonne-ajoutee');
    expect(evenements).toContain('db.ouverte');
  });
});