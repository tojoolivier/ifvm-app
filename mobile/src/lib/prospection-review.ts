import * as Network from 'expo-network';
import {
  apiClient,
  ProspectionCaptureInput,
  ProspectionInfestationInput,
  ProspectionOperationAerienneInput,
  ProspectionPopulationInput,
  ProspectionCreateInput,
} from './api-client';
import {
  CaptureRow,
  DraftProspection,
  InfestationRow,
  OperationAerienneRow,
  PopulationRow,
  completeProspection,
  markProspectionEchec,
  markProspectionSynced,
  listAllProspectionCaptures,
  listAllProspectionPopulations,
  listAllProspectionInfestations,
  listOperationsAeriennes,
  normalizeBoolean,
} from './prospection-repository';
import { PHENOTYPES, TYPE_CIBLE_OPTIONS, formatHeureLocale } from './prospection-fiche-lecture';
import { parseSelectionMultiple, typeCibleImagoLabel } from './prospection-extensive';
import { CaptureCounts, dominantPhenotype, rowsToCounts, totalBySexe, totalCaptures } from './prospection-capture-store';
import { CHRONO_MAX_SECONDS, capturesMaxFor, phasesFor, phenotypesFor } from './prospection-especes-stades';
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

export interface DensiteViewModel {
  key: string;
  espece: 'LMC' | 'NSE';
  categorie: 'imago' | 'larve';
  label: string;
  densiteDiffuse: number | null;
  densiteGroupee: number | null;
}

/** Une ligne `prospection_infestation` = une cible réellement sélectionnée et enregistrée. */
export interface InfestationCibleViewModel {
  key: string;
  label: string;
  details: string[];
}

/**
 * Détail Imagos/Larves × LMC/NSE affiché dans la carte « Infestation » du
 * récapitulatif Intensive (#infestation-recap-intensive) : nombre de captures +
 * densité diffuse/groupée, toujours les 4 combinaisons (jamais masquée
 * individuellement — même règle que `DensiteViewModel`).
 */
export interface InfestationDetailViewModel {
  key: string;
  categorie: 'imago' | 'larve';
  espece: 'LMC' | 'NSE';
  label: string;
  nombre: number;
  densiteDiffuse: number | null;
  densiteGroupee: number | null;
}

export interface DetailRowViewModel {
  label: string;
  value: string;
}

/** Une espèce (LMC/NSE) avec au moins une donnée renseignée pour B-Imagos/C-Larves —
 * même principe de masquage que `imagoRowHasData`/`larveRowHasData` côté Extensif
 * (extensive-recap.tsx) : une combinaison jamais ouverte n'affiche aucun bloc. */
export interface SpeciesDetailGroupViewModel {
  espece: 'LMC' | 'NSE';
  label: string;
  rows: DetailRowViewModel[];
}

const PHASE_LABEL: Record<string, string> = {
  solitaire: 'Solitaire',
  solitaro_trans: 'Solitaro-Transiens',
  transiens: 'Transiens',
  gregaire: 'Grégaire',
};

function phasesBreakdownLabel(rows: CaptureRow[], phasesList: string[]): string {
  const totals: Record<string, number> = {};
  for (const phase of phasesList) totals[phase] = 0;
  for (const row of rows) {
    if (row.phase && Object.prototype.hasOwnProperty.call(totals, row.phase)) {
      totals[row.phase] += row.effectif;
    }
  }
  return phasesList.map((p) => `${PHASE_LABEL[p] ?? p} ${totals[p]}`).join(' · ');
}

function stadesBreakdownLabel(rows: CaptureRow[]): string {
  const totals: Record<string, number> = {};
  for (const row of rows) totals[row.stade] = (totals[row.stade] ?? 0) + row.effectif;
  const nonZero = Object.entries(totals).filter(([, v]) => v > 0);
  return nonZero.length > 0 ? nonZero.map(([stade, v]) => `${stade} ${v}`).join(' · ') : '—';
}

/**
 * Détail complet B-Imagos, une espèce à la fois — même esprit que
 * `buildImagoRows` côté Extensif (extensive-recap.tsx) : chaque champ saisi est
 * affiché explicitement, jamais masqué silencieusement (« — » si absent). Le
 * nombre de captures et la répartition Phases/Stades viennent de la table
 * `prospection_capture` (comme `buildReviewGroups`/`buildInfestationDetail`),
 * jamais de `PopulationRow.captures_*` (colonnes scalaires propres à l'Extensif,
 * jamais renseignées côté Intensif — cf. #stades-imago-persistance).
 */
