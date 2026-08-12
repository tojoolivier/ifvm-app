import { CaptureRead, InfestationRead, PopulationRead, ProspectionRead } from './api-client';

export const STATUT_VALIDE = 'validee';

export type Phenotype = 'solitaire' | 'solitaro_trans' | 'transiens' | 'gregaire';

export const PHENOTYPES: { value: Phenotype; label: string }[] = [
  { value: 'solitaire', label: 'Solitaires' },
  { value: 'solitaro_trans', label: 'Solitaro-trans' },
  { value: 'transiens', label: 'Transiens' },
  { value: 'gregaire', label: 'Grégaires' },
];

/** NSE larve n'a pas de phénotype intermédiaire "Solitaro-trans" (PDF). */
export const PHENOTYPES_3: { value: Phenotype; label: string }[] = PHENOTYPES.filter(
  (p) => p.value !== 'solitaro_trans'
);

type TypeCible = 'tache_larvaire' | 'bande_larvaire' | 'vol_clair' | 'essaim';

export const TYPE_CIBLE_OPTIONS: { value: TypeCible; label: string }[] = [
  { value: 'tache_larvaire', label: 'Tache larvaire' },
  { value: 'bande_larvaire', label: 'Bande larvaire' },
  { value: 'vol_clair', label: 'Vol clair' },
  { value: 'essaim', label: 'Essaim' },
];

export type Humidite = 'surface' | '0_5cm' | '5_12cm' | '12_30cm' | 'gt_30cm';
export type Texture = 'limoneuse' | 'argileuse' | 'sable_fin' | 'sable_grossier' | 'gravier' | 'cailloux' | 'bloc';
export type DegatsCultures = 'nuls' | 'faibles' | 'moyens' | 'forts';
/** Stades ORPAD (PDF cols f-j) : multi-select par strate, pas exclusif. */
export type OrpadStage = 'Germ.' | 'Feuille' | 'Fleur' | 'Fruit' | 'Sec';
export type StrateKey = 'arboree' | 'arbustive' | 'buissonneuse' | 'herbeuse' | 'cultures_seches' | 'cultures_hygro';

export const ORPAD_STAGES: OrpadStage[] = ['Germ.', 'Feuille', 'Fleur', 'Fruit', 'Sec'];

/** Les 6 strates du PDF (rows 37-42). "Sol nu" n'est pas une strate : c'est un champ (`solNu`) à l'intérieur de chaque strate (col k). */
export const STRATE_KEYS: StrateKey[] = ['arboree', 'arbustive', 'buissonneuse', 'herbeuse', 'cultures_seches', 'cultures_hygro'];

export const STRATE_LABELS: Record<StrateKey, string> = {
  arboree: 'Strate arborée',
  arbustive: 'Strate arbustive',
  buissonneuse: 'Strate buissonneuse',
  herbeuse: 'Strate herbeuse',
  cultures_seches: 'Cultures sèches',
  cultures_hygro: 'Cultures hygrophiles',
};

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
  { value: 'sable_grossier', label: 'Sable grossier' },
  { value: 'gravier', label: 'Gravier' },
  { value: 'cailloux', label: 'Cailloux' },
  { value: 'bloc', label: 'Bloc' },
];

export const DEGATS_OPTIONS: { value: DegatsCultures; label: string }[] = [
  { value: 'nuls', label: 'Nuls' },
  { value: 'faibles', label: 'Faibles' },
  { value: 'moyens', label: 'Moyens' },
  { value: 'forts', label: 'Forts' },
];

export interface StrateDetail {
  surfRel: number | null;
  hMoy: number | null;
  recouvrement: number;
  verdissement: number | null;
  repousse: number | null;
  orpad: string[];
  solNu: number | null;
}

export type StratesState = Record<StrateKey, StrateDetail>;

export interface VegetationSolState {
  strates: StratesState;
  humidite: Humidite | null;
  texture: Texture | null;
  degatsCultures: DegatsCultures | null;
}

export function defaultStrateDetail(): StrateDetail {
  return { surfRel: null, hMoy: null, recouvrement: 0, verdissement: null, repousse: null, orpad: [], solNu: null };
}

