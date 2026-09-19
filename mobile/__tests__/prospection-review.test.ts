jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn().mockResolvedValue({
    execAsync: jest.fn().mockResolvedValue(undefined),
    runAsync: jest.fn().mockResolvedValue({ changes: 0 }),
    getAllAsync: jest.fn().mockResolvedValue([]),
    getFirstAsync: jest.fn().mockResolvedValue(null),
  }),
}));

// Mock de prospection-db avec une station
jest.mock('../src/lib/prospection-db', () => ({
  getDb: jest.fn().mockResolvedValue({
    execAsync: jest.fn().mockResolvedValue(undefined),
    runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
    getAllAsync: jest.fn().mockResolvedValue([{ id: 'station-1' }]),
    getFirstAsync: jest.fn().mockResolvedValue({ id: 'station-1' }),
  }),
}));

// Mock de referentiel-sync
jest.mock('../src/lib/referentiel-sync', () => ({
  pullReferentiel: jest.fn().mockResolvedValue(undefined),
}));


import {
  CaptureRow,
  DraftProspection,
  PopulationRow,
  completeProspection,
  markProspectionEchec,
  markProspectionSynced,
  synchroniserStatutServeur,
  listAllProspectionCaptures,
  listAllProspectionPopulations,
  listAllProspectionInfestations,
  listOperationsAeriennes,
} from '../src/lib/prospection-repository';
import { apiClient } from '../src/lib/api-client';
import { NetworkError } from '../src/lib/errors';
import * as Network from 'expo-network';
import {
  buildRecapitulatif,
  chronoSeconds,
  enregistrerEtSynchroniser,
  syncOneProspection,
  syncAllProspections,
  formatChrono,
  infestationDetailHasData,
} from '../src/lib/prospection-review';

jest.mock('../src/lib/prospection-repository', () => ({
  completeProspection: jest.fn(),
  markProspectionSynced: jest.fn(),
  markProspectionEchec: jest.fn(),
  synchroniserStatutServeur: jest.fn(),
  listAllProspectionCaptures: jest.fn(),
  listAllProspectionPopulations: jest.fn(),
  listAllProspectionInfestations: jest.fn(),
  listOperationsAeriennes: jest.fn(),
  // Vraie implémentation (pas de mock utile ici) : `buildProspectionPayload`
  // en dépend pour normaliser `pesticides_embarques` (0/1/null en SQLite).
  normalizeBoolean: (value: unknown) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    return null;
  },
}));
jest.mock('../src/lib/api-client', () => ({
  apiClient: { createProspection: jest.fn() },
  // `sync-lot` lit le statut HTTP joint à l'erreur : la vraie implémentation,
  // trois lignes sans effet de bord, plutôt qu'un stub qui mentirait.
  statutHttpDe: (error: unknown) => {
    const statut = (error as { status?: number } | null)?.status;
    return typeof statut === 'number' ? statut : null;
  },
  versionServeurDe: (error: unknown) =>
    (error as { serverVersion?: unknown } | null)?.serverVersion ?? null,
}));
jest.mock('expo-network', () => ({ getNetworkStateAsync: jest.fn() }));

const mockCompleteProspection = jest.mocked(completeProspection);
const mockMarkSynced = jest.mocked(markProspectionSynced);
const mockMarkEchec = jest.mocked(markProspectionEchec);
const mockSynchroniserStatutServeur = jest.mocked(synchroniserStatutServeur);
const mockCreateProspection = jest.mocked(apiClient.createProspection);
const mockGetNetworkState = jest.mocked(Network.getNetworkStateAsync);
const mockListAllCaptures = jest.mocked(listAllProspectionCaptures);
const mockListAllPopulations = jest.mocked(listAllProspectionPopulations);
const mockListAllInfestations = jest.mocked(listAllProspectionInfestations);
const mockListOperationsAeriennes = jest.mocked(listOperationsAeriennes);

function draft(overrides: Partial<DraftProspection> = {}): DraftProspection {
  return {
    id: 'draft-1',
    type_prospection: 'intensive',
    campagne_id: 'camp-1',
    prospecteur_id: 'user-1',
    prospecteur_nom: null,
    validated_at: null,
    revalide_de_id: null,
    station_id: null,
    biotope: 'Mesophyle',
    region: null,
    district: null,
    commune: null,
    za: null,
    pa_code: null,
    pa_nom: null,
    station_nom: null,
    degats_cultures_pourcent: null,
    verdissement_pourcent: null,
    hauteur_herbe_cm: null,
    heure_observation_at: null,
    station_libre: null,
    type_station: null,
    mode_extensif: null,
    societe: null,
    immatricule_aeronef: null,
    pilote: null,
    mecanicien: null,
    chef_de_base: null,
    base: null,
    base_numero: null,
    base_date_installation: null,
    base_latitude: null,
    base_longitude: null,
    base_secondaire: null,
    base_secondaire_date_installation: null,
    base_secondaire_latitude: null,
    base_secondaire_longitude: null,
    pesticides_embarques: null,
    pesticide_nom_commercial: null,
    pesticide_quantite_disponible: null,
    pesticide_quantite_recue: null,
    futs_disponible: null,
    futs_pleins: null,
    futs_vides: null,
    futs_recues: null,
    signature_visa_nom: null,
    signature_visa_horodatage: null,
    signature_consultant_fao_nom: null,
    signature_consultant_fao_horodatage: null,
    signature_consultant_fao_image: null,
    signature_pilote_nom: null,
    signature_pilote_horodatage: null,
    signature_pilote_image: null,
    signature_chef_base_nom: null,
    signature_chef_base_horodatage: null,
    signature_chef_base_image: null,
    verdure_strate: null,
    signalement_source: null,
    signalement_date: null,
    signalement_description: null,
    conclusion_validation: null,
    n_fiche: 'FI-20260802-ABC123',
    n_message: null,
    especes: null,
    capture_started_at: null,
    grilles_completees: null,
    date_prospection: '2026-08-02',
    latitude: -18.8792,
    longitude: 47.5079,
    altitude: null,
    surface_station: 12,
    surface_prospectee: 8.5,
    surface_infestee: 1,
    degats_cultures: null,
    derniere_pluie: null,
    intensite_pluie: null,
    vegetation: null,
    sol: null,
    ennemis_naturels: null,
    observations: null,
    avertissements: null,
    statut: 'brouillon',
    statut_sync: 'local',
    created_at: '2026-08-02T00:00:00Z',
    updated_at: '2026-08-02T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  mockCompleteProspection.mockReset();
  mockMarkSynced.mockReset();
  mockCreateProspection.mockReset();
  mockGetNetworkState.mockReset();
  mockListAllCaptures.mockReset();
  mockListAllPopulations.mockReset().mockResolvedValue([]);
  mockListAllInfestations.mockReset().mockResolvedValue([]);
  mockListOperationsAeriennes.mockReset().mockResolvedValue([]);
});

