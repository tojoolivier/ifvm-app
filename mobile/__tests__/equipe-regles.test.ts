import {
  jourMois,
  libelleFonction,
  libelleSite,
  prefillTraitementAerien,
  ROLES_A_LA_VOLEE,
  aeronefPreselectionne,
  affectationActive,
  jourMoisAnnee,
  joursDepuis,
  validerNouvelAeronef,
  validerAjoutMembre,
  validerNouvelleEquipe,
} from '../src/lib/equipe-regles';

describe('validerNouvelleEquipe', () => {
  const valide = { nom: 'Équipe Sud', type: 'aerien' as const, aeronefId: 'ae-1', chefId: 'u-1' };

  it('accepte une équipe aérienne complète', () => {
    expect(validerNouvelleEquipe(valide)).toEqual([]);
  });

  it('accepte une équipe terrestre sans aéronef', () => {
    expect(validerNouvelleEquipe({ ...valide, type: 'terrestre', aeronefId: null })).toEqual([]);
  });

  it('liste toutes les erreurs d’un coup : sans nom, sans chef, aérienne sans aéronef', () => {
    expect(validerNouvelleEquipe({ nom: '  ', type: 'aerien', aeronefId: null, chefId: null })).toEqual([
      'Le nom de l’équipe est obligatoire.',
      'Un aéronef est obligatoire pour une équipe aérienne.',
      'Un chef d’équipe est obligatoire (un compte existant).',
    ]);
  });

  it('refuse un aéronef sur une équipe terrestre', () => {
    expect(validerNouvelleEquipe({ ...valide, type: 'terrestre' })).toEqual([
      'Une équipe terrestre n’a pas d’aéronef.',
    ]);
  });
});

describe('validerAjoutMembre', () => {
  const equipeSansChef = { equipeADejaUnChef: false, chefsDAutresEquipes: new Set<string>() };

  it('compte existant : exige un utilisateur choisi', () => {
    expect(validerAjoutMembre({ mode: 'existant', userId: null, fonction: 'pilote' }, equipeSansChef)).toEqual([
      'Choisissez un utilisateur dans la liste.',
    ]);
  });

  it('compte à la volée : exige un nom et une fonction parmi pilote, mécanicien, consultant, membre', () => {
    expect(validerAjoutMembre({ mode: 'nouveau', nom: '', prenom: '', fonction: 'pilote' }, equipeSansChef)).toEqual([
      'Le nom est obligatoire.',
      'Le prénom est obligatoire.',
    ]);
    expect(ROLES_A_LA_VOLEE).toEqual(['pilote', 'mecanicien', 'consultant_international', 'membre']);
  });

  it('refuse un compte à la volée sur une fonction qui exige un compte, avec un message lisible', () => {
    expect(
      validerAjoutMembre({ mode: 'nouveau', nom: 'Dupont', prenom: 'M.', fonction: 'chef_equipe' }, equipeSansChef)
    ).toEqual([
      'Un compte sans accès ne peut être que pilote, mécanicien, consultant international ou membre. Choisissez un compte existant pour « Chef d’équipe ».',
    ]);
  });

  it('refuse un second chef', () => {
    expect(
      validerAjoutMembre(
        { mode: 'existant', userId: 'u-2', fonction: 'chef' },
        { equipeADejaUnChef: true, chefsDAutresEquipes: new Set() }
      )
    ).toEqual(['Cette équipe a déjà un chef. Désignez un autre chef avant d’en ajouter un second.']);
  });

  it('refuse un utilisateur déjà chef d’une autre équipe', () => {
    expect(
      validerAjoutMembre(
        { mode: 'existant', userId: 'u-2', fonction: 'chef' },
        { equipeADejaUnChef: false, chefsDAutresEquipes: new Set(['u-2']) }
      )
    ).toEqual(['Cet utilisateur est déjà chef d’une autre équipe.']);
  });
});

describe('libelleFonction', () => {
  it('rend le libellé français d’une fonction', () => {
    expect(libelleFonction('mecanicien')).toBe('Mécanicien');
    expect(libelleFonction('consultant_international')).toBe('Consultant');
    expect(libelleFonction('chef')).toBe('Chef');
  });

  it('retombe sur la valeur brute pour une fonction inconnue', () => {
    expect(libelleFonction('inconnue')).toBe('inconnue');
  });
});

describe('formats des maquettes', () => {
  it('jourMois rend jour/mois', () => {
    expect(jourMois('2026-09-20')).toBe('20/09');
    expect(jourMois('2026-09-20T10:00:00Z')).toBe('20/09');
  });

  it('libelleSite rend « localité · numéro »', () => {
    expect(libelleSite({ localite: 'Isoanala', numero: 'n°03' })).toBe('Isoanala · n°03');
  });
});

