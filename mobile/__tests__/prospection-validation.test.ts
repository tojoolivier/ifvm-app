import {
  validateInfestationFormation,
  validateGpsPosition,
  validateComportementDirection,
  validateGroupementLarvaire,
  validateProspectionDate,
  validateEssaimNocturne,
  isHeureNocturne,
  classifyLarvalPopulation,
  classifyAerialPopulation,
  validateAntiDoublon,
  DOUBLON_DISTANCE_SEUIL_M,
  DOUBLON_DELAI_SEUIL_H,
  validateEcartHistorique,
  ECART_HISTORIQUE_SEUIL_RATIO,
} from '../src/lib/prospection-validation';

describe('validateProspectionDate — antériorité au début de mission (#105)', () => {
  it('bloque quand la date de prospection précède le début de la campagne', () => {
    const { blocages } = validateProspectionDate({
      dateProspection: '2026-05-01',
      campagneStartDate: '2026-06-01',
    });
    expect(blocages).toEqual([expect.stringContaining('antérieure au début de la mission')]);
  });

  it('ne bloque pas quand la date de prospection est exactement le début de la campagne', () => {
    const { blocages } = validateProspectionDate({
      dateProspection: '2026-06-01',
      campagneStartDate: '2026-06-01',
    });
    expect(blocages).toEqual([]);
  });

  it('ne bloque pas quand la date de prospection est postérieure au début de la campagne', () => {
    const { blocages } = validateProspectionDate({
      dateProspection: '2026-07-11',
      campagneStartDate: '2026-06-01',
    });
    expect(blocages).toEqual([]);
  });
});

describe('validateInfestationFormation — densité min < max', () => {
  it('bloque quand la densité minimale est supérieure à la maximale', () => {
    const { blocages } = validateInfestationFormation({ densMin: 50, densMax: 10, ventVitesse: null });
    expect(blocages).toEqual([expect.stringContaining('inférieure à la densité maximale')]);
  });

  it('bloque quand min et max sont égales', () => {
    const { blocages } = validateInfestationFormation({ densMin: 20, densMax: 20, ventVitesse: null });
    expect(blocages.length).toBe(1);
  });

  it('ne bloque pas quand min < max', () => {
    const { blocages } = validateInfestationFormation({ densMin: 5, densMax: 10, ventVitesse: null });
    expect(blocages).toEqual([]);
  });

  it('ne bloque pas quand un des deux champs est vide', () => {
    expect(validateInfestationFormation({ densMin: 5, densMax: null, ventVitesse: null }).blocages).toEqual([]);
    expect(validateInfestationFormation({ densMin: null, densMax: 10, ventVitesse: null }).blocages).toEqual([]);
  });
});

describe('validateInfestationFormation — vitesse du vent', () => {
  it('bloque une vitesse négative', () => {
    const { blocages } = validateInfestationFormation({ densMin: null, densMax: null, ventVitesse: -5 });
    expect(blocages).toEqual([expect.stringContaining('négative')]);
  });

  it('bloque une vitesse au-delà du seuil physiquement plausible', () => {
    const { blocages } = validateInfestationFormation({ densMin: null, densMax: null, ventVitesse: 300 });
    expect(blocages).toEqual([expect.stringContaining('250 km/h')]);
  });

  it('avertit sans bloquer pour une vitesse extrême mais plausible', () => {
    const { blocages, avertissements } = validateInfestationFormation({
      densMin: null,
      densMax: null,
      ventVitesse: 100,
    });
    expect(blocages).toEqual([]);
    expect(avertissements).toEqual([expect.stringContaining('extrême')]);
  });

  it('ne déclenche rien pour une vitesse plausible normale', () => {
    const result = validateInfestationFormation({ densMin: null, densMax: null, ventVitesse: 15 });
    expect(result).toEqual({ blocages: [], avertissements: [] });
  });

  it('ne déclenche rien quand la vitesse est absente', () => {
    const result = validateInfestationFormation({ densMin: null, densMax: null, ventVitesse: null });
    expect(result).toEqual({ blocages: [], avertissements: [] });
  });
});

