import * as yup from 'yup';
import { Humidite, Texture } from './prospection-fiche-lecture';

export interface StrateFormValues {
  surfRel: number | null;
  hMoy: number | null;
  recouvrement: number;
  verdissement: number | null;
  repousse: number | null;
  orpad: string[];
}

export interface VegetationFormValues {
  humidite: Humidite | null;
  texture: Texture | null;
}

export const vegetationSchema = yup.object({
  humidite: yup.string().nullable().required('Humidité du sol requise'),
  texture: yup.string().nullable().required('Texture du sol requise'),
});
