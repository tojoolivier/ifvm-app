import * as yup from 'yup';
import { DegatsCultures } from './prospection-fiche-lecture';

export interface ObservationsFormValues {
  degatsCultures: DegatsCultures | null;
  ennemisSelected: string[];
  ennemisAutre: string;
  observation: string;
}

export const observationsSchema = yup.object({
  degatsCultures: yup.string().nullable().required('Dégâts sur culture requis'),
  ennemisSelected: yup.array().of(yup.string().required()).default([]),
  ennemisAutre: yup.string().optional(),
  observation: yup.string().optional(),
});
