import {
  accouplementOuPonteActif,
  createEmptySpeciesData,
  createEmptyLarveSpeciesData,
  speciesDataToPopulationRow,
  populationRowToSpeciesData,
  larveSpeciesDataToPopulationRow,
  populationRowToLarveSpeciesData,
  imagoTotalFromRow,
  larveTotalFromRow,
  calculerDureeMinutes,
  formatDuree,
  HEURE_STRICTE_RE,
  IMAGO_PHASE_ROWS,
  LARVE_PHASE_ROWS,
} from '../src/lib/prospection-extensive';

// #interdistance-obligatoire-si-accouplement-ou-ponte : l'interdistance (imagos,
// Intensif comme Extensif/Signalement) n'a de sens que si un accouplement OU une
// ponte a été observé.
describe('accouplementOuPonteActif', () => {
  it('faux quand les deux valent « Néant »', () => {
    expect(accouplementOuPonteActif('Néant', 'Néant')).toBe(false);
  });

  it('faux quand les deux sont non renseignés (null)', () => {
    expect(accouplementOuPonteActif(null, null)).toBe(false);
  });

  it('faux pour un mélange Néant / non renseigné', () => {
    expect(accouplementOuPonteActif('Néant', null)).toBe(false);
    expect(accouplementOuPonteActif(null, 'Néant')).toBe(false);
  });

  it('vrai dès que l’accouplement est « Rare » ou « Beaucoup », même si la ponte est Néant/non renseignée', () => {
    expect(accouplementOuPonteActif('Rare', 'Néant')).toBe(true);
    expect(accouplementOuPonteActif('Beaucoup', null)).toBe(true);
  });

  it('vrai dès que la ponte est « Rare » ou « Beaucoup », même si l’accouplement est Néant/non renseigné', () => {
    expect(accouplementOuPonteActif('Néant', 'Rare')).toBe(true);
    expect(accouplementOuPonteActif(null, 'Beaucoup')).toBe(true);
  });

  it('vrai quand les deux sont actifs', () => {
    expect(accouplementOuPonteActif('Rare', 'Beaucoup')).toBe(true);
  });
});

// #phase-ordre-affichage : Solitaire → Solitaro-Transiens → Transiens → Grégaire
// (écrans extensive-imagos.tsx / extensive-larves.tsx, Prospection Extensive).
describe('IMAGO_PHASE_ROWS / LARVE_PHASE_ROWS — ordre d’affichage du champ Phase', () => {
  it('IMAGO_PHASE_ROWS : Solitaire, Solitaro-Transiens, Transiens, Grégaire', () => {
    expect(IMAGO_PHASE_ROWS.map((row) => row.label)).toEqual([
      'Solitaire',
      'Solitaro-Transiens',
      'Transiens',
      'Grégaire',
    ]);
  });

  it('LARVE_PHASE_ROWS (sans Solitaro-Transiens) : Solitaire, Transiens, Grégaire', () => {
    expect(LARVE_PHASE_ROWS.map((row) => row.label)).toEqual(['Solitaire', 'Transiens', 'Grégaire']);
  });
});

describe('calculerDureeMinutes (mode aérien)', () => {
  it('calcule une durée simple dans la même journée', () => {
    expect(calculerDureeMinutes('08:00', '10:30')).toBe(150);
  });

  it('franchit minuit sans passer en négatif (23:00 → 01:15 = 135 min, pas -1305)', () => {
    expect(calculerDureeMinutes('23:00', '01:15')).toBe(135);
  });

  it('début = fin donne une durée nulle', () => {
    expect(calculerDureeMinutes('12:00', '12:00')).toBe(0);
  });

  it('reste cohérent avec le même calcul appliqué côté backend (_calculer_duree_minutes)', () => {
    // Même exemple que le test backend test_create_prospection_extensive_mode_aerien —
    // les deux implémentations doivent converger sur la même valeur.
    expect(calculerDureeMinutes('08:00', '10:30')).toBe(150);
    expect(calculerDureeMinutes('23:00', '01:15')).toBe(135);
  });
});

