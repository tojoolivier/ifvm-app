import { apiClient, ProspectionCaptureInput } from './api-client';
import {
  CaptureRow,
  DraftProspection,
  completeProspection,
  listAllProspectionCaptures,
  markProspectionSynced,
} from './prospection-repository';
import {
  PHENOTYPES,
  chronoSeconds,
  dominantPhenotype,
  formatChrono,
  parseCaptureRows,
  totalBySexe,
  totalCaptures,
} from './prospection-captures';
import {
  DEGATS_OPTIONS,
  HUMIDITE_OPTIONS,
  STRATE_KEYS,
  STRATE_LABELS,
  TEXTURE_OPTIONS,
  VegetationSolState,
  parseVegetationSol,
  totalRecouvrement,
} from './prospection-vegetation';

export interface RecapitulatifViewModel {
  nFiche: string;
  stationLabel: string;
  dateProspection: string;
  totalCaptures: number;
  totalFemelles: number;
  totalMales: number;
  phenotypeDominantLabel: string;
  dureeSession: string;
  vegetationSummary: string;
  surfStation: number | null;
  surfProspectee: number | null;
  surfInfestee: number | null;
  latitude: number | null;
  longitude: number | null;
}

/** Synthèse textuelle de la végétation/sol saisis, dérivée des mêmes données que l'écran Végétation & sol. */
export function buildVegetationSummary(state: VegetationSolState): string {
  const strateParts = STRATE_KEYS.filter((key) => state.strates[key].recouvrement > 0)
    .map((key) => `${STRATE_LABELS[key]} ${state.strates[key].recouvrement}%`)
    .join(', ');
  const parts: string[] = [`Strates (${totalRecouvrement(state.strates)}%) : ${strateParts || '—'}`];
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

/** Construit le récapitulatif à partir des données déjà saisies aux écrans précédents (aucune resaisie). */
export async function buildRecapitulatif(draft: DraftProspection): Promise<RecapitulatifViewModel> {
  const rows = await listAllProspectionCaptures(draft.id);
  const counts = parseCaptureRows(rows);
  const dominant = dominantPhenotype(counts);
  const vegState = parseVegetationSol(draft.vegetation, draft.sol, draft.degats_cultures);

  return {
    nFiche: draft.n_fiche ?? '—',
    stationLabel: draft.station_id ?? formatCoordinates(draft.latitude, draft.longitude),
    dateProspection: draft.date_prospection,
    totalCaptures: totalCaptures(counts),
    totalFemelles: totalBySexe(counts, 'F'),
    totalMales: totalBySexe(counts, 'M'),
    phenotypeDominantLabel: dominant ? PHENOTYPES.find((p) => p.value === dominant)!.label : '—',
    dureeSession: formatChrono(chronoSeconds(draft.capture_started_at)),
    vegetationSummary: buildVegetationSummary(vegState),
    surfStation: draft.surf_station,
    surfProspectee: draft.surf_prospectee,
    surfInfestee: draft.surf_infestee,
    latitude: draft.latitude,
    longitude: draft.longitude,
  };
}

function formatCoordinates(latitude: number | null, longitude: number | null): string {
  if (latitude == null || longitude == null) return '—';
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
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

/**
 * Enregistre la fiche hors-ligne (toujours, indépendamment du réseau) puis tente une
 * synchronisation vers l'API. L'échec de synchronisation n'est jamais bloquant (offline-first,
 * cf. ADR-002) : la fiche reste locale et « à synchroniser ».
 */
export async function enregistrerEtSynchroniser(
  draft: DraftProspection,
  token: string
): Promise<{ synced: boolean }> {
  const completed = await completeProspection(draft.id);
  const rows = await listAllProspectionCaptures(draft.id);

  try {
    await apiClient.createProspection(token, {
      type_prospection: completed.type_prospection,
      campagne_id: completed.campagne_id,
      station_id: completed.station_id,
      n_fiche: completed.n_fiche,
      date_prospection: completed.date_prospection,
      latitude: completed.latitude,
      longitude: completed.longitude,
      altitude: completed.altitude,
      surf_station: completed.surf_station,
      surf_prospectee: completed.surf_prospectee,
      surf_infestee: completed.surf_infestee,
      degats_cultures: completed.degats_cultures,
      vegetation: completed.vegetation ? JSON.parse(completed.vegetation) : null,
      sol: completed.sol ? JSON.parse(completed.sol) : null,
      statut: completed.statut,
      captures: buildCapturesPayload(rows),
    });
    await markProspectionSynced(completed.id);
    return { synced: true };
  } catch {
    return { synced: false };
  }
}