function buildImagoDetailRows(espece: 'LMC' | 'NSE', captures: CaptureRow[], population: PopulationRow | null): DetailRowViewModel[] {
  const captureRows = captures.filter((c) => c.espece === espece && c.categorie === 'imago');
  const counts = rowsToCounts(captureRows);
  const phasesList = phasesFor(espece, 'imago');
  const typeCible = parseSelectionMultiple(population?.type_cible ?? null);
  return [
    { label: 'Nombre de captures', value: String(totalCaptures(counts)) },
    { label: 'Phases', value: phasesBreakdownLabel(captureRows, phasesList) },
    { label: 'Stades', value: stadesBreakdownLabel(captureRows) },
    { label: 'Densité diffuse', value: population?.densite_diffuse != null ? `${population.densite_diffuse} ind./ha` : '—' },
    { label: 'Densité groupée', value: population?.densite_groupee != null ? `${population.densite_groupee} ind./m²` : '—' },
    { label: 'Accouplement', value: population?.accouplement ?? '—' },
    { label: 'Ponte', value: population?.ponte ?? '—' },
    { label: 'Interdistance (m)', value: population?.interdistance != null ? String(population.interdistance) : '—' },
    { label: 'Type de cible', value: typeCible.map((v) => typeCibleImagoLabel(v)).join(', ') || '—' },
  ];
}

function imagoDetailHasData(captures: CaptureRow[], espece: 'LMC' | 'NSE', population: PopulationRow | null): boolean {
  const hasCaptures = captures.some((c) => c.espece === espece && c.categorie === 'imago');
  return (
    hasCaptures ||
    population?.densite_diffuse != null ||
    population?.densite_groupee != null ||
    !!population?.accouplement ||
    !!population?.ponte ||
    population?.interdistance != null ||
    parseSelectionMultiple(population?.type_cible ?? null).length > 0
  );
}

/** Détail complet C-Larves, une espèce à la fois — même esprit que
 * `buildLarveRows` côté Extensif, adapté à l'Intensif (surface contaminée
 * délibérément exclue, cf. #prospection-intensive-fusion-abcd). */
function buildLarveDetailRows(espece: 'LMC' | 'NSE', captures: CaptureRow[], population: PopulationRow | null): DetailRowViewModel[] {
  const captureRows = captures.filter((c) => c.espece === espece && c.categorie === 'larve');
  const counts = rowsToCounts(captureRows);
  const phasesList = phasesFor(espece, 'larve');
  return [
    { label: 'Nombre de captures', value: String(totalCaptures(counts)) },
    { label: 'Phases', value: phasesBreakdownLabel(captureRows, phasesList) },
    { label: 'Stades larvaires', value: stadesBreakdownLabel(captureRows) },
    { label: 'Densité diffuse', value: population?.densite_diffuse != null ? `${population.densite_diffuse} ind./ha` : '—' },
    { label: 'Densité groupée', value: population?.densite_groupee != null ? `${population.densite_groupee} ind./m²` : '—' },
    { label: 'Interdistance (m)', value: population?.interdistance != null ? String(population.interdistance) : '—' },
    { label: 'Tache larvaire', value: population?.tache_larvaire ? 'Oui' : 'Non' },
    { label: 'Bande larvaire', value: population?.bande_larvaire ? 'Oui' : 'Non' },
    {
      label: 'Déplacement',
      value: population?.deplacement === 'perchee' ? 'Perchée' : population?.deplacement === 'repos' ? 'Repos' : '—',
    },
  ];
}

function larveDetailHasData(captures: CaptureRow[], espece: 'LMC' | 'NSE', population: PopulationRow | null): boolean {
  const hasCaptures = captures.some((c) => c.espece === espece && c.categorie === 'larve');
  return (
    hasCaptures ||
    population?.densite_diffuse != null ||
    population?.densite_groupee != null ||
    population?.interdistance != null ||
    !!population?.tache_larvaire ||
    !!population?.bande_larvaire ||
    (!!population?.deplacement && population.deplacement !== 'repos')
  );
}