function defaultStrates(): StratesState {
  return STRATE_KEYS.reduce((acc, key) => {
    acc[key] = defaultStrateDetail();
    return acc;
  }, {} as StratesState);
}

function clampRecouvrement(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)));
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
          surfRel: typeof detail.surfRel === 'number' ? detail.surfRel : null,
          hMoy: typeof detail.hMoy === 'number' ? detail.hMoy : null,
          recouvrement: clampRecouvrement(detail.recouvrement ?? 0),
          verdissement: typeof detail.verdissement === 'number' ? detail.verdissement : null,
          repousse: typeof detail.repousse === 'number' ? detail.repousse : null,
          orpad: Array.isArray(detail.orpad) ? detail.orpad : [],
          solNu: typeof detail.solNu === 'number' ? detail.solNu : null,
        };
      }
    }
  }
  return {
    strates,
    humidite: (solParsed.humidite as Humidite) ?? null,
    texture: (solParsed.texture as Texture) ?? null,
    degatsCultures: (degatsCultures as DegatsCultures) ?? null,
  };
}

export function buildVegetationSummary(state: VegetationSolState): string {
  const strateParts = STRATE_KEYS.filter((key) => state.strates[key].recouvrement > 0)
    .map((key) => `${STRATE_LABELS[key]} ${state.strates[key].recouvrement}%`)
    .join(', ');
  const parts: string[] = [strateParts ? `Strates : ${strateParts}` : 'Strates : —'];
  if (state.humidite) {
    parts.push(`Humidité ${HUMIDITE_OPTIONS.find((o) => o.value === state.humidite)?.label}`);
  }
  if (state.texture) {
    parts.push(`Texture ${TEXTURE_OPTIONS.find((o) => o.value === state.texture)?.label}`);
  }
  if (state.degatsCultures) {
    parts.push(`Dégâts culture ${DEGATS_OPTIONS.find((o) => o.value === state.degatsCultures)?.label}`);
  }
  return parts.join(' · ');
}

/** Une fiche n'est consultable en lecture (#16) que si elle a atteint le statut final Validé. */
export function isFicheValidee(prospection: Pick<ProspectionRead, 'statut'>): boolean {
  return prospection.statut === STATUT_VALIDE;
}

export interface EspeceSyntheseViewModel {
  espece: string;
  totalCaptures: number;
  densiteDiffuse: number | null;
  densiteGroupee: number | null;
  phenotypeDominantLabel: string;
}

/** Synthèse par espèce (LMC/NSE) : totaux capturés, densité /ha, phénotype dominant — dérivée des lignes déjà chargées. */
export function buildEspecesSynthese(
  captures: CaptureRead[],
  populations: PopulationRead[]
): EspeceSyntheseViewModel[] {
  const especes = [...new Set([...captures.map((c) => c.espece), ...populations.map((p) => p.espece)])].sort();

  return especes.map((espece) => {
    const especeCaptures = captures.filter((c) => c.espece === espece);
    const totalCaptures = especeCaptures.reduce((sum, c) => sum + c.effectif, 0);

    const parPhase = new Map<string, number>();
    for (const c of especeCaptures) {
      parPhase.set(c.phase, (parPhase.get(c.phase) ?? 0) + c.effectif);
    }
    let dominant: string | null = null;
    let max = 0;
    for (const [phase, total] of parPhase) {
      if (total > max) {
        max = total;
        dominant = phase;
      }
    }

    const especePopulations = populations.filter((p) => p.espece === espece);
    const densiteDiffuse = especePopulations.reduce<number | null>(
      (acc, p) => (p.densite_diffuse != null ? (acc ?? 0) + p.densite_diffuse : acc),
      null
    );
    const densiteGroupee = especePopulations.reduce<number | null>(
      (acc, p) => (p.densite_groupee != null ? (acc ?? 0) + p.densite_groupee : acc),
      null
    );

    return {
      espece,
      totalCaptures,
      densiteDiffuse,
      densiteGroupee,
      phenotypeDominantLabel: dominant
        ? PHENOTYPES.find((p) => p.value === dominant)?.label ?? dominant
        : '—',
    };
  });
}