describe('formatChrono / chronoSeconds', () => {
  it('formate mm:ss', () => {
    expect(formatChrono(90)).toBe('01:30');
    expect(formatChrono(0)).toBe('00:00');
  });

  it("renvoie 0 si le chrono n'a jamais démarré", () => {
    expect(chronoSeconds(null)).toBe(0);
  });

  it('plafonne à 30 minutes', () => {
    const startedAt = new Date(Date.now() - 3600 * 1000).toISOString();
    expect(chronoSeconds(startedAt)).toBe(1800);
  });
});

describe('buildRecapitulatif', () => {
  it('calcule les totaux et le phénotype dominant', () => {
    const rows: CaptureRow[] = [
      { espece: 'LMC', categorie: 'imago', sexe: 'F', phase: 'transiens', stade: 'A1', effectif: 5 },
      { espece: 'LMC', categorie: 'imago', sexe: 'M', phase: 'gregaire', stade: 'A1', effectif: 2 },
    ];
    const recap = buildRecapitulatif(draft(), rows, 'Strate herbeuse 70%', []);
    expect(recap.totalCaptures).toBe(7);
    expect(recap.totalFemelles).toBe(5);
    expect(recap.totalMales).toBe(2);
    expect(recap.phenotypeDominantLabel).toBe('Transiens');
    expect(recap.nFiche).toBe('FI-20260802-ABC123');
    expect(recap.vegetationSummary).toBe('Strate herbeuse 70%');
  });

  it("affiche '—' si aucune capture", () => {
    const recap = buildRecapitulatif(draft(), [], '', []);
    expect(recap.phenotypeDominantLabel).toBe('—');
    expect(recap.totalCaptures).toBe(0);
  });

  it('construit une carte par groupe actif (espèce+catégorie), avec total/max/dominant propres', () => {
    const d = draft({ especes: JSON.stringify({ lmcImago: true, lmcLarve: true, nseImago: false, nseLarve: false }) });
    const rows: CaptureRow[] = [
      { espece: 'LMC', categorie: 'imago', sexe: 'F', phase: 'transiens', stade: 'A1', effectif: 5 },
      { espece: 'LMC', categorie: 'larve', sexe: null, phase: 'gregaire', stade: 'L1', effectif: 3 },
    ];
    const recap = buildRecapitulatif(d, rows, '', []);
    expect(recap.reviewGroups).toEqual([
      { label: 'Locusta — Imagos', total: 5, max: 50, dominantLabel: 'Transiens' },
      { label: 'Locusta — Larves', total: 3, max: 65, dominantLabel: 'Grégaires' },
    ]);
  });

  it("liste chaque cible réellement sélectionnée (une ligne = une cible), quelle que soit la surface/densité", () => {
    const filled = buildRecapitulatif(draft(), [], '', [
      { espece: null, type_cible: 'dense', taille_min: null, taille_max: null, taille_moy: null, surface_totale: 5, densite_min: null, densite_max: null, densite_moy: 12, interdistance: null, comportement: null, direction_de: null, direction_vers: null, vent_de: null, vent_vitesse: null, pullulation_nb: null, taille_long: null, taille_large: null, taille_epaisseur: null, essaim_en_vol: null, essaim_pose: null, type_essaim: null, nb_taches_bandes: null, interdistance_m: null, interdistance_min: null, interdistance_max: null, interdistance_moy: null, surface_contaminee_ha: null, type_larve: null, surface_infestee_pourcent: null, stade_dominant: null, taille_groupe_m2: null, front_longueur_m: null, front_largeur_m: null, densite_max_front: null, densite_moy_arriere_front: null, heure_observation: null, densite_en_vol: null, dimension_ha: null },
    ]);
    expect(filled.infestationCibles).toEqual([
      { key: 'dense', label: 'Dense', details: ['Surface : 5 ha', 'Densité moy. : 12'] },
    ]);

    const empty = buildRecapitulatif(draft(), [], '', []);
    expect(empty.infestationCibles).toEqual([]);
  });

  it('n’oublie pas une cible sélectionnée mais pas encore quantifiée — régression : elle disparaissait du récapitulatif', () => {
    // La section Infestation est facultative (cf. persistAll dans infestation.tsx qui
    // enregistre chaque cible sélectionnée "même partiellement remplie") : une cible
    // choisie sans surface ni densité renseignée doit quand même apparaître ici.
    const recap = buildRecapitulatif(draft(), [], '', [
      { espece: null, type_cible: 'bande_larvaire', taille_min: null, taille_max: null, taille_moy: null, surface_totale: null, densite_min: null, densite_max: null, densite_moy: null, interdistance: null, comportement: null, direction_de: null, direction_vers: null, vent_de: null, vent_vitesse: null, pullulation_nb: null, taille_long: null, taille_large: null, taille_epaisseur: null, essaim_en_vol: null, essaim_pose: null, type_essaim: null, nb_taches_bandes: null, interdistance_m: null, interdistance_min: null, interdistance_max: null, interdistance_moy: null, surface_contaminee_ha: null, type_larve: null, surface_infestee_pourcent: null, stade_dominant: null, taille_groupe_m2: null, front_longueur_m: null, front_largeur_m: null, densite_max_front: null, densite_moy_arriere_front: null, heure_observation: null, densite_en_vol: null, dimension_ha: null },
    ]);
    expect(recap.infestationCibles).toEqual([{ key: 'bande_larvaire', label: 'Bande larvaire', details: [] }]);
  });

  it('reclasse un brouillon local pré-migration encore marqué "essaim" plutôt que d’afficher la valeur brute', () => {
    const recap = buildRecapitulatif(draft(), [], '', [
      { espece: null, type_cible: 'essaim', taille_min: null, taille_max: null, taille_moy: null, surface_totale: null, densite_min: null, densite_max: null, densite_moy: null, interdistance: null, comportement: null, direction_de: null, direction_vers: null, vent_de: null, vent_vitesse: null, pullulation_nb: null, taille_long: null, taille_large: null, taille_epaisseur: null, essaim_en_vol: null, essaim_pose: null, type_essaim: 'tres_dense', nb_taches_bandes: null, interdistance_m: null, interdistance_min: null, interdistance_max: null, interdistance_moy: null, surface_contaminee_ha: null, type_larve: null, surface_infestee_pourcent: null, stade_dominant: null, taille_groupe_m2: null, front_longueur_m: null, front_largeur_m: null, densite_max_front: null, densite_moy_arriere_front: null, heure_observation: null, densite_en_vol: null, dimension_ha: null },
    ]);
    expect(recap.infestationCibles).toEqual([{ key: 'essaim', label: 'Très dense', details: [] }]);
  });

  it('liste plusieurs cibles sélectionnées simultanément, chacune avec ses propres informations', () => {
    const recap = buildRecapitulatif(draft(), [], '', [
      { espece: null, type_cible: 'tache_larvaire', taille_min: null, taille_max: null, taille_moy: null, surface_totale: null, densite_min: 2, densite_max: 8, densite_moy: null, interdistance: null, comportement: null, direction_de: null, direction_vers: null, vent_de: null, vent_vitesse: null, pullulation_nb: null, taille_long: null, taille_large: null, taille_epaisseur: null, essaim_en_vol: null, essaim_pose: null, type_essaim: null, nb_taches_bandes: null, interdistance_m: null, interdistance_min: null, interdistance_max: null, interdistance_moy: null, surface_contaminee_ha: null, type_larve: null, surface_infestee_pourcent: null, stade_dominant: null, taille_groupe_m2: null, front_longueur_m: null, front_largeur_m: null, densite_max_front: null, densite_moy_arriere_front: null, heure_observation: null, densite_en_vol: null, dimension_ha: null },
      { espece: null, type_cible: 'dense', taille_min: null, taille_max: null, taille_moy: null, surface_totale: 3, densite_min: null, densite_max: null, densite_moy: null, interdistance: null, comportement: null, direction_de: null, direction_vers: null, vent_de: null, vent_vitesse: null, pullulation_nb: null, taille_long: null, taille_large: null, taille_epaisseur: null, essaim_en_vol: null, essaim_pose: null, type_essaim: null, nb_taches_bandes: null, interdistance_m: null, interdistance_min: null, interdistance_max: null, interdistance_moy: null, surface_contaminee_ha: null, type_larve: null, surface_infestee_pourcent: null, stade_dominant: null, taille_groupe_m2: null, front_longueur_m: null, front_largeur_m: null, densite_max_front: null, densite_moy_arriere_front: null, heure_observation: null, densite_en_vol: null, dimension_ha: null },
    ]);
    expect(recap.infestationCibles).toEqual([
      { key: 'tache_larvaire', label: 'Tache larvaire', details: ['Densité : 2 – 8'] },
      { key: 'dense', label: 'Dense', details: ['Surface : 3 ha'] },
    ]);
  });

  it("résume le comportement (État + Direction), sans confondre avec le vent (indépendant)", () => {
    const row = {
      espece: null, type_cible: 'bande_larvaire', taille_min: null, taille_max: null, taille_moy: null,
      surface_totale: null, densite_min: null, densite_max: null, densite_moy: null, interdistance: null,
      comportement: 'deplacement', direction_de: 'N', direction_vers: 'S',
      vent_de: 'E', vent_vitesse: 12, pullulation_nb: null, taille_long: null, taille_large: null,
      taille_epaisseur: null, essaim_en_vol: null, essaim_pose: null, type_essaim: null, nb_taches_bandes: null,
      interdistance_m: null, interdistance_min: null, interdistance_max: null, interdistance_moy: null,
      surface_contaminee_ha: null, type_larve: null, surface_infestee_pourcent: null, stade_dominant: null,
      taille_groupe_m2: null, front_longueur_m: null, front_largeur_m: null, densite_max_front: null,
      densite_moy_arriere_front: null, heure_observation: null, densite_en_vol: null, dimension_ha: null,
    } as const;
    const recap = buildRecapitulatif(draft(), [], '', [row]);
    expect(recap.comportementSummary).toBe('État Déplacement · Direction vers Nord');

    const empty = buildRecapitulatif(draft(), [], '', []);
    expect(empty.comportementSummary).toBe('Aucun comportement renseigné.');
  });

  it("reprend le texte d'observations tel qu'enregistré sur la fiche, sinon un texte neutre", () => {
    const withObs = buildRecapitulatif(draft({ observations: 'RAS, végétation sèche.' }), [], '', []);
    expect(withObs.observationsText).toBe('RAS, végétation sèche.');

    const withoutObs = buildRecapitulatif(draft({ observations: null }), [], '', []);
    expect(withoutObs.observationsText).toBe('Aucune observation renseignée.');
  });

  it('expose toujours les 4 blocs de densité LMC/NSE × imago/larve, jamais partagés entre eux', () => {
    const populations: PopulationRow[] = [
      { espece: 'LMC', categorie: 'imago', densite_diffuse: 12, densite_groupee: 3, methode: null, accouplement: null, ponte: null },
      { espece: 'LMC', categorie: 'larve', densite_diffuse: 40, densite_groupee: null, methode: null, accouplement: null, ponte: null },
      { espece: 'NSE', categorie: 'imago', densite_diffuse: 7, densite_groupee: 1, methode: null, accouplement: null, ponte: null },
      // NSE larve : pas encore renseigné — doit apparaître à part, non nul par contamination des 3 autres.
    ];
    const recap = buildRecapitulatif(draft(), [], '', [], populations);

    // Imagos avant larves (LMC puis NSE dans chaque groupe) : aligne le récapitulatif
    // sur l'ordre A/B-Imagos/C-Larves/D/E du parcours de saisie (#recap-ordre-a-b-c-d-e).
    expect(recap.densites).toEqual([
      { key: 'LMC-imago', espece: 'LMC', categorie: 'imago', label: 'Locusta — Imagos', densiteDiffuse: 12, densiteGroupee: 3 },
      { key: 'NSE-imago', espece: 'NSE', categorie: 'imago', label: 'Nomadacris — Imagos', densiteDiffuse: 7, densiteGroupee: 1 },
      { key: 'LMC-larve', espece: 'LMC', categorie: 'larve', label: 'Locusta — Larves', densiteDiffuse: 40, densiteGroupee: null },
      { key: 'NSE-larve', espece: 'NSE', categorie: 'larve', label: 'Nomadacris — Larves', densiteDiffuse: null, densiteGroupee: null },
    ]);
  });

  it('les 4 blocs de densité sont vides sans donnée, plutôt que de faire disparaître la section', () => {
    const recap = buildRecapitulatif(draft(), [], '', []);
    expect(recap.densites).toHaveLength(4);
    expect(recap.densites.every((d) => d.densiteDiffuse === null && d.densiteGroupee === null)).toBe(true);
  });

  /** #infestation-recap-intensive : la carte « Infestation » du récapitulatif
   * Intensive doit afficher le nombre de captures + densités réellement saisis
   * pour Imagos/Larves × LMC/NSE — jamais de valeur fictive. */
  it('infestationDetail combine nombre de captures et densités, toujours les 4 blocs Imagos/Larves × LMC/NSE', () => {
    const captures: CaptureRow[] = [
      { espece: 'LMC', categorie: 'imago', sexe: 'F', phase: 'transiens', stade: 'A1', effectif: 5 },
      { espece: 'LMC', categorie: 'imago', sexe: 'M', phase: 'gregaire', stade: 'A1', effectif: 2 },
      { espece: 'NSE', categorie: 'larve', sexe: null, phase: 'gregaire', stade: 'L1', effectif: 3 },
    ];
    const populations: PopulationRow[] = [
      { espece: 'LMC', categorie: 'imago', densite_diffuse: 12, densite_groupee: 4, methode: null, accouplement: null, ponte: null },
    ];
    const recap = buildRecapitulatif(draft(), captures, '', [], populations);

    expect(recap.infestationDetail).toEqual([
      { key: 'imago-LMC', categorie: 'imago', espece: 'LMC', label: 'Locusta', nombre: 7, densiteDiffuse: 12, densiteGroupee: 4 },
      { key: 'imago-NSE', categorie: 'imago', espece: 'NSE', label: 'Nomadacris', nombre: 0, densiteDiffuse: null, densiteGroupee: null },
      { key: 'larve-LMC', categorie: 'larve', espece: 'LMC', label: 'Locusta', nombre: 0, densiteDiffuse: null, densiteGroupee: null },
      { key: 'larve-NSE', categorie: 'larve', espece: 'NSE', label: 'Nomadacris', nombre: 3, densiteDiffuse: null, densiteGroupee: null },
    ]);
  });

  it('infestationDetail : un nombre de captures à 0 (réellement enregistré) n’est pas confondu avec une absence de donnée', () => {
    const recap = buildRecapitulatif(draft(), [], '', []);
    expect(recap.infestationDetail).toHaveLength(4);
    // Toujours un nombre (0 par défaut, jamais null) — seules les densités distinguent
    // "non renseigné" (null) d'une vraie valeur.
    expect(recap.infestationDetail.every((d) => d.nombre === 0)).toBe(true);
    expect(recap.infestationDetail.every((d) => d.densiteDiffuse === null && d.densiteGroupee === null)).toBe(true);
  });
});