function buildSpeciesDetailGroups(
  captures: CaptureRow[],
  populations: PopulationRow[],
  categorie: 'imago' | 'larve'
): SpeciesDetailGroupViewModel[] {
  const especes: ('LMC' | 'NSE')[] = ['LMC', 'NSE'];
  const groups: SpeciesDetailGroupViewModel[] = [];
  for (const espece of especes) {
    const population = populations.find((p) => p.espece === espece && p.categorie === categorie) ?? null;
    const hasData = categorie === 'imago' ? imagoDetailHasData(captures, espece, population) : larveDetailHasData(captures, espece, population);
    if (!hasData) continue;
    groups.push({
      espece,
      label: ESPECE_LABEL[espece],
      rows: categorie === 'imago' ? buildImagoDetailRows(espece, captures, population) : buildLarveDetailRows(espece, captures, population),
    });
  }
  return groups;
}

export interface RecapitulatifViewModel {
  nFiche: string;
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
  infestationCibles: InfestationCibleViewModel[];
  comportementSummary: string;
  observationsText: string;
  densites: DensiteViewModel[];
  infestationDetail: InfestationDetailViewModel[];
  heureObservationLabel: string;
  /** Détail complet B-Imagos/C-Larves, style Extensif (#recap-style-extensif-vers-intensif) —
   * un groupe par espèce ayant au moins une donnée, masqué sinon. */
  imagoDetailGroups: SpeciesDetailGroupViewModel[];
  larveDetailGroups: SpeciesDetailGroupViewModel[];
}

const ESPECE_LABEL = { LMC: 'Locusta', NSE: 'Nomadacris' } as const;
const CATEGORIE_LABEL = { imago: 'Imagos', larve: 'Larves' } as const;

/**
 * Densité diffuse/groupée par espèce + stade — 4 blocs indépendants (LMC/NSE ×
 * imago/larve), jamais partagés (cf. `saveProspectionPopulation`, upsert par
 * `(prospection_id, espece, categorie)`). Toujours les 4 combinaisons, même sans
 * ligne en base pour l'une d'elles (densités alors affichées comme non renseignées).
 */
function buildDensitesSummary(populations: PopulationRow[]): DensiteViewModel[] {
  const especes: ('LMC' | 'NSE')[] = ['LMC', 'NSE'];
  // Imagos avant larves (et non espèce par espèce) : aligne le récapitulatif sur l'ordre
  // A-Références/B-Imagos/C-Larves/D-Végétation & Sol/E-Observations du parcours de saisie.
  const categories: ('imago' | 'larve')[] = ['imago', 'larve'];
  const rows: DensiteViewModel[] = [];
  for (const categorie of categories) {
    for (const espece of especes) {
      const row = populations.find((p) => p.espece === espece && p.categorie === categorie);
      rows.push({
        key: `${espece}-${categorie}`,
        espece,
        categorie,
        label: `${ESPECE_LABEL[espece]} — ${CATEGORIE_LABEL[categorie]}`,
        densiteDiffuse: row?.densite_diffuse ?? null,
        densiteGroupee: row?.densite_groupee ?? null,
      });
    }
  }
  return rows;
}

/**
 * Détail Imagos/Larves × LMC/NSE pour la carte « Infestation » du récapitulatif
 * Intensive : nombre de captures (même calcul que `buildReviewGroups`, indépendant
 * de la sélection d'espèces du brouillon — toujours les 4 combinaisons, une
 * combinaison jamais ouverte vaut simplement 0, pas « non renseigné », cf.
 * `totalCaptures` déjà affiché sans condition dans les cartes du haut) et densité
 * diffuse/groupée (`null` si aucune ligne `prospection_population` pour cette
 * combinaison — jamais confondu avec `0`, une valeur réellement saisie).
 */
function buildInfestationDetail(
  captures: CaptureRow[],
  populations: PopulationRow[]
): InfestationDetailViewModel[] {
  const especes: ('LMC' | 'NSE')[] = ['LMC', 'NSE'];
  const categories: ('imago' | 'larve')[] = ['imago', 'larve'];
  const rows: InfestationDetailViewModel[] = [];
  for (const categorie of categories) {
    for (const espece of especes) {
      const captureRows = captures.filter((c) => c.espece === espece && c.categorie === categorie);
      const population = populations.find((p) => p.espece === espece && p.categorie === categorie);
      rows.push({
        key: `${categorie}-${espece}`,
        categorie,
        espece,
        label: ESPECE_LABEL[espece],
        nombre: totalCaptures(rowsToCounts(captureRows)),
        densiteDiffuse: population?.densite_diffuse ?? null,
        densiteGroupee: population?.densite_groupee ?? null,
      });
    }
  }
  return rows;
}

