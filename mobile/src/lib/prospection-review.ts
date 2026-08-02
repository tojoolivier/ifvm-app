import * as Network from 'expo-network';
import { apiClient, ProspectionCaptureInput } from './api-client';
import {
  CaptureRow,
  DraftProspection,
  completeProspection,
  markProspectionSynced,
} from './prospection-repository';
import { PHENOTYPES } from './prospection-fiche-lecture';
import { CaptureCounts, dominantPhenotype, rowsToCounts, totalBySexe, totalCaptures } from './prospection-capture-store';
import { CHRONO_MAX_SECONDS } from './prospection-especes-stades';

export interface RecapitulatifViewModel {
  nFiche: string;
  dateProspection: string;
  totalCaptures: number;
  totalFemelles: number;
  totalMales: number;
  phenotypeDominantLabel: string;
  dureeSession: string;
  surfStation: number | null;
  surfProspectee: number | null;
  surfInfestee: number | null;
  latitude: number | null;
  longitude: number | null;
  vegetationSummary: string;
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
  vegetationSummary: string
): RecapitulatifViewModel {
  const counts: CaptureCounts = rowsToCounts(captures);
  const dominant = dominantPhenotype(counts);

  return {
    nFiche: draft.n_fiche ?? '—',
    dateProspection: draft.date_prospection,
    totalCaptures: totalCaptures(counts),
    totalFemelles: totalBySexe(counts, 'F'),
    totalMales: totalBySexe(counts, 'M'),
    phenotypeDominantLabel: dominant ? PHENOTYPES.find((p) => p.value === dominant)?.label ?? '—' : '—',
    dureeSession: formatChrono(chronoSeconds(draft.capture_started_at)),
    surfStation: draft.surf_station,
    surfProspectee: draft.surf_prospectee,
    surfInfestee: draft.surf_infestee,
    latitude: draft.latitude,
    longitude: draft.longitude,
    vegetationSummary,
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
      captures: buildCapturesPayload(captures),
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
