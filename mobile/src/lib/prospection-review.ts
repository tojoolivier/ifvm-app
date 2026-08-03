import * as Network from 'expo-network';
import {
  apiClient,
  ProspectionCaptureInput,
  ProspectionInfestationInput,
  ProspectionPopulationInput,
} from './api-client';
import {
  CaptureRow,
  DraftProspection,
  InfestationRow,
  PopulationRow,
  completeProspection,
  markProspectionSynced,
  listAllProspectionCaptures,
  listAllProspectionPopulations,
  listAllProspectionInfestations,
} from './prospection-repository';
import { PHENOTYPES, TYPE_CIBLE_OPTIONS } from './prospection-fiche-lecture';
import { CaptureCounts, dominantPhenotype, rowsToCounts, totalBySexe, totalCaptures } from './prospection-capture-store';
import { CHRONO_MAX_SECONDS, capturesMaxFor, phenotypesFor } from './prospection-especes-stades';
import { buildGrilles, parseEspeceSelection } from './prospection-especes';

export interface ReviewGroupViewModel {
  label: string;
  total: number;
  max: number;
  dominantLabel: string;
}

export interface RecapitulatifViewModel {
  nFiche: string;
  nReleve: string;
  dateProspection: string;
  totalCaptures: number;
  totalFemelles: number;
  totalMales: number;
  phenotypeDominantLabel: string;
  dureeSession: string;
  pa: string;
  station: string;
  surfStation: number | null;
  surfProspectee: number | null;
  surfInfestee: number | null;
  latitude: number | null;
  longitude: number | null;
  vegetationSummary: string;
  reviewGroups: ReviewGroupViewModel[];
  infestationSummary: string;
}

const ESPECE_LABEL = { LMC: 'Locusta', NSE: 'Nomadacris' } as const;
const CATEGORIE_LABEL = { imago: 'Imagos', larve: 'Larves' } as const;

function buildReviewGroups(draft: DraftProspection, captures: CaptureRow[]): ReviewGroupViewModel[] {
  const grilles = buildGrilles(parseEspeceSelection(draft.especes));
  return grilles.map((grille) => {
    const rows = captures.filter((c) => c.espece === grille.espece && c.categorie === grille.categorie);
    const counts = rowsToCounts(rows);
    const dominant = dominantPhenotype(counts);
    const phenotypes = phenotypesFor(grille.espece, grille.categorie);
    return {
      label: `${ESPECE_LABEL[grille.espece]} — ${CATEGORIE_LABEL[grille.categorie]}`,
      total: totalCaptures(counts),
      max: capturesMaxFor(grille.espece, grille.categorie),
      dominantLabel: dominant ? phenotypes.find((p) => p.value === dominant)?.label ?? '—' : '—',
    };
  });
}

/** Une formation est "renseignée" si sa surface totale ou sa densité moyenne est saisie (même règle que l'écran Infestation). */
function buildInfestationSummary(infestations: InfestationRow[]): string {
  const filled = infestations.filter((row) => row.surface_tot != null || row.densite_moy != null);
  if (filled.length === 0) return 'Aucune formation renseignée.';
  const labels = filled.map((row) => TYPE_CIBLE_OPTIONS.find((o) => o.value === row.type_cible)?.label ?? row.type_cible);
  return `${labels.join(', ')} renseignée${filled.length > 1 ? 's' : ''}.`;
}

export function chronoSeconds(startedAt: string | null, now: Date = new Date()): number {
  if (!startedAt) return 0;
  const elapsed = Math.floor((now.getTime() - new Date(startedAt).getTime()) / 1000);
  return Math.max(0, Math.min(elapsed, CHRONO_MAX_SECONDS));
}

