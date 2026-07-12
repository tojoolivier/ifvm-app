import { updateProspectionVegetation } from './prospection-repository';

export type Humidite = 'surface' | '0_5cm' | '5_12cm' | '12_30cm' | 'gt_30cm';
export type Texture = 'limoneuse' | 'argileuse' | 'sable_fin' | 'gravier' | 'cailloux';
export type DegatsCultures = 'nuls' | 'faibles' | 'moyens' | 'forts';
export type Phenologie = 'verdissement' | 'feuillaison' | 'floraison' | 'fructification' | 'sec';

/** 6 strates du référentiel ORPAD (issue #15) ; `sol_nu` n'a pas de phénologie/hauteur. */
export type StrateKey = 'arboree' | 'arbustive' | 'buissonneuse' | 'herbeuse' | 'cultures_seches' | 'sol_nu';

export const STRATE_KEYS: StrateKey[] = ['arboree', 'arbustive', 'buissonneuse', 'herbeuse', 'cultures_seches', 'sol_nu'];

export const STRATE_LABELS: Record<StrateKey, string> = {
  arboree: 'Arborée',
  arbustive: 'Arbustive',
  buissonneuse: 'Buissonneuse',
  herbeuse: 'Herbeuse',
  cultures_seches: 'Cultures sèches',
  sol_nu: 'Sol nu',
};

/** `sol_nu` n'a pas de couvert végétal : pas de phénologie/hauteur à détailler. */
export const STRATES_DETAILLABLES: StrateKey[] = ['arboree', 'arbustive', 'buissonneuse', 'herbeuse', 'cultures_seches'];

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

export const PHENOLOGIE_OPTIONS: { value: Phenologie; label: string }[] = [
  { value: 'verdissement', label: 'Verdissement' },
  { value: 'feuillaison', label: 'Feuillaison' },
  { value: 'floraison', label: 'Floraison' },
  { value: 'fructification', label: 'Fructification' },
  { value: 'sec', label: 'Sec' },
];

export interface StrateDetail {
  recouvrement: number;
  phenologie: Phenologie | null;
  hauteur: number | null;
}

export type StratesState = Record<StrateKey, StrateDetail>;

export interface VegetationSolState {
  strates: StratesState;
  humidite: Humidite | null;
  texture: Texture | null;
  degatsCultures: DegatsCultures | null;
}

function defaultStrateDetail(): StrateDetail {
  return { recouvrement: 0, phenologie: null, hauteur: null };
}

function defaultStrates(): StratesState {
  return STRATE_KEYS.reduce((acc, key) => {
    acc[key] = defaultStrateDetail();
    return acc;
  }, {} as StratesState);
}

export const DEFAULT_VEGETATION_SOL: VegetationSolState = {
  strates: defaultStrates(),
  humidite: null,
  texture: null,
  degatsCultures: null,
};

/** Ramène une valeur de curseur dans la plage [0, 100], arrondie à l'entier. */
export function clampRecouvrement(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)));
}

/** Somme des recouvrements des 6 strates. Doit atteindre 100 pour valider l'écran. */
export function totalRecouvrement(strates: StratesState): number {
  return STRATE_KEYS.reduce((sum, key) => sum + strates[key].recouvrement, 0);
}

export function isVegetationSolComplete(state: VegetationSolState): boolean {
  return (
    state.humidite !== null &&
    state.texture !== null &&
    state.degatsCultures !== null &&
    totalRecouvrement(state.strates) === 100
  );
}

/** Sérialise l'état en JSONB `vegetation` (archival, jamais filtré — cf. ADR-006). */
export function buildVegetationJson(state: VegetationSolState): string {
  return JSON.stringify({ strates: state.strates });
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
  const strates = defaultStrates();
  const parsedStrates = veg.strates ?? null;
  if (parsedStrates) {
    for (const key of STRATE_KEYS) {
      const detail = parsedStrates[key];
      if (detail) {
        strates[key] = {
          recouvrement: clampRecouvrement(detail.recouvrement ?? 0),
          phenologie: (detail.phenologie as Phenologie) ?? null,
          hauteur: typeof detail.hauteur === 'number' ? detail.hauteur : null,
        };
      }
    }
  } else if (typeof veg.recouvrement_herbeux === 'number') {
    // Ancien format à strate unique (avant #15) : migré vers la strate herbeuse.
    strates.herbeuse = { recouvrement: clampRecouvrement(veg.recouvrement_herbeux), phenologie: null, hauteur: null };
  }
  return {
    strates,
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