describe('validateInfestationFormation — combinaison', () => {
  it('cumule les blocages de plusieurs règles', () => {
    const { blocages } = validateInfestationFormation({ densMin: 30, densMax: 10, ventVitesse: -1 });
    expect(blocages.length).toBe(2);
  });
});

describe('validateGpsPosition — emprise Madagascar', () => {
  it('ne bloque pas une position au centre de Madagascar', () => {
    const { blocages } = validateGpsPosition({ latitude: -18.9, longitude: 47.5, accuracy: 10 });
    expect(blocages).toEqual([]);
  });

  it('bloque une position hors de Madagascar (ex. Paris)', () => {
    const { blocages } = validateGpsPosition({ latitude: 48.85, longitude: 2.35, accuracy: 10 });
    expect(blocages).toEqual([expect.stringContaining('hors de Madagascar')]);
  });

  it('bloque une position juste hors des bornes de la bounding box', () => {
    const { blocages } = validateGpsPosition({ latitude: -11.7, longitude: 47.5, accuracy: 10 });
    expect(blocages).toEqual([expect.stringContaining('hors de Madagascar')]);
  });
});

describe('validateGpsPosition — précision GPS', () => {
  it('ne bloque pas une précision exactement au seuil (100 m)', () => {
    const { blocages } = validateGpsPosition({ latitude: -18.9, longitude: 47.5, accuracy: 100 });
    expect(blocages).toEqual([]);
  });

  it('bloque une précision au-delà du seuil de 100 m', () => {
    const { blocages } = validateGpsPosition({ latitude: -18.9, longitude: 47.5, accuracy: 101 });
    expect(blocages).toEqual([expect.stringContaining('Précision GPS insuffisante')]);
  });

  it('ne bloque pas quand la précision est indisponible', () => {
    const { blocages } = validateGpsPosition({ latitude: -18.9, longitude: 47.5, accuracy: null });
    expect(blocages).toEqual([]);
  });

  it('cumule le blocage hors-Madagascar et le blocage de précision', () => {
    const { blocages } = validateGpsPosition({ latitude: 48.85, longitude: 2.35, accuracy: 200 });
    expect(blocages.length).toBe(2);
  });
});

describe('validateComportementDirection — direction obligatoire', () => {
  it.each(['bande_larvaire', 'vol_clair', 'dense', 'tres_dense'])(
    'bloque quand la direction est absente pour %s',
    (typeCible) => {
      const { blocages } = validateComportementDirection({
        typeCible,
        comportement: null,
        directionRenseignee: false,
      });
      expect(blocages.length).toBe(1);
    }
  );

  it.each(['bande_larvaire', 'vol_clair', 'dense', 'tres_dense'])(
    'ne bloque pas quand la direction est renseignée pour %s',
    (typeCible) => {
      const { blocages } = validateComportementDirection({
        typeCible,
        comportement: null,
        directionRenseignee: true,
      });
      expect(blocages).toEqual([]);
    }
  );

  it('n’exige pas de direction pour une tache larvaire isolée', () => {
    const { blocages } = validateComportementDirection({
      typeCible: 'tache_larvaire',
      comportement: null,
      directionRenseignee: false,
    });
    expect(blocages).toEqual([]);
  });
});

describe('validateComportementDirection — cohérence repos/déplacement', () => {
  it('avertit si la population est au repos et une direction est renseignée', () => {
    const { avertissements } = validateComportementDirection({
      typeCible: 'tache_larvaire',
      comportement: 'repos',
      directionRenseignee: true,
    });
    expect(avertissements.length).toBe(1);
  });

  it('n’avertit pas si la population est au repos sans direction', () => {
    const { avertissements } = validateComportementDirection({
      typeCible: 'tache_larvaire',
      comportement: 'repos',
      directionRenseignee: false,
    });
    expect(avertissements).toEqual([]);
  });

  it('n’avertit pas si la population est en déplacement avec direction', () => {
    const { avertissements } = validateComportementDirection({
      typeCible: 'bande_larvaire',
      comportement: 'deplacement',
      directionRenseignee: true,
    });
    expect(avertissements).toEqual([]);
  });
});

