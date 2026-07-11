import {
  buildPlanItems,
  countTerminees,
  grilleKey,
  grilleLabel,
  isEspeceComplete,
  isPlanComplete,
  parseGrillesCompletees,
} from '../src/lib/prospection-plan';
import { GrilleACapturer } from '../src/lib/prospection-especes';

const LMC_IMAGO: GrilleACapturer = { espece: 'LMC', categorie: 'imago' };
const LMC_LARVE: GrilleACapturer = { espece: 'LMC', categorie: 'larve' };
const NSE_IMAGO: GrilleACapturer = { espece: 'NSE', categorie: 'imago' };

describe('grilleKey / grilleLabel', () => {
  it('builds a stable key per espece/categorie', () => {
    expect(grilleKey(LMC_IMAGO)).toBe('LMC|imago');
    expect(grilleKey(LMC_LARVE)).toBe('LMC|larve');
  });

  it('builds a human-readable label', () => {
    expect(grilleLabel(LMC_IMAGO)).toBe('LMC — Imagos');
    expect(grilleLabel(NSE_IMAGO)).toBe('NSE — Imagos');
    expect(grilleLabel(LMC_LARVE)).toBe('LMC — Larves');
  });
});

describe('parseGrillesCompletees', () => {
  it('returns an empty set for null/invalid input', () => {
    expect(parseGrillesCompletees(null)).toEqual(new Set());
    expect(parseGrillesCompletees('{not json')).toEqual(new Set());
    expect(parseGrillesCompletees('{"not":"an array"}')).toEqual(new Set());
  });

  it('parses a stored array back into a set', () => {
    expect(parseGrillesCompletees(JSON.stringify(['LMC|imago', 'NSE|imago']))).toEqual(
      new Set(['LMC|imago', 'NSE|imago'])
    );
  });
});

describe('buildPlanItems / countTerminees / isPlanComplete', () => {
  const grilles = [LMC_IMAGO, LMC_LARVE, NSE_IMAGO];

  it('marks each grille a_faire when nothing is completed', () => {
    const items = buildPlanItems(grilles, new Set());
    expect(items.map((i) => i.statut)).toEqual(['a_faire', 'a_faire', 'a_faire']);
    expect(countTerminees(items)).toBe(0);
    expect(isPlanComplete(items)).toBe(false);
  });

  it('marks only the completed grilles as terminee, in arbitrary order', () => {
    const items = buildPlanItems(grilles, new Set(['NSE|imago']));
    expect(items[0].statut).toBe('a_faire');
    expect(items[1].statut).toBe('a_faire');
    expect(items[2].statut).toBe('terminee');
    expect(countTerminees(items)).toBe(1);
    expect(isPlanComplete(items)).toBe(false);
  });

  it('is complete once every grille is completed', () => {
    const items = buildPlanItems(grilles, new Set(['LMC|imago', 'LMC|larve', 'NSE|imago']));
    expect(countTerminees(items)).toBe(3);
    expect(isPlanComplete(items)).toBe(true);
  });

  it('is never complete for an empty grille list', () => {
    expect(isPlanComplete(buildPlanItems([], new Set()))).toBe(false);
  });

  it('preserves the original index for navigation back to a grille', () => {
    const items = buildPlanItems(grilles, new Set());
    expect(items.map((i) => i.index)).toEqual([0, 1, 2]);
  });
});

describe('isEspeceComplete', () => {
  const grilles = [LMC_IMAGO, LMC_LARVE, NSE_IMAGO];

  it('is false when no grille of the espece is completed', () => {
    expect(isEspeceComplete(grilles, new Set(), 'LMC')).toBe(false);
  });

  it('is false when only some grilles of the espece are completed', () => {
    expect(isEspeceComplete(grilles, new Set(['LMC|imago']), 'LMC')).toBe(false);
  });

  it('is true once every grille of the espece is completed, regardless of other especes', () => {
    expect(isEspeceComplete(grilles, new Set(['LMC|imago', 'LMC|larve']), 'LMC')).toBe(true);
  });

  it('is true for a single-grille espece once that grille is completed', () => {
    expect(isEspeceComplete(grilles, new Set(['NSE|imago']), 'NSE')).toBe(true);
  });

  it('is false for an espece absent from the grille list', () => {
    expect(isEspeceComplete(grilles, new Set(['LMC|imago', 'LMC|larve', 'NSE|imago']), 'NSE')).toBe(true);
    expect(isEspeceComplete([LMC_IMAGO], new Set(['LMC|imago']), 'NSE')).toBe(false);
  });
});
