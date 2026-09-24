import {
  computeNbRotations,
  computeTotalPesticideAerienParUnite,
  computeSurfaceTraiteeAerien,
  computeDureesRotation,
  formatDureeRotation,
  computeTotalPesticideTerrestre,
  computeSurfaceTraitee,
  computeSurfaceCumulee,
  computeSurfaceRestante,
  computePesticideStockRestant,
  computePesticideConsommeSuggere,
  validateReferences,
  validateTerrestreConditions,
  validateRotationsHeures,
  messagesOrdreHeuresRotation,
  validateRecouvrement,
  validateEmpoisonnement,
  validateAerienEquipe,
  computeSignatureMatrix,
  aggregateRecapErrors,
  deriveNomCommercial,
  estAerienPretPourSynchro,
  estTerrestrePretPourSynchro,
  messageVentTropFort,
  messageTemperatureTropElevee,
  validateRotationsMeteo,
} from '../src/lib/traitement-validation';

/**
 * « Stock final » (#stock-initial-terrestre, migration backend 0075) — même
 * formule que `_stock_pesticide_restant` côté backend
 * (backend/app/domain/traitement.py), y compris pour l'Aérien qui n'a pas de
 * stock initial (appel à 2 arguments, comportement inchangé).
 */
describe('computePesticideStockRestant', () => {
  it('reçu − consommé, sans stock initial (Aérien, comportement historique)', () => {
    expect(computePesticideStockRestant(200, 60)).toBe(140);
  });

  it('renvoie null si ni reçu ni stock initial ne sont renseignés', () => {
    expect(computePesticideStockRestant(null, 40)).toBeNull();
  });

  it('plancher à 0 en cas de surconsommation, sans stock initial', () => {
    expect(computePesticideStockRestant(50, 80)).toBe(0);
  });

  it('intègre le stock initial (Terrestre) : initial + reçu − consommé', () => {
    expect(computePesticideStockRestant(100, 40, 30)).toBe(90);
  });

  it('stock initial seul (sans réception) suffit à déduire un stock final', () => {
    expect(computePesticideStockRestant(null, 20, 50)).toBe(30);
  });

  it('plancher à 0 avec stock initial, en cas de surconsommation', () => {
    expect(computePesticideStockRestant(10, 40, 10)).toBe(0);
  });
});

/**
 * #produit-nom-commercial : « texte avant le premier chiffre », vérifié contre
 * des entrées réelles du référentiel (backend/app/pesticide_seed.py), y compris
 * les cas limites qui n'y suivent pas le format standard "Nom NNN unité".
 */
describe('deriveNomCommercial', () => {
  it('extrait le texte avant le premier chiffre, sur les exemples du prompt', () => {
    expect(deriveNomCommercial('NomProduit 200 SC')).toBe('NomProduit');
    expect(deriveNomCommercial('ProduitX 50 EC')).toBe('ProduitX');
    expect(deriveNomCommercial('Exemple 100 ULV')).toBe('Exemple');
  });

  it('fonctionne sur de vraies entrées du référentiel pesticide', () => {
    expect(deriveNomCommercial('Fyfanon 440 ULV')).toBe('Fyfanon');
    expect(deriveNomCommercial('TEFLUBENAZUR 50 ULV')).toBe('TEFLUBENAZUR');
    expect(deriveNomCommercial('DELTAMETHRINE 15 IL')).toBe('DELTAMETHRINE');
  });

  it('conserve plusieurs mots quand ils précèdent tous le premier chiffre', () => {
    expect(deriveNomCommercial('NURELLE D 14/120 UL')).toBe('NURELLE D');
  });

  it('retombe sur le nom complet quand il ne contient aucun chiffre', () => {
    expect(deriveNomCommercial('GREEN MUSCLE')).toBe('GREEN MUSCLE');
  });

  it('ne retire que les espaces, pas la ponctuation collée au chiffre', () => {
    expect(deriveNomCommercial('SP-9')).toBe('SP-');
  });
});

describe('computeNbRotations', () => {
  it('counts the rotations captured so far', () => {
    expect(computeNbRotations([{ quantite: 10 }, { quantite: 5 }])).toBe(2);
  });

  it('is zero when no rotation has been added', () => {
    expect(computeNbRotations([])).toBe(0);
  });
});

