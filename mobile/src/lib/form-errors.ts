import type { Schema, ValidationError } from 'yup';

/**
 * Erreurs de formulaire communes (#721) : un seul point de dérivation pour les
 * trois affichages du socle UI — message sous le champ (`NumberField`),
 * bandeau récapitulatif (`Banner`) et bouton « Il manque : … » (`PrimaryButton`).
 * Le schéma Yup reste la source de vérité (règle mobile : TanStack Form + Yup).
 */

/** Message d'une erreur TanStack Form : chaîne, ou issue Standard Schema `{ message }`. */
export function messageErreur(erreur: unknown): string | undefined {
  if (typeof erreur === 'string') return erreur;
  if (erreur && typeof erreur === 'object' && 'message' in erreur) {
    const { message } = erreur as { message: unknown };
    return typeof message === 'string' ? message : undefined;
  }
  return undefined;
}

/** Premier message d'une liste (`field.state.meta.errors`), pour `NumberField.error`. */
export function premierMessage(erreurs: readonly unknown[] | undefined): string | undefined {
  for (const e of erreurs ?? []) {
    const m = messageErreur(e);
    if (m) return m;
  }
  return undefined;
}

/** Première erreur Yup par chemin de champ ; vide si les valeurs sont valides. */
export function erreursDuSchema(schema: Schema, valeurs: unknown): Record<string, string> {
  try {
    schema.validateSync(valeurs, { abortEarly: false });
    return {};
  } catch (e) {
    const inner = (e as ValidationError).inner;
    if (!Array.isArray(inner)) throw e;
    const erreurs: Record<string, string> = {};
    for (const issue of inner.length ? inner : [e as ValidationError]) {
      if (issue.path && !(issue.path in erreurs)) erreurs[issue.path] = issue.message;
    }
    return erreurs;
  }
}

export type ErreursFormulaire = {
  /** Message par champ invalide. */
  parChamp: Record<string, string>;
  /** Libellés des champs invalides, dans l'ordre de `libelles` — pour `PrimaryButton.manques`. */
  manques: string[];
  /** Messages pour le bandeau récapitulatif (`Banner.items`). */
  resume: string[];
};

/** Dérive bouton, bandeau et messages de champ depuis un schéma Yup et les valeurs courantes. */
export function deriverErreurs(
  schema: Schema,
  valeurs: unknown,
  /** Libellé affichable de chaque champ, dans l'ordre de la maquette. */
  libelles: Record<string, string>
): ErreursFormulaire {
  const parChamp = erreursDuSchema(schema, valeurs);
  const invalides = Object.keys(libelles).filter((nom) => nom in parChamp);
  return {
    parChamp,
    manques: invalides.map((nom) => libelles[nom]),
    resume: invalides.map((nom) => parChamp[nom]),
  };
}