describe('infestationDetailHasData', () => {
  const base = { key: 'imago-LMC', categorie: 'imago' as const, espece: 'LMC' as const, label: 'Locusta' };

  it('faux quand rien n’a été renseigné (nombre à 0, densités absentes)', () => {
    expect(infestationDetailHasData({ ...base, nombre: 0, densiteDiffuse: null, densiteGroupee: null })).toBe(false);
  });

  it('vrai dès qu’il y a des captures, même sans densité', () => {
    expect(infestationDetailHasData({ ...base, nombre: 5, densiteDiffuse: null, densiteGroupee: null })).toBe(true);
  });

  it('vrai si une densité est renseignée, même avec 0 capture', () => {
    expect(infestationDetailHasData({ ...base, nombre: 0, densiteDiffuse: 12, densiteGroupee: null })).toBe(true);
  });

  it('une densité à 0 (réellement saisie) compte comme renseignée, pas comme absente', () => {
    expect(infestationDetailHasData({ ...base, nombre: 0, densiteDiffuse: 0, densiteGroupee: null })).toBe(true);
  });
});


describe('enregistrerEtSynchroniser', () => {
  it('complète toujours la fiche locale puis synchronise si en ligne', async () => {
    mockCompleteProspection.mockResolvedValue(draft({ statut: 'en_attente' }));
    mockGetNetworkState.mockResolvedValue({ isConnected: true, isInternetReachable: true } as any);
    mockCreateProspection.mockResolvedValue({ id: 'remote-1', statut: 'validee', validated_at: null });
    mockMarkSynced.mockResolvedValue(draft({ statut_sync: 'synced' }));
    mockListAllPopulations.mockResolvedValue([
      { espece: 'LMC', categorie: 'imago', densite_diffuse: 5, densite_groupee: 1, methode: null, accouplement: 'rare', ponte: null },
    ]);
    mockListAllInfestations.mockResolvedValue([
      { espece: null, type_cible: 'dense', taille_min: null, taille_max: null, taille_moy: null, surface_totale: 5, densite_min: null, densite_max: null, densite_moy: null, interdistance: null, comportement: null, direction_de: null, direction_vers: null, vent_de: null, vent_vitesse: null, pullulation_nb: null, taille_long: null, taille_large: null, taille_epaisseur: null, essaim_en_vol: null, essaim_pose: null, type_essaim: null, nb_taches_bandes: null, interdistance_m: null, interdistance_min: null, interdistance_max: null, interdistance_moy: null, surface_contaminee_ha: null, type_larve: null, surface_infestee_pourcent: null, stade_dominant: null, taille_groupe_m2: null, front_longueur_m: null, front_largeur_m: null, densite_max_front: null, densite_moy_arriere_front: null, heure_observation: null, densite_en_vol: null, dimension_ha: null },
    ]);

    const result = await enregistrerEtSynchroniser(draft(), [], 'token-1');

    expect(mockCompleteProspection).toHaveBeenCalledWith('draft-1');
    expect(mockListAllPopulations).toHaveBeenCalledWith('draft-1');
    expect(mockListAllInfestations).toHaveBeenCalledWith('draft-1');
    expect(mockCreateProspection).toHaveBeenCalledWith(
      'token-1',
      expect.objectContaining({
        populations: [expect.objectContaining({ espece: 'LMC', categorie: 'imago', densite_diffuse: 5 })],
        infestations: [expect.objectContaining({ type_cible: 'dense', surface_totale: 5 })],
      })
    );
    expect(mockMarkSynced).toHaveBeenCalledWith('draft-1');
    expect(result.reussies).toEqual(['draft-1']);
    expect(result.echouees).toEqual([]);
  });

  /**
   * #densite-zero-perdue : `valeur ? Number(valeur) : null` (JS) traite 0
   * comme faux et le convertissait à tort en `null` à la synchronisation —
   * perdant silencieusement une densité (ou un autre champ numérique)
   * réellement saisie à zéro (aucune population diffuse constatée, par
   * exemple) alors qu'elle était bien conservée en local. `!= null` seul
   * distingue correctement « non renseigné » de « renseigné à zéro ».
   */
  it('conserve une densité (ou tout autre champ numérique) explicitement saisie à 0, ne la convertit pas en null', async () => {
    mockCompleteProspection.mockResolvedValue(draft({ statut: 'en_attente' }));
    mockGetNetworkState.mockResolvedValue({ isConnected: true, isInternetReachable: true } as any);
    mockCreateProspection.mockResolvedValue({ id: 'remote-1', statut: 'validee', validated_at: null });
    mockMarkSynced.mockResolvedValue(draft({ statut_sync: 'synced' }));
    mockListAllPopulations.mockResolvedValue([
      {
        espece: 'LMC', categorie: 'imago', densite_diffuse: 0, densite_groupee: 0, methode: null,
        accouplement: null, ponte: null, captures_nombre: 0, captures_sol: 0, captures_trans: 0,
        captures_greg: 0, interdistance: 0,
      },
    ] as any);
    mockListAllInfestations.mockResolvedValue([
      {
        espece: 'LMC', type_cible: 'dense', taille_min: 0, taille_max: null, taille_moy: null,
        surface_totale: null, densite_min: 0, densite_max: null, densite_moy: null, interdistance: null,
        comportement: null, direction_de: null, direction_vers: null, vent_de: null, vent_vitesse: 0,
        pullulation_nb: 0, taille_long: null, taille_large: null, taille_epaisseur: null,
        essaim_en_vol: null, essaim_pose: null, type_essaim: null, nb_taches_bandes: null,
        interdistance_m: null, interdistance_min: null, interdistance_max: null, interdistance_moy: null,
        surface_contaminee_ha: 0, type_larve: null, surface_infestee_pourcent: 0, stade_dominant: null,
        taille_groupe_m2: null, front_longueur_m: null, front_largeur_m: null, densite_max_front: null,
        densite_moy_arriere_front: null, heure_observation: null, densite_en_vol: 0, dimension_ha: null,
      },
    ] as any);

    await enregistrerEtSynchroniser(draft(), [], 'token-1');

    expect(mockCreateProspection).toHaveBeenCalledWith(
      'token-1',
      expect.objectContaining({
        populations: [
          expect.objectContaining({
            densite_diffuse: 0,
            densite_groupee: 0,
            captures_nombre: 0,
            captures_sol: 0,
            captures_trans: 0,
            captures_greg: 0,
            interdistance: 0,
          }),
        ],
        infestations: [
          expect.objectContaining({
            taille_min: 0,
            densite_min: 0,
            vent_vitesse: 0,
            pullulation_nb: 0,
            surface_contaminee_ha: 0,
            surface_infestee_pourcent: 0,
            densite_en_vol: 0,
          }),
        ],
      })
    );
  });

  it("transmet les champs extensif-imagos ajoutés (type de cible, direction, état/comportement, interdistance)", async () => {
    mockCompleteProspection.mockResolvedValue(draft({ statut: 'en_attente' }));
    mockGetNetworkState.mockResolvedValue({ isConnected: true, isInternetReachable: true } as any);
    mockCreateProspection.mockResolvedValue({ id: 'remote-1', statut: 'validee', validated_at: null });
    mockMarkSynced.mockResolvedValue(draft({ statut_sync: 'synced' }));
    mockListAllPopulations.mockResolvedValue([
      {
        espece: 'NSE', categorie: 'imago', densite_diffuse: null, densite_groupee: null, methode: null,
        accouplement: 'neant', ponte: 'beaucoup', interdistance: 40.75, type_cible: '["tres_dense"]',
        direction_de: 'N', direction_vers: 'S', etat: 'deplacement', essaim_en_vol: true, essaim_pose: false,
      },
      {
        espece: 'LMC', categorie: 'larve', densite_diffuse: null, densite_groupee: null, methode: null,
        accouplement: null, ponte: null, surface_contaminee_ha: 12.75,
      },
    ] as any);
    mockListAllInfestations.mockResolvedValue([]);

    await enregistrerEtSynchroniser(draft(), [], 'token-1');

    expect(mockCreateProspection).toHaveBeenCalledWith(
      'token-1',
      expect.objectContaining({
        populations: [
          expect.objectContaining({
            espece: 'NSE', accouplement: 'neant', ponte: 'beaucoup', interdistance: 40.75,
            type_cible: ['tres_dense'], direction_de: 'N', direction_vers: 'S',
            etat: 'deplacement', essaim_en_vol: true, essaim_pose: false,
          }),
          expect.objectContaining({ espece: 'LMC', surface_contaminee_ha: 12.75 }),
        ],
      })
    );
  });

  /** #revalidation-prospection : `demarrerRevalidation` clone TOUTES les lignes
   * population de la fiche source, y compris une grille espèce/catégorie jamais
   * renseignée sur l'ancienne fiche (tolérée en lecture par `PopulationRead`) —
   * sans filtrage, cette ligne totalement vide partirait en synchro et
   * échouerait sur `densite_diffuse` obligatoire pour une grille que l'agent n'a
   * jamais ouverte. Elle doit être omise du payload, silencieusement. */
  it('omet du payload une ligne population sans aucune donnée (résidu de clonage), sans échouer', async () => {
    mockCompleteProspection.mockResolvedValue(draft({ statut: 'en_attente' }));
    mockGetNetworkState.mockResolvedValue({ isConnected: true, isInternetReachable: true } as any);
    mockCreateProspection.mockResolvedValue({ id: 'remote-1', statut: 'validee', validated_at: null });
    mockMarkSynced.mockResolvedValue(draft({ statut_sync: 'synced' }));
    mockListAllPopulations.mockResolvedValue([
      {
        espece: 'LMC', categorie: 'imago', densite_diffuse: 5, densite_groupee: null, methode: null,
        accouplement: null, ponte: null,
      },
      // Ligne "NSE imago" jamais renseignée — clonée telle quelle depuis une
      // fiche périmée (revalidation), aucun champ rempli.
      {
        espece: 'NSE', categorie: 'imago', densite_diffuse: null, densite_groupee: null, methode: null,
        accouplement: null, ponte: null, type_cible: '[]',
      },
    ] as any);
    mockListAllInfestations.mockResolvedValue([]);

    await enregistrerEtSynchroniser(draft(), [], 'token-1');

    expect(mockCreateProspection).toHaveBeenCalledWith(
      'token-1',
      expect.objectContaining({
        populations: [expect.objectContaining({ espece: 'LMC', categorie: 'imago', densite_diffuse: 5 })],
      })
    );
  });

  /** #revalidation-sync-lien-perdu : `revalide_de_id` n'était jusqu'ici jamais
   * transmis à la synchronisation — le serveur ne pouvait donc ni faire
   * passer cette fiche directement à `validee` (CreateProspection.execute),
   * ni marquer l'origine périmée comme remplacée. */
  it('transmet revalide_de_id quand la fiche revalide une origine périmée', async () => {
    mockCompleteProspection.mockResolvedValue(draft({ statut: 'en_attente', revalide_de_id: 'presp-perimee' }));
    mockGetNetworkState.mockResolvedValue({ isConnected: true, isInternetReachable: true } as any);
    mockCreateProspection.mockResolvedValue({ id: 'remote-1', statut: 'validee', validated_at: '2026-09-19T00:00:00Z' });
    mockMarkSynced.mockResolvedValue(draft({ statut_sync: 'synced' }));
    mockListAllPopulations.mockResolvedValue([]);
    mockListAllInfestations.mockResolvedValue([]);

    await enregistrerEtSynchroniser(draft({ revalide_de_id: 'presp-perimee' }), [], 'token-1');

    expect(mockCreateProspection).toHaveBeenCalledWith(
      'token-1',
      expect.objectContaining({ revalide_de_id: 'presp-perimee' })
    );
  });

  it('transmet revalide_de_id=null pour une fiche qui ne revalide rien', async () => {
    mockCompleteProspection.mockResolvedValue(draft({ statut: 'en_attente' }));
    mockGetNetworkState.mockResolvedValue({ isConnected: true, isInternetReachable: true } as any);
    mockCreateProspection.mockResolvedValue({ id: 'remote-1', statut: 'en_attente', validated_at: null });
    mockMarkSynced.mockResolvedValue(draft({ statut_sync: 'synced' }));
    mockListAllPopulations.mockResolvedValue([]);
    mockListAllInfestations.mockResolvedValue([]);

    await enregistrerEtSynchroniser(draft(), [], 'token-1');

    expect(mockCreateProspection).toHaveBeenCalledWith(
      'token-1',
      expect.objectContaining({ revalide_de_id: null })
    );
  });

  it('normalise type_cible et type_essaim pour la synchro (0031 : "essaim" a disparu du contrat TypeCible ; anciennes valeurs à 5 niveaux de type_essaim toujours reconnues)', async () => {
    mockCompleteProspection.mockResolvedValue(draft({ statut: 'en_attente' }));
    mockGetNetworkState.mockResolvedValue({ isConnected: true, isInternetReachable: true } as any);
    mockCreateProspection.mockResolvedValue({ id: 'remote-1', statut: 'validee', validated_at: null });
    mockMarkSynced.mockResolvedValue(draft({ statut_sync: 'synced' }));
    mockListAllPopulations.mockResolvedValue([]);
    mockListAllInfestations.mockResolvedValue([
      { espece: null, type_cible: 'essaim', taille_min: null, taille_max: null, taille_moy: null, surface_totale: 5, densite_min: null, densite_max: null, densite_moy: null, interdistance: null, comportement: null, direction_de: null, direction_vers: null, vent_de: null, vent_vitesse: null, pullulation_nb: null, taille_long: null, taille_large: null, taille_epaisseur: null, essaim_en_vol: null, essaim_pose: null, type_essaim: 'dense', nb_taches_bandes: null, interdistance_m: null, interdistance_min: null, interdistance_max: null, interdistance_moy: null, surface_contaminee_ha: null, type_larve: null, surface_infestee_pourcent: null, stade_dominant: null, taille_groupe_m2: null, front_longueur_m: null, front_largeur_m: null, densite_max_front: null, densite_moy_arriere_front: null, heure_observation: null, densite_en_vol: null, dimension_ha: null },
      { espece: null, type_cible: 'vol_clair', taille_min: null, taille_max: null, taille_moy: null, surface_totale: 5, densite_min: null, densite_max: null, densite_moy: null, interdistance: null, comportement: null, direction_de: null, direction_vers: null, vent_de: null, vent_vitesse: null, pullulation_nb: null, taille_long: null, taille_large: null, taille_epaisseur: null, essaim_en_vol: null, essaim_pose: null, type_essaim: 'tres_dense', nb_taches_bandes: null, interdistance_m: null, interdistance_min: null, interdistance_max: null, interdistance_moy: null, surface_contaminee_ha: null, type_larve: null, surface_infestee_pourcent: null, stade_dominant: null, taille_groupe_m2: null, front_longueur_m: null, front_largeur_m: null, densite_max_front: null, densite_moy_arriere_front: null, heure_observation: null, densite_en_vol: null, dimension_ha: null },
      // Ancien brouillon (avant la bascule sur les 3 catégories officielles) : doit toujours se normaliser.
      { espece: null, type_cible: 'essaim', taille_min: null, taille_max: null, taille_moy: null, surface_totale: 5, densite_min: null, densite_max: null, densite_moy: null, interdistance: null, comportement: null, direction_de: null, direction_vers: null, vent_de: null, vent_vitesse: null, pullulation_nb: null, taille_long: null, taille_large: null, taille_epaisseur: null, essaim_en_vol: null, essaim_pose: null, type_essaim: 'essaim_densite_forte', nb_taches_bandes: null, interdistance_m: null, interdistance_min: null, interdistance_max: null, interdistance_moy: null, surface_contaminee_ha: null, type_larve: null, surface_infestee_pourcent: null, stade_dominant: null, taille_groupe_m2: null, front_longueur_m: null, front_largeur_m: null, densite_max_front: null, densite_moy_arriere_front: null, heure_observation: null, densite_en_vol: null, dimension_ha: null },
    ] as any);

    await enregistrerEtSynchroniser(draft(), [], 'token-1');

    expect(mockCreateProspection).toHaveBeenCalledWith(
      'token-1',
      expect.objectContaining({
        infestations: [
          expect.objectContaining({ type_cible: 'dense', type_essaim: 'dense' }),
          expect.objectContaining({ type_cible: 'vol_clair', type_essaim: 'tres_dense' }),
          expect.objectContaining({ type_cible: 'dense', type_essaim: 'dense' }),
        ],
      })
    );
  });

  it('ne tente pas le réseau hors-ligne, et la fiche reste dans la file', async () => {
    mockCompleteProspection.mockResolvedValue(draft({ statut: 'en_attente' }));
    mockGetNetworkState.mockResolvedValue({ isConnected: false, isInternetReachable: false } as any);

    const result = await enregistrerEtSynchroniser(draft(), [], 'token-1');

    expect(mockCreateProspection).not.toHaveBeenCalled();
    expect(mockMarkSynced).not.toHaveBeenCalled();
    // Hors ligne n'est plus un `{ synced: false }` indiscernable d'un succès :
    // c'est un échec transitoire nommé, qui laisse la fiche dans la file.
    expect(result.reussies).toEqual([]);
    expect(result.echouees[0]).toMatchObject({ id: 'draft-1', sort: 'file', classe: 'NetworkError' });
    expect(mockMarkEchec).not.toHaveBeenCalled();
  });

  it("remonte l'échec de synchronisation au lieu de l'avaler, la fiche restant enregistrée localement (#98)", async () => {
    mockCompleteProspection.mockResolvedValue(draft({ statut: 'en_attente' }));
    mockGetNetworkState.mockResolvedValue({ isConnected: true, isInternetReachable: true } as any);
    mockCreateProspection.mockRejectedValue(new NetworkError('network error'));

    const result = await enregistrerEtSynchroniser(draft(), [], 'token-1');

    expect(mockCompleteProspection).toHaveBeenCalledWith('draft-1');
    expect(result.echouees[0]).toMatchObject({ id: 'draft-1', classe: 'NetworkError' });
    expect(mockMarkSynced).not.toHaveBeenCalled();
  });

  it('sort de la file la fiche que le serveur refuse (4xx), et elle seule', async () => {
    mockCompleteProspection.mockResolvedValue(draft({ statut: 'en_attente' }));
    mockGetNetworkState.mockResolvedValue({ isConnected: true, isInternetReachable: true } as any);
    const refus = new NetworkError('champ obligatoire manquant');
    (refus as unknown as { status: number }).status = 422;
    mockCreateProspection.mockRejectedValue(refus);

    const result = await enregistrerEtSynchroniser(draft(), [], 'token-1');

    expect(result.echouees[0].sort).toBe('echec');
    expect(mockMarkEchec).toHaveBeenCalledWith('draft-1');
  });

  it('enregistre normalement une 3e, 4e, 5e fiche à la suite, même si le serveur rejette une des synchronisations (#98)', async () => {
    mockGetNetworkState.mockResolvedValue({ isConnected: true, isInternetReachable: true } as any);
    mockMarkSynced.mockResolvedValue(draft({ statut_sync: 'synced' }));

    for (let i = 1; i <= 5; i += 1) {
      mockCompleteProspection.mockResolvedValueOnce(draft({ id: `draft-${i}`, statut: 'en_attente' }));
      if (i === 3) {
        mockCreateProspection.mockRejectedValueOnce(new NetworkError(`Erreur serveur sur la fiche ${i}`));
      } else {
        mockCreateProspection.mockResolvedValueOnce({ id: `remote-${i}`, statut: 'validee', validated_at: null });
      }

      const result = await enregistrerEtSynchroniser(draft({ id: `draft-${i}` }), [], 'token-1');

      expect(mockCompleteProspection).toHaveBeenCalledWith(`draft-${i}`);
      if (i === 3) {
        expect(result.reussies).toEqual([]);
        expect(result.echouees).toHaveLength(1);
      } else {
        expect(result.reussies).toEqual([`draft-${i}`]);
      }
    }
  });
});

