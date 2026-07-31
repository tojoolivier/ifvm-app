import { CaptureRead, InfestationRead, PopulationRead, ProspectionRead } from './api-client';
import { PHENOTYPES } from './prospection-captures';
import { TYPE_CIBLE_OPTIONS } from './prospection-infestation';
import { parseVegetationSol } from './prospection-vegetation';
import { buildVegetationSummary } from './prospection-recapitulatif';

export const STATUT_VALIDE = 'validee';

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
    surfaceTot: infestation.surface_tot,
    comportementLabel: infestation.comportement === 'deplacement' ? 'Déplacement' : infestation.comportement === 'repos' ? 'Repos' : '—',
    pullulationNb: infestation.pullulation_nb,
    tailleEssaim: tailleParts.length > 0 ? tailleParts.join(' ') : '—',
    typeEssaim: infestation.type_essaim,
    typeLarve: infestation.type_larve,
    surfaceContamineeHa: infestation.surface_contaminee_ha,
    surfInfesteePourcent: infestation.surf_infestee_pourcent,
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
        prospection.degats_cultures,
        prospection.degats_cultures_pourcent,
        prospection.verdissement_pourcent,
        prospection.hauteur_herbe_cm
      )
    ),
    region: prospection.region,
    district: prospection.district,
    commune: prospection.commune,
    za: prospection.za,
    pa_code: prospection.pa_code,
    degatsCulturesPourcent: prospection.degats_cultures_pourcent,
    verdissementPourcent: prospection.verdissement_pourcent,
    hauteurHerbeCm: prospection.hauteur_herbe_cm,
  };
}

function formatCoordinates(latitude: number | null, longitude: number | null): string {
  if (latitude == null || longitude == null) return '—';
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}