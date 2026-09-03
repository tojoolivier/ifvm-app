import {
  computeNbRotations,
  computeTotalPesticideAerien,
  computeTotalPesticideTerrestre,
  computeSurfaceTraitee,
  computeSurfaceCumulee,
  computeSurfaceRestante,
  validateReferences,
  validateTerrestreConditions,
  validateRotationsHeures,
  validateRecouvrement,
  validateEmpoisonnement,
  computeSignatureMatrix,
  aggregateRecapErrors,
  deriveNomCommercial,
} from '../src/lib/traitement-validation';

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
    expect(computeNbRotations([{ quantite_l: 10 }, { quantite_l: 5 }])).toBe(2);
  });

  it('is zero when no rotation has been added', () => {
    expect(computeNbRotations([])).toBe(0);
  });
});

describe('computeTotalPesticideAerien', () => {
  it('sums the pesticide quantities across rotations', () => {
    expect(computeTotalPesticideAerien([{ quantite_l: 10 }, { quantite_l: 5.5 }])).toBe(15.5);
  });

  it('ignores rotations whose quantity is not yet filled in', () => {
    expect(computeTotalPesticideAerien([{ quantite_l: 10 }, { quantite_l: null }, {}])).toBe(10);
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
        surface_ulvamast_ha: 0.5,
      })
    ).toBe(4);
  });

  it('treats missing surfaces as zero', () => {
    expect(
      computeSurfaceTraitee({ surface_atomiseur_ha: 3, surface_disque_rotatif_ha: null, surface_ulvamast_ha: undefined })
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
});

describe('validateTerrestreConditions', () => {
  const base = {
    heureDebut: '08:00',
    heureFin: '10:00',
    repriseTraitement: false,
    traitementOrigineId: null,
    surfaceRestanteHa: 0,
    surfaceRestanteAbandonnee: null,
    motifSurfaceRestanteAbandonnee: null,
  };

  it('accepts consistent conditions with no restante surface', () => {
    expect(validateTerrestreConditions(base)).toEqual([]);
  });

  it('rejects an end time not after the start time', () => {
    const errors = validateTerrestreConditions({ ...base, heureFin: '08:00' });
    expect(errors.some((e) => e.field === 'heureFin')).toBe(true);
  });

  it('requires an origin fiche when reprise is chosen', () => {
    const errors = validateTerrestreConditions({ ...base, repriseTraitement: true, traitementOrigineId: null });
    expect(errors.some((e) => e.field === 'traitementOrigineId')).toBe(true);
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
      pilote: 'Jean',
      mecanicien: 'Paul',
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
      pilote: 'Jean',
      mecanicien: 'Paul',
      chef_de_base_id: 'u-1',
      consultant_international: 'Dr Smith',
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
      agent_encadreur_id: 'u-3',
      consultant_international: null,
    });
    expect(matrix).toEqual([{ role: 'CHEF_EQUIPE', required: true, champRenseigne: true }]);
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
        repriseTraitement: false,
        traitementOrigineId: null,
        surfaceRestanteHa: 0,
        surfaceRestanteAbandonnee: null,
        motifSurfaceRestanteAbandonnee: null,
      },
    });
    expect(errors.some((e) => e.field === 'heureFin')).toBe(true);
  });
});
