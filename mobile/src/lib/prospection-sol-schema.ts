import { array, mixed, object } from 'yup';
import type { ProspectionCreate } from '@/lib/prospection-db';
import type { DegatsCultures } from '@/lib/prospection-vegetation-extensive-schema';

/** Profondeurs d'humidité, codes stockés dans `sol.humidite` (identiques à ceux du PDF backend). */
export const HUMIDITES = ['surface', '0_5cm', '5_12cm', '12_30cm', 'gt_30cm'] as const;
export type Humidite = (typeof HUMIDITES)[number];

/** Textures, codes stockés dans `sol.texture` (identiques à ceux du PDF backend). */
export const TEXTURES = ['argileuse', 'limoneuse', 'sable_fin', 'sable_grossier', 'gravier', 'cailloux', 'bloc'] as const;
export type Texture = (typeof TEXTURES)[number];

/** Valeurs du formulaire : multi-sélection humidité et texture, choix unique de dégâts (colonne `degats_cultures`). */
export interface SolValeurs {
  humidite: Humidite[];
  texture: Texture[];
  degats: DegatsCultures | null;
}

type Brouillon = Pick<ProspectionCreate, 'sol' | 'degats_cultures'>;

/** Codes connus du JSON `sol` (libre côté serveur) : le reste est ignoré ; un ancien brouillon scalaire devient `[valeur]`. */
const codesConnus = <T extends string>(valeur: unknown, connus: readonly T[]): T[] => {
  const liste = Array.isArray(valeur) ? valeur : typeof valeur === 'string' ? [valeur] : [];
  return connus.filter((c) => liste.includes(c));
};

/** Reprise d'un brouillon : humidité et texture vivent dans le JSON `sol`, les dégâts dans leur colonne. */
export function valeursDeSol({ sol, degats_cultures }: Partial<Brouillon>): SolValeurs {
  return { humidite: codesConnus(sol?.humidite, HUMIDITES), texture: codesConnus(sol?.texture, TEXTURES), degats: degats_cultures ?? null };
}

/** Champs à enregistrer : `sol` garde `solNu` (saisi à l'étape Végétation) et le reste de son JSON. */
export function champsDeSol({ sol }: Partial<Brouillon>, v: SolValeurs) {
  return { sol: { ...sol, humidite: v.humidite, texture: v.texture }, degats_cultures: v.degats };
}

/** Schéma du formulaire : humidité et texture obligatoires (au moins un choix), dégâts facultatifs. */
export function creerSolSchema(t: (cle: string) => string) {
  return object({
    humidite: array().of(mixed<Humidite>().defined()).default([]).min(1, t('prospection.sol.erreurs.humidite')),
    texture: array().of(mixed<Texture>().defined()).default([]).min(1, t('prospection.sol.erreurs.texture')),
    degats: mixed<DegatsCultures>().nullable().default(null),
  });
}
