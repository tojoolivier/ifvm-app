import { type VolSaisi, dureeMinutes, formaterDuree, validerVol } from '../src/lib/vol-regles';

const base: VolSaisi = {
  categorie: 'application',
  equipeType: 'aerien',
  aeronefId: 'ae-1',
  date: '2026-09-23',
  debut: '06:30',
  fin: '09:15',
  sitePrincipalId: 'si-1',
  standId: 'st-1',
  baseSecondaireId: null,
  motif: '',
  lieuDepart: '',
  lieuArrivee: '',
};
const contexte = { dependantIds: ['st-1', 'bs-1'] };

const valider = (surcharge: Partial<VolSaisi>) => validerVol({ ...base, ...surcharge }, contexte);

describe('validerVol', () => {
  it('accepte un vol d’application complet', () => {
    expect(valider({})).toEqual([]);
  });

  it.each(['application', 'mise_en_place'] as const)('%s : exige site principal et stand', (categorie) => {
    expect(valider({ categorie, sitePrincipalId: null })).toContain(
      'Aucun site principal actif : impossible de saisir ce vol.'
    );
    expect(valider({ categorie, standId: null })).toContain('Choisissez le stand de remplissage.');
  });

  it('prospection : le stand n’est pas obligatoire', () => {
    expect(valider({ categorie: 'prospection', standId: null })).toEqual([]);
  });

  it.each(['convoyage', 'divers'] as const)('%s : exige un motif', (categorie) => {
    const erreurs = valider({ categorie, sitePrincipalId: null, standId: null, motif: '  ' });
    expect(erreurs).toContain('Le motif est obligatoire.');
  });

  it('divers : sans lieux ni site, un motif suffit', () => {
    expect(valider({ categorie: 'divers', sitePrincipalId: null, standId: null, motif: 'Essai moteur' })).toEqual([]);
  });

  it('convoyage : exige les lieux de départ et d’arrivée', () => {
    const erreurs = valider({ categorie: 'convoyage', sitePrincipalId: null, standId: null, motif: 'Transfert' });
    expect(erreurs).toEqual(['Le lieu de départ est obligatoire.', 'Le lieu d’arrivée est obligatoire.']);
  });

  it('exige une heure de fin postérieure au début', () => {
    expect(valider({ fin: '06:30' })).toContain('L’heure de fin doit être postérieure à l’heure de début.');
    expect(valider({ fin: '' })).toContain('L’heure de fin est obligatoire (HH:MM).');
  });

  it('refuse une équipe de travail terrestre pour un vol', () => {
    expect(valider({ equipeType: 'terrestre' })).toContain(
      'Un vol se mène avec une équipe aérienne : changez d’équipe de travail dans Paramètres.'
    );
  });

  it('exige un aéronef', () => {
    expect(valider({ aeronefId: null })).toContain('L’équipe n’a aucun aéronef en service : impossible de saisir un vol.');
  });

  it('limite stand et base secondaire aux dépendants du site principal', () => {
    expect(valider({ standId: 'autre' })).toContain('Le stand choisi ne dépend pas du site principal.');
    expect(valider({ baseSecondaireId: 'autre' })).toContain('La base secondaire choisie ne dépend pas du site principal.');
    expect(valider({ baseSecondaireId: 'bs-1' })).toEqual([]);
  });
});

describe('durée', () => {
  it('calcule et formate la durée', () => {
    expect(dureeMinutes('06:30', '09:15')).toBe(165);
    expect(formaterDuree(165)).toBe('2h 45min');
    expect(formaterDuree(2910)).toBe('48h 30min');
    expect(formaterDuree(60)).toBe('1h 00min');
  });
});