/**
 * Une combinaison Imagos/Larves × LMC/NSE n'a de sens à afficher que si elle a
 * effectivement été renseignée — même règle de masquage que
 * `imagoRowHasData`/`larveRowHasData` dans extensive-recap.tsx (masquer le bloc
 * entier plutôt qu'une ligne à 0/—/— pour une combinaison jamais ouverte).
 */
export function infestationDetailHasData(d: InfestationDetailViewModel): boolean {
  return d.nombre > 0 || d.densiteDiffuse != null || d.densiteGroupee != null;
}

function buildReviewGroups(draft: DraftProspection, captures: CaptureRow[]): ReviewGroupViewModel[] {
  // Imagos avant larves (et non espèce par espèce, l'ordre naturel de `buildGrilles`) :
  // aligne le récapitulatif sur l'ordre A-Références/B-Imagos/C-Larves/D-Végétation &
  // Sol/E-Observations du parcours de saisie.
  const grilles = [...buildGrilles(parseEspeceSelection(draft.especes))].sort((a, b) =>
    a.categorie === b.categorie ? 0 : a.categorie === 'imago' ? -1 : 1
  );
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

/**
 * Une cible affichée = une cible sélectionnée par l'utilisateur (une ligne existe pour
 * elle en base, cf. `persistAll`/`deleteProspectionInfestation` dans infestation.tsx qui
 * gardent exactement synchronisées sélection et lignes enregistrées — désélectionner
 * supprime la ligne, donc plus rien à afficher ici pour cette cible).
 *
 * Ancien bug : ce résumé ne retenait qu'une cible ayant surface_totale ou densite_moy
 * renseigné — une cible sélectionnée mais pas encore quantifiée (la section Infestation
 * est facultative) disparaissait donc silencieusement du récapitulatif alors qu'elle
 * était bien enregistrée.
 */
function buildInfestationCibles(infestations: InfestationRow[]): InfestationCibleViewModel[] {
  return infestations.map((row) => {
    const details: string[] = [];
    if (row.surface_totale != null) details.push(`Surface : ${row.surface_totale} ha`);
    if (row.densite_moy != null) {
      details.push(`Densité moy. : ${row.densite_moy}`);
    } else if (row.densite_min != null || row.densite_max != null) {
      details.push(`Densité : ${row.densite_min ?? '—'} – ${row.densite_max ?? '—'}`);
    }
    // Un brouillon local pré-migration 0031 pas encore resynchronisé peut encore porter
    // type_cible='essaim' — même reclassement que buildInfestationsPayload, pour ne pas
    // afficher la valeur brute non traduite dans le récapitulatif.
    const typeEssaim = row.type_essaim ? (TYPE_ESSAIM_TO_BACKEND[row.type_essaim] ?? null) : null;
    const typeCible = normalizeTypeCible(row.type_cible, typeEssaim);
    return {
      key: row.type_cible,
      label: TYPE_CIBLE_OPTIONS.find((o) => o.value === typeCible)?.label ?? typeCible,
      details,
    };
  });
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
  infestations: InfestationRow[],
  populations: PopulationRow[] = []
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
    pa: draft.pa_nom ?? '—',
    station: draft.station_nom ?? '—',
    surfaceStation: draft.surface_station,
    surfaceProspectee: draft.surface_prospectee,
    surfaceInfestee: draft.surface_infestee,
    latitude: draft.latitude,
    longitude: draft.longitude,
    vegetationSummary,
    reviewGroups: buildReviewGroups(draft, captures),
    infestationCibles: buildInfestationCibles(infestations),
    comportementSummary: buildComportementSummary(infestations),
    observationsText: draft.observations?.trim() ? draft.observations : 'Aucune observation renseignée.',
    densites: buildDensitesSummary(populations),
    infestationDetail: buildInfestationDetail(captures, populations),
    heureObservationLabel: formatHeureLocale(draft.heure_observation_at),
    imagoDetailGroups: buildSpeciesDetailGroups(captures, populations, 'imago'),
    larveDetailGroups: buildSpeciesDetailGroups(captures, populations, 'larve'),
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
    n_fiche: draft.n_fiche || null,
    n_message: draft.n_message || null,
    date_prospection: draft.date_prospection,
    latitude: draft.latitude ? Number(draft.latitude) : null,
    longitude: draft.longitude ? Number(draft.longitude) : null,
    altitude: draft.altitude ? Number(draft.altitude) : null,
    // #biotope-multi : tableau, jamais `null` (le nouveau schéma ProspectionCreate a
    // pour défaut `[]`) — `parseSelectionMultiple` absorbe aussi l'ancien format
    // scalaire d'un brouillon local créé avant ce changement.
    biotope: parseSelectionMultiple(draft.biotope).map((v) => v.toLowerCase()) as ProspectionCreateInput['biotope'],
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
    heure_observation_at: draft.heure_observation_at || null,
    station_libre: draft.station_libre || null,
    type_station: parseSelectionMultiple(draft.type_station) as ProspectionCreateInput['type_station'],
    verdure_strate: (draft.verdure_strate || null) as ProspectionCreateInput['verdure_strate'],
    signalement_source: draft.signalement_source || null,
    signalement_date: draft.signalement_date || null,
    signalement_description: draft.signalement_description || null,
    conclusion_validation: (draft.conclusion_validation || null) as ProspectionCreateInput['conclusion_validation'],
    avertissements: draft.avertissements ? JSON.parse(draft.avertissements) : [],
    mode_extensif: (draft.mode_extensif || null) as ProspectionCreateInput['mode_extensif'],
    societe: draft.societe || null,
    immatricule_aeronef: draft.immatricule_aeronef || null,
    pilote: draft.pilote || null,
    mecanicien: draft.mecanicien || null,
    chef_de_base: draft.chef_de_base || null,
    base: draft.base || null,
    base_numero: draft.base_numero != null ? Number(draft.base_numero) : null,
    base_date_installation: draft.base_date_installation || null,
    base_latitude: draft.base_latitude != null ? Number(draft.base_latitude) : null,
    base_longitude: draft.base_longitude != null ? Number(draft.base_longitude) : null,
    base_secondaire: draft.base_secondaire || null,
    base_secondaire_date_installation: draft.base_secondaire_date_installation || null,
    base_secondaire_latitude: draft.base_secondaire_latitude != null ? Number(draft.base_secondaire_latitude) : null,
    base_secondaire_longitude: draft.base_secondaire_longitude != null ? Number(draft.base_secondaire_longitude) : null,
    pesticides_embarques: normalizeBoolean(draft.pesticides_embarques),
    pesticide_nom_commercial: draft.pesticide_nom_commercial || null,
    pesticide_quantite_disponible: draft.pesticide_quantite_disponible != null ? Number(draft.pesticide_quantite_disponible) : null,
    pesticide_quantite_recue: draft.pesticide_quantite_recue != null ? Number(draft.pesticide_quantite_recue) : null,
    futs_disponible: draft.futs_disponible != null ? Number(draft.futs_disponible) : null,
    futs_pleins: draft.futs_pleins != null ? Number(draft.futs_pleins) : null,
    futs_vides: draft.futs_vides != null ? Number(draft.futs_vides) : null,
    futs_recues: draft.futs_recues != null ? Number(draft.futs_recues) : null,
    signature_visa_nom: draft.signature_visa_nom || null,
    signature_visa_horodatage: draft.signature_visa_horodatage || null,
    signature_consultant_fao_nom: draft.signature_consultant_fao_nom || null,
    signature_consultant_fao_horodatage: draft.signature_consultant_fao_horodatage || null,
    signature_consultant_fao_image: draft.signature_consultant_fao_image || null,
    signature_pilote_nom: draft.signature_pilote_nom || null,
    signature_pilote_horodatage: draft.signature_pilote_horodatage || null,
    signature_pilote_image: draft.signature_pilote_image || null,
    signature_chef_base_nom: draft.signature_chef_base_nom || null,
    signature_chef_base_horodatage: draft.signature_chef_base_horodatage || null,
    signature_chef_base_image: draft.signature_chef_base_image || null,
  };
}

