import { CaptureRead, InfestationRead, PopulationRead, ProspectionRead } from '../src/lib/api-client';
import {
  STATUT_VALIDE,
  STRATE_KEYS,
  TEXTURE_OPTIONS,
  buildEspecesSynthese,
  buildFicheLecture,
  buildInfestationSynthese,
  buildVegetationSummary,
  isFicheValidee,
  parseVegetationSol,
} from '../src/lib/prospection-fiche-lecture';

jest.mock('../src/lib/prospection-repository', () => ({}));

function capture(overrides: Partial<CaptureRead> = {}): CaptureRead {
  return {
    id: 'cap-1',
    espece: 'LMC',
    categorie: 'imago',
    sexe: 'F',
    phase: 'gregaire',
    stade: 'A1',
    effectif: 5,
    ...overrides,
  };
}

function population(overrides: Partial<PopulationRead> = {}): PopulationRead {
  return {
    id: 'pop-1',
    espece: 'LMC',
    categorie: 'imago',
    densite_diffuse: null,
    densite_groupee: null,
    captures_nombre: null,
    temps_capture: null,
    methode: null,
    phase: null,
    accouplement: null,
    ponte: null,
    ...overrides,
  };
}

function prospection(overrides: Partial<ProspectionRead> = {}): ProspectionRead {
  return {
    id: 'p-1',
    type_prospection: 'intensive',
    campagne_id: 'c-1',
    prospecteur_id: 'u-1',
    station_id: 'station-1',
    n_releve: null,
    n_fiche: 'F-001',
    n_message: null,
    date_prospection: '2026-07-01',
    latitude: null,
    longitude: null,
    altitude: null,
    biotope: null,
    surface_station: null,
    surface_prospectee: null,
    surface_infestee: null,
    degats_cultures: null,
    derniere_pluie: null,
    intensite_pluie: null,
    vegetation: null,
    sol: null,
    avertissements: [],
    verdissement: null,
    hauteur_strate: null,
    ennemis_naturels: null,
    observations: null,
    statut: STATUT_VALIDE,
    statut_sync: 'synced',
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    populations: [],
    captures: [],
    infestations: [],
    region: null,
    district: null,
    commune: null,
    za: null,
    pa_code: null,
    degats_cultures_pourcent: null,
    verdissement_pourcent: null,
    hauteur_herbe_cm: null,
    ...overrides,
  };
}

describe('isFicheValidee', () => {
  it('est vraie uniquement pour le statut validee', () => {
    expect(isFicheValidee({ statut: 'validee' })).toBe(true);
    expect(isFicheValidee({ statut: 'en_attente' })).toBe(false);
    expect(isFicheValidee({ statut: 'verifiee' })).toBe(false);
  });
});

describe('buildEspecesSynthese', () => {
  it('agrège les captures et densités par espèce, phénotype dominant par total effectif', () => {
    const captures = [
      capture({ espece: 'LMC', phase: 'gregaire', effectif: 10 }),
      capture({ espece: 'LMC', phase: 'solitaire', effectif: 3 }),
      capture({ espece: 'NSE', phase: 'transiens', effectif: 7 }),
    ];
    const populations = [
      population({ espece: 'LMC', densite_diffuse: 12, densite_groupee: 4 }),
      population({ espece: 'NSE', densite_diffuse: 2, densite_groupee: null }),
    ];

    const result = buildEspecesSynthese(captures, populations);

    expect(result).toEqual([
      { espece: 'LMC', totalCaptures: 13, densiteDiffuse: 12, densiteGroupee: 4, phenotypeDominantLabel: 'Grégaires' },
      { espece: 'NSE', totalCaptures: 7, densiteDiffuse: 2, densiteGroupee: null, phenotypeDominantLabel: 'Transiens' },
    ]);
  });

  it('retourne un tableau vide sans captures ni populations', () => {
    expect(buildEspecesSynthese([], [])).toEqual([]);
  });
});

