import { useMemo } from 'react';
import { useForm, useStore } from '@tanstack/react-form';
import { useTranslation } from 'react-i18next';
import type { Schema } from 'yup';
import { useErreursFormulaire } from '@/hooks/use-erreurs-formulaire';
import type { FiltreObservation } from '@/lib/prospection-observation';
import { creerObservationSchema } from '@/lib/prospection-observation-schema';

/** Formulaire de l'étape « Qu'avez-vous observé ? » : TanStack Form + schéma Yup (`onChangeAsync`). */
export function useObservationForm(valeursInitiales: FiltreObservation) {
  const { t } = useTranslation();
  const schema: Schema = useMemo(() => creerObservationSchema((cle) => t(cle as never)), [t]);
  const form = useForm({ defaultValues: valeursInitiales, validators: { onChangeAsync: schema as never } });
  const libelles = useMemo(() => ({ grilles: t('prospection.observation.manque') }), [t]);
  const erreurs = useErreursFormulaire(form as never, schema, libelles);
  const filtre = useStore(form.store, (s) => s.values);

  /** Applique une transition du module pur (`basculerGrille`, …) sur les deux champs du formulaire. */
  const appliquer = (transition: (f: FiltreObservation) => FiltreObservation) => {
    const suivant = transition(form.state.values);
    form.setFieldValue('aucunCriquet', suivant.aucunCriquet);
    form.setFieldValue('grilles', suivant.grilles);
  };

  return { form, filtre, appliquer, erreurs };
}