describe('formatDuree', () => {
  it('formate en HH:MM avec zéros de tête', () => {
    expect(formatDuree(150)).toBe('02:30');
    expect(formatDuree(5)).toBe('00:05');
    expect(formatDuree(0)).toBe('00:00');
  });
});

describe('HEURE_STRICTE_RE', () => {
  it.each(['08:30', '00:00', '23:59'])('accepte %s', (valeur) => {
    expect(HEURE_STRICTE_RE.test(valeur)).toBe(true);
  });

  it.each(['8:30', '8h30', '24:00', '12:60', 'abc', ''])('rejette %s', (valeur) => {
    expect(HEURE_STRICTE_RE.test(valeur)).toBe(false);
  });
});

describe('createEmptySpeciesData (imago)', () => {
  it('démarre à zéro, sans espèce/état/type de cible choisis (#type-cible-multi-select)', () => {
    const data = createEmptySpeciesData();
    expect(data.totalCaptures).toBe(0);
    expect(data.typeCible).toEqual([]);
    expect(data.etat).toBeNull();
    expect(data.comportementEssaim).toBeNull();
    expect(data.accouplement).toBeNull();
    expect(data.ponte).toBeNull();
  });
});

describe('createEmptyLarveSpeciesData', () => {
  it('initialise les stades LMC sur L1-L5', () => {
    const data = createEmptyLarveSpeciesData('LMC');
    expect(Object.keys(data.stades)).toEqual(['L1', 'L2', 'L3', 'L4', 'L5']);
    expect(data.deplacement).toBe('repos');
    expect(data.tacheLarvaire).toBe(false);
  });

  it('initialise les stades NSE sur L1-L7', () => {
    const data = createEmptyLarveSpeciesData('NSE');
    expect(Object.keys(data.stades)).toEqual(['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7']);
  });
});