describe('buildInfestationSynthese', () => {
  it("indique l'absence d'infestation quand la liste est vide", () => {
    expect(buildInfestationSynthese([])).toEqual({
      hasInfestation: false,
      typeLabel: '—',
      surfaceTotale: null,
      comportementLabel: '—',
      pullulationNb: null,
      tailleEssaim: '—',
      typeEssaim: null,
      typeLarve: null,
      surfaceContamineeHa: null,
      surfaceInfesteePourcent: null,
    });
  });

  it('synthétise type/surface/comportement de la première infestation', () => {
    const infestation: InfestationRead = {
      id: 'inf-1',
      espece: 'LMC',
      type_cible: 'essaim',
      taille_min: null,
      taille_max: null,
      taille_moy: null,
      surface_totale: 3.5,
      densite_min: null,
      densite_max: null,
      densite_moy: null,
      interdistance: null,
      comportement: 'deplacement',
      direction_de: null,
      direction_vers: 'N',
      vent_de: null,
      vent_vitesse: null,
      pullulation_nb: null,
      taille_long: null,
      taille_large: null,
      taille_epaisseur: null,
      essaim_en_vol: null,
      essaim_pose: null,
      type_essaim: null,
      nb_taches_bandes: null,
      interdistance_m: null,
      surface_contaminee_ha: null,
      type_larve: null,
      surface_infestee_pourcent: null,
    };

    expect(buildInfestationSynthese([infestation])).toEqual({
      hasInfestation: true,
      typeLabel: 'Essaim',
      surfaceTotale: 3.5,
      comportementLabel: 'Déplacement',
      pullulationNb: null,
      tailleEssaim: '—',
      typeEssaim: null,
      typeLarve: null,
      surfaceContamineeHa: null,
      surfaceInfesteePourcent: null,
    });
  });
});

describe('buildFicheLecture', () => {
  it('construit la vue sans resaisie, à partir des données de la fiche', () => {
    const p = prospection({
      n_fiche: 'F-042',
      station_id: 'Station Nord',
      date_prospection: '2026-07-05',
      captures: [capture({ espece: 'LMC', phase: 'gregaire', effectif: 8 })],
      populations: [population({ espece: 'LMC', densite_diffuse: 5, densite_groupee: 1 })],
    });

    const result = buildFicheLecture(p);

    expect(result.nFiche).toBe('F-042');
    expect(result.statutLabel).toBe('Validée ✓');
    expect(result.stationLabel).toBe('Station Nord');
    expect(result.dateProspection).toBe('2026-07-05');
    expect(result.especes).toHaveLength(1);
    expect(result.especes[0].espece).toBe('LMC');
    expect(result.infestation.hasInfestation).toBe(false);
  });

  it('dérive la station depuis les coordonnées quand aucune station n\'est renseignée', () => {
    const p = prospection({ station_id: null, latitude: -18.9, longitude: 47.5 });
    expect(buildFicheLecture(p).stationLabel).toBe('-18.9000, 47.5000');
  });
});

describe('STRATE_KEYS', () => {
  it('contient les 6 strates du handoff (cultures_hygro remplace sol_nu, qui est un champ par strate)', () => {
    expect(STRATE_KEYS).toEqual(['arboree', 'arbustive', 'buissonneuse', 'herbeuse', 'cultures_seches', 'cultures_hygro']);
  });
});

describe('TEXTURE_OPTIONS', () => {
  it('propose les 7 textures du PDF, y compris sable grossier et bloc', () => {
    expect(TEXTURE_OPTIONS.map((o) => o.value)).toEqual([
      'limoneuse',
      'argileuse',
      'sable_fin',
      'sable_grossier',
      'gravier',
      'cailloux',
      'bloc',
    ]);
  });
});

describe('parseVegetationSol / buildVegetationSummary (multi-strate)', () => {
  it('parse une strate complète et calcule le résumé sur le recouvrement de chaque strate renseignée', () => {
    const vegetation = JSON.stringify({
      strates: {
        herbeuse: { surfRel: 40, hMoy: 0.3, recouvrement: 70, verdissement: 20, repousse: 10, orpad: ['Fleur'], solNu: 5 },
        arboree: { surfRel: 10, hMoy: 4, recouvrement: 15, verdissement: 0, repousse: 0, orpad: [], solNu: 0 },
      },
    });
    const sol = JSON.stringify({ humidite: '5_12cm', texture: 'sable_grossier' });

    const state = parseVegetationSol(vegetation, sol, 'moyens');

    expect(state.strates.herbeuse).toEqual({
      surfRel: 40, hMoy: 0.3, recouvrement: 70, verdissement: 20, repousse: 10, orpad: ['Fleur'], solNu: 5,
    });
    expect(state.strates.buissonneuse.recouvrement).toBe(0);

    const summary = buildVegetationSummary(state);
    expect(summary).toContain('Strate herbeuse 70%');
    expect(summary).toContain('Strate arborée 15%');
    expect(summary).toContain('Texture Sable grossier');
    expect(summary).toContain('Dégâts culture Moyens');
  });

  it('ne casse pas sur un JSON vide', () => {
    const state = parseVegetationSol(null, null, null);
    expect(STRATE_KEYS.every((k) => state.strates[k].recouvrement === 0)).toBe(true);
  });
});
