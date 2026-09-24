import {
  type SiteSaisi,
  dureeImplantationJours,
  jourPrecedent,
  lireDependants,
  validerCreationGroupee,
  validerDeplacement,
  validerPosition,
  validerSiteSecondaire,
  validerVolMiseEnPlace,
} from '../src/lib/site-aerien-regles';

const POSITION = { latitude: -21.8135, longitude: 46.0432, altitude: 893 };
const SANS_POSITION = { latitude: null, longitude: null, altitude: null };

const principal: SiteSaisi = {
  actif: true,
  numero: '03',
  localite: 'Isoanala',
  memePositionQuePrincipal: false,
  position: POSITION,
};
const stand: SiteSaisi = {
  actif: true,
  numero: '01',
  localite: 'Isoanala',
  memePositionQuePrincipal: true,
  position: SANS_POSITION,
};
const inactif: SiteSaisi = { ...stand, actif: false, numero: '', localite: '' };

describe('validerPosition', () => {
  it('accepte une position dans les bornes, altitude facultative', () => {
    expect(validerPosition({ latitude: -21.8, longitude: 46, altitude: null })).toEqual([]);
  });

  it('refuse une position absente', () => {
    expect(validerPosition(SANS_POSITION)).toEqual(['La position GPS est obligatoire.']);
  });

  it.each([
    [{ latitude: 90.01, longitude: 0 }, 'La latitude doit être comprise entre −90 et 90.'],
    [{ latitude: -91, longitude: 0 }, 'La latitude doit être comprise entre −90 et 90.'],
    [{ latitude: 0, longitude: 180.5 }, 'La longitude doit être comprise entre −180 et 180.'],
    [{ latitude: 0, longitude: -181 }, 'La longitude doit être comprise entre −180 et 180.'],
  ])('refuse %j hors bornes', (position, message) => {
    expect(validerPosition({ ...position, altitude: null })).toEqual([message]);
  });

  it('accepte les bornes exactes', () => {
    expect(validerPosition({ latitude: 90, longitude: -180, altitude: null })).toEqual([]);
    expect(validerPosition({ latitude: -90, longitude: 180, altitude: null })).toEqual([]);
  });

  it('refuse une coordonnée non finie', () => {
    expect(validerPosition({ latitude: Number.NaN, longitude: 0, altitude: null })).toEqual([
      'La latitude doit être comprise entre −90 et 90.',
    ]);
  });
});

describe('validerCreationGroupee', () => {
  it('accepte un principal seul', () => {
    expect(validerCreationGroupee({ principal, stand: inactif, baseSecondaire: inactif })).toEqual([]);
  });

  it('accepte un principal + stand (même position) + base secondaire avec sa propre position', () => {
    const base: SiteSaisi = {
      actif: true,
      numero: '02',
      localite: 'Ihosy',
      memePositionQuePrincipal: false,
      position: { latitude: -22.4, longitude: 46.1, altitude: null },
    };
    expect(validerCreationGroupee({ principal, stand, baseSecondaire: base })).toEqual([]);
  });

  it('exige numéro, localité et position du principal', () => {
    const vide: SiteSaisi = { ...principal, numero: ' ', localite: '', position: SANS_POSITION };
    expect(validerCreationGroupee({ principal: vide, stand: inactif, baseSecondaire: inactif })).toEqual([
      'Site principal : le numéro est obligatoire.',
      'Site principal : la localité est obligatoire.',
      'Site principal : La position GPS est obligatoire.',
    ]);
  });

  it('refuse un dépendant activé sans numéro ni localité', () => {
    expect(
      validerCreationGroupee({ principal, stand: { ...stand, numero: '', localite: ' ' }, baseSecondaire: inactif })
    ).toEqual(['Stand : le numéro est obligatoire.', 'Stand : la localité est obligatoire.']);
  });

  it('refuse un dépendant sans position alors que « même position » est décoché', () => {
    expect(
      validerCreationGroupee({
        principal,
        stand: inactif,
        baseSecondaire: { ...stand, numero: '02', localite: 'Ihosy', memePositionQuePrincipal: false },
      })
    ).toEqual(['Base secondaire : La position GPS est obligatoire.']);
  });

  it('ignore complètement un dépendant non activé, même incomplet', () => {
    expect(validerCreationGroupee({ principal, stand: inactif, baseSecondaire: inactif })).toEqual([]);
  });

  it('refuse deux sites du même lot avec le même numéro', () => {
    expect(
      validerCreationGroupee({ principal, stand: { ...stand, numero: '03' }, baseSecondaire: inactif })
    ).toEqual(['Deux sites du même lot ne peuvent pas porter le même numéro (03).']);
  });

  it('valide les bornes GPS de chaque site', () => {
    const hors = { ...principal, position: { latitude: 95, longitude: 46, altitude: null } };
    expect(validerCreationGroupee({ principal: hors, stand: inactif, baseSecondaire: inactif })).toEqual([
      'Site principal : La latitude doit être comprise entre −90 et 90.',
    ]);
  });
});

