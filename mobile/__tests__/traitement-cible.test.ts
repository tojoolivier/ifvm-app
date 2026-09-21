/**
 * construireCible() reproduit construire_cible() (backend/app/domain/traitement.py) —
 * mêmes scénarios que test_traitement_domain.py::test_cible_*, pour garantir que le
 * snapshot affiché hors-ligne (cibles.tsx) coïncide avec ce que le backend recalculera
 * à la synchronisation.
 */
import { construireCible, construireDetailPhaseStade } from '@/lib/traitement-cible';
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

// Intensif : `type_prospection` neutre (ni "extensive" ni "validation"), même
// comportement "non renseigné" qu'avant #cible-extensif-signalement-defauts-zero.
// Voir le describe dédié plus bas pour Extensif/Signalement (défauts à 0).
const PROSPECTION_INTENSIVE = { type_prospection: 'intensive' } as const;

describe('construireCible', () => {
  it('renvoie tout à null quand la prospection est vide', () => {
    expect(construireCible({ surface_infestee: null, ...PROSPECTION_INTENSIVE }, [], [])).toEqual({
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
    const cible = construireCible({ surface_infestee: null, ...PROSPECTION_INTENSIVE }, [population({ espece: 'LMC' })], []);
    expect(cible.espece).toBe('LMC');
  });

  it('renvoie MELANGE quand deux espèces sont présentes', () => {
    const cible = construireCible(
      { surface_infestee: null, ...PROSPECTION_INTENSIVE },
      [population({ espece: 'LMC', categorie: 'imago' }), population({ espece: 'NSE', categorie: 'larve' })],
      []
    );
    expect(cible.espece).toBe('MELANGE');
  });

  it('reprend aussi les espèces des infestations', () => {
    const cible = construireCible({ surface_infestee: null, ...PROSPECTION_INTENSIVE }, [], [infestation({ espece: 'LMC' })]);
    expect(cible.espece).toBe('LMC');
  });

  it('cumule les densités L1 à L3 en petites larves et le reste en grandes larves', () => {
    const cible = construireCible(
      { surface_infestee: null, ...PROSPECTION_INTENSIVE },
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
      { surface_infestee: null, ...PROSPECTION_INTENSIVE },
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
      { surface_infestee: null, ...PROSPECTION_INTENSIVE },
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
      { surface_infestee: null, ...PROSPECTION_INTENSIVE },
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
      { surface_infestee: null, ...PROSPECTION_INTENSIVE },
      [population({ espece: 'NSE', categorie: 'larve', densites_larve: JSON.stringify({ L1: 2 }) })],
      [],
      [capture({ espece: 'NSE', stade: 'L1', effectif: 5 })]
    );
    expect(cible.petites_larves_nse).toBe(7);
  });

  it('détaille les densités diffuse/groupée par espèce, cumulées sur les lignes imago + larve', () => {
    const cible = construireCible(
      { surface_infestee: null, ...PROSPECTION_INTENSIVE },
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
    const cible = construireCible({ surface_infestee: null, ...PROSPECTION_INTENSIVE }, [population({ categorie: 'larve', densites_larve: null })], []);
    expect(cible.petites_larves).toBeNull();
    expect(cible.grandes_larves).toBeNull();
  });

  it('vols_clairs_essaims = 1 dès qu’une population a essaim_observe=true', () => {
    const cible = construireCible(
      { surface_infestee: null, ...PROSPECTION_INTENSIVE },
      [population({ essaim_observe: false }), population({ essaim_observe: true })],
      []
    );
    expect(cible.vols_clairs_essaims).toBe(1);
  });

  it('vols_clairs_essaims = 0 quand renseigné mais jamais à true', () => {
    const cible = construireCible({ surface_infestee: null, ...PROSPECTION_INTENSIVE }, [population({ essaim_observe: false })], []);
    expect(cible.vols_clairs_essaims).toBe(0);
  });

  it('vols_clairs_essaims = null quand jamais renseigné', () => {
    const cible = construireCible({ surface_infestee: null, ...PROSPECTION_INTENSIVE }, [population({ essaim_observe: null })], []);
    expect(cible.vols_clairs_essaims).toBeNull();
  });

  it('vols_clairs_essaims = 1 pour une population Extensif Imagos (essaim_en_vol, migration 0033 — essaim_observe non renseigné)', () => {
    const cible = construireCible(
      { surface_infestee: null, ...PROSPECTION_INTENSIVE },
      [population({ essaim_observe: null, essaim_en_vol: true, essaim_pose: false })],
      []
    );
    expect(cible.vols_clairs_essaims).toBe(1);
  });

  it('vols_clairs_essaims = 1 pour une population Extensif Imagos (essaim_pose, migration 0033)', () => {
    const cible = construireCible(
      { surface_infestee: null, ...PROSPECTION_INTENSIVE },
      [population({ essaim_observe: null, essaim_en_vol: false, essaim_pose: true })],
      []
    );
    expect(cible.vols_clairs_essaims).toBe(1);
  });

  it('vols_clairs_essaims = null quand essaim_observe et essaim_en_vol/pose sont tous non renseignés (Extensif Imagos sans État sélectionné)', () => {
    const cible = construireCible(
      { surface_infestee: null, ...PROSPECTION_INTENSIVE },
      [population({ essaim_observe: null, essaim_en_vol: null, essaim_pose: null })],
      []
    );
    expect(cible.vols_clairs_essaims).toBeNull();
  });

  it('répartition groupée prioritaire sur diffuse', () => {
    const cible = construireCible(
      { surface_infestee: null, ...PROSPECTION_INTENSIVE },
      [population({ densite_diffuse: 1.0, densite_groupee: 2.0 })],
      []
    );
    expect(cible.repartition_population).toBe('GROUPEE');
  });

  it('répartition diffuse si aucune densité groupée', () => {
    const cible = construireCible({ surface_infestee: null, ...PROSPECTION_INTENSIVE }, [population({ densite_diffuse: 1.0 })], []);
    expect(cible.repartition_population).toBe('DIFFUSE');
  });

  it('reprend la surface infestée telle quelle', () => {
    const cible = construireCible({ surface_infestee: 42.5, ...PROSPECTION_INTENSIVE }, [], []);
    expect(cible.surface_infestee_ha).toBe(42.5);
  });
});

/**
 * #cible-extensif-signalement-defauts-zero : Extensif et Signalement
 * ("validation") — une prospection validée y est toujours conclusive (y
 * compris "rien trouvé", résultat légitime et fréquent) : les champs sans
 * donnée y prennent un défaut neutre (0, "non" pour vols_clairs_essaims,
 * "DIFFUSE") plutôt que `null`, contrairement à l'Intensif ci-dessus.
 */
describe.each(['extensive', 'validation'] as const)(
  'construireCible — défauts à 0 (type_prospection=%s)',
  (type_prospection) => {
    it('prospection réellement vide (rien trouvé) : totaux agrégés à 0/"non"/"DIFFUSE", détail par espèce à null (ni LMC ni NSE jamais mentionnée)', () => {
      const cible = construireCible({ surface_infestee: null, type_prospection }, [], []);
      expect(cible.espece).toBeNull();
      expect(cible.petites_larves).toBe(0);
      expect(cible.grandes_larves).toBe(0);
      expect(cible.petites_larves_lmc).toBeNull();
      expect(cible.petites_larves_nse).toBeNull();
      expect(cible.grandes_larves_lmc).toBeNull();
      expect(cible.grandes_larves_nse).toBeNull();
      expect(cible.densite_diffuse_lmc).toBeNull();
      expect(cible.densite_groupee_lmc).toBeNull();
      expect(cible.densite_diffuse_nse).toBeNull();
      expect(cible.densite_groupee_nse).toBeNull();
      expect(cible.vols_clairs_essaims).toBe(0);
      expect(cible.repartition_population).toBe('DIFFUSE');
      expect(cible.surface_infestee_ha).toBe(0);
    });

    it('surface infestée déjà renseignée : pas écrasée par le défaut', () => {
      const cible = construireCible({ surface_infestee: 42.5, type_prospection }, [], []);
      expect(cible.surface_infestee_ha).toBe(42.5);
    });

    it('LMC en scope (une ligne la mentionne) : son détail passe à 0/absent, NSE (jamais mentionnée) reste à null', () => {
      const cible = construireCible(
        { surface_infestee: null, type_prospection },
        [population({ espece: 'LMC', categorie: 'larve', densites_larve: JSON.stringify({ L1: 10 }) })],
        []
      );
      expect(cible.petites_larves_lmc).toBe(10);
      expect(cible.petites_larves_nse).toBeNull();
      expect(cible.grandes_larves_nse).toBeNull();
    });

    it('LMC en scope sans densité larvaire précise (ligne imago) : son détail larvaire/densités passe à 0, pas à null', () => {
      const cible = construireCible(
        { surface_infestee: null, type_prospection },
        [population({ espece: 'LMC', categorie: 'imago' })],
        []
      );
      expect(cible.petites_larves_lmc).toBe(0);
      expect(cible.grandes_larves_lmc).toBe(0);
      expect(cible.densite_diffuse_lmc).toBe(0);
      expect(cible.densite_groupee_lmc).toBe(0);
      expect(cible.petites_larves_nse).toBeNull();
      expect(cible.densite_diffuse_nse).toBeNull();
    });
  }
);

/**
 * construireDetailPhaseStade() — écran Cibles (Terrestre), lu EN DIRECT à chaque
 * visite (#cibles-phase-stade-en-direct), contrairement à construireCible()
 * ci-dessus (snapshot figé). Toujours 4 groupes (LMC/NSE × Imagos/Larves), même
 * quand aucune donnée n'est disponible pour un groupe.
 */
describe('construireDetailPhaseStade', () => {
  it('renvoie les 4 groupes vides quand la prospection est vide', () => {
    const groupes = construireDetailPhaseStade([], []);
    expect(groupes.map((g) => g.label)).toEqual(['LMC Imagos', 'LMC Larves', 'NSE Imagos', 'NSE Larves']);
    for (const g of groupes) {
      expect(g.phases).toEqual([]);
      expect(g.stades).toEqual([]);
    }
  });

  it('dérive Phase et Stade imago Extensif depuis les colonnes scalaires et stades_imago (JSON)', () => {
    const groupes = construireDetailPhaseStade(
      [
        population({
          espece: 'LMC',
          categorie: 'imago',
          captures_sol: 5,
          captures_trans: 0,
          captures_greg: 2,
          captures_solitaro_transiens: 0,
          stades_imago: JSON.stringify({ femelleA1: 3, maleA1: 4, femelleA2: 0 }),
        }),
      ],
      []
    );
    const lmcImagos = groupes.find((g) => g.label === 'LMC Imagos')!;
    expect(lmcImagos.phases).toEqual([
      { label: 'Solitaire', value: 5 },
      { label: 'Grégaire', value: 2 },
    ]);
    // femelleA2 à 0 est exclu, comme extensive-recap.tsx (nonZero).
    expect(lmcImagos.stades).toEqual([
      { label: 'femelleA1', value: 3 },
      { label: 'maleA1', value: 4 },
    ]);
  });

  it("n'a pas de notion de phase pour les larves Extensif (jamais saisie) — seul le Stade est renseigné", () => {
    const groupes = construireDetailPhaseStade(
      [
        population({
          espece: 'NSE',
          categorie: 'larve',
          densites_larve: JSON.stringify({ L1: 10, L4: 3 }),
        }),
      ],
      []
    );
    const nseLarves = groupes.find((g) => g.label === 'NSE Larves')!;
    expect(nseLarves.phases).toEqual([]);
    expect(nseLarves.stades).toEqual([
      { label: 'L1', value: 10 },
      { label: 'L4', value: 3 },
    ]);
  });

  it('dérive Phase ET Stade Intensif depuis des lignes CaptureRow, cumulées par code', () => {
    const groupes = construireDetailPhaseStade(
      [],
      [
        capture({ espece: 'NSE', categorie: 'larve', phase: 'gregaire', stade: 'L2', effectif: 6 }),
        capture({ espece: 'NSE', categorie: 'larve', phase: 'gregaire', stade: 'L3', effectif: 4 }),
      ]
    );
    const nseLarves = groupes.find((g) => g.label === 'NSE Larves')!;
    expect(nseLarves.phases).toEqual([{ label: 'Grégaire', value: 10 }]);
    expect(nseLarves.stades).toEqual([
      { label: 'L2', value: 6 },
      { label: 'L3', value: 4 },
    ]);
  });

  it('additionne une population Extensif et des captures Intensif sans les faire s’écraser (garde-fou défensif)', () => {
    const groupes = construireDetailPhaseStade(
      [population({ espece: 'LMC', categorie: 'imago', captures_sol: 5 })],
      [capture({ espece: 'LMC', categorie: 'imago', phase: 'solitaire', stade: 'A1', effectif: 3 })]
    );
    const lmcImagos = groupes.find((g) => g.label === 'LMC Imagos')!;
    expect(lmcImagos.phases).toEqual([{ label: 'Solitaire', value: 8 }]);
  });
});
