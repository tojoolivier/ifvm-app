import { CaptureRead, InfestationRead, PopulationRead, ProspectionRead } from './api-client';
import { PHENOTYPES } from './prospection-captures';
import { TYPE_CIBLE_OPTIONS } from './prospection-infestation';
import { parseVegetationSol } from './prospection-vegetation';
import { buildVegetationSummary } from './prospection-recapitulatif';

export const STATUT_VALIDE = 'validee';

export function getStatusLabel(statut: string): string {
  const map: Record<string, string> = {
    'brouillon': 'Brouillon',
    'en_attente': 'En attente de vérification',
    'verifiee': 'Vérifiée',
    'validee': 'Validée ✓',
    'rejetee': 'Rejetée ✗'
  };
  return map[statut] ?? statut;
}

/** Une fiche n'est consultable en lecture que si elle a atteint le statut final Validé. */
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

export interface InfestationSyntheseViewModel {
  hasInfestation: boolean;
  typeLabel: string;
  espece: string | null;           // AJOUTÉ
  surfaceTot: number | null;
  comportementLabel: string;
  direction: string | null;        // AJOUTÉ
  vent: string | null;             // AJOUTÉ
}

export interface PullulationSyntheseViewModel {
  nb: number | null;
  interdistance: number | null;
  taille: string | null;
}

export interface EssaimSyntheseViewModel {
  type: string | null;
  provenance: string | null;
  direction: string | null;
  pose: boolean | null;
  surfaceContaminee: number | null;
}

export interface SurfacesSyntheseViewModel {
  station: number | null;
  prospectee: number | null;
  infestee: number | null;
  contaminee: number | null;
}

export interface HistoriqueSyntheseViewModel {
  creeLe: string;
  modifieLe: string;
  verifieLe: string | null;
  valideLe: string | null;
}

export interface FicheLectureViewModel {
  nFiche: string;
  nReleve: string | null;              // AJOUTÉ
  nMessage: string | null;             // AJOUTÉ
  typeProspection: string;             // AJOUTÉ
  statutLabel: string;
  stationLabel: string;
  dateProspection: string;
  biotope: string | null;              // AJOUTÉ
  altitude: number | null;             // AJOUTÉ
  especes: EspeceSyntheseViewModel[];
  infestation: InfestationSyntheseViewModel;
  vegetationSummary: string;
  verdissement: number | null;         // AJOUTÉ
  hauteurStrate: number | null;        // AJOUTÉ
  surfaces: SurfacesSyntheseViewModel; // AJOUTÉ
  pullulation: PullulationSyntheseViewModel | null; // AJOUTÉ
  essaim: EssaimSyntheseViewModel | null;           // AJOUTÉ
  observations: string | null;         // AJOUTÉ
  historique: HistoriqueSyntheseViewModel; // AJOUTÉ
}

/** Synthèse par espèce (LMC/NSE) : totaux capturés, densité /ha, phénotype dominant. */
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

/** Bandeau niveau d'infestation : type de cible, surface, comportement. */
export function buildInfestationSynthese(infestations: InfestationRead[]): InfestationSyntheseViewModel {
  const infestation = infestations[0];
  if (!infestation) {
    return { 
      hasInfestation: false, 
      typeLabel: '—', 
      espece: null,
      surfaceTot: null, 
      comportementLabel: '—',
      direction: null,
      vent: null,
    };
  }
  
  let ventText = null;
  if (infestation.vent_de) {
    ventText = infestation.vent_de;
    if (infestation.vent_vitesse != null) {
      ventText += ` • ${infestation.vent_vitesse} km/h`;
    }
  }
  
  return {
    hasInfestation: true,
    typeLabel: TYPE_CIBLE_OPTIONS.find((o) => o.value === infestation.type_cible)?.label ?? infestation.type_cible,
    espece: infestation.espece,
    surfaceTot: infestation.surface_tot,
    comportementLabel: infestation.comportement === 'deplacement' ? 'Déplacement' : infestation.comportement === 'repos' ? 'Repos' : '—',
    direction: infestation.direction_vers,
    vent: ventText,
  };
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('fr-FR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
}

/** Construit la vue de la Fiche de lecture à partir de la fiche renvoyée par l'API. */
export function buildFicheLecture(prospection: ProspectionRead): FicheLectureViewModel {
  const vegState = parseVegetationSol(
    prospection.vegetation ? JSON.stringify(prospection.vegetation) : null,
    prospection.sol ? JSON.stringify(prospection.sol) : null,
    prospection.degats_cultures
  );

  // Pullulation
  let pullulation: PullulationSyntheseViewModel | null = null;
  if (prospection.pullulation_nb != null || prospection.interdistance != null || prospection.taille_info) {
    let tailleText = null;
    if (prospection.taille_info) {
      const info = prospection.taille_info as any;
      const parts = [];
      if (info.long) parts.push(`L: ${info.long}m`);
      if (info.large) parts.push(`l: ${info.large}m`);
      if (info.epaisseur) parts.push(`E: ${info.epaisseur}m`);
      tailleText = parts.join(' · ') || null;
    }
    pullulation = {
      nb: prospection.pullulation_nb,
      interdistance: prospection.interdistance,
      taille: tailleText,
    };
  }

  // Essaim
  let essaim: EssaimSyntheseViewModel | null = null;
  if (prospection.essaim_type || prospection.essaim_vol_dir_de || prospection.essaim_vol_dir_vers || prospection.essaim_pose != null) {
    essaim = {
      type: prospection.essaim_type,
      provenance: prospection.essaim_vol_dir_de,
      direction: prospection.essaim_vol_dir_vers,
      pose: prospection.essaim_pose,
      surfaceContaminee: prospection.surface_contaminee,
    };
  }

  return {
    nFiche: prospection.n_fiche ?? '—',
    nReleve: prospection.n_releve ?? null,
    nMessage: prospection.n_message ?? null,
    typeProspection: prospection.type_prospection,
    statutLabel: getStatusLabel(prospection.statut),
    stationLabel: prospection.station_id ?? formatCoordinates(prospection.latitude, prospection.longitude),
    dateProspection: prospection.date_prospection,
    biotope: prospection.biotope ?? null,
    altitude: prospection.altitude ?? null,
    especes: buildEspecesSynthese(prospection.captures, prospection.populations),
    infestation: buildInfestationSynthese(prospection.infestations),
    vegetationSummary: buildVegetationSummary(vegState),
    verdissement: prospection.verdissement ?? null,
    hauteurStrate: prospection.hauteur_strate ?? null,
    surfaces: {
      station: prospection.surf_station,
      prospectee: prospection.surf_prospectee,
      infestee: prospection.surf_infestee,
      contaminee: prospection.surface_contaminee,
    },
    pullulation,
    essaim,
    observations: prospection.observations ?? null,
    historique: {
      creeLe: formatDate(prospection.created_at),
      modifieLe: formatDate(prospection.updated_at),
      verifieLe: prospection.verified_at ? formatDate(prospection.verified_at) : null,
      valideLe: prospection.validated_at ? formatDate(prospection.validated_at) : null,
    },
  };
}

function formatCoordinates(latitude: number | null, longitude: number | null): string {
  if (latitude == null || longitude == null) return '—';
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}