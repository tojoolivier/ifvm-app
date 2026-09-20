import { apiClient, Campagne, ProspectionRead } from './api-client';
import { generateId } from './id';
import { STATUT_VALIDE } from './prospection-fiche-lecture';
import { listCampagnesLocal, getStationById } from './referentiel-db';
import {
  createDraftProspection,
  countUnsyncedProspections,
  deleteProspection as deleteLocalProspection,
  listDraftProspections,
  listRecentProspections,
  listUnsyncedProspections,
  materialiserProspectionValidee,
  updateProspectionStationNom,
  saveProspectionPopulation,
  saveProspectionInfestation,
  saveProspectionCaptures,
  saveOperationsAeriennes,
  getProspection,
  DraftProspection,
  TypeProspection,
  PopulationRow,
  InfestationRow,
  CaptureRow,
  OperationAerienneRow,
} from './prospection-repository';
import { validateProspectionDate } from './prospection-validation';
import { PreconditionError, ReferentialError } from './errors';
import { logger } from './logger';
import { useAuthStore } from './auth-store';

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
 * « Prospections à revalider » (#revalidation-prospection) — les fiches
 * validées depuis plus de 5 jours (extensive/validation uniquement) sans
 * traitement associé : exactement celles qu'exclut
 * `loadFichesDisponiblesPourTraitement` pour cette raison. Même
 * raisonnement multi-utilisateurs que « Consulter une fiche validée » —
 * toujours un appel serveur direct, jamais le cache local seul (repli hors
 * ligne : `listProspectionsARevaliderLocal`, prospection-repository.ts).
 */
export async function loadFichesARevalider(token: string): Promise<ProspectionRead[]> {
  return apiClient.listProspections(token, {
    statut: STATUT_VALIDE,
    a_revalider: true,
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
 * ailleurs (brouillon de traitement déjà démarré dessus, par ex.) — sauf pour
 * combler un `station_nom` resté vide (#localite-traitement-poste-acridien-
 * autre-agent : peut arriver si cette fiche avait été matérialisée avant que
 * le référentiel `station_fixe` ait fini de se synchroniser sur cet appareil),
 * seule colonne jamais réécrite ici sur une fiche déjà locale.
 */
export async function assurerProspectionDisponibleLocalement(fiche: ProspectionRead): Promise<void> {
  const dejaLocale = await getProspection(fiche.id);
  if (dejaLocale) {
    if (!dejaLocale.station_nom && fiche.station_id) {
      const stationNom = (await getStationById(fiche.station_id))?.nom ?? null;
      if (stationNom) await updateProspectionStationNom(fiche.id, stationNom);
    }
    return;
  }

  // #localite-traitement-poste-acridien-autre-agent : `ProspectionRead` (réponse
  // serveur) n'expose pas le nom de la station (contrairement à `prospecteur_nom`,
  // résolu côté backend) — sans lui, une fiche de traitement Terrestre créée
  // depuis cette prospection Intensive par un AUTRE agent ne pouvait jamais
  // pré-remplir « Localité » (references.tsx ne lit que `station_nom`/
  // `station_libre`). Résolu ici depuis le référentiel local déjà synchronisé
  // (`station_fixe`, partagé entre tous les agents) — `null` si absent
  // (extensif, sans station) ou si le référentiel n'a encore jamais été
  // synchronisé sur cet appareil, même repli que l'absence actuelle.
  const stationNom = fiche.station_id ? ((await getStationById(fiche.station_id))?.nom ?? null) : null;

  await materialiserProspectionValidee({
    id: fiche.id,
    typeProspection: fiche.type_prospection,
    campagneId: fiche.campagne_id,
    prospecteurId: fiche.prospecteur_id,
    prospecteurNom: fiche.prospecteur_nom ?? null,
    stationId: fiche.station_id ?? null,
    stationNom,
    dateProspection: fiche.date_prospection,
    latitude: fiche.latitude ?? null,
    longitude: fiche.longitude ?? null,
    altitude: fiche.altitude ?? null,
    biotope: fiche.biotope ?? [],
    surfaceStation: fiche.surface_station ?? null,
    surfaceProspectee: fiche.surface_prospectee ?? null,
    surfaceInfestee: fiche.surface_infestee ?? null,
    degatsCultures: fiche.degats_cultures ?? null,
    dernierePluie: fiche.derniere_pluie ?? null,
    intensitePluie: fiche.intensite_pluie ?? null,
    vegetation: fiche.vegetation ?? null,
    sol: fiche.sol ?? null,
    ennemisNaturels: fiche.ennemis_naturels ?? null,
    observations: fiche.observations ?? null,
    nFiche: fiche.n_fiche ?? null,
    nMessage: fiche.n_message ?? null,
    statut: fiche.statut,
    validatedAt: fiche.validated_at ?? null,
    revalideDeId: fiche.revalide_de_id ?? null,
    region: fiche.region ?? null,
    district: fiche.district ?? null,
    commune: fiche.commune ?? null,
    za: fiche.za ?? null,
    paCode: fiche.pa_code ?? null,
    degatsCulturesPourcent: fiche.degats_cultures_pourcent ?? null,
    verdissementPourcent: fiche.verdissement_pourcent ?? null,
    hauteurHerbeCm: fiche.hauteur_herbe_cm ?? null,
    heureObservationAt: fiche.heure_observation_at ?? null,
    stationLibre: fiche.station_libre ?? null,
    typeStation: fiche.type_station ?? [],
    verdureStrate: fiche.verdure_strate ?? null,
    signalementSource: fiche.signalement_source ?? null,
    signalementDate: fiche.signalement_date ?? null,
    signalementDescription: fiche.signalement_description ?? null,
    conclusionValidation: fiche.conclusion_validation ?? null,
    avertissements: fiche.avertissements ?? [],
    modeExtensif: fiche.mode_extensif ?? null,
    societe: fiche.societe ?? null,
    immatriculeAeronef: fiche.immatricule_aeronef ?? null,
    pilote: fiche.pilote ?? null,
    mecanicien: fiche.mecanicien ?? null,
    chefDeBase: fiche.chef_de_base ?? null,
    base: fiche.base ?? null,
    baseNumero: fiche.base_numero ?? null,
    baseDateInstallation: fiche.base_date_installation ?? null,
    baseLatitude: fiche.base_latitude ?? null,
    baseLongitude: fiche.base_longitude ?? null,
    baseSecondaire: fiche.base_secondaire ?? null,
    baseSecondaireDateInstallation: fiche.base_secondaire_date_installation ?? null,
    baseSecondaireLatitude: fiche.base_secondaire_latitude ?? null,
    baseSecondaireLongitude: fiche.base_secondaire_longitude ?? null,
    pesticidesEmbarques: fiche.pesticides_embarques ?? null,
    pesticideNomCommercial: fiche.pesticide_nom_commercial ?? null,
    pesticideQuantiteDisponible: fiche.pesticide_quantite_disponible ?? null,
    pesticideQuantiteRecue: fiche.pesticide_quantite_recue ?? null,
    futsDisponible: fiche.futs_disponible ?? null,
    futsPleins: fiche.futs_pleins ?? null,
    futsVides: fiche.futs_vides ?? null,
    futsRecues: fiche.futs_recues ?? null,
    signatureVisaNom: fiche.signature_visa_nom ?? null,
    signatureVisaHorodatage: fiche.signature_visa_horodatage ?? null,
    signatureConsultantFaoNom: fiche.signature_consultant_fao_nom ?? null,
    signatureConsultantFaoHorodatage: fiche.signature_consultant_fao_horodatage ?? null,
    signatureConsultantFaoImage: fiche.signature_consultant_fao_image ?? null,
    signaturePiloteNom: fiche.signature_pilote_nom ?? null,
    signaturePiloteHorodatage: fiche.signature_pilote_horodatage ?? null,
    signaturePiloteImage: fiche.signature_pilote_image ?? null,
    signatureChefBaseNom: fiche.signature_chef_base_nom ?? null,
    signatureChefBaseHorodatage: fiche.signature_chef_base_horodatage ?? null,
    signatureChefBaseImage: fiche.signature_chef_base_image ?? null,
    createdAt: fiche.created_at,
    updatedAt: fiche.updated_at,
  });

  for (const population of fiche.populations ?? []) {
    await saveProspectionPopulation(fiche.id, population as unknown as PopulationRow);
  }
  for (const infestation of fiche.infestations ?? []) {
    await saveProspectionInfestation(fiche.id, infestation.type_cible, infestation as unknown as InfestationRow);
  }
  // Jusqu'ici absents de cette matérialisation (#revalidation-prospection) :
  // sans eux, une fiche intensive/aérienne créée sur un AUTRE appareil se
  // matérialiserait sans ses captures ni ses opérations aériennes.
  const capturesParGroupe = new Map<string, CaptureRow[]>();
  for (const capture of (fiche.captures ?? []) as unknown as CaptureRow[]) {
    const cle = `${capture.espece}::${capture.categorie}`;
    const groupe = capturesParGroupe.get(cle) ?? [];
    groupe.push(capture);
    capturesParGroupe.set(cle, groupe);
  }
  for (const [cle, rows] of capturesParGroupe) {
    const [espece, categorie] = cle.split('::');
    await saveProspectionCaptures(fiche.id, espece, categorie, rows);
  }
  if ((fiche.operations_aeriennes ?? []).length > 0) {
    await saveOperationsAeriennes(fiche.id, fiche.operations_aeriennes as unknown as OperationAerienneRow[]);
  }
}

/**
 * Matérialise en local TOUTES les fiches d'une liste « disponible pour
 * traitement » (#fiches-disponibles-hors-ligne), pas seulement celle
 * finalement choisie par l'agent : sans ça, une fiche validée par un AUTRE
 * agent, seulement VUE en ligne dans « Consulter une fiche validée »
 * (prospection-picker.tsx) sans être sélectionnée, redevenait invisible dès
 * le passage hors ligne — `assurerProspectionDisponibleLocalement` n'étant
 * jusque-là appelée qu'au moment du choix (`choisir()`).
 *
 * Best-effort, fiche par fiche : un échec isolé (ex. fiche corrompue côté
 * serveur) ne doit jamais empêcher les autres d'être mises en cache, ni
 * bloquer l'affichage de la liste elle-même.
 */
export async function materialiserFichesDisponibles(fiches: ProspectionRead[]): Promise<void> {
  for (const fiche of fiches) {
    try {
      await assurerProspectionDisponibleLocalement(fiche);
    } catch (error) {
      log.ignore(
        error,
        `Mise en cache hors ligne de la fiche ${fiche.id} échouée — fiche ignorée, les autres continuent`
      );
    }
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

  // #fiches-disponibles-hors-ligne : le nom de l'agent connecté (déjà en
  // mémoire, jamais un appel réseau) est figé ici pour que « Créé par … »
  // s'affiche aussi hors ligne pour SA PROPRE fiche, une fois celle-ci
  // apparue dans « Consulter une fiche validée » sur un AUTRE appareil —
  // même convention "Prénom Nom" que `_resoudre_noms` côté serveur.
  const agentConnecte = useAuthStore.getState().user;
  const prospecteurNom = agentConnecte ? `${agentConnecte.prenom} ${agentConnecte.nom}` : null;

  const draft = await createDraftProspection({
    id: generateId(),
    typeProspection: params.typeProspection ?? 'intensive',
    campagneId: selectedCampagneId,
    prospecteurId: params.prospecteurId,
    prospecteurNom,
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