export interface InfestationSyntheseViewModel {
  hasInfestation: boolean;
  typeLabel: string;
  surfaceTot: number | null;
  comportementLabel: string;
  pullulationNb: number | null;
  tailleEssaim: string;
  typeEssaim: string | null;
  typeLarve: string | null;
  surfaceContamineeHa: number | null;
  surfInfesteePourcent: number | null;
}

/** Bandeau niveau d'infestation : type de cible, surface, comportement — dérivé de la ligne prospection_infestation. */
export function buildInfestationSynthese(infestations: InfestationRead[]): InfestationSyntheseViewModel {
  const infestation = infestations[0];
  if (!infestation) {
    return {
      hasInfestation: false,
      typeLabel: '—',
      surfaceTot: null,
      comportementLabel: '—',
      pullulationNb: null,
      tailleEssaim: '—',
      typeEssaim: null,
      typeLarve: null,
      surfaceContamineeHa: null,
      surfInfesteePourcent: null,
    };
  }

  const tailleParts: string[] = [];
  if (infestation.taille_long) tailleParts.push(`L:${infestation.taille_long}m`);
  if (infestation.taille_large) tailleParts.push(`l:${infestation.taille_large}m`);
  if (infestation.taille_epaisseur) tailleParts.push(`E:${infestation.taille_epaisseur}m`);

  return {
    hasInfestation: true,
    typeLabel: TYPE_CIBLE_OPTIONS.find((o) => o.value === infestation.type_cible)?.label ?? infestation.type_cible,
    surfaceTot: infestation.surface_tot ?? null,
    comportementLabel: infestation.comportement === 'deplacement' ? 'Déplacement' : infestation.comportement === 'repos' ? 'Repos' : '—',
    pullulationNb: infestation.pullulation_nb ?? null,
    tailleEssaim: tailleParts.length > 0 ? tailleParts.join(' ') : '—',
    typeEssaim: infestation.type_essaim ?? null,
    typeLarve: infestation.type_larve ?? null,
    surfaceContamineeHa: infestation.surface_contaminee_ha ?? null,
    surfInfesteePourcent: infestation.surf_infestee_pourcent ?? null,
  };
}

export interface FicheLectureViewModel {
  nFiche: string;
  statutLabel: string;
  stationLabel: string;
  dateProspection: string;
  especes: EspeceSyntheseViewModel[];
  infestation: InfestationSyntheseViewModel;
  vegetationSummary: string;
  region: string | null;
  district: string | null;
  commune: string | null;
  za: string | null;
  pa_code: string | null;
  degatsCulturesPourcent: number | null;
  verdissementPourcent: number | null;
  hauteurHerbeCm: number | null;
}

/** Construit la vue de la Fiche de lecture (#16) à partir de la fiche telle que renvoyée par l'API — aucune resaisie. */
export function buildFicheLecture(prospection: ProspectionRead): FicheLectureViewModel {
  return {
    nFiche: prospection.n_fiche ?? '—',
    statutLabel: 'Validée ✓',
    stationLabel: prospection.station_id ?? formatCoordinates(prospection.latitude, prospection.longitude),
    dateProspection: prospection.date_prospection,
    especes: buildEspecesSynthese(prospection.captures, prospection.populations),
    infestation: buildInfestationSynthese(prospection.infestations),
    vegetationSummary: buildVegetationSummary(
      parseVegetationSol(
        prospection.vegetation ? JSON.stringify(prospection.vegetation) : null,
        prospection.sol ? JSON.stringify(prospection.sol) : null,
        prospection.degats_cultures
      )
    ),
    region: prospection.region ?? null,
    district: prospection.district ?? null,
    commune: prospection.commune ?? null,
    za: prospection.za ?? null,
    pa_code: prospection.pa_code ?? null,
    degatsCulturesPourcent: prospection.degats_cultures_pourcent ?? null,
    verdissementPourcent: prospection.verdissement_pourcent ?? null,
    hauteurHerbeCm: prospection.hauteur_herbe_cm ?? null,
  };
}

function formatCoordinates(latitude: number | null, longitude: number | null): string {
  if (latitude == null || longitude == null) return '—';
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}