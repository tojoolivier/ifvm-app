import { getDb, resetDbForTests } from '../src/lib/prospection-db';
import {
  AppError,
  LocalReadError,
  LocalWriteError,
} from '../src/lib/errors';
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
  { name: 'heure_observation_at' },
  { name: 'mode_extensif' },
  { name: 'societe' },
  { name: 'immatricule_aeronef' },
  { name: 'pilote' },
  { name: 'mecanicien' },
  { name: 'chef_de_base' },
  { name: 'base' },
  { name: 'base_secondaire' },
  { name: 'lieu_base_id' },
  { name: 'pesticides_embarques' },
  { name: 'pesticide_nom_commercial' },
  { name: 'pesticide_quantite_disponible' },
  { name: 'pesticide_quantite_recue' },
  { name: 'futs_disponible' },
  { name: 'futs_pleins' },
  { name: 'futs_vides' },
  { name: 'futs_recues' },
  { name: 'signature_visa_nom' },
  { name: 'signature_visa_horodatage' },
  { name: 'signature_consultant_fao_nom' },
  { name: 'signature_consultant_fao_horodatage' },
  { name: 'signature_consultant_fao_image' },
  { name: 'signature_pilote_nom' },
  { name: 'signature_pilote_horodatage' },
  { name: 'signature_pilote_image' },
  { name: 'signature_chef_base_nom' },
  { name: 'signature_chef_base_horodatage' },
  { name: 'signature_chef_base_image' },

  // Colonnes de prospection_operation_aerienne
  { name: 'motif_divers' },

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
  { name: 'stades_imago' }, // NOUVEAU (#stades-imago-persistance)
  { name: 'essaim_observe' },
  { name: 'densites_larve' },
  { name: 'tache_larvaire' },
  { name: 'bande_larvaire' },
  { name: 'interdistance' },
  { name: 'deplacement' },
  { name: 'surface_contaminee_ha' },
  { name: 'type_cible' },
  { name: 'direction_de' },
  { name: 'direction_vers' },
  { name: 'etat' },
  { name: 'essaim_en_vol' },
  { name: 'essaim_pose' },

  // Autres colonnes
  { name: 'server_updated_at' },
  { name: 'surface_station' },
  { name: 'surface_prospectee' },
  { name: 'surface_infestee' },
  { name: 'surface_totale' },

  // Colonnes de rotation et produit_utilise (nom_commercial partagée entre les deux)
  { name: 'heure_debut' },
  { name: 'heure_fin' },
  { name: 'nom_commercial' },
  // Migration backend 0046 (quantite_l -> quantite + unite, surface_ha, heures de vanne)
  { name: 'unite' },
  { name: 'surface_ha' },
  { name: 'heure_ouverture_vanne' },
  { name: 'heure_fermeture_vanne' },

  // Colonnes de traitement_aerien
  { name: 'immatricule_aeronef' },
  { name: 'surface_traitee_ha' },
  { name: 'surface_restante_ha' },
  // Migration backend 0047 (quantite_l -> quantite + unite, surface_ha, vanne)
  { name: 'total_pesticide_kg' },
  // pilote/mecanicien/consultant_international (texte libre) -> FK utilisateur
  // (migration backend 0047), puis retour au texte libre (migration backend 0048,
  // cf. prospection-db.ts COLONNES_TRAITEMENT_AERIEN) — les 3 colonnes FK restent
  // déclarées (mortes) pour les installations qui les ont déjà.
  { name: 'pilote_id' },
  { name: 'mecanicien_id' },
  { name: 'consultant_id' },
  { name: 'pilote' },
  { name: 'mecanicien' },
  { name: 'consultant_international' },
  // Base principale/stand/base secondaire (référentiel lieu_aerien) — écran « Équipe »
  // (#equipe-slide-aerien).
  { name: 'lieu_base_principale_id' },
  { name: 'lieu_stand_id' },
  { name: 'lieu_base_secondaire_id' },
  // Chaînage de reprise (migration backend 0050), généralisé depuis le Terrestre.
  { name: 'reprise_traitement' },
  { name: 'traitement_origine_id' },
  { name: 'surface_cumulee_ha' },

  // Colonnes de traitement_aerien et traitement_terrestre (partagées)
  { name: 'pesticide_recu_l' },
  { name: 'pesticide_stock_restant_l' },

  // Colonne de traitement_signature — signature numérique (#signatures-auto-equipe,
  // migration backend 0049).
  { name: 'signature_image' },
];