describe('computeTotalPesticideAerienParUnite', () => {
  it('sums litre-dosed rotations separately from kg-dosed ones (migration 0046)', () => {
    expect(
      computeTotalPesticideAerienParUnite([
        { quantite: 10, unite: 'L' },
        { quantite: 5.5, unite: 'L' },
        { quantite: 4, unite: 'kg' },
      ])
    ).toEqual({ l: 15.5, kg: 4 });
  });

  it('treats a missing unite as L (server default)', () => {
    expect(computeTotalPesticideAerienParUnite([{ quantite: 10 }])).toEqual({ l: 10, kg: 0 });
  });

  it('ignores rotations whose quantity is not yet filled in', () => {
    expect(computeTotalPesticideAerienParUnite([{ quantite: 10, unite: 'L' }, { quantite: null, unite: 'L' }, {}])).toEqual({
      l: 10,
      kg: 0,
    });
  });
});

describe('computeSurfaceTraiteeAerien', () => {
  it('sums the surface_ha of every rotation (surface_traitee_ha is no longer a direct entry)', () => {
    expect(computeSurfaceTraiteeAerien([{ surface_ha: 12 }, { surface_ha: 8.5 }])).toBe(20.5);
  });

  it('is zero when no rotation has surface_ha filled in', () => {
    expect(computeSurfaceTraiteeAerien([{ surface_ha: null }, {}])).toBe(0);
  });
});

describe('computeDureesRotation', () => {
  it('computes application, totale and mise en place from the 4 rotation times', () => {
    const durees = computeDureesRotation({
      heureDebut: '06:00',
      heureFin: '06:30',
      heureOuvertureVanne: '06:05',
      heureFermetureVanne: '06:20',
    });
    expect(durees).toEqual({ applicationMinutes: 15, totaleMinutes: 30, miseEnPlaceMinutes: 15 });
  });

  it('is null wherever the underlying times are not yet filled in', () => {
    expect(computeDureesRotation({ heureDebut: null, heureFin: null, heureOuvertureVanne: null, heureFermetureVanne: null })).toEqual({
      applicationMinutes: null,
      totaleMinutes: null,
      miseEnPlaceMinutes: null,
    });
  });

  it('never reports a negative mise en place duration', () => {
    // Heures de vanne débordant (mal saisies) au-delà de la rotation entière : la
    // mise en place plancher à 0 plutôt qu'un nombre négatif illisible à l'écran.
    const durees = computeDureesRotation({
      heureDebut: '06:00',
      heureFin: '06:10',
      heureOuvertureVanne: '06:00',
      heureFermetureVanne: '06:30',
    });
    expect(durees.miseEnPlaceMinutes).toBe(0);
  });
});

describe('formatDureeRotation', () => {
  it('formats minutes as HH:MM', () => {
    expect(formatDureeRotation(15)).toBe('00:15');
    expect(formatDureeRotation(90)).toBe('01:30');
  });
});

describe('computeTotalPesticideTerrestre', () => {
  it('sums the pesticide quantities across products used', () => {
    expect(computeTotalPesticideTerrestre([{ quantite_l: 3 }, { quantite_l: 7 }])).toBe(10);
  });

  it('is zero when no product has been added', () => {
    expect(computeTotalPesticideTerrestre([])).toBe(0);
  });
});

describe('computeSurfaceTraitee', () => {
  it('sums the three treatment-means surfaces', () => {
    expect(
      computeSurfaceTraitee({
        surface_atomiseur_ha: 2,
        surface_disque_rotatif_ha: 1.5,
        surface_atomiseur_autoporte_ha: 0.5,
      })
    ).toBe(4);
  });

  it('treats missing surfaces as zero', () => {
    expect(
      computeSurfaceTraitee({ surface_atomiseur_ha: 3, surface_disque_rotatif_ha: null, surface_atomiseur_autoporte_ha: undefined })
    ).toBe(3);
  });
});

describe('computeSurfaceCumulee', () => {
  it('equals the treated surface when this is not a reprise', () => {
    expect(computeSurfaceCumulee(4, false, 10)).toBe(4);
  });

  it('adds the origin fiche cumulated surface when this is a reprise', () => {
    expect(computeSurfaceCumulee(4, true, 10)).toBe(14);
  });

  it('falls back to zero when reprise is set but the origin surface is unknown', () => {
    expect(computeSurfaceCumulee(4, true, null)).toBe(4);
  });
});

describe('computeSurfaceRestante', () => {
  it('is the infested surface minus the cumulated surface', () => {
    expect(computeSurfaceRestante(10, 4)).toBe(6);
  });

  it('never goes below zero', () => {
    expect(computeSurfaceRestante(10, 15)).toBe(0);
  });

  it('is zero when the infested surface is unknown', () => {
    expect(computeSurfaceRestante(null, 4)).toBe(0);
  });
});