export function formatChrono(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function buildRecapitulatif(
  draft: DraftProspection,
  captures: CaptureRow[],
  vegetationSummary: string,
  infestations: InfestationRow[]
): RecapitulatifViewModel {
  const counts: CaptureCounts = rowsToCounts(captures);
  const dominant = dominantPhenotype(counts);

  return {
    nFiche: draft.n_fiche ?? '—',
    nReleve: draft.n_releve ?? '—',
    dateProspection: draft.date_prospection,
    totalCaptures: totalCaptures(counts),
    totalFemelles: totalBySexe(counts, 'F'),
    totalMales: totalBySexe(counts, 'M'),
    phenotypeDominantLabel: dominant ? PHENOTYPES.find((p) => p.value === dominant)?.label ?? '—' : '—',
    dureeSession: formatChrono(chronoSeconds(draft.capture_started_at)),
    pa: draft.pa_nom ?? '—',
    station: draft.station_nom ?? '—',
    surfStation: draft.surf_station,
    surfProspectee: draft.surf_prospectee,
    surfInfestee: draft.surf_infestee,
    latitude: draft.latitude,
    longitude: draft.longitude,
    vegetationSummary,
    reviewGroups: buildReviewGroups(draft, captures),
    infestationSummary: buildInfestationSummary(infestations),
  };
}

function buildCapturesPayload(rows: CaptureRow[]): ProspectionCaptureInput[] {
  return rows.map((row) => ({
    espece: row.espece,
    categorie: row.categorie,
    sexe: row.sexe,
    phase: row.phase,
    stade: row.stade,
    effectif: row.effectif,
  }));
}

function buildPopulationsPayload(rows: PopulationRow[]): ProspectionPopulationInput[] {
  return rows.map((row) => ({
    espece: row.espece,
    categorie: row.categorie,
    densite_diffuse: row.densite_diffuse,
    densite_groupee: row.densite_groupee,
    accouplement: row.accouplement,
    ponte: row.ponte,
  }));
}

function buildInfestationsPayload(rows: InfestationRow[]): ProspectionInfestationInput[] {
  return rows.map((row) => ({ ...row }));
}

function buildProspectionPayload(draft: DraftProspection) {
  return {
    type_prospection: draft.type_prospection,
    campagne_id: draft.campagne_id,
    station_id: draft.station_id,
    n_releve: draft.n_releve,
    n_fiche: draft.n_fiche,
    date_prospection: draft.date_prospection,
    latitude: draft.latitude,
    longitude: draft.longitude,
    altitude: draft.altitude,
    surf_station: draft.surf_station,
    surf_prospectee: draft.surf_prospectee,
    surf_infestee: draft.surf_infestee,
    degats_cultures: draft.degats_cultures,
    vegetation: draft.vegetation ? JSON.parse(draft.vegetation) : null,
    sol: draft.sol ? JSON.parse(draft.sol) : null,
    ennemis_naturels: draft.ennemis_naturels,
    observations: draft.observations,
    statut: draft.statut,
    region: draft.region,
    district: draft.district,
    commune: draft.commune,
    za: draft.za,
    pa_code: draft.pa_code,
    pa_nom: draft.pa_nom,
    station_nom: draft.station_nom,
    degats_cultures_pourcent: draft.degats_cultures_pourcent,
    verdissement_pourcent: draft.verdissement_pourcent,
    hauteur_herbe_cm: draft.hauteur_herbe_cm,
  };
}

/**
 * Écrit d'abord la fiche localement (toujours — c'est la référence hors-ligne, cf. ADR-002),
 * puis envoie directement au serveur si une connexion est disponible ; sinon la fiche reste
 * en `statut_sync = 'local'`, synchronisée plus tard par le module de sync existant.
 */
export async function enregistrerEtSynchroniser(
  draft: DraftProspection,
  captures: CaptureRow[],
  token: string
): Promise<{ synced: boolean }> {
  const completed = await completeProspection(draft.id);

  const network = await Network.getNetworkStateAsync();
  const isOnline = Boolean(network.isConnected && network.isInternetReachable);
  if (!isOnline) return { synced: false };

  try {
    const [populations, infestations] = await Promise.all([
      listAllProspectionPopulations(completed.id),
      listAllProspectionInfestations(completed.id),
    ]);
    await apiClient.createProspection(token, {
      ...buildProspectionPayload(completed),
      captures: buildCapturesPayload(captures),
      populations: buildPopulationsPayload(populations),
      infestations: buildInfestationsPayload(infestations),
    });
    await markProspectionSynced(completed.id);
    return { synced: true };
  } catch {
    return { synced: false };
  }
}

/**
 * Relance l'envoi d'une fiche déjà complétée mais restée `statut_sync != 'synced'`
 * (échec silencieux précédent). Contrairement à enregistrerEtSynchroniser, l'erreur
 * n'est PAS avalée : l'appelant (UI) doit pouvoir afficher un toast d'échec.
 */
export async function retrySyncProspection(draft: DraftProspection, token: string): Promise<void> {
  const [captures, populations, infestations] = await Promise.all([
    listAllProspectionCaptures(draft.id),
    listAllProspectionPopulations(draft.id),
    listAllProspectionInfestations(draft.id),
  ]);
  await apiClient.createProspection(token, {
    ...buildProspectionPayload(draft),
    captures: buildCapturesPayload(captures),
    populations: buildPopulationsPayload(populations),
    infestations: buildInfestationsPayload(infestations),
  });
  await markProspectionSynced(draft.id);
}
