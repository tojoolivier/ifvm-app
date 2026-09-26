export type TypeGrille = 'intensive' | 'extensive' | 'validation';
export type CategorieGrille = 'imago' | 'larve';

export type NiveauAbondance = 'neant' | 'rare' | 'beaucoup';

export interface SaisieGrille {
  captures: number | null;
  phases: Record<string, number>;
  densiteDiffuse?: number | null;
  accouplement?: NiveauAbondance | null;
  ponte?: NiveauAbondance | null;
  interdistance?: number | null;
  etat?: 'repos' | 'deplacement' | null;
  /** Répartition des stades par sexe (intensif uniquement). */
  stades?: { F: Record<string, number>; M: Record<string, number> };
}

export type ErreurGrille = 'phases' | 'stades' | 'densiteDiffuse' | 'interdistance' | 'accouplement' | 'ponte' | 'etat';

const somme = (valeurs: Record<string, number>) => Object.values(valeurs).reduce((a, b) => a + b, 0);

/** Règles de validation d'une grille de captures, partagées par tous les types de fiche. */
export function validerGrille(
  type: TypeGrille,
  _categorie: CategorieGrille,
  saisie: SaisieGrille
): ErreurGrille[] {
  const erreurs: ErreurGrille[] = [];
  if (somme(saisie.phases) !== (saisie.captures ?? 0)) erreurs.push('phases');
  if (type === 'intensive') {
    const stades = saisie.stades ? somme(saisie.stades.F) + somme(saisie.stades.M) : 0;
    if (stades !== (saisie.captures ?? 0)) erreurs.push('stades');
  }
  if ((saisie.captures ?? 0) > 0 && saisie.densiteDiffuse == null) erreurs.push('densiteDiffuse');
  const signale = (n?: NiveauAbondance | null) => n != null && n !== 'neant';
  if ((signale(saisie.accouplement) || signale(saisie.ponte)) && saisie.interdistance == null) {
    erreurs.push('interdistance');
  }
  if (type === 'intensive' && (saisie.captures ?? 0) > 0) {
    if (saisie.accouplement == null) erreurs.push('accouplement');
    if (saisie.ponte == null) erreurs.push('ponte');
    if (saisie.etat == null) erreurs.push('etat');
  }
  return erreurs;
}
