import { CaptureRead, InfestationRead, PopulationRead, ProspectionRead } from '../src/lib/api-client';
import {
  STATUT_VALIDE,
  STRATE_KEYS,
  TEXTURE_OPTIONS,
  buildEspecesSynthese,
  buildFicheLecture,
  buildInfestationSynthese,
  buildVegetationSummary,
  computeSurfaceRepartitionTotal,
  defaultStrateDetail,
  isFicheValidee,
  isSurfaceRepartitionValide,
  parseVegetationSol,
  StratesState,
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
    type_cible: [],
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
    n_fiche: 'F-001',
    n_message: null,
    date_prospection: '2026-07-01',
    latitude: null,
    longitude: null,
    altitude: null,
    biotope: [],
    type_station: [],
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
    operations_aeriennes: [],
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

  /**
   * #nombre-de-capture-fiable : régression — la Prospection Extensive ne crée jamais
   * de ligne dans `captures` (grille chronométrée réservée à l'Intensif) ; son seul
   * total de captures par espèce/catégorie vit dans `population.captures_nombre`.
   * Avant ce correctif, `totalCaptures` ne lisait que `captures` et affichait
   * toujours 0 pour une fiche Extensive pourtant correctement renseignée.
   */
  it('additionne aussi population.captures_nombre — cas Extensive, sans aucune ligne captures', () => {
    const captures: CaptureRead[] = [];
    const populations = [
      population({ espece: 'LMC', categorie: 'imago', captures_nombre: 20, densite_diffuse: 8 }),
      population({ espece: 'LMC', categorie: 'larve', captures_nombre: 15 }),
    ];

    const result = buildEspecesSynthese(captures, populations);

    expect(result).toEqual([
      { espece: 'LMC', totalCaptures: 35, densiteDiffuse: 8, densiteGroupee: null, phenotypeDominantLabel: '—' },
    ]);
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
      type_cible: 'dense',
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
      typeLabel: 'Dense',
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
  it('contient les 6 strates du handoff (sol nu est un champ station, pas une strate — #278)', () => {
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
        herbeuse: { surfRel: 40, hMoy: 0.3, recouvrement: 70, verdissement: 20, repousse: true, orpad: ['Rare'] },
        arboree: { surfRel: 10, hMoy: 4, recouvrement: 15, verdissement: 0, repousse: false, orpad: [] },
      },
    });
    const sol = JSON.stringify({ humidite: '5_12cm', texture: 'sable_grossier', solNu: 5 });

    const state = parseVegetationSol(vegetation, sol, 'moyens');

    expect(state.strates.herbeuse).toEqual({
      surfRel: 40, hMoy: 0.3, recouvrement: 70, verdissement: 20, repousse: true, orpad: ['Rare'],
      feuille: [], fleur: [], fruit: [], sec: [],
    });
    expect(state.strates.buissonneuse.recouvrement).toBe(0);
    expect(state.solNu).toBe(5);

    const summary = buildVegetationSummary(state);
    expect(summary).toContain('Strate herbeuse 70%');
    expect(summary).toContain('Strate arborée 15%');
    expect(summary).toContain('Sol nu 5%');
    expect(summary).toContain('Texture Sable grossier');
    expect(summary).toContain('Dégâts culture Moyens');
  });

  it('repousse : un ancien brouillon avec un pourcentage numérique (avant #repousse-presence-absence) retombe à null plutôt que de garder une valeur incohérente', () => {
    const vegetation = JSON.stringify({
      strates: {
        herbeuse: { surfRel: 40, hMoy: 0.3, recouvrement: 70, verdissement: 20, repousse: 10, orpad: [] },
      },
    });

    const state = parseVegetationSol(vegetation, null, null);

    expect(state.strates.herbeuse.repousse).toBeNull();
  });

  it('ne casse pas sur un JSON vide', () => {
    const state = parseVegetationSol(null, null, null);
    expect(STRATE_KEYS.every((k) => state.strates[k].recouvrement === 0)).toBe(true);
    expect(state.texture).toEqual([]);
  });

  it('conserve TOUTES les textures d’une sélection multiple, pas seulement la première', () => {
    // Régression : `texture` était traité comme une valeur scalaire (`Texture | null`)
    // alors que veg.tsx enregistre un tableau ("sélection multiple") — la comparaison
    // `state.texture === option.value` échouait donc toujours et la texture disparaissait
    // silencieusement du récapitulatif, même correctement enregistrée en base.
    const sol = JSON.stringify({ humidite: 'surface', texture: ['limoneuse', 'argileuse', 'cailloux'] });
    const state = parseVegetationSol(null, sol, null);
    expect(state.texture).toEqual(['limoneuse', 'argileuse', 'cailloux']);

    const summary = buildVegetationSummary(state);
    expect(summary).toContain('Texture Limoneuse, Argileuse, Cailloux');
  });

  it('reconnaît encore une ancienne fiche enregistrée avec une texture scalaire (avant le multi-select)', () => {
    const sol = JSON.stringify({ humidite: 'surface', texture: 'sable_fin' });
    const state = parseVegetationSol(null, sol, null);
    expect(state.texture).toEqual(['sable_fin']);
    expect(buildVegetationSummary(state)).toContain('Texture Sable fin');
  });

  // #humidite-multiselect : même mécanisme que la texture ci-dessus.
  it('conserve TOUTES les humidités d’une sélection multiple, pas seulement la première', () => {
    const sol = JSON.stringify({ humidite: ['surface', '0_5cm', 'gt_30cm'], texture: [] });
    const state = parseVegetationSol(null, sol, null);
    expect(state.humidite).toEqual(['surface', '0_5cm', 'gt_30cm']);

    const summary = buildVegetationSummary(state);
    expect(summary).toContain('Humidité Surf., 0,5 cm, >30');
  });

  it('reconnaît encore une ancienne fiche enregistrée avec une humidité scalaire (avant le multi-select)', () => {
    const sol = JSON.stringify({ humidite: 'surface', texture: [] });
    const state = parseVegetationSol(null, sol, null);
    expect(state.humidite).toEqual(['surface']);
    expect(buildVegetationSummary(state)).toContain('Humidité Surf.');
  });
});