describe('speciesDataToPopulationRow / populationRowToSpeciesData — round-trip imago', () => {
  it('conserve le nombre de captures — non-régression #227 (« la valeur ne doit jamais disparaître »)', () => {
    const data = { ...createEmptySpeciesData(), totalCaptures: 25 };
    const row = speciesDataToPopulationRow('LMC', data);
    expect(row.captures_nombre).toBe(25);

    const restored = populationRowToSpeciesData(row);
    expect(restored.totalCaptures).toBe(25);
  });

  it('conserve la 4e phase « Solitaro-Transiens » — non-régression #227 (colonne existante jamais alimentée)', () => {
    const data = {
      ...createEmptySpeciesData(),
      totalCaptures: 10,
      phases: { solitaire: 2, transiens: 3, solitaroTransiens: 4, gregaire: 1 },
    };
    const row = speciesDataToPopulationRow('NSE', data);
    expect(row.captures_solitaro_transiens).toBe(4);

    const restored = populationRowToSpeciesData(row);
    expect(restored.phases.solitaroTransiens).toBe(4);
    expect(restored.phases.solitaire).toBe(2);
    expect(restored.phases.transiens).toBe(3);
    expect(restored.phases.gregaire).toBe(1);
  });

  /**
   * #stades-imago-persistance : la répartition par sexe/sous-stade (femelleA1…
   * femelleA5, maleA1, maleA234, maleA5) n'était persistée nulle part — le
   * récapitulatif affichait un message d'indisponibilité au lieu de la vraie saisie,
   * quelle que soit la valeur enregistrée. Même principe de non-régression que
   * « Solitaro-Transiens » ci-dessus.
   */
  it('conserve la répartition par sexe/sous-stade (stades_imago) — #stades-imago-persistance', () => {
    const data = {
      ...createEmptySpeciesData(),
      totalCaptures: 10,
      stades: {
        ...createEmptySpeciesData().stades,
        femelleA1: 3,
        femelleA3_1_2: 2,
        maleA234: 5,
      },
    };
    const row = speciesDataToPopulationRow('LMC', data);
    expect(row.stades_imago).toBe(JSON.stringify(data.stades));

    const restored = populationRowToSpeciesData(row);
    expect(restored.stades.femelleA1).toBe(3);
    expect(restored.stades.femelleA3_1_2).toBe(2);
    expect(restored.stades.maleA234).toBe(5);
    expect(restored.stades.femelleA2).toBe(0);
  });

  it('populationRowToSpeciesData restaure des stades à zéro pour une fiche enregistrée avant #stades-imago-persistance (stades_imago = null)', () => {
    const data = { ...createEmptySpeciesData(), totalCaptures: 10, phases: { solitaire: 10, transiens: 0, solitaroTransiens: 0, gregaire: 0 } };
    const row = speciesDataToPopulationRow('LMC', data);
    row.stades_imago = null; // simule une ligne existante, jamais réenregistrée depuis ce correctif

    const restored = populationRowToSpeciesData(row);
    expect(restored.stades).toEqual(createEmptySpeciesData().stades);
    // Le reste de la ligne (dont le nombre de captures) reste, lui, bien restauré.
    expect(restored.totalCaptures).toBe(10);
  });

  it('conserve accouplement, ponte, interdistance, type de cible, état, comportement et direction', () => {
    const data = {
      ...createEmptySpeciesData(),
      accouplement: 'Rare',
      ponte: 'Beaucoup',
      interdistance: '25.5',
      typeCible: ['tres_dense' as const],
      etat: 'deplacement' as const,
      comportementEssaim: 'vol' as const,
      directionDe: 'Nord',
      directionVers: 'Sud',
    };
    const row = speciesDataToPopulationRow('LMC', data);
    expect(row.accouplement).toBe('Rare');
    expect(row.ponte).toBe('Beaucoup');
    expect(row.interdistance).toBe(25.5);
    expect(row.type_cible).toBe('["tres_dense"]');
    expect(row.etat).toBe('deplacement');
    expect(row.essaim_en_vol).toBe(true);
    expect(row.essaim_pose).toBe(false);
    expect(row.direction_de).toBe('Nord');
    expect(row.direction_vers).toBe('Sud');

    const restored = populationRowToSpeciesData(row);
    expect(restored.accouplement).toBe('Rare');
    expect(restored.ponte).toBe('Beaucoup');
    expect(restored.interdistance).toBe('25.5');
    expect(restored.typeCible).toEqual(['tres_dense']);
    expect(restored.etat).toBe('deplacement');
    expect(restored.comportementEssaim).toBe('vol');
    expect(restored.directionDe).toBe('Nord');
    expect(restored.directionVers).toBe('Sud');
  });

  it('populationRowToSpeciesData renvoie des données vides si row est null', () => {
    expect(populationRowToSpeciesData(null)).toEqual(createEmptySpeciesData());
  });

  it('populationRowToSpeciesData ne plante pas sur un stades_imago pré-JSON (ancien brouillon) — rapport ifvm-debug-1789630807888', () => {
    const data = { ...createEmptySpeciesData(), totalCaptures: 7 };
    const row = speciesDataToPopulationRow('LMC', data);
    row.stades_imago = 'moyenne'; // valeur scalaire d'avant #stades-imago-persistance, pas du JSON

    const restored = populationRowToSpeciesData(row);
    expect(restored.stades).toEqual(createEmptySpeciesData().stades);
    expect(restored.totalCaptures).toBe(7);
  });
});

