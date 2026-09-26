import { useMemo } from 'react';
import { useStore, type AnyFormApi } from '@tanstack/react-form';
import type { Schema } from 'yup';
import { deriverErreurs, type ErreursFormulaire } from '@/lib/form-errors';

/**
 * Yup implémente Standard Schema en asynchrone : côté `useForm`, brancher le schéma
 * sur `validators: { onChangeAsync: schema }` (`onChange` lèverait « async function
 * passed to sync validator »). Les erreurs de ce hook, elles, sont dérivées
 * en synchrone du même schéma : le bouton ne clignote pas le temps de la validation.
 *
 * Branche un formulaire TanStack Form et son schéma Yup sur les erreurs du socle UI.
 *
 * `erreurChamp(nom)` ne renvoie un message qu'une fois le champ touché ou une
 * soumission tentée (pas d'erreur affichée sur un formulaire vierge) ; `manques`
 * et `resume` couvrent toujours tous les champs invalides — le bouton dit
 * d'emblée ce qu'il manque.
 */
export function useErreursFormulaire(
  form: AnyFormApi,
  schema: Schema,
  libelles: Record<string, string>
): ErreursFormulaire & { erreurChamp: (nom: string) => string | undefined; aTenteDeSoumettre: boolean } {
  const valeurs = useStore(form.store, (s) => s.values);
  const touches = useStore(form.store, (s) => s.fieldMeta);
  const aTenteDeSoumettre = useStore(form.store, (s) => s.submissionAttempts > 0);

  const erreurs = useMemo(() => deriverErreurs(schema, valeurs, libelles), [schema, valeurs, libelles]);

  return {
    ...erreurs,
    aTenteDeSoumettre,
    erreurChamp: (nom) =>
      aTenteDeSoumettre || (touches as Record<string, { isTouched?: boolean } | undefined>)[nom]?.isTouched
        ? erreurs.parChamp[nom]
        : undefined,
  };
}
