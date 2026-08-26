import * as yup from 'yup';

export interface ReferenceFormValues {
  surfaceStation: string;
  surfaceProspectee: string;
  surfaceInfestee: string;
}

/** Contrainte métier ADR-006 : infestée <= prospectée <= station. */
export const referenceSchema = yup.object({
  surfaceStation: yup
    .number()
    .typeError('La surface station doit être un nombre')
    .positive('La surface station doit être positive')
    .required('Surface station requise'),
  surfaceProspectee: yup
    .number()
    .typeError('La surface prospectée doit être un nombre')
    .positive('La surface prospectée doit être positive')
    .required('Surface prospectée requise')
    .max(yup.ref('surfaceStation'), 'La surface prospectée ne peut pas dépasser la surface station'),
  surfaceInfestee: yup
    .number()
    .typeError('La surface infestée doit être un nombre')
    .transform((value, originalValue) => (originalValue === '' || originalValue == null ? 0 : value))
    .min(0, 'La surface infestée ne peut pas être négative')
    .max(yup.ref('surfaceProspectee'), 'La surface infestée ne peut pas dépasser la surface prospectée'),
    biotope: yup
    .string()
    .oneOf(['xerophyle', 'mesophyle', 'hydrophyle'] as const)
    .nullable(),
});