describe('larveSpeciesDataToPopulationRow / populationRowToLarveSpeciesData — round-trip larve', () => {
  it('conserve le nombre de captures et les stades par espèce', () => {
    const data = {
      ...createEmptyLarveSpeciesData('NSE'),
      totalCaptures: 35,
      stades: { ...createEmptyLarveSpeciesData('NSE').stades, L3: 31, L5: 4 },
    };
    const row = larveSpeciesDataToPopulationRow('NSE', data);
    expect(row.captures_nombre).toBe(35);
    expect(JSON.parse(row.densites_larve as string).L3).toBe(31);

    const restored = populationRowToLarveSpeciesData('NSE', row);
    expect(restored.totalCaptures).toBe(35);
    expect(restored.stades.L3).toBe(31);
    expect(restored.stades.L5).toBe(4);
  });

  it('conserve tache/bande larvaire, interdistance, déplacement et surface contaminée — par espèce, non-régression #226', () => {
    const dataLmc = {
      ...createEmptyLarveSpeciesData('LMC'),
      tacheLarvaire: true,
      bandeLarvaire: false,
      interdistance: '0.6',
      deplacement: 'deplacement',
      surfaceContamineeHa: '12.75',
    };
    const dataNse = { ...createEmptyLarveSpeciesData('NSE'), interdistance: '3.2', surfaceContamineeHa: '0.5' };

    const rowLmc = larveSpeciesDataToPopulationRow('LMC', dataLmc);
    const rowNse = larveSpeciesDataToPopulationRow('NSE', dataNse);

    expect(rowLmc.tache_larvaire).toBe(true);
    expect(rowLmc.interdistance).toBe(0.6);
    expect(rowLmc.deplacement).toBe('deplacement');
    expect(rowLmc.surface_contaminee_ha).toBe(12.75);

    // LMC et NSE ne doivent jamais partager ces valeurs (bug corrigé : elles étaient
    // jusqu'ici un unique état partagé entre les deux espèces sur extensive-larves.tsx).
    expect(rowNse.tache_larvaire).toBe(false);
    expect(rowNse.interdistance).toBe(3.2);
    expect(rowNse.deplacement).toBe('repos');
    expect(rowNse.surface_contaminee_ha).toBe(0.5);

    const restoredLmc = populationRowToLarveSpeciesData('LMC', rowLmc);
    const restoredNse = populationRowToLarveSpeciesData('NSE', rowNse);
    expect(restoredLmc.tacheLarvaire).toBe(true);
    expect(restoredLmc.surfaceContamineeHa).toBe('12.75');
    expect(restoredNse.tacheLarvaire).toBe(false);
    expect(restoredNse.surfaceContamineeHa).toBe('0.5');
  });

  it('populationRowToLarveSpeciesData renvoie des données vides (par espèce) si row est null', () => {
    expect(populationRowToLarveSpeciesData('LMC', null)).toEqual(createEmptyLarveSpeciesData('LMC'));
  });

  it('populationRowToLarveSpeciesData ne plante pas sur un densites_larve pré-JSON (ancien brouillon) — rapport ifvm-debug-1789630807888', () => {
    const data = { ...createEmptyLarveSpeciesData('NSE'), totalCaptures: 12 };
    const row = larveSpeciesDataToPopulationRow('NSE', data);
    row.densites_larve = 'Larve'; // valeur scalaire d'avant le passage en JSON, pas du JSON valide

    const restored = populationRowToLarveSpeciesData('NSE', row);
    expect(restored.stades).toEqual(createEmptyLarveSpeciesData('NSE').stades);
    expect(restored.totalCaptures).toBe(12);
  });
});

describe('imagoTotalFromRow / larveTotalFromRow', () => {
  it('additionne sol/trans/solitaro-trans/greg directement depuis la ligne persistée', () => {
    const row = speciesDataToPopulationRow('LMC', {
      ...createEmptySpeciesData(),
      totalCaptures: 19,
      phases: { solitaire: 3, transiens: 14, solitaroTransiens: 0, gregaire: 2 },
    });
    expect(imagoTotalFromRow(row)).toBe(19);
  });

  it('renvoie 0 si la ligne imago est absente', () => {
    expect(imagoTotalFromRow(null)).toBe(0);
  });

  it('additionne les stades directement depuis la ligne persistée', () => {
    const data = {
      ...createEmptyLarveSpeciesData('NSE'),
      stades: { ...createEmptyLarveSpeciesData('NSE').stades, L3: 31, L5: 4 },
    };
    const row = larveSpeciesDataToPopulationRow('NSE', data);
    expect(larveTotalFromRow(row)).toBe(35);
  });

  it('renvoie 0 si la ligne larve est absente', () => {
    expect(larveTotalFromRow(null)).toBe(0);
  });
});
