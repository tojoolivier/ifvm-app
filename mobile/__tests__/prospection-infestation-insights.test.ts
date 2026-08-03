import {
  COMPASS_DIRECTIONS,
  oppositeDirection,
  densityInsight,
  comportementInsight,
} from '../src/lib/prospection-infestation-insights';

describe('COMPASS_DIRECTIONS', () => {
  it('lists the 8 points with their degree', () => {
    expect(COMPASS_DIRECTIONS).toEqual([
      { label: 'N', deg: 0 },
      { label: 'NE', deg: 45 },
      { label: 'E', deg: 90 },
      { label: 'SE', deg: 135 },
      { label: 'S', deg: 180 },
      { label: 'SO', deg: 225 },
      { label: 'O', deg: 270 },
      { label: 'NO', deg: 315 },
    ]);
  });
});

describe('oppositeDirection', () => {
  it('returns the opposite point on the compass', () => {
    expect(oppositeDirection('N')).toBe('S');
    expect(oppositeDirection('S')).toBe('N');
    expect(oppositeDirection('NE')).toBe('SO');
    expect(oppositeDirection('SO')).toBe('NE');
    expect(oppositeDirection('NO')).toBe('SE');
  });
});

describe('densityInsight', () => {
  it('returns null when no densité moyenne is entered', () => {
    expect(densityInsight(null)).toBeNull();
  });

  it('flags densité above the critical threshold', () => {
    expect(densityInsight(300)).toBe('Densité moyenne dépasse le seuil critique.');
    expect(densityInsight(450)).toBe('Densité moyenne dépasse le seuil critique.');
  });

  it('flags moderate densité below the threshold', () => {
    expect(densityInsight(120)).toBe('Densité modérée, à surveiller.');
    expect(densityInsight(0)).toBe('Densité modérée, à surveiller.');
  });
});

describe('comportementInsight', () => {
  it('returns null when no comportement is selected', () => {
    expect(comportementInsight(null, null, null)).toBeNull();
  });

  it('warns of progression toward crops on déplacement with wind speed', () => {
    expect(comportementInsight('deplacement', 'SE', 12)).toBe(
      'Déplacement SE + vent portant → progression vers les cultures à surveiller.'
    );
  });

  it('has no insight on déplacement without a wind speed yet', () => {
    expect(comportementInsight('deplacement', 'SE', null)).toBeNull();
  });

  it('gives a stability note on repos', () => {
    expect(comportementInsight('repos', null, null)).toBe('Bande stable, pas de déplacement notable.');
  });
});