describe('isHeureNocturne — bornes jour/nuit', () => {
  it('considère 22:00 comme nocturne', () => {
    expect(isHeureNocturne('22:00')).toBe(true);
  });

  it('considère 03:30 comme nocturne', () => {
    expect(isHeureNocturne('03:30')).toBe(true);
  });

  it('considère 18:00 (borne de début) comme nocturne', () => {
    expect(isHeureNocturne('18:00')).toBe(true);
  });

  it('considère 06:00 (borne de fin) comme diurne', () => {
    expect(isHeureNocturne('06:00')).toBe(false);
  });

  it('considère 14:00 comme diurne', () => {
    expect(isHeureNocturne('14:00')).toBe(false);
  });

  it('traite une heure invalide/vide comme non-nocturne', () => {
    expect(isHeureNocturne('')).toBe(false);
    expect(isHeureNocturne('abc')).toBe(false);
  });
});

describe('validateEssaimNocturne — plausibilité horaire (§2.2 point 14 du manuel)', () => {
  it('avertit quand un essaim est signalé de nuit', () => {
    const { avertissements } = validateEssaimNocturne({ typeCible: 'dense', heureObservation: '23:15' });
    expect(avertissements).toEqual([expect.stringContaining('forcé sur « posé »')]);
  });

  it('avertit quand un vol clair est signalé de nuit', () => {
    const { avertissements } = validateEssaimNocturne({ typeCible: 'vol_clair', heureObservation: '05:00' });
    expect(avertissements.length).toBe(1);
  });

  it('n’avertit pas de jour', () => {
    const { avertissements } = validateEssaimNocturne({ typeCible: 'dense', heureObservation: '10:00' });
    expect(avertissements).toEqual([]);
  });

  it('n’avertit pas pour un type de cible non ailé groupé, même de nuit', () => {
    const { avertissements } = validateEssaimNocturne({ typeCible: 'tache_larvaire', heureObservation: '23:00' });
    expect(avertissements).toEqual([]);
  });

  it('ne bloque jamais (avertissement non bloquant)', () => {
    const { blocages } = validateEssaimNocturne({ typeCible: 'dense', heureObservation: '23:00' });
    expect(blocages).toEqual([]);
  });
});

describe('classifyLarvalPopulation — tache vs bande (#103)', () => {
  it('classe en tache quand la direction n’est pas renseignée et la taille < 1000 m²', () => {
    expect(
      classifyLarvalPopulation({ tailleGroupeM2: 500, directionRenseignee: false, nbTaches: null })
    ).toBe('tache_larvaire');
  });

  it('classe en bande quand la direction est renseignée et la taille ≥ 1000 m²', () => {
    expect(
      classifyLarvalPopulation({ tailleGroupeM2: 1500, directionRenseignee: true, nbTaches: null })
    ).toBe('bande_larvaire');
  });

  it('classe en bande quand la direction est renseignée et au moins 2 taches, même sous 1000 m²', () => {
    expect(
      classifyLarvalPopulation({ tailleGroupeM2: 200, directionRenseignee: true, nbTaches: 3 })
    ).toBe('bande_larvaire');
  });

  it('classe en tache quand la direction est renseignée mais taille < 1000 m² et moins de 2 taches', () => {
    expect(
      classifyLarvalPopulation({ tailleGroupeM2: 200, directionRenseignee: true, nbTaches: 1 })
    ).toBe('tache_larvaire');
  });

  it('cas limite : taille exactement 1000 m² avec direction renseignée classe en bande', () => {
    expect(
      classifyLarvalPopulation({ tailleGroupeM2: 1000, directionRenseignee: true, nbTaches: null })
    ).toBe('bande_larvaire');
  });

  it('cas limite : taille juste sous 1000 m² avec direction renseignée classe en tache', () => {
    expect(
      classifyLarvalPopulation({ tailleGroupeM2: 999, directionRenseignee: true, nbTaches: null })
    ).toBe('tache_larvaire');
  });

  it('classe en tache sans direction même si la taille est très grande', () => {
    expect(
      classifyLarvalPopulation({ tailleGroupeM2: 5000, directionRenseignee: false, nbTaches: null })
    ).toBe('tache_larvaire');
  });
});