const execAsync = jest.fn().mockResolvedValue(undefined);
const getAllAsync = jest.fn().mockResolvedValue(MIGRATED_COLUMNS);
const runAsync = jest.fn().mockResolvedValue(undefined);

/**
 * Méthode hors du tableau de typage, qui **rend son propre `this`**.
 *
 * `expo-sqlite` en a de vraies : `closeAsync()` fait
 * `unregisterDatabaseForDevToolsAsync(this)`, et un `this` valant l'enveloppe
 * ne correspondrait à aucune entrée du registre.
 */
function renvoieSonThis(this: unknown): unknown {
  return this;
}

const baseNue = {
  execAsync,
  getAllAsync,
  runAsync,
  closeAsync: renvoieSonThis,
};

const openDatabaseAsync = jest.fn().mockResolvedValue(baseNue);

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: (...args: unknown[]) => openDatabaseAsync(...args),
}));

beforeEach(() => {
  resetDbForTests();
  resetLoggerForTests();
  openDatabaseAsync.mockClear();
  execAsync.mockClear();
  getAllAsync.mockClear();
  runAsync.mockClear();
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
      'heure_observation_at',
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
      'stades_imago',
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

  /*
   * Les dépôts (`*-repository.ts`) font une centaine d'appels SQLite sans un
   * `try` : typer chacun d'eux à la main, c'était cent occasions d'en oublier
   * un. Le handle rendu par `getDb()` type donc les échecs lui-même — une
   * lecture ratée est `LocalReadError`, une écriture ratée `LocalWriteError`,
   * partout, sans que le dépôt ait à y penser (ADR-012 décision 2, #173).
   */
  it('type les lectures ratées du handle en LocalReadError', async () => {
    const db = await getDb();
    getAllAsync.mockRejectedValueOnce(new Error('disk I/O error'));

    await expect(db.getAllAsync('SELECT 1')).rejects.toBeInstanceOf(
      LocalReadError
    );
  });

  it('type les écritures ratées du handle en LocalWriteError', async () => {
    const db = await getDb();
    runAsync.mockRejectedValueOnce(new Error('database is locked'));

    await expect(db.runAsync('UPDATE prospection SET x = 1')).rejects.toBeInstanceOf(
      LocalWriteError
    );
  });

  it('laisse passer intacte une erreur déjà typée, sans la réenvelopper', async () => {
    const db = await getDb();
    const deja = new LocalReadError('déjà typée');
    runAsync.mockRejectedValueOnce(deja);

    // Sans ce garde, une `PreconditionError` levée dans un
    // `withTransactionAsync` ressortirait en `LocalWriteError` et l'agent
    // lirait « impossible d'enregistrer » au lieu du message écrit pour lui.
    await expect(db.runAsync('UPDATE prospection SET x = 1')).rejects.toBe(deja);
  });

  it('rend les résultats inchangés quand tout va bien', async () => {
    const db = await getDb();
    getAllAsync.mockResolvedValueOnce([{ id: 'p1' }]);

    await expect(db.getAllAsync('SELECT 1')).resolves.toEqual([{ id: 'p1' }]);
  });

  /*
   * Ce test existe parce que la correction qu'il protège serait restée
   * invisible autrement : le registre devtools d'`expo-sqlite` est gardé par
   * `__DEV__`, et toutes les suites mockent `expo-sqlite` par des objets nus.
   * C'est le motif que ce dépôt collectionne — du code d'apparence correcte
   * que rien n'exerce.
   */
  it('garde la vraie base comme `this`, même pour une méthode non typée', async () => {
    const db = await getDb();

    expect((db as unknown as { closeAsync: () => unknown }).closeAsync()).toBe(baseNue);
  });

  it('journalise l’ouverture et les colonnes ajoutées, pas en console', async () => {
    getAllAsync.mockResolvedValue([]);

    await getDb();

    const evenements = lignesEnAttente().map((ligne) => ligne.event);
    expect(evenements).toContain('db.migration.colonnes-ajoutees');
    expect(evenements).toContain('db.ouverte');
  });
});

/*
 * `kit_boite` -> `kit_botte` (renommage métier, #kit-botte) : une installation
 * déjà en place a la colonne sous l'ancien nom, remplie. Un simple ajout de
 * colonne (comme `ajouterColonnesManquantes`) créerait `kit_botte` vide à côté
 * au lieu de reprendre ces valeurs — d'où une fonction de renommage dédiée,
 * appelée avant l'ajout de colonnes sur `traitement`.
 */
