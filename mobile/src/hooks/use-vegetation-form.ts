import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from '@tanstack/react-form';
import type { Schema } from 'yup';
import { useErreursFormulaire } from '@/hooks/use-erreurs-formulaire';
import { creerVegetationSchema, type VegetationValeurs } from '@/lib/prospection-vegetation-schema';

/**
 * Formulaire de l'étape Végétation : TanStack Form + schéma Yup (`onChangeAsync`, Yup étant asynchrone côté
 * Standard Schema). Les messages du schéma sont des clés de `fr.ts` composées à l'exécution : le cast de `t`
 * est confiné ici.
 */
export function useVegetationForm(valeursInitiales: VegetationValeurs) {
  const { t } = useTranslation();
  const schema: Schema = useMemo(() => creerVegetationSchema((cle) => t(cle as never)), [t]);
  const form = useForm({ defaultValues: valeursInitiales, validators: { onChangeAsync: schema as never } });
  // `useErreursFormulaire` attend un `AnyFormApi` : un formulaire typé n'y est pas assignable (écouteurs).
  const erreurs = useErreursFormulaire(form as never, schema, {});
  return { form, erreurs };
}

export type VegetationForm = ReturnType<typeof useVegetationForm>['form'];
export type ErreursVegetation = ReturnType<typeof useVegetationForm>['erreurs'];
