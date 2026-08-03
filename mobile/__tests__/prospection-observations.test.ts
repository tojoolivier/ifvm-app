import { ENNEMIS_OPTIONS, parseEnnemis, serializeEnnemis } from '../src/lib/prospection-observations';

describe('ENNEMIS_OPTIONS', () => {
  it('lists the PDF preset ennemis naturels', () => {
    expect(ENNEMIS_OPTIONS).toEqual(['Oiseaux', 'Fourmis', 'Reptiles', 'Mantes']);
  });
});

describe('serializeEnnemis / parseEnnemis roundtrip', () => {
  it('serializes an empty selection to null', () => {
    expect(serializeEnnemis([], '')).toBeNull();
  });

  it('serializes preset selections only', () => {
    expect(serializeEnnemis(['Oiseaux', 'Mantes'], '')).toBe('Oiseaux, Mantes');
  });

  it('serializes preset selections plus free text autre', () => {
    expect(serializeEnnemis(['Oiseaux'], 'Termites')).toBe('Oiseaux, Termites');
  });

  it('serializes free text autre alone', () => {
    expect(serializeEnnemis([], 'Termites')).toBe('Termites');
  });

  it('parses null into an empty selection', () => {
    expect(parseEnnemis(null)).toEqual({ selected: [], autre: '' });
  });

  it('parses a mix of preset and custom tokens', () => {
    expect(parseEnnemis('Oiseaux, Mantes, Termites')).toEqual({
      selected: ['Oiseaux', 'Mantes'],
      autre: 'Termites',
    });
  });

  it('roundtrips preset-only selections', () => {
    const raw = serializeEnnemis(['Fourmis', 'Reptiles'], '');
    expect(parseEnnemis(raw)).toEqual({ selected: ['Fourmis', 'Reptiles'], autre: '' });
  });
});
