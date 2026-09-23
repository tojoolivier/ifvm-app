/**
 * Géocodage inverse hors ligne (#geonames-geocodage-hors-ligne) : plus proche
 * voisin sur un jeu de données GeoNames bundlé — repli de `reverseGeocode()`
 * quand le géocodeur natif échoue (brousse malgache hors couverture).
 *
 * Jeu de données réduit et contrôlé pour le test, pas le vrai
 * `geonames-mg.json` (~24 000 points, généré par
 * `scripts/generate-geonames-mg.js`) — déterministe et rapide.
 */
jest.mock(
  '@/data/geonames-mg.json',
  () => ({
    regions: ['Androy', 'Analamanga'],
    districts: ['Ambovombe District', '6e Arrondissement'],
    communes: ['Ambovombe', '6e Arrondissement'],
    points: [
      [-25.1739, 46.0833, 0, 0, 0], // Ambovombe
      [-18.8792, 47.5079, 1, 1, 1], // Antananarivo
    ],
  }),
  { virtual: true }
);

import { resoudreZoneHorsLigne } from '@/lib/geo-administratif';

describe('resoudreZoneHorsLigne', () => {
  it('résout la Région/District/Commune du point le plus proche', () => {
    expect(resoudreZoneHorsLigne(-25.17, 46.08)).toEqual({
      region: 'Androy',
      district: 'Ambovombe District',
      commune: 'Ambovombe',
    });
  });

  it('choisit l’autre point quand il est effectivement le plus proche', () => {
    expect(resoudreZoneHorsLigne(-18.88, 47.51)).toEqual({
      region: 'Analamanga',
      district: '6e Arrondissement',
      commune: '6e Arrondissement',
    });
  });

  it('renvoie toujours un résultat, même loin de tout point connu (pas de seuil de distance)', () => {
    // Simple, comme demandé — pas de rejet par distance : le point le plus
    // proche est renvoyé même s'il est à des centaines de km.
    expect(resoudreZoneHorsLigne(0, 0)).not.toBeNull();
  });
});

describe('resoudreZoneHorsLigne — jeu de données vide (défensif)', () => {
  it('renvoie null plutôt que de lever, si jamais le jeu de données est vide', () => {
    jest.resetModules();
    jest.doMock(
      '@/data/geonames-mg.json',
      () => ({ regions: [], districts: [], communes: [], points: [] }),
      { virtual: true }
    );
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { resoudreZoneHorsLigne: resoudreAvecJeuVide } = require('@/lib/geo-administratif');

    expect(resoudreAvecJeuVide(-18.88, 47.51)).toBeNull();
  });
});