/** `numero`/`duree_minutes` ne sont pas envoyés : assignés/recalculés côté serveur
 * (cf. CreateProspection.execute), jamais fait confiance à la valeur locale. */
function buildOperationsAeriennesPayload(rows: OperationAerienneRow[]): ProspectionOperationAerienneInput[] {
  return rows.map((row) => ({
    type_operation: row.type_operation as ProspectionOperationAerienneInput['type_operation'],
    motif_divers: row.motif_divers || null,
    debut_heure: row.debut_heure,
    debut_temperature_c: row.debut_temperature_c ?? null,
    debut_vent_ms: row.debut_vent_ms ?? null,
    fin_heure: row.fin_heure,
    fin_temperature_c: row.fin_temperature_c ?? null,
    fin_vent_ms: row.fin_vent_ms ?? null,
  }));
}

/** Le picker affiche 'Néant'/'Rare'/'Beaucoup' (accouplement.tsx) mais le
 * backend n'accepte que l'ASCII minuscule ('neant'/'rare'/'beaucoup'). */
const COMBINING_DIACRITICS_RE = new RegExp('[̀-ͯ]', 'g');

function normalizeIntensite(value: string | null): string | null {
  if (!value) return null;
  return value.toLowerCase().normalize('NFD').replace(COMBINING_DIACRITICS_RE, '');
}

