/**
 * construireCible() reproduit construire_cible() (backend/app/domain/traitement.py) —
 * mêmes scénarios que test_traitement_domain.py::test_cible_*, pour garantir que le
 * snapshot affiché hors-ligne (cibles.tsx) coïncide avec ce que le backend recalculera
 * à la synchronisation.
 */
import { construireCible } from '@/lib/traitement-cible';
import { CaptureRow, InfestationRow, PopulationRow } from '@/lib/prospection-repository';

function population(overrides: Partial<PopulationRow>): PopulationRow {
  return {
    espece: 'LMC',
    categorie: 'imago',
    densite_diffuse: null,
    densite_groupee: null,
    methode: null,
    accouplement: null,
    ponte: null,
    ...overrides,
  };
}

function capture(overrides: Partial<CaptureRow>): CaptureRow {
  return {
    espece: 'LMC',
    categorie: 'larve',
    sexe: null,
    phase: 'gregaire',
    stade: 'L1',
    effectif: 0,
    ...overrides,
  };
}

function infestation(overrides: Partial<InfestationRow>): InfestationRow {
  return {
    espece: null,
    type_cible: 'vol_clair',
    taille_min: null,
    taille_max: null,
    taille_moy: null,
    surface_totale: null,
    densite_min: null,
    densite_max: null,
    densite_moy: null,
    interdistance: null,
    comportement: null,
    direction_de: null,
    direction_vers: null,
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
    interdistance_min: null,
    interdistance_max: null,
    interdistance_moy: null,
    surface_contaminee_ha: null,
    type_larve: null,
    surface_infestee_pourcent: null,
    stade_dominant: null,
    taille_groupe_m2: null,
    ...overrides,
  } as InfestationRow;
}

