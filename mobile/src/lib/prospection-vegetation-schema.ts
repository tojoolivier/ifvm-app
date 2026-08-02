import * as yup from 'yup';
import { DegatsCultures, Humidite, Texture } from './prospection-fiche-lecture';

export interface VegetationFormValues {
  recouvrement: number;
  humidite: Humidite | null;
  texture: Texture | null;
  degatsCultures: DegatsCultures | null;
}

export const vegetationSchema = yup.object({
  recouvrement: yup.number().min(0).max(100).required(),
  humidite: yup.string().nullable().required('Humidité du sol requise'),
  texture: yup.string().nullable().required('Texture du sol requise'),
  degatsCultures: yup.string().nullable().required('Dégâts sur culture requis'),
});
