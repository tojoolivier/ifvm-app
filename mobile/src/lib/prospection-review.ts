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
  markProspectionEchec,
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
import { assertPresent, ReferentialError } from './errors';
import { logger } from './logger';
import { avecConnexion, syncAll, type LotSync, type ResumeSync } from './sync-lot';

const log = logger.child({ module: 'prospection-review' });

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
  comportementSummary: string;
  observationsText: string;
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

/**
 * Comportement (État/Direction/Essaim en vol-posé) : rattaché à une ligne
 * `prospection_infestation`, comme dans infestation.tsx (onglet "Comport.") — même
 * vocabulaire, direction du déplacement et direction du vent restant deux mesures
 * indépendantes (cf. commentaire de `formFromRow` dans infestation.tsx).
 */
function buildComportementSummary(infestations: InfestationRow[]): string {
  const row = infestations.find(
    (r) => r.comportement != null || r.essaim_en_vol || r.essaim_pose || r.direction_de != null
  );
  if (!row) return 'Aucun comportement renseigné.';

  const parts: string[] = [];
  if (row.comportement) {
    parts.push(`État ${row.comportement === 'deplacement' ? 'Déplacement' : 'Repos'}`);
  }
  if (row.direction_de || row.direction_vers) {
    parts.push(`Direction ${row.direction_de ?? '—'} → ${row.direction_vers ?? '—'}`);
  }
  if (row.essaim_en_vol || row.essaim_pose) {
    const etats = [row.essaim_en_vol ? 'en vol' : null, row.essaim_pose ? 'posé' : null].filter(Boolean);
    parts.push(`Essaim ${etats.join(' / ')}`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'Aucun comportement renseigné.';
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
    comportementSummary: buildComportementSummary(infestations),
    observationsText: draft.observations?.trim() ? draft.observations : 'Aucune observation renseignée.',
  };
}

/**
 * Cherche une station active en local, en tentant une synchronisation de
 * rattrapage si le référentiel est vide.
 *
 * Rend `null` quand il n'y en a toujours pas — et `null` est ici discernable :
 * l'appelant en fait une `ReferentialError`, qui propose « Synchroniser les
 * référentiels » à l'agent.
 */
async function ensureStationExists(token: string): Promise<string | null> {
  const db = await getDb();

  const stations = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM station_fixe WHERE actif = 1 LIMIT 1'
  );

  if (stations.length > 0) {
    log.detail('station.trouvee-en-local', { stationId: stations[0].id });
    return stations[0].id;
  }

  log.event('referentiel.sync-de-rattrapage');

  try {
    await pullReferentiel(token);

    const newStations = await db.getAllAsync<{ id: string }>(
      'SELECT id FROM station_fixe WHERE actif = 1 LIMIT 1'
    );

    if (newStations.length > 0) {
      log.detail('station.trouvee-apres-sync', { stationId: newStations[0].id });
      return newStations[0].id;
    }
  } catch (error) {
    // Pas un `ignore` : l'échec n'est pas silencieux, l'appelant le transforme
    // en `ReferentialError`. Mais son motif — réseau, jeton, base — ne survit
    // pas à ce `return null`, et c'est lui que le support cherchera.
    log.failure('referentiel.sync-de-rattrapage.failed', error);
  }

  return null;
}

function buildCapturesPayload(rows: CaptureRow[]): ProspectionCaptureInput[] {
  return rows.map((row) => ({
    espece: row.espece,
    categorie: row.categorie,
    sexe: row.sexe || null,
    phase: (row.phase || 'inconnu') as ProspectionCaptureInput['phase'],
    stade: row.stade || 'inconnu',
    effectif: row.effectif ? Number(row.effectif) : 0,
  }));
}

// ✅ FONCTION MODIFIÉE : Pour extensive, station_id est ignoré
async function buildProspectionPayload(draft: DraftProspection, token: string) {
  let stationId = draft.station_id;
  
  // 🔑 Pour l'intensif seulement : si station_id est manquant, on essaie de le récupérer
  if (draft.type_prospection === 'intensive' && !stationId) {
    log.event('station.manquante', { prospectionId: draft.id });

    assertPresent(token || null, 'Session expirée — reconnectez-vous pour synchroniser.');

    stationId = await ensureStationExists(token);

    if (!stationId) {
      // `ReferentialError` : l'action utile — « Synchroniser les référentiels »
      // — est une propriété de la classe, pas de ce site d'appel.
      throw new ReferentialError(
        'Aucune station disponible. Veuillez synchroniser les référentiels dans l’onglet Synchronisation.'
      );
    }

    log.detail('station.resolue', { prospectionId: draft.id, stationId });
  }

  if (draft.type_prospection === 'extensive') {
    log.detail('station.ignoree_extensive', { prospectionId: draft.id, stationId });
  }

  return {
    type_prospection: draft.type_prospection as ProspectionCreateInput['type_prospection'],
    campagne_id: draft.campagne_id,
    // 🔑 station_id = null pour extensive, la valeur pour intensive
    station_id: draft.type_prospection === 'extensive' ? null : stationId,
    n_releve: draft.n_releve || null,
    n_fiche: draft.n_fiche || null,
    n_message: draft.n_message || null,
    date_prospection: draft.date_prospection,
    latitude: draft.latitude ? Number(draft.latitude) : null,
    longitude: draft.longitude ? Number(draft.longitude) : null,
    altitude: draft.altitude ? Number(draft.altitude) : null,
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
    statut: (draft.statut || 'brouillon') as ProspectionCreateInput['statut'],
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
    type_station: (draft.type_station || null) as ProspectionCreateInput['type_station'],
    verdure_strate: (draft.verdure_strate || null) as ProspectionCreateInput['verdure_strate'],
    signalement_source: draft.signalement_source || null,
    signalement_date: draft.signalement_date || null,
    signalement_description: draft.signalement_description || null,
    conclusion_validation: (draft.conclusion_validation || null) as ProspectionCreateInput['conclusion_validation'],
    avertissements: draft.avertissements ? JSON.parse(draft.avertissements) : [],
  };
}

