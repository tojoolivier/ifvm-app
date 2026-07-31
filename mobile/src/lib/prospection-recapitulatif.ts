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
  region: string | null;
  district: string | null;
  commune: string | null;
  za: string | null;
  pa_code: string | null;
  degats_cultures_pourcent: number | null;
  verdissement_pourcent: number | null;
  hauteur_herbe_cm: number | null;
}

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

export async function buildRecapitulatif(draft: DraftProspection): Promise<RecapitulatifViewModel> {
  const rows = await listAllProspectionCaptures(draft.id);
  const counts = parseCaptureRows(rows);
  const dominant = dominantPhenotype(counts);
  const vegState = parseVegetationSol(
    draft.vegetation,
    draft.sol,
    draft.degats_cultures,
    draft.degats_cultures_pourcent,
    draft.verdissement_pourcent,
    draft.hauteur_herbe_cm
  );

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
    region: draft.region ?? null,
    district: draft.district ?? null,
    commune: draft.commune ?? null,
    za: draft.za ?? null,
    pa_code: draft.pa_code ?? null,
    degats_cultures_pourcent: draft.degats_cultures_pourcent ?? null,
    verdissement_pourcent: draft.verdissement_pourcent ?? null,
    hauteur_herbe_cm: draft.hauteur_herbe_cm ?? null,
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
      region: completed.region,
      district: completed.district,
      commune: completed.commune,
      za: completed.za,
      pa_code: completed.pa_code,
      degats_cultures_pourcent: completed.degats_cultures_pourcent,
      verdissement_pourcent: completed.verdissement_pourcent,
      hauteur_herbe_cm: completed.hauteur_herbe_cm,
    });
    await markProspectionSynced(completed.id);
    return { synced: true };
  } catch {
    return { synced: false };
  }
}