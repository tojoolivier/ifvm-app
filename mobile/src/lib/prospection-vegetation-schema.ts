import * as yup from 'yup';
import { Humidite, Texture } from './prospection-fiche-lecture';

export interface StrateFormValues {
  surfRel: number | null;
  hMoy: number | null;
  recouvrement: number;
  verdissement: number | null;
  // Présence/Absence (pas un pourcentage saisi) : renommé de "% Repousse" à
  // "Repousse" (#repousse-presence-absence) — la fiche papier n'attend qu'une
  // constatation binaire à cet endroit, pas une valeur mesurée.
  repousse: boolean | null;
  orpad: string[];
  feuille: string[];
  fleur: string[];
  fruit: string[];
  sec: string[];
}

export interface VegetationFormValues {
  humidite: Humidite | null;
  texture: Texture | null;
}

export const vegetationSchema = yup.object({
  humidite: yup.string().nullable().required('Humidité du sol requise'),
  texture: yup.string().nullable().required('Texture du sol requise'),
});
