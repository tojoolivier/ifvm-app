import { estDansMadagascar } from '../src/lib/madagascar-boundary';

describe('estDansMadagascar', () => {
  it('accepte des villes malgaches réparties sur toute l’île', () => {
    expect(estDansMadagascar(-18.8792, 47.5079)).toBe(true); // Antananarivo
    expect(estDansMadagascar(-23.35, 43.67)).toBe(true); // Toliara (côte sud-ouest)
    expect(estDansMadagascar(-12.27, 49.29)).toBe(true); // Antsiranana (pointe nord)
    expect(estDansMadagascar(-15.7167, 46.3167)).toBe(true); // Mahajanga (côte nord-ouest)
    expect(estDansMadagascar(-21.4536, 47.0854)).toBe(true); // Fianarantsoa (intérieur)
  });

  it('rejette une position en pleine mer à l’est de l’île, même dans l’ancien rectangle englobant', () => {
    // Ancien MADAGASCAR_BBOX : lat [-25.7, -11.8], lon [43.1, 50.5] — ce point y
    // était accepté à tort (#position-hors-madagascar), alors qu'il est à ~90 km
    // au large de la côte est (la côte est proche de lon 49.4 à cette latitude).
    expect(estDansMadagascar(-18, 50.2)).toBe(false);
  });

  it('rejette une position clairement hors de Madagascar', () => {
    expect(estDansMadagascar(48.8566, 2.3522)).toBe(false); // Paris
    expect(estDansMadagascar(-25.9992, 32.5732)).toBe(false); // Maputo, Mozambique (continent)
    expect(estDansMadagascar(0, 0)).toBe(false);
  });

  it('accepte une position juste au large, dans la marge de tolérance (imprécision GPS/simplification)', () => {
    // ~0.05° à l'est de la côte est autour d'Antananarivo/Toamasina — dans la
    // marge de tolérance (0.15°), ne bloque pas une position réellement côtière.
    expect(estDansMadagascar(-18.15, 49.48)).toBe(true);
  });
});
