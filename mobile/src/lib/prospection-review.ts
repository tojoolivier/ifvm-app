import * as Network from 'expo-network';
import {
  apiClient,
  ProspectionCaptureInput,
  ProspectionInfestationInput,
  ProspectionPopulationInput,
  ProspectionCreateInput,
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
import { getDb } from './prospection-db';
import { pullReferentiel } from './referentiel-sync';

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
  surfaceStation: number | null;
  surfaceProspectee: number | null;
  surfaceInfestee: number | null;
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

function buildInfestationSummary(infestations: InfestationRow[]): string {
  const filled = infestations.filter((row) => row.surface_totale != null || row.densite_moy != null);
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
    surfaceStation: draft.surface_station,
    surfaceProspectee: draft.surface_prospectee,
    surfaceInfestee: draft.surface_infestee,
    latitude: draft.latitude,
    longitude: draft.longitude,
    vegetationSummary,
    reviewGroups: buildReviewGroups(draft, captures),
    infestationSummary: buildInfestationSummary(infestations),
  };
}

async function ensureStationExists(token: string): Promise<string | null> {
  const db = await getDb();
  
  const stations = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM station_fixe WHERE actif = 1 LIMIT 1'
  );
  
  if (stations.length > 0) {
    console.log(`✅ Station locale trouvée: ${stations[0].id}`);
    return stations[0].id;
  }
  
  console.log('🔄 Aucune station locale, synchronisation des référentiels...');
  try {
    await pullReferentiel(token);
    console.log('✅ Référentiels synchronisés');
    
    const newStations = await db.getAllAsync<{ id: string }>(
      'SELECT id FROM station_fixe WHERE actif = 1 LIMIT 1'
    );
    
    if (newStations.length > 0) {
      console.log(`✅ Station trouvée après sync: ${newStations[0].id}`);
      return newStations[0].id;
    }
  } catch (error) {
    console.error('❌ Erreur lors de la synchronisation:', error);
  }
  
  return null;
}

function buildCapturesPayload(rows: CaptureRow[]): ProspectionCaptureInput[] {
  return rows.map((row) => ({
    espece: row.espece,
    categorie: row.categorie,
    sexe: row.sexe || null,
    phase: row.phase || 'inconnu',
    stade: row.stade || 'inconnu',
    effectif: row.effectif ? Number(row.effectif) : 0,
  }));
}

async function buildProspectionPayload(draft: DraftProspection, token: string) {
  let stationId = draft.station_id;
  
  if (draft.type_prospection === 'intensive' && !stationId) {
    console.warn(`⚠️ station_id manquant pour ${draft.id}, tentative de récupération...`);
    
    if (!token) {
      throw new Error('Token manquant pour la synchronisation');
    }
    
    stationId = await ensureStationExists(token);
    
    if (!stationId) {
      throw new Error('Aucune station disponible. Veuillez synchroniser les référentiels dans l\'onglet Synchronisation.');
    }
    
    console.log(`✅ station_id trouvé: ${stationId}`);
  }
  
  return {
    type_prospection: draft.type_prospection as ProspectionCreateInput['type_prospection'],
    campagne_id: draft.campagne_id,
    station_id: stationId || null,
    n_releve: draft.n_releve || null,
    n_fiche: draft.n_fiche || null,
    n_message: draft.n_message || null,
    date_prospection: draft.date_prospection,
    latitude: draft.latitude ? Number(draft.latitude) : null,
    longitude: draft.longitude ? Number(draft.longitude) : null,
    altitude: draft.altitude ? Number(draft.altitude) : null,
    // toLowerCase() : rattrape les brouillons locaux enregistrés avant la correction du picker
    // (qui stockait 'Xerophyle'/'Mesophyle'/'Hydrophyle' en PascalCase, rejeté par l'enum backend).
    biotope: (draft.biotope ? draft.biotope.toLowerCase() : null) as ProspectionCreateInput['biotope'],
    surface_station: draft.surface_station ? Number(draft.surface_station) : null,
    surface_prospectee: draft.surface_prospectee ? Number(draft.surface_prospectee) : null,
    surface_infestee: draft.surface_infestee ? Number(draft.surface_infestee) : null,
    degats_cultures: (draft.degats_cultures || null) as ProspectionCreateInput['degats_cultures'],
    derniere_pluie: draft.derniere_pluie || null,
    intensite_pluie: draft.intensite_pluie || null,
    vegetation: draft.vegetation ? JSON.parse(draft.vegetation) : null,
    sol: draft.sol ? JSON.parse(draft.sol) : null,
    ennemis_naturels: draft.ennemis_naturels || null,
    observations: draft.observations || null,
    statut: draft.statut || 'brouillon',
    region: draft.region || null,
    district: draft.district || null,
    commune: draft.commune || null,
    za: draft.za || null,
    pa_code: draft.pa_code || null,
    pa_nom: draft.pa_nom || null,
    station_nom: draft.station_nom || null,
    degats_cultures_pourcent: draft.degats_cultures_pourcent ? Number(draft.degats_cultures_pourcent) : null,
    verdissement_pourcent: draft.verdissement_pourcent ? Number(draft.verdissement_pourcent) : null,
    hauteur_herbe_cm: draft.hauteur_herbe_cm ? Number(draft.hauteur_herbe_cm) : null,
    station_libre: draft.station_libre || null,
    type_station: draft.type_station || null,
    verdure_strate: draft.verdure_strate || null,
    signalement_source: draft.signalement_source || null,
    signalement_date: draft.signalement_date || null,
    signalement_description: draft.signalement_description || null,
    conclusion_validation: draft.conclusion_validation || null,
    avertissements: draft.avertissements ? JSON.parse(draft.avertissements) : [],
  };
}

