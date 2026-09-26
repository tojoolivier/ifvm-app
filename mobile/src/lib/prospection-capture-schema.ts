import { ValidationError, mixed } from 'yup';
import {
  validerGrille,
  type CategorieGrille,
  type NiveauAbondance,
  type SaisieGrille,
  type TypeGrille,
} from '@/lib/prospection-capture-rules';

/** Valeurs du formulaire d'une grille : les champs numériques libres restent du texte (virgule française). */
export interface CaptureValeurs {
  captures: string;
  phases: Record<string, number>;
  stades: { F: Record<string, number>; M: Record<string, number> };
  densiteDiffuse: string;
  densiteGroupee: string;
  accouplement: NiveauAbondance | null;
  ponte: NiveauAbondance | null;
  interdistance: string;
  etat: 'repos' | 'deplacement' | null;
}

/** « 1 200,5 » → 1200.5 ; vide ou illisible → null. */
export function versNombreCapture(texte: string): number | null {
  const propre = texte.replace(/\s/g, '').replace(',', '.');
  const n = Number(propre);
  return propre === '' || !Number.isFinite(n) ? null : n;
}

export function versSaisieGrille(v: CaptureValeurs): SaisieGrille {
  return {
    captures: versNombreCapture(v.captures),
    phases: v.phases,
    stades: v.stades,
    densiteDiffuse: versNombreCapture(v.densiteDiffuse),
    accouplement: v.accouplement,
    ponte: v.ponte,
    interdistance: versNombreCapture(v.interdistance),
    etat: v.etat,
  };
}

/** Schéma de la grille : les règles vivent dans `validerGrille`, le schéma les branche sur les champs. */
export function creerCaptureSchema(type: TypeGrille, categorie: CategorieGrille, t: (cle: string) => string) {
  return mixed<CaptureValeurs>().test('regles-grille', function (valeurs) {
    if (!valeurs) return true;
    const erreurs = validerGrille(type, categorie, versSaisieGrille(valeurs));
    if (erreurs.length === 0) return true;
    return new ValidationError(
      erreurs.map((champ) => this.createError({ path: champ, message: t(`prospection.capture.erreurs.${champ}`) }))
    );
  });
}