/**
 * #pesticide-consomme-suggere-mode-traitement : suggestion de "Pesticides
 * consommés" dérivée de "Cumulée" selon le mode de traitement et l'unité —
 * seulement 3 combinaisons ont une formule, confirmées avec l'utilisateur.
 */
describe('computePesticideConsommeSuggere', () => {
  it('Barrière + L : Cumulée / 5', () => {
    expect(computePesticideConsommeSuggere('BARRIERE', 'L', 20)).toBe(4);
  });

  it('Barrière + kg : aucune formule pour l’instant, reste manuel', () => {
    expect(computePesticideConsommeSuggere('BARRIERE', 'kg', 20)).toBeNull();
  });

  it('Couverture totale + L : égal à Cumulée', () => {
    expect(computePesticideConsommeSuggere('TOTAL', 'L', 15)).toBe(15);
  });

  it('Couverture totale + kg : Cumulée / 20', () => {
    expect(computePesticideConsommeSuggere('TOTAL', 'kg', 100)).toBe(5);
  });

  it('Irrégulier : aucune formule, reste manuel', () => {
    expect(computePesticideConsommeSuggere('IRREGULIER', 'L', 20)).toBeNull();
  });

  it('mode non renseigné : aucune formule', () => {
    expect(computePesticideConsommeSuggere(null, 'L', 20)).toBeNull();
  });

  it('unité non renseignée : traitée comme Litre (défaut)', () => {
    expect(computePesticideConsommeSuggere('TOTAL', null, 15)).toBe(15);
  });

  it('arrondit à 2 décimales', () => {
    expect(computePesticideConsommeSuggere('BARRIERE', 'L', 17)).toBe(3.4);
  });
});

describe('validateReferences', () => {
  const valid = {
    typeTraitement: 'AERIEN' as const,
    dateTraitement: '2026-08-11',
    dateValidation: '2026-08-10',
    localite: 'Ambositra',
    prospectionId: 'presp-1',
  };

  it('accepts a fully filled reference', () => {
    expect(validateReferences(valid)).toEqual([]);
  });

  it('rejects a missing treatment type', () => {
    const errors = validateReferences({ ...valid, typeTraitement: null });
    expect(errors.some((e) => e.field === 'typeTraitement')).toBe(true);
  });

  it('rejects a missing linked prospection fiche', () => {
    const errors = validateReferences({ ...valid, prospectionId: null });
    expect(errors.some((e) => e.field === 'prospectionId')).toBe(true);
  });

  it('rejects a treatment date earlier than the validation date', () => {
    const errors = validateReferences({ ...valid, dateTraitement: '2026-08-10', dateValidation: '2026-08-11' });
    expect(errors.some((e) => e.field === 'dateTraitement')).toBe(true);
  });

  it('rejects a missing localite', () => {
    const errors = validateReferences({ ...valid, localite: '' });
    expect(errors.some((e) => e.field === 'localite')).toBe(true);
  });

  // #position-hors-madagascar
  it('accepts a position inside Madagascar', () => {
    const errors = validateReferences({ ...valid, latitude: -18.9, longitude: 47.5 });
    expect(errors).toEqual([]);
  });

  it('rejects a position at sea, even within the old bounding box', () => {
    const errors = validateReferences({ ...valid, latitude: -18, longitude: 50.2 });
    expect(errors.some((e) => e.field === 'latitude' && /hors de Madagascar/.test(e.message))).toBe(true);
  });

  it('does not require a position (GPS not yet captured)', () => {
    const errors = validateReferences({ ...valid, latitude: null, longitude: null });
    expect(errors.some((e) => e.field === 'latitude')).toBe(false);
  });
});