function buildPopulationsPayload(rows: PopulationRow[]): ProspectionPopulationInput[] {
  return rows.map((row) => ({
    espece: row.espece,
    categorie: row.categorie,
    methode: row.methode || null,
    phase: row.phase || null,
    captures_nombre: row.captures_nombre ? Number(row.captures_nombre) : null,
    temps_capture: row.temps_capture ? Number(row.temps_capture) : null,
    densite_diffuse: row.densite_diffuse ? Number(row.densite_diffuse) : null,
    densite_groupee: row.densite_groupee ? Number(row.densite_groupee) : null,
    accouplement: row.accouplement || null,
    ponte: row.ponte || null,
    captures_sol: row.captures_sol ? Number(row.captures_sol) : null,
    captures_trans: row.captures_trans ? Number(row.captures_trans) : null,
    captures_greg: row.captures_greg ? Number(row.captures_greg) : null,
    stade_imago: row.stade_imago || null,
    essaim_observe: row.essaim_observe != null ? Boolean(row.essaim_observe) : null,
    densites_larve: row.densites_larve ? JSON.parse(row.densites_larve) : null,
    tache_larvaire: row.tache_larvaire != null ? Boolean(row.tache_larvaire) : null,
    bande_larvaire: row.bande_larvaire != null ? Boolean(row.bande_larvaire) : null,
    interdistance: row.interdistance ? Number(row.interdistance) : null,
    deplacement: row.deplacement || null,
  }));
}