/** Le picker affiche 'Néant'/'Rare'/'Peu'/'Beaucoup'/'Dominant' (accouplement.tsx) mais le
 * backend n'accepte que l'ASCII minuscule ('neant'/'rare'/'peu'/'beaucoup'/'dominant'). */
const COMBINING_DIACRITICS_RE = new RegExp('[̀-ͯ]', 'g');

function normalizeIntensite(value: string | null): string | null {
  if (!value) return null;
  return value.toLowerCase().normalize('NFD').replace(COMBINING_DIACRITICS_RE, '');
}

function buildPopulationsPayload(rows: PopulationRow[]): ProspectionPopulationInput[] {
  return rows.map((row) => ({
    espece: row.espece,
    categorie: row.categorie,
    methode: (row.methode || null) as ProspectionPopulationInput['methode'],
    phase: row.phase || null,
    captures_nombre: row.captures_nombre ? Number(row.captures_nombre) : null,
    temps_capture: row.temps_capture ? Number(row.temps_capture) : null,
    densite_diffuse: row.densite_diffuse ? Number(row.densite_diffuse) : null,
    densite_groupee: row.densite_groupee ? Number(row.densite_groupee) : null,
    accouplement: normalizeIntensite(row.accouplement) as ProspectionPopulationInput['accouplement'],
    ponte: normalizeIntensite(row.ponte) as ProspectionPopulationInput['ponte'],
    captures_sol: row.captures_sol ? Number(row.captures_sol) : null,
    captures_trans: row.captures_trans ? Number(row.captures_trans) : null,
    captures_greg: row.captures_greg ? Number(row.captures_greg) : null,
    stade_imago: (row.stade_imago || null) as ProspectionPopulationInput['stade_imago'],
    essaim_observe: row.essaim_observe != null ? Boolean(row.essaim_observe) : null,
    densites_larve: row.densites_larve ? JSON.parse(row.densites_larve) : null,
    tache_larvaire: row.tache_larvaire != null ? Boolean(row.tache_larvaire) : null,
    bande_larvaire: row.bande_larvaire != null ? Boolean(row.bande_larvaire) : null,
    interdistance: row.interdistance ? Number(row.interdistance) : null,
    deplacement: (row.deplacement || null) as ProspectionPopulationInput['deplacement'],
  }));
}

/**
 * `classifyAerialPopulation` calcule désormais directement les 3 catégories officielles
 * du backend (vol_clair/dense/tres_dense — enum TypeEssaim). Cette table ne sert plus
 * qu'à normaliser d'anciens brouillons locaux enregistrés avant cette bascule, avec les
 * 5 valeurs internes d'origine (non_classe/essaim_densite_moyenne/forte/tres_forte) —
 * même règle de regroupement qu'alors (moyenne+forte -> 'dense').
 */
const TYPE_ESSAIM_TO_BACKEND: Record<string, 'vol_clair' | 'dense' | 'tres_dense' | null> = {
  vol_clair: 'vol_clair',
  dense: 'dense',
  tres_dense: 'tres_dense',
  non_classe: null,
  essaim_densite_moyenne: 'dense',
  essaim_densite_forte: 'dense',
  essaim_densite_tres_forte: 'tres_dense',
};

/**
 * `type_cible` n'accepte plus 'essaim' côté backend depuis la migration 0031 (Dense et
 * Très dense sont désormais des types de cible à part entière). Un brouillon local
 * enregistré avant cette bascule et pas encore synchronisé peut encore porter
 * `type_cible: 'essaim'` : on le reclasse ici avec la même règle que la migration
 * backend, à partir du `type_essaim` déjà normalisé (dense/tres_dense -> repris tel
 * quel, y compris pour un ancien brouillon à 5 niveaux ; sinon 'vol_clair' par défaut).
 */
function normalizeTypeCible(rawTypeCible: string, normalizedTypeEssaim: string | null): string {
  if (rawTypeCible !== 'essaim') return rawTypeCible;
  return normalizedTypeEssaim === 'dense' || normalizedTypeEssaim === 'tres_dense'
    ? normalizedTypeEssaim
    : 'vol_clair';
}