describe('validateTerrestreConditions', () => {
  const base = {
    heureDebut: '08:00',
    heureFin: '10:00',
    vitesseVentMs: 2.5,
    temperatureC: 26,
    surfaceRestanteHa: 0,
    surfaceRestanteAbandonnee: null,
    motifSurfaceRestanteAbandonnee: null,
  };

  it('accepts consistent conditions with no restante surface', () => {
    expect(validateTerrestreConditions(base)).toEqual([]);
  });

  /** #traitement-terrestre-sync-apres-enregistrement : ces 4 champs sont
   * obligatoires côté backend (TraitementTerrestreCreate) — la fiche ne
   * doit plus jamais paraître "complète" sur le récapitulatif tant qu'ils
   * manquent, sous peine d'échouer bien plus tard, à la synchronisation. */
  it.each([
    ['heureDebut', { heureDebut: null }],
    ['heureFin', { heureFin: null }],
    ['vitesseVentMs', { vitesseVentMs: null }],
    ['temperatureC', { temperatureC: null }],
  ])('requires %s to be present', (field, overrides) => {
    const errors = validateTerrestreConditions({ ...base, ...overrides });
    expect(errors.some((e) => e.field === field)).toBe(true);
  });

  it('rejects an end time not after the start time', () => {
    const errors = validateTerrestreConditions({ ...base, heureFin: '08:00' });
    expect(errors.some((e) => e.field === 'heureFin')).toBe(true);
  });

  it('requires an abandon choice when restante surface is positive', () => {
    const errors = validateTerrestreConditions({ ...base, surfaceRestanteHa: 2 });
    expect(errors.some((e) => e.field === 'surfaceRestanteAbandonnee')).toBe(true);
  });

  it('requires a motif when the restante surface is abandoned', () => {
    const errors = validateTerrestreConditions({
      ...base,
      surfaceRestanteHa: 2,
      surfaceRestanteAbandonnee: true,
      motifSurfaceRestanteAbandonnee: null,
    });
    expect(errors.some((e) => e.field === 'motifSurfaceRestanteAbandonnee')).toBe(true);
  });

  it('does not require a motif when the restante surface is not abandoned', () => {
    const errors = validateTerrestreConditions({
      ...base,
      surfaceRestanteHa: 2,
      surfaceRestanteAbandonnee: false,
    });
    expect(errors.some((e) => e.field === 'motifSurfaceRestanteAbandonnee')).toBe(false);
  });
});

