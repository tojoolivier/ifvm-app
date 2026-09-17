import { CaptureRead, InfestationRead, PopulationRead, ProspectionRead } from './api-client';

export const STATUT_VALIDE = 'validee';

export type Phenotype = 'solitaire' | 'solitaro_trans' | 'transiens' | 'gregaire';

export const PHENOTYPES: { value: Phenotype; label: string }[] = [
  { value: 'solitaire', label: 'Solitaires' },
  { value: 'solitaro_trans', label: 'Solitaro-transiens' },
  { value: 'transiens', label: 'Transiens' },
  { value: 'gregaire', label: 'Grégaires' },
];

/** NSE larve n'a pas de phénotype intermédiaire "Solitaro-transiens" (PDF). */
export const PHENOTYPES_3: { value: Phenotype; label: string }[] = PHENOTYPES.filter(
  (p) => p.value !== 'solitaro_trans'
);

// "essaim" a disparu (migration backend 0031) : la densité de l'essaim est désormais le
// type de cible lui-même, au même niveau que "Vol clair" — plus une sous-classification.
type TypeCible = 'tache_larvaire' | 'bande_larvaire' | 'vol_clair' | 'dense' | 'tres_dense';

export const TYPE_CIBLE_OPTIONS: { value: TypeCible; label: string }[] = [
  { value: 'tache_larvaire', label: 'Tache larvaire' },
  { value: 'bande_larvaire', label: 'Bande larvaire' },
  { value: 'vol_clair', label: 'Vol clair' },
  { value: 'dense', label: 'Dense' },
  { value: 'tres_dense', label: 'Très dense' },
];

export type Humidite = 'surface' | '0_5cm' | '5_12cm' | '12_30cm' | 'gt_30cm';
export type Texture = 'limoneuse' | 'argileuse' | 'sable_fin' | 'sable_grossier' | 'gravier' | 'cailloux' | 'bloc';
export type DegatsCultures = 'nuls' | 'faibles' | 'moyens' | 'forts';
/** Niveaux phénologiques (Germination — ex-ORPAD, PDF cols f-j — Feuille, Fleur,
 * Fruit, Sec) : multi-select par strate, pas exclusif, mêmes 3 valeurs pour les 5
 * champs. */
export type PhenologieStage = 'Néant' | 'Rare' | 'Beaucoup';
export type StrateKey = 'arboree' | 'arbustive' | 'buissonneuse' | 'herbeuse' | 'cultures_seches' | 'cultures_hygro';

export const PHENOLOGIE_STAGES: PhenologieStage[] = ['Néant', 'Rare', 'Beaucoup'];

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
  // Présence/Absence (#repousse-presence-absence) — jamais un pourcentage saisi,
  // contrairement à verdissement.
  repousse: boolean | null;
  /** Germination — nom historique "orpad" conservé côté données (fiches déjà
   * synchronisées avant le renommage d'affichage), seul le libellé UI a changé. */
  orpad: string[];
  feuille: string[];
  fleur: string[];
  fruit: string[];
  sec: string[];
}

export type StratesState = Record<StrateKey, StrateDetail>;

export interface VegetationSolState {
  strates: StratesState;
  // Sol nu (%) — au niveau de la station, pas par strate (issue #278) : avec le
  // `recouvrement` des 6 strates, partitionne 100% de la surface de la station
  // prospectée. Saisi comme le recouvrement (stepper par pas de 5%), pas en décimal
  // libre — cf. veg.tsx.
  solNu: number | null;
  // Sélection multiple (#humidite-multiselect, même mécanisme que Texture juste en
  // dessous) : toujours un tableau, jamais une valeur scalaire — un ancien brouillon
  // enregistré avant le passage au multi-select peut encore porter une simple string,
  // normalisée en tableau à un élément.
  humidite: Humidite[];
  // Sélection multiple (cf. veg.tsx "Texture du sol (sélection multiple)") : toujours un
  // tableau, jamais une valeur scalaire — un ancien brouillon enregistré avant l'ajout du
  // multi-select peut encore porter une simple string, normalisée en tableau à un élément.
  texture: Texture[];
  degatsCultures: DegatsCultures | null;
}