describe('computeSurfaceRepartitionTotal / isSurfaceRepartitionValide (#278)', () => {
  function strates(recouvrementParStrate: Partial<Record<(typeof STRATE_KEYS)[number], number>>): StratesState {
    return STRATE_KEYS.reduce((acc, key) => {
      acc[key] = { ...defaultStrateDetail(), recouvrement: recouvrementParStrate[key] ?? 0 };
      return acc;
    }, {} as StratesState);
  }

  it('additionne le sol nu et le recouvrement des 6 strates', () => {
    const total = computeSurfaceRepartitionTotal({
      strates: strates({ arboree: 10, herbeuse: 60, cultures_seches: 25 }),
      solNu: 5,
    });
    expect(total).toBe(100);
  });

  it('traite un sol nu non renseigné comme 0, pas comme une erreur', () => {
    const total = computeSurfaceRepartitionTotal({ strates: strates({ herbeuse: 40 }), solNu: null });
    expect(total).toBe(40);
  });

  it('valide une répartition exactement à 100%', () => {
    const state = { strates: strates({ herbeuse: 100 }), solNu: 0 };
    expect(isSurfaceRepartitionValide(state)).toBe(true);
  });

  it('tolère un écart d’arrondi de saisie (0,1 point)', () => {
    const state = { strates: strates({ herbeuse: 99.95 }), solNu: 0 };
    expect(isSurfaceRepartitionValide(state)).toBe(true);
  });

  it('rejette une répartition qui ne totalise pas 100%', () => {
    const state = { strates: strates({ herbeuse: 60 }), solNu: 10 };
    expect(computeSurfaceRepartitionTotal(state)).toBe(70);
    expect(isSurfaceRepartitionValide(state)).toBe(false);
  });
});