/**
 * Une ligne population « ne porte aucune donnée » quand tous ses champs sont
 * vides ET qu'aucune capture ne lui est associée (table `prospection_capture`,
 * Intensif — `captures_*` scalaires, Extensif) : c'est un résidu sans intérêt,
 * jamais une saisie de l'agent, qu'il faut simplement omettre du payload de
 * synchro (cf. `syncOneProspection`) plutôt que d'envoyer une ligne vide pour
 * une grille que l'agent n'a jamais ouverte. `densite_diffuse` n'est plus
 * obligatoire côté backend (#densite-diffuse-obligatoire retiré, demande
 * explicite du 2026-09-14 — bloquait la synchronisation entière d'une fiche à
 * cause d'une seule grille jamais destinée à être remplie), mais cette
 * omission reste utile pour la propreté du payload.
 *
 * #revalidation-prospection : c'est le cas le plus fréquent pour ces lignes
 * résiduelles — `demarrerRevalidation` clone TOUTES les lignes population de
 * la fiche source, y compris une grille espèce/catégorie jamais renseignée
 * sur l'ancienne fiche (tolérée en lecture par `PopulationRead`, jamais
 * imposée), que l'agent n'a ensuite aucune raison de rouvrir s'il ne
 * s'intéresse pas à cette espèce.
 */
function populationRowHasData(row: PopulationRow, captures: CaptureRow[]): boolean {
  const hasCaptures = captures.some((c) => c.espece === row.espece && c.categorie === row.categorie);
  return (
    hasCaptures ||
    row.densite_diffuse != null ||
    row.densite_groupee != null ||
    !!row.methode ||
    !!row.accouplement ||
    !!row.ponte ||
    (row.captures_nombre ?? 0) > 0 ||
    (row.captures_sol ?? 0) > 0 ||
    (row.captures_trans ?? 0) > 0 ||
    (row.captures_greg ?? 0) > 0 ||
    (row.captures_solitaro_transiens ?? 0) > 0 ||
    !!row.stades_imago ||
    row.essaim_observe != null ||
    !!row.densites_larve ||
    !!row.tache_larvaire ||
    !!row.bande_larvaire ||
    row.interdistance != null ||
    (!!row.deplacement && row.deplacement !== 'repos') ||
    row.surface_contaminee_ha != null ||
    parseSelectionMultiple(row.type_cible ?? null).length > 0 ||
    !!row.direction_de ||
    !!row.direction_vers ||
    (!!row.etat && row.etat !== 'repos') ||
    !!row.essaim_en_vol ||
    !!row.essaim_pose
  );
}