/** Accepte le format actuel (tableau) et l'ancien format scalaire d'un brouillon antérieur. */
function normalizeHumiditeSelection(raw: unknown): Humidite[] {
  if (Array.isArray(raw)) return raw.filter((h): h is Humidite => typeof h === 'string');
  if (typeof raw === 'string' && raw) return [raw as Humidite];
  return [];
}

/** Accepte le format actuel (tableau) et l'ancien format scalaire d'un brouillon antérieur. */
function normalizeTextureSelection(raw: unknown): Texture[] {
  if (Array.isArray(raw)) return raw.filter((t): t is Texture => typeof t === 'string');
  if (typeof raw === 'string' && raw) return [raw as Texture];
  return [];
}

export function defaultStrateDetail(): StrateDetail {
  return {
    surfRel: null,
    hMoy: null,
    recouvrement: 0,
    verdissement: null,
    repousse: null,
    orpad: [],
    feuille: [],
    fleur: [],
    fruit: [],
    sec: [],
  };
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
          repousse: typeof detail.repousse === 'boolean' ? detail.repousse : null,
          orpad: Array.isArray(detail.orpad) ? detail.orpad : [],
          feuille: Array.isArray(detail.feuille) ? detail.feuille : [],
          fleur: Array.isArray(detail.fleur) ? detail.fleur : [],
          fruit: Array.isArray(detail.fruit) ? detail.fruit : [],
          sec: Array.isArray(detail.sec) ? detail.sec : [],
        };
      }
    }
  }
  return {
    strates,
    solNu: typeof solParsed.solNu === 'number' ? solParsed.solNu : null,
    humidite: normalizeHumiditeSelection(solParsed.humidite),
    texture: normalizeTextureSelection(solParsed.texture),
    degatsCultures: (degatsCultures as DegatsCultures) ?? null,
  };
}

/**
 * Répartition de la surface de la station (issue #278) : sol nu + recouvrement des 6
 * strates doit totaliser 100% de la station prospectée — même grandeur et même pas de
 * saisie (stepper 5%) que le recouvrement par strate, pour que sol nu et strates
 * s'additionnent dans la même unité.
 */
export function computeSurfaceRepartitionTotal(state: Pick<VegetationSolState, 'strates' | 'solNu'>): number {
  const recouvrementTotal = STRATE_KEYS.reduce((sum, key) => sum + state.strates[key].recouvrement, 0);
  return recouvrementTotal + (state.solNu ?? 0);
}

/** Tolérance d'arrondi de saisie (dixième de pourcent) — pas d'égalité stricte à 100. */
const TOLERANCE_REPARTITION_SURFACE = 0.1;

export function isSurfaceRepartitionValide(state: Pick<VegetationSolState, 'strates' | 'solNu'>): boolean {
  return Math.abs(computeSurfaceRepartitionTotal(state) - 100) <= TOLERANCE_REPARTITION_SURFACE;
}

