import { updateProspectionVegetation } from './prospection-repository';

export type Humidite = 'surface' | '0_5cm' | '5_12cm' | '12_30cm' | 'gt_30cm';
export type Texture = 'limoneuse' | 'argileuse' | 'sable_fin' | 'gravier' | 'cailloux';
export type DegatsCultures = 'nuls' | 'faibles' | 'moyens' | 'forts';

export const HUMIDITE_OPTIONS: { value: Humidite; label: string }[] = [
  { value: 'surface', label: 'Surf.' },
  { value: '0_5cm', label: '0,5 cm' },
  { value: '5_12cm', label: '5-12 cm' },
  { value: '12_30cm', label: '12-30' },
  { value: 'gt_30cm', label: '>30' },
];

export const TEXTURE_OPTIONS: { value: Texture; label: string }[] = [
  { value: 'limoneuse', label: 'Limoneuse' },
  { value: 'argileuse', label: 'Argileuse' },
  { value: 'sable_fin', label: 'Sable fin' },
  { value: 'gravier', label: 'Gravier' },
  { value: 'cailloux', label: 'Cailloux' },
];

export const DEGATS_OPTIONS: { value: DegatsCultures; label: string }[] = [
  { value: 'nuls', label: 'Nuls' },
  { value: 'faibles', label: 'Faibles' },
  { value: 'moyens', label: 'Moyens' },
  { value: 'forts', label: 'Forts' },
];

export interface VegetationSolState {
  recouvrementHerbeux: number;
  humidite: Humidite | null;
  texture: Texture | null;
  degatsCultures: DegatsCultures | null;
}

export const DEFAULT_VEGETATION_SOL: VegetationSolState = {
  recouvrementHerbeux: 0,
  humidite: null,
  texture: null,
  degatsCultures: null,
};

/** Ramène une valeur de curseur dans la plage [0, 100], arrondie à l'entier. */
export function clampRecouvrement(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)));
}

export function isVegetationSolComplete(state: VegetationSolState): boolean {
  return state.humidite !== null && state.texture !== null && state.degatsCultures !== null;
}

/** Sérialise l'état en JSONB `vegetation` (archival, jamais filtré — cf. ADR-006). */
export function buildVegetationJson(state: VegetationSolState): string {
  return JSON.stringify({ recouvrement_herbeux: state.recouvrementHerbeux });
}

/** Sérialise l'état en JSONB `sol` (archival, jamais filtré — cf. ADR-006). */
export function buildSolJson(state: VegetationSolState): string {
  return JSON.stringify({ humidite: state.humidite, texture: state.texture });
}

export function parseVegetationSol(
  vegetation: string | null,
  sol: string | null,
  degatsCultures: string | null
): VegetationSolState {
  const veg = vegetation ? JSON.parse(vegetation) : {};
  const solParsed = sol ? JSON.parse(sol) : {};
  return {
    recouvrementHerbeux: clampRecouvrement(veg.recouvrement_herbeux ?? 0),
    humidite: (solParsed.humidite as Humidite) ?? null,
    texture: (solParsed.texture as Texture) ?? null,
    degatsCultures: (degatsCultures as DegatsCultures) ?? null,
  };
}

/** Persiste la végétation/sol/dégâts saisis à l'écran Végétation & sol. */
export async function saveVegetationSol(prospectionId: string, state: VegetationSolState): Promise<void> {
  await updateProspectionVegetation(prospectionId, {
    vegetation: buildVegetationJson(state),
    sol: buildSolJson(state),
    degatsCultures: state.degatsCultures,
  });
}
