import * as yup from 'yup';

export interface ReferenceFormValues {
  surfStation: string;
  surfProspectee: string;
  surfInfestee: string;
}

/** Contrainte métier ADR-006 : infestée <= prospectée <= station. */
export const referenceSchema = yup.object({
  surfStation: yup
    .number()
    .typeError('La surface station doit être un nombre')
    .positive('La surface station doit être positive')
    .required('Surface station requise'),
  surfProspectee: yup
    .number()
    .typeError('La surface prospectée doit être un nombre')
    .positive('La surface prospectée doit être positive')
    .required('Surface prospectée requise')
    .max(yup.ref('surfStation'), 'La surface prospectée ne peut pas dépasser la surface station'),
  surfInfestee: yup
    .number()
    .typeError('La surface infestée doit être un nombre')
    .min(0, 'La surface infestée ne peut pas être négative')
    .required('Surface infestée requise')
    .max(yup.ref('surfProspectee'), 'La surface infestée ne peut pas dépasser la surface prospectée'),
});