export function buildVegetationSummary(state: VegetationSolState): string {
  const strateParts = STRATE_KEYS.filter((key) => state.strates[key].recouvrement > 0)
    .map((key) => `${STRATE_LABELS[key]} ${state.strates[key].recouvrement}%`)
    .join(', ');
  const parts: string[] = [strateParts ? `Strates : ${strateParts}` : 'Strates : —'];
  if (state.solNu != null) {
    parts.push(`Sol nu ${state.solNu}%`);
  }
  if (state.humidite.length > 0) {
    // Sélection multiple : tous les niveaux cochés apparaissent, pas seulement le premier.
    const labels = state.humidite
      .map((h) => HUMIDITE_OPTIONS.find((o) => o.value === h)?.label ?? h)
      .join(', ');
    parts.push(`Humidité ${labels}`);
  }
  if (state.texture.length > 0) {
    // Sélection multiple : toutes les textures cochées apparaissent, pas seulement la première.
    const labels = state.texture
      .map((t) => TEXTURE_OPTIONS.find((o) => o.value === t)?.label ?? t)
      .join(', ');
    parts.push(`Texture ${labels}`);
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
    const especePopulations = populations.filter((p) => p.espece === espece);
    // #nombre-de-capture-fiable : la Prospection Intensive enregistre ses captures
    // dans `captures` (grille chronométrée, c.effectif) et ne renseigne jamais
    // `population.captures_nombre` (toujours null, cf. density.tsx/accouplement.tsx) ;
    // la Prospection Extensive fait l'inverse — un seul total par espèce/catégorie
    // dans `population.captures_nombre`, jamais de ligne dans `captures`. Sommer les
    // deux sources couvre les deux fiches sans double comptage ni régression pour
    // l'une ou l'autre : un « Total capturé » à 0 malgré une fiche Extensive bien
    // renseignée était le signe que seule la première source était lue ici.
    const totalCaptures =
      especeCaptures.reduce((sum, c) => sum + c.effectif, 0) +
      especePopulations.reduce((sum, p) => sum + (p.captures_nombre ?? 0), 0);

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
  surfaceTotale: number | null;
  comportementLabel: string;
  pullulationNb: number | null;
  tailleEssaim: string;
  typeEssaim: string | null;
  typeLarve: string | null;
  surfaceContamineeHa: number | null;
  surfaceInfesteePourcent: number | null;
}

/** Bandeau niveau d'infestation : type de cible, surface, comportement — dérivé de la ligne prospection_infestation. */
export function buildInfestationSynthese(infestations: InfestationRead[]): InfestationSyntheseViewModel {
  const infestation = infestations[0];
  if (!infestation) {
    return {
      hasInfestation: false,
      typeLabel: '—',
      surfaceTotale: null,
      comportementLabel: '—',
      pullulationNb: null,
      tailleEssaim: '—',
      typeEssaim: null,
      typeLarve: null,
      surfaceContamineeHa: null,
      surfaceInfesteePourcent: null,
    };
  }

  const tailleParts: string[] = [];
  if (infestation.taille_long) tailleParts.push(`L:${infestation.taille_long}m`);
  if (infestation.taille_large) tailleParts.push(`l:${infestation.taille_large}m`);
  if (infestation.taille_epaisseur) tailleParts.push(`E:${infestation.taille_epaisseur}m`);

  return {
    hasInfestation: true,
    typeLabel: TYPE_CIBLE_OPTIONS.find((o) => o.value === infestation.type_cible)?.label ?? infestation.type_cible,
    surfaceTotale: infestation.surface_totale ?? null,
    comportementLabel: infestation.comportement === 'deplacement' ? 'Déplacement' : infestation.comportement === 'repos' ? 'Repos' : '—',
    pullulationNb: infestation.pullulation_nb ?? null,
    tailleEssaim: tailleParts.length > 0 ? tailleParts.join(' ') : '—',
    typeEssaim: infestation.type_essaim ?? null,
    typeLarve: infestation.type_larve ?? null,
    surfaceContamineeHa: infestation.surface_contaminee_ha ?? null,
    surfaceInfesteePourcent: infestation.surface_infestee_pourcent ?? null,
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

/**
 * `HH:mm` en heure locale de l'appareil, à partir d'un timestamp ISO (ex.
 * `heure_observation_at`, capturé au moment de l'acquisition GPS sur observations.tsx).
 * Partagé entre l'écran (affichage au moment de la saisie) et le récapitulatif (lecture
 * depuis le brouillon déjà enregistré) — une seule implémentation du format.
 */
export function formatHeureLocale(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}