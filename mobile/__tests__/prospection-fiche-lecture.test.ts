jest.mock('../src/lib/prospection-repository', () => ({}));

import { CaptureRead, InfestationRead, PopulationRead, ProspectionRead } from '../src/lib/api-client';
import {
  STATUT_VALIDE,
  buildEspecesSynthese,
  buildFicheLecture,
  buildInfestationSynthese,
  isFicheValidee,
} from '../src/lib/prospection-fiche-lecture';

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
    surf_station: null,
    surf_prospectee: null,
    surf_infestee: null,
    degats_cultures: null,
    derniere_pluie: null,
    intensite_pluie: null,
    vegetation: null,
    sol: null,
    ennemis_naturels: null,
    observations: null,
    statut: STATUT_VALIDE,
    statut_sync: 'synced',
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    populations: [],
    captures: [],
    infestations: [],
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
      surfaceTot: null,
      comportementLabel: '—',
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
      surface_tot: 3.5,
      densite_min: null,
      densite_max: null,
      densite_moy: null,
      interdistance: null,
      comportement: 'deplacement',
      direction_de: null,
      direction_vers: 'N',
      vent_de: null,
      vent_vitesse: null,
    };

    expect(buildInfestationSynthese([infestation])).toEqual({
      hasInfestation: true,
      typeLabel: 'Essaim',
      surfaceTot: 3.5,
      comportementLabel: 'Déplacement',
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
