import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from '@tanstack/react-form';
import type { Schema } from 'yup';
import { useErreursFormulaire } from '@/hooks/use-erreurs-formulaire';
import { creerReferenceSchema, type ModeReference, type ReferenceValeurs } from '@/lib/prospection-reference-schema';

/**
 * Formulaire de l'étape Référence : TanStack Form + schéma Yup (`onChangeAsync`, Yup étant asynchrone
 * côté Standard Schema) et erreurs dérivées pour le socle UI (message de champ, « Il manque : … »).
 */
export function useReferenceForm(mode: ModeReference, valeursInitiales: ReferenceValeurs) {
  const { t } = useTranslation();
  // Les messages du schéma sont des clés de `fr.ts` composées à l'exécution, alors que `t` est typé sur les
  // clés connues : le cast est confiné ici (les clés sont vérifiées par les tests du schéma).
  const schema: Schema = useMemo(() => creerReferenceSchema(mode, (cle) => t(cle as never)), [mode, t]);
  // TanStack type le validateur sur les valeurs du formulaire ; le schéma varie selon le mode (2 ou 3 surfaces).
  const form = useForm({ defaultValues: valeursInitiales, validators: { onChangeAsync: schema as never } });
  const libelles = useMemo(
    () => ({
      surface_station: t('prospection.reference.surfaceStation'),
      surface_prospectee: t('prospection.reference.surfaceProspectee'),
      biotope: t('prospection.reference.biotopeLibelle'),
    }),
    [t]
  );
  // `useErreursFormulaire` attend un `AnyFormApi` : un formulaire typé n'y est pas assignable (écouteurs).
  const erreurs = useErreursFormulaire(form as never, schema, libelles);
  return { form, erreurs };
}

export type ReferenceForm = ReturnType<typeof useReferenceForm>['form'];
export type ErreursReference = ReturnType<typeof useReferenceForm>['erreurs'];