describe('validateRotationsHeures', () => {
  it('accepts rotations whose end time is after the start time', () => {
    expect(validateRotationsHeures([{ heureDebut: '06:00', heureFin: '06:30' }])).toEqual([]);
  });

  it('accepts an empty list', () => {
    expect(validateRotationsHeures([])).toEqual([]);
  });

  it('accepts rotations not yet filled in', () => {
    expect(validateRotationsHeures([{ heureDebut: null, heureFin: null }])).toEqual([]);
  });

  it('rejects an end time not after the start time, naming the offending rotation', () => {
    const errors = validateRotationsHeures([
      { heureDebut: '06:00', heureFin: '06:30' },
      { heureDebut: '09:00', heureFin: '09:00' },
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('Rotation 2');
  });

  it('rejects a vanne closing time not after the opening time (migration 0046)', () => {
    const errors = validateRotationsHeures([
      { heureDebut: '06:00', heureFin: '06:30', heureOuvertureVanne: '06:20', heureFermetureVanne: '06:10' },
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('fermeture de vanne');
  });

  it('accepts rotations whose vanne hours are not yet filled in', () => {
    expect(
      validateRotationsHeures([{ heureDebut: '06:00', heureFin: '06:30', heureOuvertureVanne: null, heureFermetureVanne: null }])
    ).toEqual([]);
  });
});

// #ordre-heures-rotation-aerien : début < ouverture vanne < fermeture vanne < fin (strict).
describe('ordre des heures d’une rotation aérienne (#ordre-heures-rotation-aerien)', () => {
  const base = {
    heureDebut: '06:00',
    heureOuvertureVanne: '06:05',
    heureFermetureVanne: '06:20',
    heureFin: '06:30',
  };

  it('accepte l’ordre début < ouverture < fermeture < fin', () => {
    expect(messagesOrdreHeuresRotation(base)).toEqual([]);
  });

  it('refuse une ouverture de vanne avant (ou égale à) l’heure de début', () => {
    expect(messagesOrdreHeuresRotation({ ...base, heureOuvertureVanne: '05:55' })).toEqual([
      "l'heure d'ouverture de vanne doit être postérieure à l'heure de début",
    ]);
    expect(messagesOrdreHeuresRotation({ ...base, heureOuvertureVanne: '06:00' })).toHaveLength(1);
  });

  it('refuse une fermeture de vanne avant (ou égale à) l’ouverture', () => {
    expect(messagesOrdreHeuresRotation({ ...base, heureFermetureVanne: '06:05' })).toEqual([
      "l'heure de fermeture de vanne doit être postérieure à l'heure d'ouverture de vanne",
    ]);
  });

  it('refuse une heure de fin avant (ou égale à) la fermeture de vanne', () => {
    expect(messagesOrdreHeuresRotation({ ...base, heureFin: '06:20' })).toEqual([
      "l'heure de fin doit être postérieure à l'heure de fermeture de vanne",
    ]);
  });

  it('ne compare que les heures renseignées : début/fin restent contrôlés sans heures de vanne', () => {
    const sansVanne = { ...base, heureOuvertureVanne: null, heureFermetureVanne: null };
    expect(messagesOrdreHeuresRotation(sansVanne)).toEqual([]);
    expect(messagesOrdreHeuresRotation({ ...sansVanne, heureFin: '05:00' })).toEqual([
      "l'heure de fin doit être postérieure à l'heure de début",
    ]);
  });

  it('validateRotationsHeures nomme la rotation fautive', () => {
    const errors = validateRotationsHeures([base, { ...base, heureOuvertureVanne: '05:00' }]);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/^Rotation 2 : /);
  });

  it('le récapitulatif remonte aussi une rotation dont l’ordre est incohérent', () => {
    const errors = aggregateRecapErrors({
      typeTraitement: 'AERIEN',
      references: { typeTraitement: 'AERIEN', dateTraitement: '2026-09-17', dateValidation: null, localite: 'X', prospectionId: 'p1' },
      recouvrementPercent: null,
      empoisonnement: { empoisonnement: false, empoisonnementType: null, empoisonnementMode: null, empoisonnementAutre: null },
      terrestreConditions: null,
      aerienEquipe: null,
      aerienRotations: [],
      aerienRotationsHeures: [{ ...base, heureFin: '06:10' }],
      terrestreProduits: [],
      signatureMatrix: [],
    } as any);
    expect(errors.some((e) => e.message.includes('Rotation 1 : '))).toBe(true);
  });
});

describe('validateRecouvrement', () => {
  it('accepts a percentage within 0 and 100', () => {
    expect(validateRecouvrement(50)).toEqual([]);
  });

  it.each([-1, 101])('rejects %s as out of range', (value) => {
    expect(validateRecouvrement(value).length).toBe(1);
  });

  it('accepts an empty value (not yet filled in)', () => {
    expect(validateRecouvrement(null)).toEqual([]);
  });
});

describe('validateEmpoisonnement', () => {
  it('requires nothing when there is no empoisonnement', () => {
    expect(validateEmpoisonnement({ empoisonnement: false, empoisonnementType: null, empoisonnementMode: null, empoisonnementAutre: null })).toEqual([]);
  });

  it('requires the type and mode when empoisonnement is reported', () => {
    const errors = validateEmpoisonnement({ empoisonnement: true, empoisonnementType: null, empoisonnementMode: null, empoisonnementAutre: null });
    expect(errors.some((e) => e.field === 'empoisonnementType')).toBe(true);
    expect(errors.some((e) => e.field === 'empoisonnementMode')).toBe(true);
  });

  it('requires the free-text detail when the mode is AUTRE', () => {
    const errors = validateEmpoisonnement({ empoisonnement: true, empoisonnementType: 'AGENT', empoisonnementMode: 'AUTRE', empoisonnementAutre: null });
    expect(errors.some((e) => e.field === 'empoisonnementAutre')).toBe(true);
  });

  it('is satisfied once type, mode and (when relevant) detail are filled', () => {
    const errors = validateEmpoisonnement({ empoisonnement: true, empoisonnementType: 'AGENT', empoisonnementMode: 'INGESTION', empoisonnementAutre: null });
    expect(errors).toEqual([]);
  });
});

describe('computeSignatureMatrix', () => {
  it('lists pilote, mecanicien and chef de base as required when filled, aerien', () => {
    const matrix = computeSignatureMatrix('AERIEN', {
      pilote: 'Jean Dupont',
      mecanicien: 'Marc Rabe',
      chef_de_base_id: 'u-1',
      consultant_international: null,
    });
    expect(matrix).toEqual([
      { role: 'PILOTE', required: true, champRenseigne: true },
      { role: 'MECANICIEN', required: true, champRenseigne: true },
      { role: 'CHEF_DE_BASE', required: true, champRenseigne: true },
    ]);
  });

  it('adds consultant international only when it was filled in, aerien', () => {
    const matrix = computeSignatureMatrix('AERIEN', {
      pilote: 'Jean Dupont',
      mecanicien: 'Marc Rabe',
      chef_de_base_id: 'u-1',
      consultant_international: 'Dr. Smith',
    });
    expect(matrix.find((r) => r.role === 'CONSULTANT_INTERNATIONAL')).toEqual({
      role: 'CONSULTANT_INTERNATIONAL',
      required: true,
      champRenseigne: true,
    });
  });

  it('requires only chef equipe for terrestre, never agent encadreur', () => {
    const matrix = computeSignatureMatrix('TERRESTRE', {
      chef_equipe_id: 'u-2',
      agent_encadreur: 'u-3',
      consultant_international: null,
    });
    expect(matrix).toEqual([{ role: 'CHEF_EQUIPE', required: true, champRenseigne: true }]);
  });
});

describe('validateAerienEquipe', () => {
  const equipeValide = {
    chefDeBaseId: 'chef-1',
    chefDeBaseNom: 'Sarah Ravelo',
    pilote: 'Jean Dupont',
    mecanicien: 'Marc Rabe',
    consultantInternational: null,
    immatriculeAeronef: '5R-ABC',
    basePrincipale: 'Base Betioky',
  };

  it('ne remonte aucune erreur quand chef de base/pilote/mécanicien/aéronef/base principale sont renseignés et distincts', () => {
    expect(validateAerienEquipe(equipeValide)).toEqual([]);
  });

  it.each([
    ['chefDeBaseId', { ...equipeValide, chefDeBaseId: null }],
    ['pilote', { ...equipeValide, pilote: null }],
    ['mecanicien', { ...equipeValide, mecanicien: null }],
    ['immatriculeAeronef', { ...equipeValide, immatriculeAeronef: null }],
    ['basePrincipale', { ...equipeValide, basePrincipale: null }],
    ['basePrincipale', { ...equipeValide, basePrincipale: '   ' }],
  ])('rapporte %s comme obligatoire quand absent', (champ, input) => {
    const errors = validateAerienEquipe(input);
    expect(errors.some((e) => e.field === champ)).toBe(true);
  });

  it('accepte un consultant absent (facultatif)', () => {
    expect(validateAerienEquipe({ ...equipeValide, consultantInternational: null })).toEqual([]);
  });

  it.each([
    ['chef de base et pilote', { ...equipeValide, pilote: equipeValide.chefDeBaseNom }],
    ['chef de base et mécanicien', { ...equipeValide, mecanicien: equipeValide.chefDeBaseNom }],
    ['pilote et mécanicien', { ...equipeValide, mecanicien: equipeValide.pilote }],
  ])('bloque quand la même personne occupe deux rôles obligatoires (%s)', (_label, input) => {
    const errors = validateAerienEquipe(input);
    expect(errors.length).toBeGreaterThan(0);
    expect(
      errors.every((e) =>
        e.message === 'Cette personne est déjà affectée à un autre rôle. Veuillez sélectionner une personne différente.'
      )
    ).toBe(true);
  });

  it('détecte une collision malgré une casse et des espaces différents', () => {
    const errors = validateAerienEquipe({ ...equipeValide, mecanicien: '  jean   DUPONT  ' });
    expect(errors.some((e) => e.field === 'pilote')).toBe(true);
  });

  it('le consultant peut être la même personne qu’un rôle obligatoire (exempté de la règle de distinction)', () => {
    expect(validateAerienEquipe({ ...equipeValide, consultantInternational: equipeValide.pilote })).toEqual([]);
  });
});

/**
 * #traitement-aerien-rotation-incomplete-bloque-synchro : `RotationCreate`
 * (backend) exige `produit_id` (UUID) et `quantite` (> 0) sans défaut — une
 * rotation ajoutée mais jamais remplie ne doit pas passer ce garde-fou, sous
 * peine que `pushRotationsEtProduits` (traitement-sync.ts) l'envoie avec
 * `produit_id: ''` / `quantite: 0`, rejetée par le serveur avec ses messages
 * Pydantic bruts.
 */
describe('estAerienPretPourSynchro', () => {
  const base = {
    pilote: 'Jean Dupont',
    mecanicien: 'Paul Martin',
    chefDeBaseId: 'user-1',
    immatriculeAeronef: '5R-ABC',
    basePrincipale: 'Betioky',
    rotations: [{ produitId: 'prod-1', quantite: 10 }],
  };

  it('accepte une fiche équipe complète avec au moins une rotation renseignée', () => {
    expect(estAerienPretPourSynchro(base)).toBe(true);
  });

  it('accepte une fiche équipe complète sans aucune rotation (rien à pousser, pas d’appel en échec)', () => {
    expect(estAerienPretPourSynchro({ ...base, rotations: [] })).toBe(true);
  });

  it('refuse une rotation sans produit sélectionné', () => {
    expect(estAerienPretPourSynchro({ ...base, rotations: [{ produitId: null, quantite: 10 }] })).toBe(false);
  });

  it('refuse une rotation avec une quantité nulle ou à zéro', () => {
    expect(estAerienPretPourSynchro({ ...base, rotations: [{ produitId: 'prod-1', quantite: null }] })).toBe(false);
    expect(estAerienPretPourSynchro({ ...base, rotations: [{ produitId: 'prod-1', quantite: 0 }] })).toBe(false);
  });

  it('refuse dès qu’une seule rotation parmi plusieurs est incomplète', () => {
    expect(
      estAerienPretPourSynchro({
        ...base,
        rotations: [
          { produitId: 'prod-1', quantite: 10 },
          { produitId: null, quantite: null },
        ],
      })
    ).toBe(false);
  });

  it('refuse toujours quand les champs équipe manquent, même avec des rotations valides', () => {
    expect(estAerienPretPourSynchro({ ...base, pilote: null })).toBe(false);
  });
});

/** Miroir de la suite ci-dessus pour la branche Terrestre — `ProduitUtiliseCreate`
 * porte exactement la même contrainte (`produit_id` UUID, `quantite_l` > 0). */
describe('estTerrestrePretPourSynchro', () => {
  const base = {
    chefEquipeId: 'user-1',
    heureDebut: '08:00',
    heureFin: '10:00',
    vitesseVentMs: 2,
    temperatureC: 25,
    produits: [{ produitId: 'prod-1', quantiteL: 5 }],
  };

  it('accepte une fiche complète avec au moins un produit renseigné', () => {
    expect(estTerrestrePretPourSynchro(base)).toBe(true);
  });

  it('accepte une fiche complète sans aucun produit (rien à pousser, pas d’appel en échec)', () => {
    expect(estTerrestrePretPourSynchro({ ...base, produits: [] })).toBe(true);
  });

  it('refuse un produit sans sélection ou sans quantité', () => {
    expect(estTerrestrePretPourSynchro({ ...base, produits: [{ produitId: null, quantiteL: 5 }] })).toBe(false);
    expect(estTerrestrePretPourSynchro({ ...base, produits: [{ produitId: 'prod-1', quantiteL: 0 }] })).toBe(false);
  });
});

describe('aggregateRecapErrors', () => {
  const validAerien = {
    typeTraitement: 'AERIEN' as const,
    references: {
      typeTraitement: 'AERIEN' as const,
      dateTraitement: '2026-08-11',
      dateValidation: '2026-08-10',
      localite: 'Ambositra',
      prospectionId: 'presp-1',
    },
    recouvrementPercent: 50,
    empoisonnement: { empoisonnement: false, empoisonnementType: null, empoisonnementMode: null, empoisonnementAutre: null },
    terrestreConditions: null,
    aerienEquipe: null,
    aerienRotations: [],
    terrestreProduits: [],
    signatureMatrix: [{ role: 'PILOTE' as const, required: true, champRenseigne: true, signe: true }],
  };

  it('is empty when every inline rule passes', () => {
    expect(aggregateRecapErrors(validAerien)).toEqual([]);
  });

  it('reports a missing required signature', () => {
    const errors = aggregateRecapErrors({
      ...validAerien,
      signatureMatrix: [{ role: 'PILOTE' as const, required: true, champRenseigne: true, signe: false }],
    });
    expect(errors.some((e) => e.field === 'signature.PILOTE')).toBe(true);
  });

  it('combines reference, recouvrement and empoisonnement errors', () => {
    const errors = aggregateRecapErrors({
      ...validAerien,
      references: { ...validAerien.references, localite: '' },
      recouvrementPercent: 150,
      empoisonnement: { empoisonnement: true, empoisonnementType: null, empoisonnementMode: null, empoisonnementAutre: null },
    });
    expect(errors.some((e) => e.field === 'localite')).toBe(true);
    expect(errors.some((e) => e.field === 'recouvrementPercent')).toBe(true);
    expect(errors.some((e) => e.field === 'empoisonnementType')).toBe(true);
  });

  it('includes terrestre condition errors when a terrestre fiche is being validated', () => {
    const errors = aggregateRecapErrors({
      ...validAerien,
      typeTraitement: 'TERRESTRE',
      terrestreConditions: {
        heureDebut: '08:00',
        heureFin: '08:00',
        vitesseVentMs: 2.5,
        temperatureC: 26,
        surfaceRestanteHa: 0,
        surfaceRestanteAbandonnee: null,
        motifSurfaceRestanteAbandonnee: null,
      },
    });
    expect(errors.some((e) => e.field === 'heureFin')).toBe(true);
  });

  /** #traitement-aerien-sync-apres-enregistrement : une rotation ajoutée mais
   * jamais remplie ne doit plus paraître "complète" sur le récapitulatif. */
  it('reports an incomplete rotation (aérien) even when everything else is valid', () => {
    const errors = aggregateRecapErrors({
      ...validAerien,
      aerienRotations: [{ produitId: null, quantite: null }],
    });
    expect(errors.some((e) => e.field === 'rotations')).toBe(true);
  });

  /** Symétrique côté Terrestre — #traitement-terrestre-sync-apres-enregistrement. */
  it('reports an incomplete produit utilisé (terrestre) even when everything else is valid', () => {
    const errors = aggregateRecapErrors({
      ...validAerien,
      typeTraitement: 'TERRESTRE',
      terrestreConditions: {
        heureDebut: '08:00',
        heureFin: '10:00',
        vitesseVentMs: 2.5,
        temperatureC: 26,
        surfaceRestanteHa: 0,
        surfaceRestanteAbandonnee: null,
        motifSurfaceRestanteAbandonnee: null,
      },
      terrestreProduits: [{ produitId: null, quantiteL: null }],
    });
    expect(errors.some((e) => e.field === 'produits')).toBe(true);
  });
});

// #alerte-meteo-vent-temperature : au-delà de 6 m/s de vent ou de 35 °C, le
// traitement est à annuler — seuils strictement supérieurs (6 et 35 pile restent
// autorisés), valables Aérien (par rotation) comme Terrestre.
describe('conditions météo (#alerte-meteo-vent-temperature)', () => {
  it('signale un vent strictement supérieur à 6 m/s, pas 6 pile ni une valeur absente', () => {
    expect(messageVentTropFort(6.1)).toContain('6 m/s');
    expect(messageVentTropFort(6)).toBeNull();
    expect(messageVentTropFort(0)).toBeNull();
    expect(messageVentTropFort(null)).toBeNull();
    expect(messageVentTropFort(undefined)).toBeNull();
  });

  it('signale une température strictement supérieure à 35 °C, pas 35 pile ni une valeur absente', () => {
    expect(messageTemperatureTropElevee(35.1)).toContain('35 °C');
    expect(messageTemperatureTropElevee(35)).toBeNull();
    expect(messageTemperatureTropElevee(null)).toBeNull();
  });

  it('Terrestre : validateTerrestreConditions bloque vent et température hors seuil, champ par champ', () => {
    const base = {
      heureDebut: '06:00',
      heureFin: '09:00',
      vitesseVentMs: 6,
      temperatureC: 35,
      surfaceRestanteHa: 0,
      surfaceRestanteAbandonnee: null,
      motifSurfaceRestanteAbandonnee: null,
    };
    expect(validateTerrestreConditions(base)).toEqual([]);
    expect(validateTerrestreConditions({ ...base, vitesseVentMs: 7 }).map((e) => e.field)).toEqual(['vitesseVentMs']);
    expect(validateTerrestreConditions({ ...base, temperatureC: 40 }).map((e) => e.field)).toEqual(['temperatureC']);
  });

  it('Aérien : une erreur par valeur hors seuil, numérotée par rotation', () => {
    const errors = validateRotationsMeteo([
      { ventDebutMs: 6, ventFinMs: 6, temperatureDebutC: 35, temperatureFinC: 35 },
      { ventDebutMs: 8, ventFinMs: 2, temperatureDebutC: 20, temperatureFinC: 36 },
    ]);
    expect(errors).toHaveLength(2);
    expect(errors[0].message).toContain('Rotation 2 (vent début)');
    expect(errors[1].message).toContain('Rotation 2 (température fin)');
  });

  it('récapitulatif : aggregateRecapErrors remonte les rotations aériennes hors seuil', () => {
    const errors = aggregateRecapErrors({
      typeTraitement: 'AERIEN',
      references: {
        typeTraitement: 'AERIEN',
        dateTraitement: '2026-09-17',
        dateValidation: null,
        localite: 'X',
        prospectionId: 'p1',
      },
      recouvrementPercent: null,
      empoisonnement: { empoisonnement: false, empoisonnementType: null, empoisonnementMode: null, empoisonnementAutre: null },
      terrestreConditions: null,
      aerienEquipe: null,
      aerienRotations: [],
      aerienRotationsMeteo: [{ ventDebutMs: 9 }],
      terrestreProduits: [],
      signatureMatrix: [],
    } as any);
    expect(errors.some((e) => e.message.includes('Rotation 1 (vent début)'))).toBe(true);
  });
});