describe('construireCible', () => {
  it('renvoie tout à null quand la prospection est vide', () => {
    expect(construireCible({ surface_infestee: null }, [], [])).toEqual({
      espece: null,
      petites_larves: null,
      grandes_larves: null,
      vols_clairs_essaims: null,
      repartition_population: null,
      surface_infestee_ha: null,
      petites_larves_lmc: null,
      petites_larves_nse: null,
      grandes_larves_lmc: null,
      grandes_larves_nse: null,
      densite_diffuse_lmc: null,
      densite_groupee_lmc: null,
      densite_diffuse_nse: null,
      densite_groupee_nse: null,
    });
  });

  it('reprend l’espèce unique des populations', () => {
    const cible = construireCible({ surface_infestee: null }, [population({ espece: 'LMC' })], []);
    expect(cible.espece).toBe('LMC');
  });

  it('renvoie MELANGE quand deux espèces sont présentes', () => {
    const cible = construireCible(
      { surface_infestee: null },
      [population({ espece: 'LMC', categorie: 'imago' }), population({ espece: 'NSE', categorie: 'larve' })],
      []
    );
    expect(cible.espece).toBe('MELANGE');
  });

  it('reprend aussi les espèces des infestations', () => {
    const cible = construireCible({ surface_infestee: null }, [], [infestation({ espece: 'LMC' })]);
    expect(cible.espece).toBe('LMC');
  });

  it('cumule les densités L1 à L3 en petites larves et le reste en grandes larves', () => {
    const cible = construireCible(
      { surface_infestee: null },
      [
        population({
          espece: 'LMC',
          categorie: 'larve',
          densites_larve: JSON.stringify({ L1: 10, L2: 5, L3: 7, L5: 3 }),
        }),
      ],
      []
    );
    expect(cible.petites_larves).toBe(22);
    expect(cible.grandes_larves).toBe(3);
  });

  it('détaille les petites/grandes larves par espèce (LMC et NSE séparément)', () => {
    const cible = construireCible(
      { surface_infestee: null },
      [
        population({
          espece: 'LMC',
          categorie: 'larve',
          densites_larve: JSON.stringify({ L1: 10, L2: 5, L3: 7, L5: 3 }),
        }),
        population({
          espece: 'NSE',
          categorie: 'larve',
          densites_larve: JSON.stringify({ L1: 2, L4: 1, L7: 4 }),
        }),
      ],
      []
    );
    expect(cible.petites_larves_lmc).toBe(22);
    expect(cible.grandes_larves_lmc).toBe(3);
    expect(cible.petites_larves_nse).toBe(2);
    expect(cible.grandes_larves_nse).toBe(5);
    // Totaux agrégés (écran Cibles, Terrestre) inchangés : somme des 2 espèces.
    expect(cible.petites_larves).toBe(24);
    expect(cible.grandes_larves).toBe(8);
  });

  it('laisse à null le détail larvaire d’une espèce absente de la prospection', () => {
    const cible = construireCible(
      { surface_infestee: null },
      [population({ espece: 'LMC', categorie: 'larve', densites_larve: JSON.stringify({ L1: 10 }) })],
      []
    );
    expect(cible.petites_larves_lmc).toBe(10);
    expect(cible.petites_larves_nse).toBeNull();
    expect(cible.grandes_larves_nse).toBeNull();
  });

  it('dérive les petites/grandes larves depuis ProspectionCapture (Intensif, #cible-intensif-larves-non-renseigne)', () => {
    // Intensif (fusion des écrans B/C, intensive-imagos.tsx/intensive-larves.tsx) :
    // les effectifs larvaires par stade sont posés sur des lignes CaptureRow, pas
    // sur densites_larve (propre à l'Extensif) — avant ce correctif, "Cibles"/
    // "Synthèse" affichaient toujours "non renseigné" pour ces fiches.
    const cible = construireCible(
      { surface_infestee: null },
      [],
      [],
      [
        capture({ espece: 'LMC', stade: 'L1', effectif: 10 }),
        capture({ espece: 'LMC', stade: 'L5', effectif: 3 }),
        // Une capture imago ne doit jamais être comptée comme larve.
        capture({ espece: 'LMC', categorie: 'imago', stade: 'F', effectif: 99 }),
      ]
    );
    expect(cible.petites_larves).toBe(10);
    expect(cible.grandes_larves).toBe(3);
    expect(cible.petites_larves_lmc).toBe(10);
    expect(cible.grandes_larves_lmc).toBe(3);
    expect(cible.petites_larves_nse).toBeNull();
  });

  it('cumule densites_larve et ProspectionCapture sans les faire s’écraser l’un l’autre', () => {
    // Les deux sources ne se recouvrent jamais pour une même prospection
    // (l'Extensif n'écrit jamais dans prospection_capture, l'Intensif jamais
    // dans densites_larve) : garde-fou défensif, pas un scénario réel.
    const cible = construireCible(
      { surface_infestee: null },
      [population({ espece: 'NSE', categorie: 'larve', densites_larve: JSON.stringify({ L1: 2 }) })],
      [],
      [capture({ espece: 'NSE', stade: 'L1', effectif: 5 })]
    );
    expect(cible.petites_larves_nse).toBe(7);
  });

  it('détaille les densités diffuse/groupée par espèce, cumulées sur les lignes imago + larve', () => {
    const cible = construireCible(
      { surface_infestee: null },
      [
        population({ espece: 'LMC', categorie: 'imago', densite_diffuse: 12, densite_groupee: 3 }),
        population({ espece: 'LMC', categorie: 'larve', densite_diffuse: 8 }),
        population({ espece: 'NSE', categorie: 'imago', densite_diffuse: 5 }),
      ],
      []
    );
    expect(cible.densite_diffuse_lmc).toBe(20);
    expect(cible.densite_groupee_lmc).toBe(3);
    expect(cible.densite_diffuse_nse).toBe(5);
    expect(cible.densite_groupee_nse).toBeNull();
  });

  it('ne renseigne ni petites ni grandes larves si aucune densité larvaire', () => {
    const cible = construireCible({ surface_infestee: null }, [population({ categorie: 'larve', densites_larve: null })], []);
    expect(cible.petites_larves).toBeNull();
    expect(cible.grandes_larves).toBeNull();
  });

  it('vols_clairs_essaims = 1 dès qu’une population a essaim_observe=true', () => {
    const cible = construireCible(
      { surface_infestee: null },
      [population({ essaim_observe: false }), population({ essaim_observe: true })],
      []
    );
    expect(cible.vols_clairs_essaims).toBe(1);
  });

  it('vols_clairs_essaims = 0 quand renseigné mais jamais à true', () => {
    const cible = construireCible({ surface_infestee: null }, [population({ essaim_observe: false })], []);
    expect(cible.vols_clairs_essaims).toBe(0);
  });

  it('vols_clairs_essaims = null quand jamais renseigné', () => {
    const cible = construireCible({ surface_infestee: null }, [population({ essaim_observe: null })], []);
    expect(cible.vols_clairs_essaims).toBeNull();
  });

  it('vols_clairs_essaims = 1 pour une population Extensif Imagos (essaim_en_vol, migration 0033 — essaim_observe non renseigné)', () => {
    const cible = construireCible(
      { surface_infestee: null },
      [population({ essaim_observe: null, essaim_en_vol: true, essaim_pose: false })],
      []
    );
    expect(cible.vols_clairs_essaims).toBe(1);
  });

  it('vols_clairs_essaims = 1 pour une population Extensif Imagos (essaim_pose, migration 0033)', () => {
    const cible = construireCible(
      { surface_infestee: null },
      [population({ essaim_observe: null, essaim_en_vol: false, essaim_pose: true })],
      []
    );
    expect(cible.vols_clairs_essaims).toBe(1);
  });

  it('vols_clairs_essaims = null quand essaim_observe et essaim_en_vol/pose sont tous non renseignés (Extensif Imagos sans État sélectionné)', () => {
    const cible = construireCible(
      { surface_infestee: null },
      [population({ essaim_observe: null, essaim_en_vol: null, essaim_pose: null })],
      []
    );
    expect(cible.vols_clairs_essaims).toBeNull();
  });

  it('répartition groupée prioritaire sur diffuse', () => {
    const cible = construireCible(
      { surface_infestee: null },
      [population({ densite_diffuse: 1.0, densite_groupee: 2.0 })],
      []
    );
    expect(cible.repartition_population).toBe('GROUPEE');
  });

  it('répartition diffuse si aucune densité groupée', () => {
    const cible = construireCible({ surface_infestee: null }, [population({ densite_diffuse: 1.0 })], []);
    expect(cible.repartition_population).toBe('DIFFUSE');
  });

  it('reprend la surface infestée telle quelle', () => {
    const cible = construireCible({ surface_infestee: 42.5 }, [], []);
    expect(cible.surface_infestee_ha).toBe(42.5);
  });
});
