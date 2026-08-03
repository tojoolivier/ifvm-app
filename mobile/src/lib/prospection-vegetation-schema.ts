import * as yup from 'yup';
import { Humidite, Texture } from './prospection-fiche-lecture';

export interface StrateFormValues {
  surfRel: number | null;
  hMoy: number | null;
  recouvrement: number;
  verdissement: number | null;
  repousse: number | null;
  orpad: string[];
  solNu: number | null;
}

export interface VegetationFormValues {
  strate: StrateFormValues;
  humidite: Humidite | null;
  texture: Texture | null;
}

const strateSchema = yup.object({
  surfRel: yup.number().nullable().min(0).max(100),
  hMoy: yup.number().nullable().min(0),
  recouvrement: yup.number().min(0).max(100).required(),
  verdissement: yup.number().nullable().min(0).max(100),
  repousse: yup.number().nullable().min(0).max(100),
  orpad: yup.array().of(yup.string().required()).default([]),
  solNu: yup.number().nullable().min(0).max(100),
});

export const vegetationSchema = yup.object({
  strate: strateSchema.required(),
  humidite: yup.string().nullable().required('Humidité du sol requise'),
  texture: yup.string().nullable().required('Texture du sol requise'),
});