function buildInfestationsPayload(rows: InfestationRow[]): ProspectionInfestationInput[] {
  return rows.map((row) => {
    const typeEssaim = row.type_essaim ? (TYPE_ESSAIM_TO_BACKEND[row.type_essaim] ?? null) : null;
    return {
      type_cible: normalizeTypeCible(row.type_cible, typeEssaim) as ProspectionInfestationInput['type_cible'],
      espece: (row.espece || null) as ProspectionInfestationInput['espece'],
      taille_min: row.taille_min ? Number(row.taille_min) : null,
      taille_max: row.taille_max ? Number(row.taille_max) : null,
      taille_moy: row.taille_moy ? Number(row.taille_moy) : null,
      surface_totale: row.surface_totale ? Number(row.surface_totale) : null,
      densite_min: row.densite_min ? Number(row.densite_min) : null,
      densite_max: row.densite_max ? Number(row.densite_max) : null,
      densite_moy: row.densite_moy ? Number(row.densite_moy) : null,
      interdistance: row.interdistance ? Number(row.interdistance) : null,
      comportement: (row.comportement || null) as ProspectionInfestationInput['comportement'],
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
      type_essaim: typeEssaim as ProspectionInfestationInput['type_essaim'],
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
    };
  });
}

/** Le réseau, tel que l'appareil le voit à cet instant. */
async function estEnLigne(): Promise<boolean> {
  const network = await Network.getNetworkStateAsync();
  return Boolean(network.isConnected && network.isInternetReachable);
}

/**
 * L'unitaire — ADR-012 décision 9. **Il lève.**
 *
 * Ex-`retrySyncProspection` : le nom disait « réessai » alors que c'était le
 * seul envoi unitaire du domaine, et les deux autres conventions du mobile
 * s'appuyaient sur cette confusion.
 *
 * `captures` vient de l'écran lors du premier envoi — la boucle de capture les
 * tient en mémoire — et de la base lors des suivants. C'est la seule différence
 * entre les deux chemins, d'où le paramètre plutôt qu'une seconde fonction.
 */
export async function syncOneProspection(
  draft: DraftProspection,
  token: string,
  capturesDeLEcran?: CaptureRow[]
): Promise<void> {
  const [captures, populations, infestations] = await Promise.all([
    capturesDeLEcran ? Promise.resolve(capturesDeLEcran) : listAllProspectionCaptures(draft.id),
    listAllProspectionPopulations(draft.id),
    listAllProspectionInfestations(draft.id),
  ]);

  const payload = {
    ...(await buildProspectionPayload(draft, token)),
    captures: buildCapturesPayload(captures),
    populations: buildPopulationsPayload(populations),
    infestations: buildInfestationsPayload(infestations),
  };

  // Le `try/catch` qui entourait ce corps ne faisait que journaliser puis
  // relancer. L'erreur remonte désormais typée depuis `api-client`, et la
  // frontière de l'appelant la journalise une fois — pas deux.
  await apiClient.createProspection(token, payload);
  await markProspectionSynced(draft.id);

  log.event('prospection.sync.ok', {
    prospectionId: draft.id,
    stationId: payload.station_id,
  });
}

/**
 * Ce que le domaine « prospection » fournit pour être synchronisé en lot.
 *
 * `marquerConflit` est **absent** : `POST /prospections` ne rend pas de 409.
 * Le déclarer vide inventerait une gestion de conflit qui n'existe pas ; son
 * absence fait compter un 409 imprévu comme un échec visible (`sync-lot`).
 */
export const lotProspection: LotSync<DraftProspection> = {
  nom: 'prospection',
  syncOne: syncOneProspection,
  idDe: (draft) => draft.id,
  labelDe: (draft) => draft.n_fiche ?? `Fiche du ${draft.date_prospection}`,
  marquerEchec: markProspectionEchec,
};

/**
 * Clôt la fiche localement, puis tente l'envoi et **résume**.
 *
 * `completeProspection` est hors du lot à dessein : la clôture locale doit
 * réussir ou lever, elle n'a rien d'un résultat partiel (ADR-008).
 */
export async function enregistrerEtSynchroniser(
  draft: DraftProspection,
  captures: CaptureRow[],
  token: string
): Promise<ResumeSync> {
  const completed = await completeProspection(draft.id);

  return syncAll(
    [completed],
    token,
    avecConnexion(
      {
        ...lotProspection,
        // Les captures viennent de l'écran au premier envoi : la boucle de
        // capture les tient encore en mémoire.
        syncOne: (fiche, jeton) => syncOneProspection(fiche, jeton, captures),
      },
      estEnLigne
    )
  );
}

/** Synchronise un lot de prospections en attente. Ne lève jamais. */
export async function syncAllProspections(
  drafts: DraftProspection[],
  token: string
): Promise<ResumeSync> {
  return syncAll(drafts, token, lotProspection);
}