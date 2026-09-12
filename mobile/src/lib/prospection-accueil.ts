import { apiClient, Campagne, ProspectionRead } from './api-client';
import { generateId } from './id';
import { STATUT_VALIDE } from './prospection-fiche-lecture';
import { listCampagnesLocal } from './referentiel-db';
import {
  createDraftProspection,
  countUnsyncedProspections,
  deleteProspection as deleteLocalProspection,
  listDraftProspections,
  listRecentProspections,
  listUnsyncedProspections,
  materialiserProspectionValidee,
  saveProspectionPopulation,
  saveProspectionInfestation,
  getProspection,
  DraftProspection,
  TypeProspection,
  PopulationRow,
  InfestationRow,
} from './prospection-repository';
import { validateProspectionDate } from './prospection-validation';
import { PreconditionError, ReferentialError } from './errors';
import { logger } from './logger';

const log = logger.child({ module: 'prospection-accueil' });

export interface AccueilViewModel {
  unsyncedCount: number;
  activeDraft: DraftProspection | null;
  recent: DraftProspection[];
  validated: ProspectionRead[];
  /**
   * File d'envoi réelle (#synchronisation-automatique), distincte de `recent`
   * qui plafonne à 20 fiches pour l'affichage — une fiche en attente au-delà
   * de ces 20 ne doit jamais être exclue d'une synchronisation.
   */
  pendingSync: DraftProspection[];
}

/** Charge les données de l'écran Accueil depuis le store local — aucune dépendance réseau. */
export async function loadAccueilData(): Promise<AccueilViewModel> {
  const [drafts, recent, unsyncedCount, pendingSync] = await Promise.all([
    listDraftProspections(),
    listRecentProspections(),
    countUnsyncedProspections(),
    listUnsyncedProspections(),
  ]);

  return {
    unsyncedCount,
    activeDraft: drafts[0] ?? null,
    recent,
    validated: [],
    pendingSync,
  };
}

/**
 * Récupère les fiches au statut Validé du prospecteur courant depuis le serveur (#16) —
 * seul endroit où le statut final "Validé" existe, l'app locale ne connaît que jusqu'à
 * "en_attente".
 *
 * **L'échec n'est plus avalé** (ADR-012 décision 1). Le `catch { return [] }`
 * d'origine rendait « serveur injoignable » strictement indiscernable de
 * « aucune fiche validée » : l'agent lisait « Aucune fiche » et en concluait
 * que sa saisie n'avait pas été prise. L'erreur remonte désormais typée depuis
 * `api-client`, et c'est le `runTask` de l'écran qui décide si l'absence est
 * un vide ou une panne.
 */
export async function loadValidatedProspections(
  token: string,
  prospecteurId: string
): Promise<ProspectionRead[]> {
  return apiClient.listProspections(token, {
    statut: STATUT_VALIDE,
    prospecteur_id: prospecteurId,
  });
}

/**
 * Récupère l'état de revue de toutes les fiches du prospecteur. Après leur
 * envoi, les fiches restent dans SQLite avec leur dernier état local ; sans
 * cette lecture serveur, une fiche vérifiée ou rejetée continuait donc à être
 * affichée « En attente » sur le téléphone.
 */
export async function loadMesProspectionsServeur(
  token: string,
  prospecteurId: string
): Promise<ProspectionRead[]> {
  return apiClient.listProspections(token, { prospecteur_id: prospecteurId });
}

/**
 * « Fiches de traitement → Consulter une fiche validée » (#fiches-validees-
 * multi-utilisateurs) : les fiches validées PAR N'IMPORTE QUEL UTILISATEUR
 * (pas seulement celles de l'agent connecté — contrairement à
 * `loadValidatedProspections` ci-dessus, qui reste réservée à l'écran
 * Accueil/Mes fiches), pas encore transformées en traitement. Toujours un
 * appel serveur direct, jamais un cache local : « la disponibilité globale
 * des fiches est une opération serveur » (aucune fiche d'un autre agent
 * n'existe dans la base SQLite locale de cet appareil).
 */
export async function loadFichesDisponiblesPourTraitement(
  token: string
): Promise<ProspectionRead[]> {
  return apiClient.listProspections(token, {
    statut: STATUT_VALIDE,
    disponible_pour_traitement: true,
  });
}

/**
 * Rapatrie en local une fiche choisie dans « Consulter une fiche validée »
 * (#fiches-validees-multi-utilisateurs) — sans quoi `references.tsx`
 * (`getTraitement`/`construireCible`, tous deux en lecture locale) ne
 * trouverait rien pour une fiche créée sur un AUTRE appareil.
 *
 * Sans effet si la fiche existe déjà en local (cas courant : l'agent choisit
 * l'une de ses propres fiches, déjà là depuis sa création) — jamais
 * n'écrase silencieusement une fiche locale potentiellement en cours d'usage
 * ailleurs (brouillon de traitement déjà démarré dessus, par ex.).
 */
