import { dateFr, texte, texteOuNull } from '@/lib/fiche-tableau';
import {
  effectif,
  enListe,
  infestationParType,
  libelleEssaim,
  nomEspece,
  phasesLarve,
  phenologie,
  populationDe,
} from '@/lib/fiche-tableau-prospection';
import type { CaptureRead, InfestationRead, PopulationRead } from '@/lib/api-client';

describe('texte', () => {
  it('rend « — » pour une valeur vide, comme les gabarits PDF', () => {
    expect(texte(null)).toBe('—');
    expect(texte(undefined)).toBe('—');
    expect(texte('')).toBe('—');
  });

  it('rend Oui / Non pour un booléen et garde le reste tel quel', () => {
    expect(texte(true)).toBe('Oui');
    expect(texte(false)).toBe('Non');
    expect(texte(0)).toBe('0');
    expect(texte('faibles')).toBe('faibles');
    expect(texte(2500)).toBe('2500');
  });

  it("texteOuNull distingue un champ à remplir d'un zéro", () => {
    expect(texteOuNull(null)).toBeNull();
    expect(texteOuNull(0)).toBe('0');
  });
});

describe('dateFr', () => {
  it("lit une date seule sans passer par le fuseau de l'appareil", () => {
    expect(dateFr('2026-09-24')).toBe('24/09/2026');
  });

  it('met en forme un horodatage complet en jj/mm/aaaa hh:mm', () => {
    expect(dateFr('2026-09-22T08:50:00')).toBe('22/09/2026 08:50');
  });

  it('rend « — » sans valeur et la valeur brute si elle est illisible', () => {
    expect(dateFr(null)).toBe('—');
    expect(dateFr('pas une date')).toBe('pas une date');
  });
});

const CAPTURES = [
  { id: 'c1', espece: 'LMC', categorie: 'imago', sexe: 'F', phase: 'solitaire', stade: 'A3', effectif: 4 },
  { id: 'c2', espece: 'LMC', categorie: 'imago', sexe: 'M', phase: 'gregaire', stade: 'A4', effectif: 3 },
  { id: 'c3', espece: 'NSE', categorie: 'larve', sexe: null, phase: 'transiens', stade: 'L2', effectif: 9 },
] as CaptureRead[];

describe('effectif', () => {
  it("lit l'effectif de la case espèce × catégorie × sexe × phase × stade", () => {
    expect(effectif(CAPTURES, 'LMC', 'imago', 'F', 'solitaire', 'A3')).toBe(4);
    expect(effectif(CAPTURES, 'LMC', 'imago', 'M', 'gregaire', 'A4')).toBe(3);
  });

  it('cumule plusieurs lignes tombant dans la même case', () => {
    const doublon = { ...CAPTURES[0], id: 'x', effectif: 6 };
    expect(effectif([...CAPTURES, doublon], 'LMC', 'imago', 'F', 'solitaire', 'A3')).toBe(10);
  });

  it("distingue le sexe NULL d'une larve du sexe d'un imago", () => {
    expect(effectif(CAPTURES, 'NSE', 'larve', null, 'transiens', 'L2')).toBe(9);
    expect(effectif(CAPTURES, 'NSE', 'larve', 'F', 'transiens', 'L2')).toBe(0);
  });
});

describe('populationDe / infestationParType', () => {
  const populations = [
    { id: 'pi', espece: 'LMC', categorie: 'imago' },
    { id: 'pl', espece: 'NSE', categorie: 'larve' },
  ] as PopulationRead[];

  it("retrouve la population d'une espèce et d'une catégorie", () => {
    expect(populationDe(populations, 'LMC', 'imago')?.id).toBe('pi');
    expect(populationDe(populations, 'NSE', 'imago')).toBeUndefined();
  });

  it('regroupe dense et très dense sous « Essaim »', () => {
    const dense = { id: 'd', type_cible: 'dense' } as InfestationRead;
    const tresDense = { id: 'td', type_cible: 'tres_dense' } as InfestationRead;
    const tache = { id: 't', type_cible: 'tache_larvaire' } as InfestationRead;
    expect(infestationParType([dense], 'essaim')?.id).toBe('d');
    expect(infestationParType([tresDense], 'essaim')?.id).toBe('td');
    expect(infestationParType([tache], 'essaim')).toBeUndefined();
    expect(infestationParType([tache], 'tache_larvaire')?.id).toBe('t');
  });
});

describe('libellés', () => {
  it('phasesLarve retire « Solitaro-trans » pour NSE seulement', () => {
    expect(phasesLarve('LMC').map((p) => p.valeur)).toContain('solitaro_trans');
    expect(phasesLarve('NSE').map((p) => p.valeur)).not.toContain('solitaro_trans');
  });

  it("nomme l'espèce et le type d'essaim", () => {
    expect(nomEspece('LMC')).toBe('Locusta migratoria capito');
    expect(nomEspece('NSE')).toBe('Nomadacris septemfasciata');
    expect(libelleEssaim('tres_dense')).toBe('Très dense');
    expect(libelleEssaim('inconnu')).toBe('inconnu');
  });

  it('phenologie joint une liste, garde un texte et rend « — » sans valeur ou liste vide', () => {
    expect(phenologie(['a', 'b'])).toBe('a, b');
    expect(phenologie('fleur')).toBe('fleur');
    expect(phenologie(null)).toBe('—');
    expect(phenologie([])).toBe('—');
  });

  it('enListe accepte une liste ou une simple chaîne (ancien brouillon)', () => {
    expect(enListe(['surface', '5_12cm'])).toEqual(['surface', '5_12cm']);
    expect(enListe('gt_30cm')).toEqual(['gt_30cm']);
    expect(enListe(undefined)).toEqual([]);
  });
});
