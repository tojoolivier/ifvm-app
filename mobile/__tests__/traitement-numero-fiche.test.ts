import { composerNumeroFiche } from '../src/lib/traitement-numero-fiche';

describe('composerNumeroFiche', () => {
  it('composes prénom-Type-DateISO for AERIEN', () => {
    expect(composerNumeroFiche('Hery', 'AERIEN', '2026-08-11')).toBe('Hery-Aerien-2026-08-11');
  });

  it('composes prénom-Type-DateISO for TERRESTRE', () => {
    expect(composerNumeroFiche('Hery', 'TERRESTRE', '2026-08-11')).toBe('Hery-Terrestre-2026-08-11');
  });

  it('truncates a full ISO timestamp to the date part', () => {
    expect(composerNumeroFiche('Hery', 'AERIEN', '2026-08-11T10:30:00.000Z')).toBe('Hery-Aerien-2026-08-11');
  });

  it('appends the suffix when one is given (collision)', () => {
    expect(composerNumeroFiche('Hery', 'AERIEN', '2026-08-11', 2)).toBe('Hery-Aerien-2026-08-11-2');
  });

  it('omits the suffix when null or undefined', () => {
    expect(composerNumeroFiche('Hery', 'AERIEN', '2026-08-11', null)).toBe('Hery-Aerien-2026-08-11');
    expect(composerNumeroFiche('Hery', 'AERIEN', '2026-08-11', undefined)).toBe('Hery-Aerien-2026-08-11');
  });
});
