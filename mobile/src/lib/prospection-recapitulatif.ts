import { apiClient, ProspectionCaptureInput } from './api-client';
import {
  CaptureRow,
  DraftProspection,
  completeProspection,
  listAllProspectionCaptures,
  markProspectionSynced,
  PopulationRow,
  InfestationRow,
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
import { getDb } from './prospection-db';

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

/** Synthèse textuelle de la végétation/sol saisis */
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

/** Construit le récapitulatif à partir des données déjà saisies */
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

async function buildPopulationsPayload(prospectionId: string): Promise<any[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PopulationRow>(
    'SELECT espece, categorie, densite_diffuse, densite_groupee, accouplement, ponte FROM prospection_population WHERE prospection_id = ?',
    [prospectionId]
  );
  return rows.map(row => ({
    espece: row.espece,
    categorie: row.categorie,
    densite_diffuse: row.densite_diffuse ?? undefined,
    densite_groupee: row.densite_groupee ?? undefined,
    accouplement: row.accouplement ?? undefined,
    ponte: row.ponte ?? undefined,
  }));
}

async function buildInfestationsPayload(prospectionId: string): Promise<any[]> {
  const db = await getDb();
  const row = await db.getFirstAsync<InfestationRow>(
    `SELECT type_cible, taille_min, taille_max, taille_moy, surface_tot,
            densite_min, densite_max, densite_moy, interdistance,
            comportement, direction_vers, vent_de, vent_vitesse
     FROM prospection_infestation WHERE prospection_id = ?`,
    [prospectionId]
  );
  if (!row) return [];
  return [{
    type_cible: row.type_cible,
    taille_min: row.taille_min ?? undefined,
    taille_max: row.taille_max ?? undefined,
    taille_moy: row.taille_moy ?? undefined,
    surface_tot: row.surface_tot ?? undefined,
    densite_min: row.densite_min ?? undefined,
    densite_max: row.densite_max ?? undefined,
    densite_moy: row.densite_moy ?? undefined,
    interdistance: row.interdistance ?? undefined,
    comportement: row.comportement ?? undefined,
    direction_vers: row.direction_vers ?? undefined,
    vent_de: row.vent_de ?? undefined,
    vent_vitesse: row.vent_vitesse ?? undefined,
  }];
}

/**
 * Enregistre la fiche hors-ligne puis tente une synchronisation vers l'API
 */
export async function enregistrerEtSynchroniser(
  draft: DraftProspection,
  token: string
): Promise<{ synced: boolean }> {
  const completed = await completeProspection(draft.id);
  const rows = await listAllProspectionCaptures(draft.id);
  const populations = await buildPopulationsPayload(draft.id);
  const infestations = await buildInfestationsPayload(draft.id);

  // ✅ CORRECTION: Si le type est 'intensive' et qu'il n'y a pas de station_id,
  // on le force en 'extensive'
  let typeProspection = completed.type_prospection;
  let stationId: string | null = completed.station_id ?? null;

  if (typeProspection === 'intensive' && !stationId) {
    console.warn('⚠️ Prospection intensive sans station, conversion en extensive');
    typeProspection = 'extensive';
    stationId = null;
  }

  // ✅ Construction du payload avec les bons types
  const payload = {
    type_prospection: typeProspection as 'intensive' | 'extensive' | 'validation',
    campagne_id: completed.campagne_id,
    station_id: stationId, // ✅ string | null, pas undefined
    n_releve: null,
    n_fiche: completed.n_fiche ?? null,
    n_message: null,
    date_prospection: completed.date_prospection,
    latitude: completed.latitude ?? null,
    longitude: completed.longitude ?? null,
    altitude: completed.altitude ?? null,
    biotope: completed.biotope ?? null,
    surf_station: completed.surf_station ?? null,
    surf_prospectee: completed.surf_prospectee ?? null,
    surf_infestee: completed.surf_infestee ?? null,
    degats_cultures: completed.degats_cultures ?? null,
    derniere_pluie: completed.derniere_pluie ?? null,
    intensite_pluie: completed.intensite_pluie ?? null,
    vegetation: completed.vegetation ? JSON.parse(completed.vegetation) : null,
    sol: completed.sol ? JSON.parse(completed.sol) : null,
    verdissement: completed.verdissement ?? null,
    hauteur_strate: completed.hauteur_strate ?? null,
    ennemis_naturels: completed.ennemis_naturels ?? null,
    pullulation_nb: completed.pullulation_nb ?? null,
    interdistance: completed.interdistance ?? null,
    taille_info: completed.taille_info ? JSON.parse(completed.taille_info) : null,
    essaim_type: completed.essaim_type ?? null,
    essaim_vol_dir_de: completed.essaim_vol_dir_de ?? null,
    essaim_vol_dir_vers: completed.essaim_vol_dir_vers ?? null,
    essaim_pose: completed.essaim_pose ?? null,
    surface_contaminee: completed.surface_contaminee ?? null,
    observations: completed.observations ?? null,
    statut: 'en_attente',
    populations: populations,
    captures: buildCapturesPayload(rows),
    infestations: infestations,
  };

  console.log('📤 === DONNÉES ENVOYÉES ===');
  console.log('📌 Type (corrigé):', payload.type_prospection);
  console.log('📌 Station:', payload.station_id);
  console.log('📌 Populations:', payload.populations?.length || 0);
  console.log('📌 Captures:', payload.captures?.length || 0);
  console.log('📌 Infestations:', payload.infestations?.length || 0);

  try {
    const result = await apiClient.createProspection(token, payload);
    console.log('✅ Synchronisation réussie:', result);
    await markProspectionSynced(completed.id);
    return { synced: true };
  } catch (error: any) {
    console.error('❌ Erreur de synchronisation:', error);
    if (error.response) {
      console.error('📄 Réponse du serveur:', error.response.data);
    }
    return { synced: false };
  }
}