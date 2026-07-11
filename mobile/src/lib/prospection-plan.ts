import { GrilleACapturer } from './prospection-especes';

export type GrilleStatut = 'a_faire' | 'terminee';

export interface PlanItem {
  grille: GrilleACapturer;
  index: number;
  statut: GrilleStatut;
}

/** Clé stable d'une grille, utilisée pour le suivi de complétion (`grilles_completees`). */
export function grilleKey(grille: GrilleACapturer): string {
  return `${grille.espece}|${grille.categorie}`;
}

export function grilleLabel(grille: GrilleACapturer): string {
  return `${grille.espece} — ${grille.categorie === 'imago' ? 'Imagos' : 'Larves'}`;
}

/** Relit l'ensemble des grilles terminées stocké sur le brouillon (colonne `grilles_completees`, JSON). */
export function parseGrillesCompletees(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

/** Construit le plan de relevé : une entrée par grille à remplir, avec son état de complétion. */
export function buildPlanItems(grilles: GrilleACapturer[], completed: Set<string>): PlanItem[] {
  return grilles.map((grille, index) => ({
    grille,
    index,
    statut: completed.has(grilleKey(grille)) ? 'terminee' : 'a_faire',
  }));
}

export function countTerminees(items: PlanItem[]): number {
  return items.filter((item) => item.statut === 'terminee').length;
}

export function isPlanComplete(items: PlanItem[]): boolean {
  return items.length > 0 && items.every((item) => item.statut === 'terminee');
}

/** Vrai une fois toutes les grilles d'une espèce donnée (imago + larve le cas échéant) terminées. */
export function isEspeceComplete(
  grilles: GrilleACapturer[],
  completed: Set<string>,
  espece: GrilleACapturer['espece']
): boolean {
  const especeGrilles = grilles.filter((g) => g.espece === espece);
  return especeGrilles.length > 0 && especeGrilles.every((g) => completed.has(grilleKey(g)));
}