describe('validerSiteSecondaire', () => {
  it('accepte un secondaire avec sa propre position', () => {
    expect(validerSiteSecondaire({ ...stand, memePositionQuePrincipal: false, position: POSITION })).toEqual([]);
  });

  it('accepte un secondaire qui reprend la position de son principal', () => {
    expect(validerSiteSecondaire(stand)).toEqual([]);
  });

  it('exige numéro, localité et — sans « même position » — une position', () => {
    expect(
      validerSiteSecondaire({ ...stand, numero: '', localite: ' ', memePositionQuePrincipal: false })
    ).toEqual([
      'Site secondaire : le numéro est obligatoire.',
      'Site secondaire : la localité est obligatoire.',
      'Site secondaire : La position GPS est obligatoire.',
    ]);
  });
});

describe('validerVolMiseEnPlace', () => {
  const vol = { debut: '07:30', fin: '08:45', standId: 'st-1', aeronefId: 'ae-1' };

  it('accepte un vol complet', () => {
    expect(validerVolMiseEnPlace(vol, { nbStands: 1 })).toEqual([]);
  });

  it('refuse si le site n’a aucun stand', () => {
    expect(validerVolMiseEnPlace({ ...vol, standId: null }, { nbStands: 0 })).toEqual([
      'Ce site n’a aucun stand : impossible de saisir un vol de mise en place.',
    ]);
  });

  it('exige le choix d’un stand quand il en existe', () => {
    expect(validerVolMiseEnPlace({ ...vol, standId: null }, { nbStands: 2 })).toEqual([
      'Choisissez le stand du vol de mise en place.',
    ]);
  });

  it('refuse une fin antérieure ou égale au début', () => {
    expect(validerVolMiseEnPlace({ ...vol, fin: '07:00' }, { nbStands: 1 })).toEqual([
      'L’heure de fin doit être postérieure à l’heure de début.',
    ]);
    expect(validerVolMiseEnPlace({ ...vol, fin: '07:30' }, { nbStands: 1 })).toEqual([
      'L’heure de fin doit être postérieure à l’heure de début.',
    ]);
  });

  it('exige des heures valides', () => {
    expect(validerVolMiseEnPlace({ ...vol, debut: '', fin: '25:99' }, { nbStands: 1 })).toEqual([
      'L’heure de début est obligatoire (HH:MM).',
      'L’heure de fin est obligatoire (HH:MM).',
    ]);
  });

  it('exige un aéronef de l’équipe', () => {
    expect(validerVolMiseEnPlace({ ...vol, aeronefId: null }, { nbStands: 1 })).toEqual([
      'L’équipe n’a aucun aéronef en service : impossible de saisir un vol.',
    ]);
  });
});

describe('validerDeplacement', () => {
  it('accepte un déplacement complet sans vol', () => {
    expect(validerDeplacement({ numero: '04', localite: 'Ambatobe', position: POSITION })).toEqual([]);
  });

  it('exige la localité et une position valide', () => {
    expect(validerDeplacement({ numero: '04', localite: '', position: SANS_POSITION })).toEqual([
      'La localité est obligatoire.',
      'La position GPS est obligatoire.',
    ]);
  });

  it('refuse une longitude hors bornes', () => {
    expect(
      validerDeplacement({
        numero: '04',
        localite: 'Ambatobe',
        position: { latitude: 0, longitude: 200, altitude: null },
      })
    ).toEqual(['La longitude doit être comprise entre −180 et 180.']);
  });
});

describe('lireDependants', () => {
  it('relit la liste d’ids stockée en JSON', () => {
    expect(lireDependants('["st-1","bs-1"]')).toEqual(['st-1', 'bs-1']);
    expect(lireDependants('[]')).toEqual([]);
  });

  it.each(['{"a":1}', '["st-1", 2]', '"st-1"', 'null'])('refuse une colonne corrompue : %s', (json) => {
    expect(() => lireDependants(json)).toThrow('dependants_json');
  });
});

describe('jourPrecedent', () => {
  it('rend la veille, y compris à cheval sur un mois et une année', () => {
    expect(jourPrecedent('2026-09-24')).toBe('2026-09-23');
    expect(jourPrecedent('2026-10-01')).toBe('2026-09-30');
    expect(jourPrecedent('2026-01-01')).toBe('2025-12-31');
  });
});

describe('dureeImplantationJours', () => {
  it('compte les jours entre début et fin', () => {
    expect(dureeImplantationJours('2026-09-01', '2026-09-11', '2026-09-24')).toBe(10);
  });

  it('une position active dure jusqu’à aujourd’hui', () => {
    expect(dureeImplantationJours('2026-09-12', null, '2026-09-24')).toBe(12);
  });

  it('même jour : zéro, comme SiteAeriennePositionRead.duree_jours', () => {
    expect(dureeImplantationJours('2026-09-24', null, '2026-09-24')).toBe(0);
  });
});

describe('validerVolMiseEnPlace — équipe terrestre (#644)', () => {
  it('refuse un vol de mise en place avec une équipe de travail terrestre', () => {
    const vol = { debut: '07:00', fin: '08:00', standId: 's1', aeronefId: 'a1' };
    expect(validerVolMiseEnPlace(vol, { nbStands: 1, equipeType: 'terrestre' })).toEqual([
      'Un vol se mène avec une équipe aérienne : changez d’équipe de travail dans Paramètres.',
    ]);
  });
});