describe('validateGroupementLarvaire — nb taches par bande + distance intergroupes (#103)', () => {
  it('bloque une bande sans nombre de taches renseigné', () => {
    const { blocages } = validateGroupementLarvaire({
      typeCible: 'bande_larvaire',
      nbTachesBandes: null,
      interdistanceMoy: 250,
    });
    expect(blocages.length).toBe(1);
  });

  it('bloque une bande avec un nombre de taches à 0', () => {
    const { blocages } = validateGroupementLarvaire({
      typeCible: 'bande_larvaire',
      nbTachesBandes: 0,
      interdistanceMoy: 250,
    });
    expect(blocages.length).toBe(1);
  });

  it("n'exige pas de nombre de taches pour une tache isolée", () => {
    const { blocages } = validateGroupementLarvaire({
      typeCible: 'tache_larvaire',
      nbTachesBandes: null,
      interdistanceMoy: 250,
    });
    expect(blocages).toEqual([]);
  });

  it.each(['tache_larvaire', 'bande_larvaire'])(
    'bloque %s sans distance intergroupes renseignée',
    (typeCible) => {
      const { blocages } = validateGroupementLarvaire({
        typeCible,
        nbTachesBandes: 3,
        interdistanceMoy: null,
      });
      expect(blocages.length).toBe(1);
    }
  );

  it.each(['tache_larvaire', 'bande_larvaire'])(
    'bloque %s avec une distance intergroupes à 0',
    (typeCible) => {
      const { blocages } = validateGroupementLarvaire({
        typeCible,
        nbTachesBandes: 3,
        interdistanceMoy: 0,
      });
      expect(blocages.length).toBe(1);
    }
  );

  it('ne bloque pas une bande complète (taches et distance renseignées)', () => {
    const { blocages } = validateGroupementLarvaire({
      typeCible: 'bande_larvaire',
      nbTachesBandes: 3,
      interdistanceMoy: 250,
    });
    expect(blocages).toEqual([]);
  });
});

describe('classifyAerialPopulation — vol clair vs essaim (#104)', () => {
  const base = {
    volSpontaneNonProvoque: true,
    visibleSeulementDePres: null as boolean | null,
    masseSombreSansMasquerPaysage: null as boolean | null,
    masquePaysage: null as 'partiellement' | 'entierement' | null,
  };

  it("classe null (non classable) quand le vol n'est pas spontané (provoqué)", () => {
    expect(
      classifyAerialPopulation({ ...base, volSpontaneNonProvoque: false, visibleSeulementDePres: true })
    ).toBeNull();
  });

  it('classe vol_clair quand la formation n’est visible que de près', () => {
    expect(classifyAerialPopulation({ ...base, visibleSeulementDePres: true })).toBe('vol_clair');
  });

  it('classe dense pour une masse sombre qui ne masque pas le paysage', () => {
    expect(
      classifyAerialPopulation({
        ...base,
        visibleSeulementDePres: false,
        masseSombreSansMasquerPaysage: true,
      })
    ).toBe('dense');
  });

  it('classe dense quand le paysage est masqué partiellement (regroupé avec "masse sombre" — contrat backend TypeEssaim à 2 niveaux)', () => {
    expect(
      classifyAerialPopulation({
        ...base,
        visibleSeulementDePres: false,
        masseSombreSansMasquerPaysage: false,
        masquePaysage: 'partiellement',
      })
    ).toBe('dense');
  });

  it('classe tres_dense quand le paysage est masqué entièrement', () => {
    expect(
      classifyAerialPopulation({
        ...base,
        visibleSeulementDePres: false,
        masseSombreSansMasquerPaysage: false,
        masquePaysage: 'entierement',
      })
    ).toBe('tres_dense');
  });

  it('classe null (non classable) quand le questionnaire est incomplet (aucune réponse positive)', () => {
    expect(
      classifyAerialPopulation({
        ...base,
        visibleSeulementDePres: false,
        masseSombreSansMasquerPaysage: false,
        masquePaysage: null,
      })
    ).toBeNull();
  });
});

