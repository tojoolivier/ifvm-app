import type { ProspectionCreate } from '@/lib/prospection-db';
import { object, string } from 'yup';
import { versNombre, versTexte } from '@/lib/prospection-vegetation-schema';

/** Dégâts sur les cultures, tels que la colonne `degats_cultures` les accepte. */
export type DegatsCultures = NonNullable<ProspectionCreate['degats_cultures']>;

/** Valeurs du formulaire : hauteur (cm) et verdissement restent du texte (virgule française). */
export interface VegetationExtensiveValeurs {
  hauteurCm: string;
  verdissement: string;
  degats: DegatsCultures | null;
}

type Brouillon = Pick<ProspectionCreate, 'hauteur_herbe_cm' | 'verdissement_pourcent' | 'degats_cultures'>;

/** Reprise d'un brouillon : en extensif, tout vit dans des colonnes (pas de JSON `vegetation`). */
export function valeursDeVegetationExtensive(b: Partial<Brouillon>): VegetationExtensiveValeurs {
  return { hauteurCm: versTexte(b.hauteur_herbe_cm), verdissement: versTexte(b.verdissement_pourcent), degats: b.degats_cultures ?? null };
}

/** Colonnes à enregistrer : un champ vide vaut `null`, jamais 0. */
export function champsDeVegetationExtensive(v: VegetationExtensiveValeurs): Brouillon {
  return { hauteur_herbe_cm: versNombre(v.hauteurCm), verdissement_pourcent: versNombre(v.verdissement), degats_cultures: v.degats };
}

/** Raccourcis de verdissement de la maquette 02a, en plus du champ libre. */
export const RACCOURCIS_VERDISSEMENT = [0, 25, 50, 75, 100] as const;

/** Schéma du formulaire : hauteur (cm, ≥ 0) et verdissement (0–100 %) facultatifs mais, s'ils sont saisis, numériques. */
export function creerVegetationExtensiveSchema(t: (cle: string) => string) {
  const nombre = (min: number, max: number | null, cle: string) =>
    string()
      .default('')
      .test('nombre', t(cle), (v) => {
        if (!v || v.trim() === '') return true;
        const n = versNombre(v);
        return n !== null && n >= min && (max === null || n <= max);
      });
  return object({
    hauteurCm: nombre(0, null, 'prospection.vegetation.extensive.erreurs.hauteur'),
    verdissement: nombre(0, 100, 'prospection.vegetation.erreurs.verdissement'),
  });
}