describe('syncOneProspection — l’unitaire lève', () => {
  it('renvoie la fiche en_attente au serveur puis la marque synchronisée', async () => {
    mockListAllCaptures.mockResolvedValue([]);
    mockCreateProspection.mockResolvedValue({ id: 'remote-1', statut: 'validee', validated_at: null });
    mockMarkSynced.mockResolvedValue(draft({ statut_sync: 'synced' }));

    await syncOneProspection(draft({ statut: 'en_attente' }), 'token-1');

    expect(mockListAllCaptures).toHaveBeenCalledWith('draft-1');
    expect(mockListAllPopulations).toHaveBeenCalledWith('draft-1');
    expect(mockListAllInfestations).toHaveBeenCalledWith('draft-1');
    expect(mockCreateProspection).toHaveBeenCalled();
    expect(mockMarkSynced).toHaveBeenCalledWith('draft-1');
  });

  /** #revalidation-sync-lien-perdu : évite d'attendre le prochain passage sur
   * "Mes prospections"/"Mes fiches" pour qu'une revalidation apparaisse enfin
   * `validee` en local — le serveur le sait déjà dans sa réponse à la création. */
  it('reporte immédiatement le statut/validated_at renvoyés par le serveur', async () => {
    mockListAllCaptures.mockResolvedValue([]);
    mockCreateProspection.mockResolvedValue({
      id: 'remote-1',
      statut: 'validee',
      validated_at: '2026-09-19T00:00:00Z',
    });
    mockMarkSynced.mockResolvedValue(draft({ statut_sync: 'synced' }));

    await syncOneProspection(draft({ id: 'draft-1', statut: 'en_attente' }), 'token-1');

    expect(mockSynchroniserStatutServeur).toHaveBeenCalledWith([
      { id: 'draft-1', statut: 'validee', validated_at: '2026-09-19T00:00:00Z' },
    ]);
  });

  it("laisse remonter l'erreur au lieu de l'avaler — c'est le lot qui la range", async () => {
    mockListAllCaptures.mockResolvedValue([]);
    mockCreateProspection.mockRejectedValue(new Error('Erreur serveur 500'));

    await expect(syncOneProspection(draft({ statut: 'en_attente' }), 'token-1')).rejects.toThrow(
      'Erreur serveur 500'
    );
    expect(mockMarkSynced).not.toHaveBeenCalled();
  });
});

describe('syncAllProspections — le lot résume', () => {
  it('ne s’arrête pas à la fiche en échec et rend le compte des deux côtés', async () => {
    mockListAllCaptures.mockResolvedValue([]);
    mockMarkSynced.mockResolvedValue(draft({ statut_sync: 'synced' }));
    mockCreateProspection
      .mockResolvedValueOnce({ id: 'remote-1', statut: 'validee', validated_at: null })
      .mockRejectedValueOnce(new NetworkError('coupure'))
      .mockResolvedValueOnce({ id: 'remote-3', statut: 'validee', validated_at: null });

    const resume = await syncAllProspections(
      [draft({ id: 'a' }), draft({ id: 'b' }), draft({ id: 'c' })],
      'token-1'
    );

    expect(resume.reussies).toEqual(['a', 'c']);
    expect(resume.echouees.map((f) => f.id)).toEqual(['b']);
  });
});