import { useMemo } from 'react';
import { useForm } from '@tanstack/react-form';
import { useTranslation } from 'react-i18next';
import type { Schema } from 'yup';
import { useErreursFormulaire } from '@/hooks/use-erreurs-formulaire';
import { creerVegetationExtensiveSchema, type VegetationExtensiveValeurs } from '@/lib/prospection-vegetation-extensive-schema';

/** Formulaire de l'étape Végétation extensive : TanStack Form + schéma Yup (`onChangeAsync`), comme l'intensif. */
export function useVegetationExtensiveForm(valeursInitiales: VegetationExtensiveValeurs) {
  const { t } = useTranslation();
  const schema: Schema = useMemo(() => creerVegetationExtensiveSchema((cle) => t(cle as never)), [t]);
  const form = useForm({ defaultValues: valeursInitiales, validators: { onChangeAsync: schema as never } });
  const erreurs = useErreursFormulaire(form as never, schema, {});
  return { form, erreurs };
}