export async function assurerProspectionDisponibleLocalement(fiche: ProspectionRead): Promise<void> {
  const dejaLocale = await getProspection(fiche.id);
  if (dejaLocale) return;

  await materialiserProspectionValidee({
    id: fiche.id,
    typeProspection: fiche.type_prospection,
    campagneId: fiche.campagne_id,
    prospecteurId: fiche.prospecteur_id,
    dateProspection: fiche.date_prospection,
    surfaceInfestee: fiche.surface_infestee ?? null,
    nFiche: fiche.n_fiche ?? null,
    nMessage: fiche.n_message ?? null,
    region: fiche.region ?? null,
    district: fiche.district ?? null,
    commune: fiche.commune ?? null,
    observations: fiche.observations ?? null,
    statut: fiche.statut,
    createdAt: fiche.created_at,
    updatedAt: fiche.updated_at,
  });

  for (const population of fiche.populations ?? []) {
    await saveProspectionPopulation(fiche.id, population as unknown as PopulationRow);
  }
  for (const infestation of fiche.infestations ?? []) {
    await saveProspectionInfestation(fiche.id, infestation.type_cible, infestation as unknown as InfestationRow);
  }
}

/** Supprime une fiche brouillon en local. Refuse toute fiche déjà complétée (elle n'existe alors que côté serveur, où le backend applique la même règle). */
export async function deleteDraftProspection(draft: DraftProspection): Promise<void> {
  if (draft.statut !== 'brouillon') {
    // Message écrit ici pour l'agent et affiché verbatim : c'est ce qui
    // distingue `PreconditionError` des six autres classes.
    throw new PreconditionError('Seules les fiches en brouillon peuvent être supprimées.');
  }
  await deleteLocalProspection(draft.id);
}

/** Choisit la campagne en cours parmi les campagnes connues (règle : une seule campagne à la fois). */
export function pickCurrentCampagneId(
  campagnes: Campagne[],
  today: Date = new Date()
): string | null {
  if (campagnes.length === 0) return null;

  const iso = today.toISOString().slice(0, 10);
  const enCours = campagnes.filter(
    (c) => c.start_date <= iso && (!c.end_date || c.end_date >= iso)
  );
  const pool = enCours.length > 0 ? enCours : campagnes;

  if (pool.length === 0) return null;

  return [...pool].sort((a, b) => b.start_date.localeCompare(a.start_date))[0].id;
}

/** Initialise une fiche brouillon vide en local et la lie à la campagne en cours. */
export async function startNewProspection(params: {
  token: string;
  prospecteurId: string;
  typeProspection?: TypeProspection;
  signalementSource?: string | null;
  signalementDate?: string | null;
  signalementDescription?: string | null;
  /** Extensif uniquement — choisi sur l'écran Terrestre/Aérien avant la création. */
  modeExtensif?: string | null;
}): Promise<DraftProspection> {
  log.detail('prospection.nouvelle.demande', {
    prospecteurId: params.prospecteurId,
    typeProspection: params.typeProspection ?? 'intensive',
  });

  const campagnes: Campagne[] = await listCampagnesLocal();

  if (campagnes.length === 0) {
    // `ReferentialError`, pas `Error` : la classe porte l'action offerte à
    // l'agent — « Synchroniser les référentiels » — là où une erreur nue
    // n'aurait proposé que « Signaler au support », inutile en brousse.
    throw new ReferentialError(
      'Aucune campagne disponible hors-ligne. Synchronisez le référentiel avant de partir sur le terrain.'
    );
  }

  // À défaut de campagne en cours, la plus récente : le référentiel n'est pas
  // vide, donc `pickCurrentCampagneId` ne peut rendre `null` qu'en l'absence
  // de campagne *active*.
  const selectedCampagneId = pickCurrentCampagneId(campagnes) ?? campagnes[0].id;

  const dateProspection = new Date().toISOString().slice(0, 10);
  const campagneSelectionnee = campagnes.find((c) => c.id === selectedCampagneId);

  if (campagneSelectionnee) {
    const { blocages } = validateProspectionDate({
      dateProspection,
      campagneStartDate: campagneSelectionnee.start_date,
    });
    if (blocages.length > 0) {
      // Le blocage est déjà une phrase écrite pour l'agent : la réécrire
      // perdrait la seule information utile.
      throw new PreconditionError(blocages[0]);
    }
  }

  const draft = await createDraftProspection({
    id: generateId(),
    typeProspection: params.typeProspection ?? 'intensive',
    campagneId: selectedCampagneId,
    prospecteurId: params.prospecteurId,
    dateProspection,
    region: null,
    district: null,
    commune: null,
    za: null,
    pa_code: null,
    signalementSource: params.signalementSource ?? null,
    signalementDate: params.signalementDate ?? null,
    signalementDescription: params.signalementDescription ?? null,
    modeExtensif: params.modeExtensif ?? null,
  });

  // `event` et non `detail` : la création d'un brouillon est le fait notable
  // auquel le support rattache tout le reste de la fiche.
  log.event('prospection.brouillon.cree', {
    prospectionId: draft.id,
    campagneId: selectedCampagneId,
    typeProspection: draft.type_prospection,
  });

  return draft;
}
