import { coordonneesValides, formaterDistance, plusProche } from '@/lib/prospection-rattachement';

const ici = { latitude: -25, longitude: 45 };

describe('plusProche', () => {
  it('choisit le candidat le plus proche avec sa distance en mètres', () => {
    // 0,01° de latitude ≈ 1 112 m ; 0,03° ≈ 3 336 m
    const proche = { id: 'a', latitude: -25.01, longitude: 45 };
    const loin = { id: 'b', latitude: -25.03, longitude: 45 };
    const res = plusProche(ici, [loin, proche]);
    expect(res?.item.id).toBe('a');
    expect(res?.distanceM).toBeGreaterThan(1100);
    expect(res?.distanceM).toBeLessThan(1125);
  });

  it('ignore les candidats sans coordonnées et renvoie null si aucun', () => {
    expect(plusProche(ici, [{ id: 'x', latitude: null, longitude: null }])).toBeNull();
    expect(plusProche(ici, [])).toBeNull();
  });
});

describe('formaterDistance', () => {
  it('affiche en mètres sous 1 km, en km avec virgule au-dessus', () => {
    expect(formaterDistance(350)).toBe('350 m');
    expect(formaterDistance(2140)).toBe('2,1 km');
  });
});

describe('coordonneesValides', () => {
  it('accepte une position à Madagascar, refuse le reste (0,0, hors île, non numérique)', () => {
    expect(coordonneesValides(-25, 45)).toBe(true);
    expect(coordonneesValides(-18.9, 47.5)).toBe(true);
    expect(coordonneesValides(0, 0)).toBe(false);
    expect(coordonneesValides(48.8, 2.3)).toBe(false);
    expect(coordonneesValides(Number.NaN, 45)).toBe(false);
  });
});