describe('prospection-db — renommage de colonne (kit_boite -> kit_botte)', () => {
  it('renomme kit_boite en kit_botte quand l’ancienne colonne existe encore', async () => {
    getAllAsync
      .mockResolvedValueOnce(MIGRATED_COLUMNS) // prospection
      .mockResolvedValueOnce(MIGRATED_COLUMNS) // prospection_infestation
      .mockResolvedValueOnce(MIGRATED_COLUMNS) // prospection_population
      .mockResolvedValueOnce(MIGRATED_COLUMNS) // prospection_operation_aerienne
      .mockResolvedValueOnce([{ name: 'kit_boite' }]); // traitement (avant renommage)

    await getDb();

    const renommage = execAsync.mock.calls.find(([sql]) =>
      (sql as string).includes('RENAME COLUMN')
    );
    expect(renommage?.[0]).toContain(
      'ALTER TABLE traitement RENAME COLUMN kit_boite TO kit_botte'
    );
  });

  it('ne fait rien si kit_boite est déjà absente (installation neuve ou déjà migrée)', async () => {
    // MIGRATED_COLUMNS (défaut) ne contient ni kit_boite ni kit_botte.
    await getDb();

    const renommage = execAsync.mock.calls.find(([sql]) =>
      (sql as string).includes('RENAME COLUMN')
    );
    expect(renommage).toBeUndefined();
  });

  it('ne fait rien si kit_botte existe déjà (migration déjà jouée)', async () => {
    getAllAsync
      .mockResolvedValueOnce(MIGRATED_COLUMNS)
      .mockResolvedValueOnce(MIGRATED_COLUMNS)
      .mockResolvedValueOnce(MIGRATED_COLUMNS)
      .mockResolvedValueOnce(MIGRATED_COLUMNS)
      .mockResolvedValueOnce([{ name: 'kit_boite' }, { name: 'kit_botte' }]);

    await getDb();

    const renommage = execAsync.mock.calls.find(([sql]) =>
      (sql as string).includes('RENAME COLUMN')
    );
    expect(renommage).toBeUndefined();
  });

  it('lève LocalWriteError si le RENAME COLUMN échoue', async () => {
    getAllAsync
      .mockResolvedValueOnce(MIGRATED_COLUMNS)
      .mockResolvedValueOnce(MIGRATED_COLUMNS)
      .mockResolvedValueOnce(MIGRATED_COLUMNS)
      .mockResolvedValueOnce(MIGRATED_COLUMNS)
      .mockResolvedValueOnce([{ name: 'kit_boite' }]);
    execAsync
      .mockResolvedValueOnce(undefined) // CREATE TABLE
      .mockRejectedValueOnce(new Error('cannot rename column'));

    await expect(getDb()).rejects.toBeInstanceOf(LocalWriteError);
  });
});

/*
 * `quantite_l` -> `quantite` sur `rotation` (migration backend 0046) : même
 * raisonnement que kit_boite -> kit_botte ci-dessus — ne pas perdre les quantités
 * déjà saisies sous l'ancien nom sur une installation existante.
 */
describe('prospection-db — renommage de colonne (rotation.quantite_l -> quantite)', () => {
  it('renomme quantite_l en quantite quand l’ancienne colonne existe encore', async () => {
    getAllAsync
      .mockResolvedValueOnce(MIGRATED_COLUMNS) // prospection
      .mockResolvedValueOnce(MIGRATED_COLUMNS) // prospection_infestation
      .mockResolvedValueOnce(MIGRATED_COLUMNS) // prospection_population
      .mockResolvedValueOnce(MIGRATED_COLUMNS) // prospection_operation_aerienne
      .mockResolvedValueOnce(MIGRATED_COLUMNS) // traitement (renommage kit_boite)
      .mockResolvedValueOnce(MIGRATED_COLUMNS) // traitement (ajout de colonnes)
      .mockResolvedValueOnce([{ name: 'quantite_l' }]); // rotation (avant renommage)

    await getDb();

    const renommage = execAsync.mock.calls.find(([sql]) =>
      (sql as string).includes('RENAME COLUMN')
    );
    expect(renommage?.[0]).toContain(
      'ALTER TABLE rotation RENAME COLUMN quantite_l TO quantite'
    );
  });

  it('ne fait rien si quantite_l est déjà absente (installation neuve ou déjà migrée)', async () => {
    // MIGRATED_COLUMNS (défaut) ne contient ni quantite_l ni quantite.
    await getDb();

    const renommage = execAsync.mock.calls.find(([sql]) =>
      (sql as string).includes('RENAME COLUMN')
    );
    expect(renommage).toBeUndefined();
  });
});