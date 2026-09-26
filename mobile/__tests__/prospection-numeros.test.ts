import { generateNumeroFiche, generateNumeroMessage } from '@/lib/prospection-numeros';

describe('generateNumeroFiche', () => {
  it('compose FI-date-6 premiers caractères de l’id en majuscules', () => {
    expect(generateNumeroFiche('abcdef12-3456-7890-abcd-ef1234567890', '2026-09-25')).toBe('FI-20260925-ABCDEF');
  });

  it('préfixe FE- en extensive et en validation, FI- en intensive', () => {
    const id = 'abcdef12-3456-7890-abcd-ef1234567890';
    expect(generateNumeroFiche(id, '2026-09-25', 'extensive')).toBe('FE-20260925-ABCDEF');
    expect(generateNumeroFiche(id, '2026-09-25', 'validation')).toBe('FE-20260925-ABCDEF');
    expect(generateNumeroFiche(id, '2026-09-25', 'intensive')).toBe('FI-20260925-ABCDEF');
  });

  it('est stable pour un même brouillon', () => {
    const id = '11111111-1111-1111-1111-111111111111';
    expect(generateNumeroFiche(id, '2026-07-11')).toBe(generateNumeroFiche(id, '2026-07-11'));
  });
});

describe('generateNumeroMessage', () => {
  it('compose date, 4 premiers caractères de l’id en majuscules et suffixe -TERR', () => {
    expect(generateNumeroMessage('abcdef12-3456-7890-abcd-ef1234567890', '2026-09-25')).toBe('20260925-ABCD-TERR');
  });
});
