import { accouplementInsight } from '../src/lib/prospection-accouplement-insight';

describe('accouplementInsight', () => {
  it('returns null when ponte is Néant', () => {
    expect(accouplementInsight('Néant', 'transiens')).toBeNull();
  });

  it('returns null when ponte is empty', () => {
    expect(accouplementInsight(null, 'transiens')).toBeNull();
  });

  it('returns null when dominant phénotype is not transiens/grégaire', () => {
    expect(accouplementInsight('Beaucoup', 'solitaire')).toBeNull();
    expect(accouplementInsight('Beaucoup', null)).toBeNull();
  });

  it('flags a reproduction signal for transiens dominant phénotype', () => {
    expect(accouplementInsight('Beaucoup', 'transiens')).toBe(
      'Ponte Beaucoup + phase Transiens → signal de reproduction à surveiller.'
    );
  });

  it('flags a reproduction signal for grégaire dominant phénotype', () => {
    expect(accouplementInsight('Rare', 'gregaire')).toBe(
      'Ponte Rare + phase Grégaires → signal de reproduction à surveiller.'
    );
  });
});