describe('prefillTraitementAerien', () => {
  const MEMBRES = [
    { user_id: 'u-1', fonction: 'chef', nom: 'Rakoto', prenom: 'Jean' },
    { user_id: 'u-2', fonction: 'pilote', nom: 'Rabe', prenom: 'Michel' },
    { user_id: 'u-3', fonction: 'mecanicien', nom: 'Andria', prenom: 'Sophie' },
    { user_id: 'u-4', fonction: 'consultant_international', nom: 'Dupont', prenom: 'M.' },
  ];

  it('auto-complète pilote, mécanicien, chef de base et consultant depuis les membres de l’équipe', () => {
    expect(prefillTraitementAerien(MEMBRES)).toEqual({
      pilote: 'Michel Rabe',
      mecanicien: 'Sophie Andria',
      chefDeBaseId: 'u-1',
      consultantInternational: 'M. Dupont',
    });
  });

  it('laisse vides les fonctions que l’équipe ne porte pas : l’agent les saisit', () => {
    expect(prefillTraitementAerien([])).toEqual({
      pilote: '',
      mecanicien: '',
      chefDeBaseId: '',
      consultantInternational: null,
    });
  });
});

describe('validerAjoutMembre — compte à la volée', () => {
  it('exige aussi le prénom', () => {
    expect(
      validerAjoutMembre(
        { mode: 'nouveau', nom: 'Dupont', prenom: ' ', fonction: 'pilote' },
        { equipeADejaUnChef: false, chefsDAutresEquipes: new Set() }
      )
    ).toEqual(['Le prénom est obligatoire.']);
  });
});

describe('joursDepuis', () => {
  it('compte les jours entre le début de l’affectation et aujourd’hui', () => {
    expect(joursDepuis('2026-09-01', '2026-09-24')).toBe(23);
  });

  it('vaut 0 le jour même et ne devient jamais négatif', () => {
    expect(joursDepuis('2026-09-24', '2026-09-24')).toBe(0);
    expect(joursDepuis('2026-10-01', '2026-09-24')).toBe(0);
  });
});

describe('jourMoisAnnee', () => {
  it('formate une date ISO en JJ/MM/AAAA', () => {
    expect(jourMoisAnnee('2026-09-01')).toBe('01/09/2026');
  });
});

describe('validerNouvelAeronef', () => {
  const valide = { immatriculation: '5R-MJK', societe: 'Air Mada', volumeCuveL: '1200' };

  it('accepte un appareil complet', () => {
    expect(validerNouvelAeronef(valide)).toEqual([]);
  });

  it('exige immatriculation, société et un volume de cuve positif', () => {
    expect(validerNouvelAeronef({ immatriculation: ' ', societe: '', volumeCuveL: '' })).toEqual([
      'L’immatriculation est obligatoire.',
      'La société est obligatoire.',
      'Le volume de cuve doit être un nombre positif.',
    ]);
    expect(validerNouvelAeronef({ ...valide, volumeCuveL: '0' })).toHaveLength(1);
    expect(validerNouvelAeronef({ ...valide, volumeCuveL: 'abc' })).toHaveLength(1);
  });

  it('accepte la virgule décimale saisie au clavier', () => {
    expect(validerNouvelAeronef({ ...valide, volumeCuveL: '1200,5' })).toEqual([]);
  });
});

describe('aeronefPreselectionne', () => {
  it('reprend l’aéronef de l’affectation active', () => {
    expect(aeronefPreselectionne([{ immatriculation: '5R-MHR' }])).toBe('5R-MHR');
  });

  it('ne présélectionne rien sans affectation ou si plusieurs appareils sont affectés', () => {
    expect(aeronefPreselectionne([])).toBe('');
    expect(aeronefPreselectionne([{ immatriculation: '5R-MHR' }, { immatriculation: '5R-MJK' }])).toBe('');
  });
});

describe('affectationActive', () => {
  const affectation = (date_debut: string, date_fin: string | null) => ({ date_debut, date_fin });

  it('rend l’affectation en cours ou dont la fin n’est pas passée', () => {
    expect(affectationActive([affectation('2026-09-01', null)], '2026-09-24')).toEqual(affectation('2026-09-01', null));
    expect(affectationActive([affectation('2026-09-01', '2026-09-25')], '2026-09-24')).not.toBeNull();
  });

  it('ignore une affectation future ou déjà terminée', () => {
    expect(affectationActive([affectation('2026-10-01', null)], '2026-09-24')).toBeNull();
    expect(affectationActive([affectation('2026-05-01', '2026-08-31')], '2026-09-24')).toBeNull();
    // Terminée aujourd'hui : intervalle semi-ouvert, l'appareil est déjà libre.
    expect(affectationActive([affectation('2026-09-01', '2026-09-24')], '2026-09-24')).toBeNull();
  });
});