function buildPopulationsPayload(rows: PopulationRow[]): ProspectionPopulationInput[] {
  return rows.map((row) => ({
    espece: row.espece,
    categorie: row.categorie,
    methode: (row.methode || null) as ProspectionPopulationInput['methode'],
    phase: row.phase || null,
    // #densite-zero-perdue : `valeur ? Number(valeur) : null` traite 0 comme
    // faux (JS) et le convertissait à tort en `null` — perdant silencieusement
    // un « 0 » réellement saisi (densité nulle constatée, 0 capture d'une
    // phase précise...) à la synchronisation, alors que la valeur était bien
    // conservée en local (recap, SQLite). `!= null` seul distingue
    // correctement « non renseigné » de « renseigné à zéro ».
    captures_nombre: row.captures_nombre != null ? Number(row.captures_nombre) : null,
    temps_capture: row.temps_capture != null ? Number(row.temps_capture) : null,
    densite_diffuse: row.densite_diffuse != null ? Number(row.densite_diffuse) : null,
    densite_groupee: row.densite_groupee != null ? Number(row.densite_groupee) : null,
    accouplement: normalizeIntensite(row.accouplement) as ProspectionPopulationInput['accouplement'],
    ponte: normalizeIntensite(row.ponte) as ProspectionPopulationInput['ponte'],
    captures_sol: row.captures_sol != null ? Number(row.captures_sol) : null,
    captures_trans: row.captures_trans != null ? Number(row.captures_trans) : null,
    captures_greg: row.captures_greg != null ? Number(row.captures_greg) : null,
    stade_imago: (row.stade_imago || null) as ProspectionPopulationInput['stade_imago'],
    // #stades-imago-persistance : répartition par sexe/sous-stade — même traitement
    // que densites_larve juste en dessous (JSON encodé côté SQLite, objet côté API).
    stades_imago: row.stades_imago ? JSON.parse(row.stades_imago) : null,
    essaim_observe: row.essaim_observe != null ? Boolean(row.essaim_observe) : null,
    densites_larve: row.densites_larve ? JSON.parse(row.densites_larve) : null,
    tache_larvaire: row.tache_larvaire != null ? Boolean(row.tache_larvaire) : null,
    bande_larvaire: row.bande_larvaire != null ? Boolean(row.bande_larvaire) : null,
    interdistance: row.interdistance != null ? Number(row.interdistance) : null,
    deplacement: (row.deplacement || null) as ProspectionPopulationInput['deplacement'],
    // Champs extensif-imagos par espèce (migration 0033) : bien présents sur PopulationRow
    // (cf. prospection-repository.ts) — indépendants de prospection_infestation/
    // buildInfestationsPayload, une table différente (InfestationRow). Les omettre ici les
    // fait silencieusement disparaître à la synchro serveur (régression déjà rencontrée à
    // deux reprises, cf. commits ca39761 et 55cdc59 qui les avaient retirés à tort — vérifié
    // sans ambiguïté par `npx tsc --noEmit`, aucune erreur sur ces champs).
    surface_contaminee_ha: row.surface_contaminee_ha != null ? Number(row.surface_contaminee_ha) : null,
    // #type-cible-multi-select : `row.type_cible` est un tableau JSON encodé (comme
    // biotope) — jamais la string brute, le backend attend désormais un vrai tableau.
    type_cible: parseSelectionMultiple(row.type_cible) as ProspectionPopulationInput['type_cible'],
    direction_de: row.direction_de || null,
    direction_vers: row.direction_vers || null,
    etat: (row.etat || null) as ProspectionPopulationInput['etat'],
    essaim_en_vol: row.essaim_en_vol != null ? Boolean(row.essaim_en_vol) : null,
    essaim_pose: row.essaim_pose != null ? Boolean(row.essaim_pose) : null,
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
    // #densite-zero-perdue : mêmes champs numériques que buildPopulationsPayload,
    // `!= null` plutôt qu'un test de vérité JS — un 0 réellement saisi (densité
    // nulle constatée, taille nulle...) ne doit pas se perdre en `null` à la
    // synchronisation.
    return {
      type_cible: normalizeTypeCible(row.type_cible, typeEssaim) as ProspectionInfestationInput['type_cible'],
      espece: (row.espece || null) as ProspectionInfestationInput['espece'],
      taille_min: row.taille_min != null ? Number(row.taille_min) : null,
      taille_max: row.taille_max != null ? Number(row.taille_max) : null,
      taille_moy: row.taille_moy != null ? Number(row.taille_moy) : null,
      surface_totale: row.surface_totale != null ? Number(row.surface_totale) : null,
      densite_min: row.densite_min != null ? Number(row.densite_min) : null,
      densite_max: row.densite_max != null ? Number(row.densite_max) : null,
      densite_moy: row.densite_moy != null ? Number(row.densite_moy) : null,
      interdistance: row.interdistance != null ? Number(row.interdistance) : null,
      comportement: (row.comportement || null) as ProspectionInfestationInput['comportement'],
      direction_de: row.direction_de || null,
      direction_vers: row.direction_vers || null,
      vent_de: row.vent_de || null,
      vent_vitesse: row.vent_vitesse != null ? Number(row.vent_vitesse) : null,
      pullulation_nb: row.pullulation_nb != null ? Number(row.pullulation_nb) : null,
      taille_long: row.taille_long != null ? Number(row.taille_long) : null,
      taille_large: row.taille_large != null ? Number(row.taille_large) : null,
      taille_epaisseur: row.taille_epaisseur != null ? Number(row.taille_epaisseur) : null,
      essaim_en_vol: row.essaim_en_vol != null ? Boolean(row.essaim_en_vol) : null,
      essaim_pose: row.essaim_pose != null ? Boolean(row.essaim_pose) : null,
      type_essaim: typeEssaim as ProspectionInfestationInput['type_essaim'],
      heure_observation: row.heure_observation || null,
      densite_en_vol: row.densite_en_vol != null ? Number(row.densite_en_vol) : null,
      dimension_ha: row.dimension_ha != null ? Number(row.dimension_ha) : null,
      nb_taches_bandes: row.nb_taches_bandes != null ? Number(row.nb_taches_bandes) : null,
      interdistance_m: row.interdistance_m != null ? Number(row.interdistance_m) : null,
      interdistance_min: row.interdistance_min != null ? Number(row.interdistance_min) : null,
      interdistance_max: row.interdistance_max != null ? Number(row.interdistance_max) : null,
      interdistance_moy: row.interdistance_moy != null ? Number(row.interdistance_moy) : null,
      surface_contaminee_ha: row.surface_contaminee_ha != null ? Number(row.surface_contaminee_ha) : null,
      type_larve: (row.type_larve || null) as ProspectionInfestationInput['type_larve'],
      surface_infestee_pourcent: row.surface_infestee_pourcent != null ? Number(row.surface_infestee_pourcent) : null,
      stade_dominant: (row.stade_dominant || null) as ProspectionInfestationInput['stade_dominant'],
      taille_groupe_m2: row.taille_groupe_m2 != null ? Number(row.taille_groupe_m2) : null,
      front_longueur_m: row.front_longueur_m != null ? Number(row.front_longueur_m) : null,
      front_largeur_m: row.front_largeur_m != null ? Number(row.front_largeur_m) : null,
      densite_max_front: row.densite_max_front != null ? Number(row.densite_max_front) : null,
      densite_moy_arriere_front: row.densite_moy_arriere_front != null ? Number(row.densite_moy_arriere_front) : null,
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
  const [captures, populations, infestations, operationsAeriennes] = await Promise.all([
    capturesDeLEcran ? Promise.resolve(capturesDeLEcran) : listAllProspectionCaptures(draft.id),
    listAllProspectionPopulations(draft.id),
    listAllProspectionInfestations(draft.id),
    // Vide sur toute fiche non aérienne (table jamais écrite par ce mode) — inclus
    // systématiquement plutôt que conditionné à `draft.mode_extensif`, même logique
    // que les autres listes ci-dessus qui ne se soucient pas non plus du contenu.
    listOperationsAeriennes(draft.id),
  ]);

  // #revalidation-prospection : une ligne population sans aucune donnée (ni
  // densité, ni capture associée) est un résidu — souvent une grille clonée
  // depuis une fiche périmée que l'agent n'a jamais rouverte — jamais une
  // saisie réelle. Omise du payload plutôt qu'envoyée pour échouer sur
  // `densite_diffuse` obligatoire, cf. `populationRowHasData`.
  const populationsAvecDonnees = populations.filter((row) => populationRowHasData(row, captures));

  const payload = {
    ...(await buildProspectionPayload(draft, token)),
    captures: buildCapturesPayload(captures),
    populations: buildPopulationsPayload(populationsAvecDonnees),
    infestations: buildInfestationsPayload(infestations),
    operations_aeriennes: buildOperationsAeriennesPayload(operationsAeriennes),
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