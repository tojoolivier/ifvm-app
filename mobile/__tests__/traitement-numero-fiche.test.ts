import {
  PREFIXE_NUMERO_FICHE,
  appliquerSigleAuNumeroFiche,
  codeTypeNumeroFiche,
  composerNumeroFiche,
  extraireSequenceNumeroFiche,
  normaliserSigle,
} from '../src/lib/traitement-numero-fiche';

// #numero-fiche-traitement-trt : « TRT-[TERR|AER]-[Date ISO]-[Sigle du chef]-[NNN] ».
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

  it('insère le sigle du chef entre la date et le numéro d’ordre', () => {
    expect(composerNumeroFiche('TERRESTRE', '2026-09-26', 1, { sigle: 'ABC' })).toBe('TRT-TERR-2026-09-26-ABC-001');
    expect(composerNumeroFiche('AERIEN', '2026-09-26', 12, { sigle: 'RH' })).toBe('TRT-AER-2026-09-26-RH-012');
  });

  it('omet le segment du sigle quand le chef n’en a pas', () => {
    for (const absent of [null, undefined, '', '   ', '-- ']) {
      expect(composerNumeroFiche('TERRESTRE', '2026-09-26', 1, { sigle: absent })).toBe('TRT-TERR-2026-09-26-001');
    }
  });

  it('ajoute un suffixe seulement en cas de collision, après le numéro d’ordre', () => {
    expect(composerNumeroFiche('AERIEN', '2026-09-26', 3, { suffixe: 2 })).toBe('TRT-AER-2026-09-26-003-2');
    expect(composerNumeroFiche('AERIEN', '2026-09-26', 3, { suffixe: null })).toBe('TRT-AER-2026-09-26-003');
    expect(composerNumeroFiche('AERIEN', '2026-09-26', 3, { sigle: 'ABC', suffixe: 2 })).toBe(
      'TRT-AER-2026-09-26-ABC-003-2'
    );
  });

  it('ne contient ni prénom, ni « ANNEXE » : seul le sigle du chef identifie la personne', () => {
    const numero = composerNumeroFiche('TERRESTRE', '2026-09-26', 5, { sigle: 'ABC' });
    expect(numero.startsWith(`${PREFIXE_NUMERO_FICHE}-`)).toBe(true);
    expect(numero).not.toMatch(/ANNEXE|Hery|Terrestre|Aerien/);
  });
});

describe('normaliserSigle', () => {
  it('garde lettres et chiffres seulement, casse conservée', () => {
    expect(normaliserSigle('ABC')).toBe('ABC');
    expect(normaliserSigle(' a-b c ')).toBe('abc');
    expect(normaliserSigle('R.H')).toBe('RH');
    expect(normaliserSigle('é1')).toBe('1');
  });

  it('renvoie une chaîne vide quand le sigle est absent', () => {
    expect(normaliserSigle(null)).toBe('');
    expect(normaliserSigle(undefined)).toBe('');
  });
});

describe('codeTypeNumeroFiche', () => {
  it('TERR pour le terrestre, AER pour l’aérien', () => {
    expect(codeTypeNumeroFiche('TERRESTRE')).toBe('TERR');
    expect(codeTypeNumeroFiche('AERIEN')).toBe('AER');
  });
});

describe('extraireSequenceNumeroFiche', () => {
  it('lit le numéro d’ordre d’un numéro du bon type, avec ou sans sigle', () => {
    expect(extraireSequenceNumeroFiche('TERRESTRE', 'TRT-TERR-2026-09-26-007')).toBe(7);
    expect(extraireSequenceNumeroFiche('AERIEN', 'TRT-AER-2026-01-02-1000')).toBe(1000);
    expect(extraireSequenceNumeroFiche('TERRESTRE', 'TRT-TERR-2026-09-26-ABC-012')).toBe(12);
    expect(extraireSequenceNumeroFiche('AERIEN', 'TRT-AER-2026-09-26-RH-1000')).toBe(1000);
  });

  it('ignore l’autre type de traitement', () => {
    expect(extraireSequenceNumeroFiche('TERRESTRE', 'TRT-AER-2026-09-26-007')).toBeNull();
    expect(extraireSequenceNumeroFiche('AERIEN', 'TRT-TERR-2026-09-26-ABC-007')).toBeNull();
  });

  it('ignore l’ancien format « Prénom-Type-Date » (les anciennes fiches ne font pas avancer le compteur)', () => {
    expect(extraireSequenceNumeroFiche('TERRESTRE', 'Hery-Terrestre-2026-09-26')).toBeNull();
    expect(extraireSequenceNumeroFiche('TERRESTRE', 'Hery-Terrestre-2026-09-26-ADM-2')).toBeNull();
  });

  it('ignore un numéro suffixé par une collision : seul le numéro de base compte', () => {
    expect(extraireSequenceNumeroFiche('TERRESTRE', 'TRT-TERR-2026-09-26-007-2')).toBeNull();
    expect(extraireSequenceNumeroFiche('TERRESTRE', 'TRT-TERR-2026-09-26-ABC-007-2')).toBeNull();
  });
});

describe('appliquerSigleAuNumeroFiche', () => {
  it('insère le sigle du chef dans un numéro qui n’en a pas encore', () => {
    expect(appliquerSigleAuNumeroFiche('TERRESTRE', 'TRT-TERR-2026-09-26-001', 'ABC')).toBe(
      'TRT-TERR-2026-09-26-ABC-001'
    );
  });

  it('remplace le sigle quand le chef change', () => {
    expect(appliquerSigleAuNumeroFiche('AERIEN', 'TRT-AER-2026-09-26-ABC-004', 'XY')).toBe('TRT-AER-2026-09-26-XY-004');
  });

  it('retire le sigle quand le nouveau chef n’en a pas', () => {
    expect(appliquerSigleAuNumeroFiche('AERIEN', 'TRT-AER-2026-09-26-ABC-004', null)).toBe('TRT-AER-2026-09-26-004');
    expect(appliquerSigleAuNumeroFiche('AERIEN', 'TRT-AER-2026-09-26-ABC-004', '')).toBe('TRT-AER-2026-09-26-004');
  });

  it('conserve la date, le numéro d’ordre et le suffixe de collision', () => {
    expect(appliquerSigleAuNumeroFiche('TERRESTRE', 'TRT-TERR-2026-01-05-042-2', 'ABC')).toBe(
      'TRT-TERR-2026-01-05-ABC-042-2'
    );
  });

  it('est idempotent', () => {
    const une = appliquerSigleAuNumeroFiche('TERRESTRE', 'TRT-TERR-2026-09-26-001', 'ABC');
    expect(appliquerSigleAuNumeroFiche('TERRESTRE', une, 'ABC')).toBe(une);
  });

  it('ne réécrit jamais un ancien numéro ni celui d’un autre type', () => {
    expect(appliquerSigleAuNumeroFiche('TERRESTRE', 'Hery-Terrestre-2026-09-26', 'ABC')).toBe('Hery-Terrestre-2026-09-26');
    expect(appliquerSigleAuNumeroFiche('TERRESTRE', 'TRT-AER-2026-09-26-001', 'ABC')).toBe('TRT-AER-2026-09-26-001');
  });
});
