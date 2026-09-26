import {
  PREFIXE_NUMERO_FICHE,
  codeTypeNumeroFiche,
  composerNumeroFiche,
  extraireSequenceNumeroFiche,
} from '../src/lib/traitement-numero-fiche';

// #numero-fiche-traitement-trt : « TRT-[TERR|AER]-[Date ISO]-[NNN] ».
describe('composerNumeroFiche', () => {
  it('compose TRT-TERR-date-NNN pour un traitement terrestre', () => {
    expect(composerNumeroFiche('TERRESTRE', '2026-09-26', 1)).toBe('TRT-TERR-2026-09-26-001');
  });

  it('compose TRT-AER-date-NNN pour un traitement aérien', () => {
    expect(composerNumeroFiche('AERIEN', '2026-09-26', 1)).toBe('TRT-AER-2026-09-26-001');
  });

  it('complète le numéro d’ordre à trois chiffres, et grandit naturellement au-delà de 999', () => {
    expect(composerNumeroFiche('TERRESTRE', '2026-09-26', 7)).toBe('TRT-TERR-2026-09-26-007');
    expect(composerNumeroFiche('TERRESTRE', '2026-09-26', 42)).toBe('TRT-TERR-2026-09-26-042');
    expect(composerNumeroFiche('TERRESTRE', '2026-09-26', 999)).toBe('TRT-TERR-2026-09-26-999');
    expect(composerNumeroFiche('TERRESTRE', '2026-09-26', 1000)).toBe('TRT-TERR-2026-09-26-1000');
  });

  it('ne garde que la date d’un horodatage ISO complet', () => {
    expect(composerNumeroFiche('AERIEN', '2026-09-26T10:30:00.000Z', 3)).toBe('TRT-AER-2026-09-26-003');
  });

  it('ajoute un suffixe seulement en cas de collision', () => {
    expect(composerNumeroFiche('AERIEN', '2026-09-26', 3, 2)).toBe('TRT-AER-2026-09-26-003-2');
    expect(composerNumeroFiche('AERIEN', '2026-09-26', 3, null)).toBe('TRT-AER-2026-09-26-003');
    expect(composerNumeroFiche('AERIEN', '2026-09-26', 3, undefined)).toBe('TRT-AER-2026-09-26-003');
  });

  it('ne contient plus ni prénom, ni sigle, ni « ANNEXE »', () => {
    const numero = composerNumeroFiche('TERRESTRE', '2026-09-26', 5);
    expect(numero.startsWith(`${PREFIXE_NUMERO_FICHE}-`)).toBe(true);
    expect(numero).not.toMatch(/ANNEXE|Hery|Terrestre|Aerien/);
  });
});

describe('codeTypeNumeroFiche', () => {
  it('TERR pour le terrestre, AER pour l’aérien', () => {
    expect(codeTypeNumeroFiche('TERRESTRE')).toBe('TERR');
    expect(codeTypeNumeroFiche('AERIEN')).toBe('AER');
  });
});

describe('extraireSequenceNumeroFiche', () => {
  it('lit le numéro d’ordre d’un numéro du bon type', () => {
    expect(extraireSequenceNumeroFiche('TERRESTRE', 'TRT-TERR-2026-09-26-007')).toBe(7);
    expect(extraireSequenceNumeroFiche('AERIEN', 'TRT-AER-2026-01-02-1000')).toBe(1000);
  });

  it('ignore l’autre type de traitement', () => {
    expect(extraireSequenceNumeroFiche('TERRESTRE', 'TRT-AER-2026-09-26-007')).toBeNull();
    expect(extraireSequenceNumeroFiche('AERIEN', 'TRT-TERR-2026-09-26-007')).toBeNull();
  });

  it('ignore l’ancien format « Prénom-Type-Date » (les anciennes fiches ne font pas avancer le compteur)', () => {
    expect(extraireSequenceNumeroFiche('TERRESTRE', 'Hery-Terrestre-2026-09-26')).toBeNull();
    expect(extraireSequenceNumeroFiche('TERRESTRE', 'Hery-Terrestre-2026-09-26-ADM-2')).toBeNull();
  });

  it('ignore un numéro suffixé par une collision : seul le numéro de base compte', () => {
    expect(extraireSequenceNumeroFiche('TERRESTRE', 'TRT-TERR-2026-09-26-007-2')).toBeNull();
  });
});