function buildInfestationsPayload(rows: InfestationRow[]): ProspectionInfestationInput[] {
  return rows.map((row) => ({
    type_cible: row.type_cible,
    espece: row.espece || null,
    taille_min: row.taille_min ? Number(row.taille_min) : null,
    taille_max: row.taille_max ? Number(row.taille_max) : null,
    taille_moy: row.taille_moy ? Number(row.taille_moy) : null,
    surface_totale: row.surface_totale ? Number(row.surface_totale) : null,
    densite_min: row.densite_min ? Number(row.densite_min) : null,
    densite_max: row.densite_max ? Number(row.densite_max) : null,
    densite_moy: row.densite_moy ? Number(row.densite_moy) : null,
    interdistance: row.interdistance ? Number(row.interdistance) : null,
    comportement: row.comportement || null,
    direction_de: row.direction_de || null,
    direction_vers: row.direction_vers || null,
    vent_de: row.vent_de || null,
    vent_vitesse: row.vent_vitesse ? Number(row.vent_vitesse) : null,
    pullulation_nb: row.pullulation_nb ? Number(row.pullulation_nb) : null,
    taille_long: row.taille_long ? Number(row.taille_long) : null,
    taille_large: row.taille_large ? Number(row.taille_large) : null,
    taille_epaisseur: row.taille_epaisseur ? Number(row.taille_epaisseur) : null,
    essaim_en_vol: row.essaim_en_vol != null ? Boolean(row.essaim_en_vol) : null,
    essaim_pose: row.essaim_pose != null ? Boolean(row.essaim_pose) : null,
    type_essaim: (row.type_essaim || null) as ProspectionInfestationInput['type_essaim'],
    heure_observation: row.heure_observation || null,
    densite_en_vol: row.densite_en_vol ? Number(row.densite_en_vol) : null,
    dimension_ha: row.dimension_ha ? Number(row.dimension_ha) : null,
    nb_taches_bandes: row.nb_taches_bandes ? Number(row.nb_taches_bandes) : null,
    interdistance_m: row.interdistance_m ? Number(row.interdistance_m) : null,
    interdistance_min: row.interdistance_min ? Number(row.interdistance_min) : null,
    interdistance_max: row.interdistance_max ? Number(row.interdistance_max) : null,
    interdistance_moy: row.interdistance_moy ? Number(row.interdistance_moy) : null,
    surface_contaminee_ha: row.surface_contaminee_ha ? Number(row.surface_contaminee_ha) : null,
    type_larve: (row.type_larve || null) as ProspectionInfestationInput['type_larve'],
    surface_infestee_pourcent: row.surface_infestee_pourcent ? Number(row.surface_infestee_pourcent) : null,
    stade_dominant: (row.stade_dominant || null) as ProspectionInfestationInput['stade_dominant'],
    taille_groupe_m2: row.taille_groupe_m2 ? Number(row.taille_groupe_m2) : null,
    front_longueur_m: row.front_longueur_m ? Number(row.front_longueur_m) : null,
    front_largeur_m: row.front_largeur_m ? Number(row.front_largeur_m) : null,
    densite_max_front: row.densite_max_front ? Number(row.densite_max_front) : null,
    densite_moy_arriere_front: row.densite_moy_arriere_front ? Number(row.densite_moy_arriere_front) : null,
  }));
}

export async function enregistrerEtSynchroniser(
  draft: DraftProspection,
  captures: CaptureRow[],
  token: string
): Promise<{ synced: boolean; syncError?: string }> {
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
      ...(await buildProspectionPayload(completed, token)),
      captures: buildCapturesPayload(captures),
      populations: buildPopulationsPayload(populations),
      infestations: buildInfestationsPayload(infestations),
    });
    await markProspectionSynced(completed.id);
    return { synced: true };
  } catch (error) {
    // ADR-008 : la fiche reste enregistrée localement (completeProspection ci-dessus a
    // déjà réussi), mais l'échec de synchronisation ne doit jamais rester invisible —
    // il est remonté à l'appelant plutôt qu'avalé (cf. #98 : symptôme "blocage silencieux").
    console.error(`❌ Échec de synchronisation pour ${completed.id}:`, error);
    const syncError = error instanceof Error ? error.message : 'Erreur de synchronisation inconnue';
    return { synced: false, syncError };
  }
}

export async function retrySyncProspection(draft: DraftProspection, token: string): Promise<void> {
  console.log(`🔄 Synchronisation de ${draft.id}...`);
  
  try {
    const [captures, populations, infestations] = await Promise.all([
      listAllProspectionCaptures(draft.id),
      listAllProspectionPopulations(draft.id),
      listAllProspectionInfestations(draft.id),
    ]);
    
    const payload = {
      ...(await buildProspectionPayload(draft, token)),
      captures: buildCapturesPayload(captures),
      populations: buildPopulationsPayload(populations),
      infestations: buildInfestationsPayload(infestations),
    };
    
    console.log('📤 Payload envoyé avec station_id:', payload.station_id);
    
    await apiClient.createProspection(token, payload);
    await markProspectionSynced(draft.id);
    console.log(`✅ ${draft.id} synchronisé`);
  } catch (error) {
    console.error(`❌ Erreur pour ${draft.id}:`, error);
    if (error && typeof error === 'object' && 'response' in error) {
      const err = error as { response?: { data?: unknown } };
      console.error('Détails:', err.response?.data);
    }
    throw error;
  }
}