describe('validateAntiDoublon — proximité temps/espace entre prospecteurs (#107)', () => {
  const base = {
    prospecteurId: 'moi',
    latitude: -18.9,
    longitude: 47.5,
    timestamp: '2026-08-15T10:00:00.000Z',
  };

  it('avertit quand une fiche proche (distance et délai) existe pour un autre prospecteur', () => {
    const { blocages, avertissements } = validateAntiDoublon({
      ...base,
      fichesProches: [
        {
          prospecteurId: 'autre',
          latitude: -18.9005,
          longitude: 47.5005,
          timestamp: '2026-08-15T09:30:00.000Z',
        },
      ],
    });
    expect(blocages).toEqual([]);
    expect(avertissements).toHaveLength(1);
  });

  it('n\'avertit pas pour une fiche du même prospecteur (auto-comparaison exclue)', () => {
    const { avertissements } = validateAntiDoublon({
      ...base,
      fichesProches: [
        { prospecteurId: 'moi', latitude: -18.9005, longitude: 47.5005, timestamp: '2026-08-15T09:30:00.000Z' },
      ],
    });
    expect(avertissements).toEqual([]);
  });

  it('n\'avertit pas hors du rayon de distance', () => {
    const { avertissements } = validateAntiDoublon({
      ...base,
      fichesProches: [
        {
          prospecteurId: 'autre',
          latitude: base.latitude,
          longitude: base.longitude + (DOUBLON_DISTANCE_SEUIL_M / 111000) * 3,
          timestamp: '2026-08-15T09:30:00.000Z',
        },
      ],
    });
    expect(avertissements).toEqual([]);
  });

  it('n\'avertit pas hors de la fenêtre temporelle', () => {
    const { avertissements } = validateAntiDoublon({
      ...base,
      fichesProches: [
        {
          prospecteurId: 'autre',
          latitude: -18.9005,
          longitude: 47.5005,
          timestamp: `2026-08-15T${String(10 - DOUBLON_DELAI_SEUIL_H - 1).padStart(2, '0')}:00:00.000Z`,
        },
      ],
    });
    expect(avertissements).toEqual([]);
  });

  it('ne bloque jamais l\'enregistrement', () => {
    const { blocages } = validateAntiDoublon({
      ...base,
      fichesProches: [
        { prospecteurId: 'autre', latitude: base.latitude, longitude: base.longitude, timestamp: base.timestamp },
      ],
    });
    expect(blocages).toEqual([]);
  });
});

describe('validateEcartHistorique — écart vs dernière observation au même site (#106, §2.2 point 15)', () => {
  it('avertit quand la densité actuelle est au moins ECART_HISTORIQUE_SEUIL_RATIO fois supérieure à la précédente', () => {
    const { blocages, avertissements } = validateEcartHistorique({
      densiteMoyActuelle: 10 * ECART_HISTORIQUE_SEUIL_RATIO,
      derniereDensiteMoyConnue: 10,
    });
    expect(blocages).toEqual([]);
    expect(avertissements).toHaveLength(1);
  });

  it('avertit quand la densité actuelle est au moins ECART_HISTORIQUE_SEUIL_RATIO fois inférieure à la précédente', () => {
    const { avertissements } = validateEcartHistorique({
      densiteMoyActuelle: 10,
      derniereDensiteMoyConnue: 10 * ECART_HISTORIQUE_SEUIL_RATIO,
    });
    expect(avertissements).toHaveLength(1);
  });

  it('n\'avertit pas pour un écart en dessous du seuil', () => {
    const { avertissements } = validateEcartHistorique({
      densiteMoyActuelle: 12,
      derniereDensiteMoyConnue: 10,
    });
    expect(avertissements).toEqual([]);
  });

  it('n\'avertit pas en l\'absence d\'observation antérieure connue (aucun point de suivi)', () => {
    const { avertissements } = validateEcartHistorique({
      densiteMoyActuelle: 1000,
      derniereDensiteMoyConnue: null,
    });
    expect(avertissements).toEqual([]);
  });

  it('n\'avertit pas en l\'absence de densité actuelle renseignée', () => {
    const { avertissements } = validateEcartHistorique({
      densiteMoyActuelle: null,
      derniereDensiteMoyConnue: 10,
    });
    expect(avertissements).toEqual([]);
  });

  it('ne bloque jamais l\'enregistrement', () => {
    const { blocages } = validateEcartHistorique({
      densiteMoyActuelle: 1000,
      derniereDensiteMoyConnue: 1,
    });
    expect(blocages).toEqual([]);
  });
});
