import { useMemo } from 'react';
import { useForm } from '@tanstack/react-form';
import { useTranslation } from 'react-i18next';
import type { Schema } from 'yup';
import { useErreursFormulaire } from '@/hooks/use-erreurs-formulaire';
import { creerSolSchema, type SolValeurs } from '@/lib/prospection-sol-schema';

/** Formulaire de l'étape Sol : TanStack Form + schéma Yup (`onChangeAsync`) ; le bouton dit ce qu'il manque. */
export function useSolForm(valeursInitiales: SolValeurs) {
  const { t } = useTranslation();
  const schema: Schema = useMemo(() => creerSolSchema((cle) => t(cle as never)), [t]);
  const form = useForm({ defaultValues: valeursInitiales, validators: { onChangeAsync: schema as never } });
  const libelles = { humidite: t('prospection.sol.humiditeTitre'), texture: t('prospection.sol.textureTitre') };
  const erreurs = useErreursFormulaire(form as never, schema, libelles);
  return { form, erreurs };
}

export type SolForm = ReturnType<typeof useSolForm>['form'];
