/**
 * Module de validation applicative centralisé pour la fiche de prospection
 * intensive (voir #96/#101). Fonctions pures : état de formulaire en entrée,
 * `{ blocages, avertissements }` en sortie — aucune dépendance au rendu React
 * Native, pour rester testable indépendamment des écrans qui l'appellent.
 *
 * `blocages` empêche l'enregistrement (garde-fou §2.1 du manuel de terrain).
 * `avertissements` n'empêche pas l'enregistrement mais doit marquer la fiche
 * « à vérifier » côté appelant (§2.2 — nécessite un champ de statut dédié,
 * pas encore présent dans le schéma : à traiter avec #106).
 */

import { PRECISION_GPS_CIBLE_M, PRECISION_GPS_SEUIL_BLOQUANT_M } from './gps-precision';

export interface ValidationResult {
  blocages: string[];
  avertissements: string[];
}

export interface InfestationValidationInput {
  densMin: number | null;
  densMax: number | null;
  ventVitesse: number | null;
}

export interface GpsPositionValidationInput {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

/**
 * Emprise géographique de Madagascar (bounding box large, §2.1 point du manuel).
 * Volontairement généreuse pour ne pas rejeter une position valide proche des côtes.
 */
const MADAGASCAR_BBOX = {
  latMin: -25.7,
  latMax: -11.8,
  lonMin: 43.1,
  lonMax: 50.5,
};

export interface ProspectionDateValidationInput {
  dateProspection: string;
  campagneStartDate: string;
}

/** Rejette une fiche dont la date est antérieure au début de la mission (§2.1 point 3 du manuel). */
export function validateProspectionDate(input: ProspectionDateValidationInput): ValidationResult {
  const blocages: string[] = [];
  const avertissements: string[] = [];

  if (input.dateProspection < input.campagneStartDate) {
    blocages.push(
      `Date de prospection (${input.dateProspection}) antérieure au début de la mission (${input.campagneStartDate}).`
    );
  }

  return { blocages, avertissements };
}

export function validateGpsPosition(input: GpsPositionValidationInput): ValidationResult {
  const blocages: string[] = [];
  const avertissements: string[] = [];

  const horsMadagascar =
    input.latitude < MADAGASCAR_BBOX.latMin ||
    input.latitude > MADAGASCAR_BBOX.latMax ||
    input.longitude < MADAGASCAR_BBOX.lonMin ||
    input.longitude > MADAGASCAR_BBOX.lonMax;

  if (horsMadagascar) {
    blocages.push(
      'Position GPS hors de Madagascar. Veuillez recapturer la position.'
    );
  }

  // Seuils partagés avec l'acquisition (`gps-precision.ts`) : ils supposent un fix
  // GNSS, pas la triangulation réseau qui rendait 300–500 m et justifiait l'ancien
  // seuil de 100 m — celui-ci tolérait un point inexploitable pour situer une tache.
  if (input.accuracy != null && input.accuracy > PRECISION_GPS_SEUIL_BLOQUANT_M) {
    blocages.push(
      `Précision GPS insuffisante (${Math.round(input.accuracy)} m, seuil ${PRECISION_GPS_SEUIL_BLOQUANT_M} m). Veuillez recapturer la position.`
    );
  } else if (input.accuracy != null && input.accuracy > PRECISION_GPS_CIBLE_M) {
    avertissements.push(
      `Précision GPS moyenne (${Math.round(input.accuracy)} m). Attendez quelques secondes à découvert pour descendre sous ${PRECISION_GPS_CIBLE_M} m.`
    );
  }

  return { blocages, avertissements };
}

/** Vitesse de vent extrême mais physiquement plausible (rafale de tempête) — avertissement. */
const VENT_VITESSE_SEUIL_AVERTISSEMENT_KMH = 80;
/** Au-delà, la valeur est jugée invalide pour une observation de terrain — bloquant. */
const VENT_VITESSE_SEUIL_BLOQUANT_KMH = 250;

export function validateInfestationFormation(input: InfestationValidationInput): ValidationResult {
  const blocages: string[] = [];
  const avertissements: string[] = [];

  if (input.densMin != null && input.densMax != null && input.densMin >= input.densMax) {
    blocages.push(
      `Densité minimale (${input.densMin}) doit être inférieure à la densité maximale (${input.densMax}).`
    );
  }

  if (input.ventVitesse != null) {
    if (input.ventVitesse < 0) {
      blocages.push('Vitesse du vent invalide : une valeur négative n’est pas possible.');
    } else if (input.ventVitesse > VENT_VITESSE_SEUIL_BLOQUANT_KMH) {
      blocages.push(
        `Vitesse du vent (${input.ventVitesse} km/h) dépasse le seuil physiquement plausible (${VENT_VITESSE_SEUIL_BLOQUANT_KMH} km/h).`
      );
    } else if (input.ventVitesse > VENT_VITESSE_SEUIL_AVERTISSEMENT_KMH) {
      avertissements.push(
        `Vitesse du vent (${input.ventVitesse} km/h) extrême, à vérifier avant envoi.`
      );
    }
  }

  return { blocages, avertissements };
}

export interface ComportementDirectionValidationInput {
  typeCible: string;
  comportement: 'repos' | 'deplacement' | null;
  directionRenseignee: boolean;
}

/**
 * Types de cible pour lesquels le déplacement commun est définitoire (§2.2
 * point 15 du manuel) : la direction devient obligatoire. Absente/non requise
 * pour une tache larvaire isolée.
 */
const TYPES_DIRECTION_OBLIGATOIRE = ['bande_larvaire', 'vol_clair', 'dense', 'tres_dense'];

export function validateComportementDirection(input: ComportementDirectionValidationInput): ValidationResult {
  const blocages: string[] = [];
  const avertissements: string[] = [];

  // La direction n'a de sens qu'en Déplacement — l'écran la masque (et l'efface) tant
  // que l'État n'est pas "Déplacement" (règle #4) : l'exiger aussi pour "Repos" rendrait
  // la fiche impossible à enregistrer via l'interface qui, elle, cache le seul moyen de
  // la renseigner.
  if (
    TYPES_DIRECTION_OBLIGATOIRE.includes(input.typeCible) &&
    input.comportement !== 'repos' &&
    !input.directionRenseignee
  ) {
    blocages.push(
      'Direction de déplacement obligatoire pour ce type de cible (bande, vol clair ou essaim).'
    );
  }

  if (input.comportement === 'repos' && input.directionRenseignee) {
    avertissements.push(
      'Population déclarée au repos alors qu’une direction de déplacement est renseignée — à vérifier.'
    );
  }

  return { blocages, avertissements };
}

export interface GroupementLarvaireValidationInput {
  typeCible: string;
  nbTachesBandes: number | null;
  interdistanceMoy: number | null;
}

/** Types de cible larvaire groupée (§1.1 du manuel) — la distance intergroupes devient obligatoire. */
const TYPES_GROUPEMENT_LARVAIRE = ['tache_larvaire', 'bande_larvaire'];

/**
 * Nombre de taches par bande (≥1) et distance moyenne intergroupes (>0), §2.1
 * points 45-46 du manuel. Le nombre de taches n'a de sens que pour une bande ;
 * la distance intergroupes est exigée dès que la population est groupée
 * (tache ou bande).
 */
export function validateGroupementLarvaire(input: GroupementLarvaireValidationInput): ValidationResult {
  const blocages: string[] = [];
  const avertissements: string[] = [];

  if (input.typeCible === 'bande_larvaire' && (input.nbTachesBandes == null || input.nbTachesBandes < 1)) {
    blocages.push('Nombre de taches par bande obligatoire (au moins 1) pour une bande larvaire.');
  }

  if (
    TYPES_GROUPEMENT_LARVAIRE.includes(input.typeCible) &&
    (input.interdistanceMoy == null || input.interdistanceMoy <= 0)
  ) {
    blocages.push('Distance moyenne intergroupes obligatoire (supérieure à 0) pour une population groupée.');
  }

  return { blocages, avertissements };
}

export type LarvalPopulationType = 'tache_larvaire' | 'bande_larvaire';

export interface LarvalPopulationClassificationInput {
  /** Taille du groupe larvaire en m². */
  tailleGroupeM2: number | null;
  /** Direction de déplacement commune renseignée (oui/non). */
  directionRenseignee: boolean;
  /** Nombre de taches par bande, quand connu. */
  nbTaches: number | null;
}

/** Seuil de taille (§3.1 du manuel) au-delà duquel une population groupée devient une bande. */
export const TAILLE_GROUPE_SEUIL_BANDE_M2 = 1000;

/**
 * Classification automatique tache vs bande larvaire (§3.1 du manuel de
 * terrain, #103) : bande si une direction de déplacement commune est
 * renseignée ET (taille ≥ 1000 m² OU au moins 2 taches) ; tache sinon.
 * Fonction pure en lecture seule — la classe n'est jamais saisissable
 * directement (garde-fou §2.1 point 11 / #103 AC).
 */
export function classifyLarvalPopulation(
  input: LarvalPopulationClassificationInput
): LarvalPopulationType {
  const estBande =
    input.directionRenseignee &&
    ((input.tailleGroupeM2 ?? 0) >= TAILLE_GROUPE_SEUIL_BANDE_M2 || (input.nbTaches ?? 0) >= 2);

  return estBande ? 'bande_larvaire' : 'tache_larvaire';
}

export interface EssaimNocturneValidationInput {
  typeCible: string;
  heureObservation: string;
}

const TYPES_AILES_GROUPES = ['vol_clair', 'dense', 'tres_dense'];

/** Bornes horaires (heure locale) au-delà/en-deçà desquelles une observation est jugée nocturne. */
const NUIT_HEURE_DEBUT = 18;
const NUIT_HEURE_FIN = 6;

/** Heure au format "hh:mm" jugée nocturne (§2.2 point 14 du manuel). */
export function isHeureNocturne(heureObservation: string): boolean {
  const match = /^(\d{1,2}):(\d{2})$/.exec(heureObservation.trim());
  if (!match) {
    return false;
  }
  const heure = Number(match[1]);
  return heure >= NUIT_HEURE_DEBUT || heure < NUIT_HEURE_FIN;
}

/**
 * Plausibilité horaire des essaims/vols clairs (§2.2 point 14 du manuel) :
 * une formation ailée groupée signalée de nuit est implausible en vol — les
 * essaims ne se déplacent pas de nuit. Avertissement non bloquant ; le
 * comportement forcé sur « posé » est appliqué par l'appelant (écran).
 */
export function validateEssaimNocturne(input: EssaimNocturneValidationInput): ValidationResult {
  const blocages: string[] = [];
  const avertissements: string[] = [];

  if (TYPES_AILES_GROUPES.includes(input.typeCible) && isHeureNocturne(input.heureObservation)) {
    avertissements.push(
      'Essaim/vol clair signalé de nuit : comportement forcé sur « posé » (les essaims ne se déplacent pas de nuit).'
    );
  }

  return { blocages, avertissements };
}

// Doit rester aligné sur l'enum backend `TypeEssaim` (vol_clair/dense/tres_dense —
// prospection_schemas.py) : c'est la valeur persistée dans `type_essaim`. `null`
// signifie « non classable » (ex. vol provoqué) et n'est jamais envoyé au backend.
export type AerialPopulationClassification = 'vol_clair' | 'dense' | 'tres_dense';

export interface AerialPopulationClassificationInput {
  /** Q1 — le vol est-il spontané, non provoqué par le prospecteur ? */
  volSpontaneNonProvoque: boolean;
  /** Q2 — la formation n'est visible que de près. */
  visibleSeulementDePres: boolean | null;
  /** Q3 — masse sombre qui ne masque pas le paysage à l'arrière-plan. */
  masseSombreSansMasquerPaysage: boolean | null;
  /** Q4 — dans quelle mesure la formation masque le paysage à l'arrière-plan. */
  masquePaysage: 'partiellement' | 'entierement' | null;
}

/**
 * Classification automatique vol clair / essaim (§3.2 du manuel de terrain,
 * #104) via le questionnaire séquentiel fermé à 4 questions : un vol non
 * spontané (provoqué, ex. par le passage d'un véhicule) n'est pas classable.
 * Sinon, chaque question ferme une branche du questionnaire dès qu'elle
 * répond « oui » ; la classe de densité n'est donc jamais saisissable
 * directement (garde-fou §2.1 point 47 / #104 AC).
 *
 * Le questionnaire distingue 3 profils de densité (masse sombre / masque partiel /
 * masque total) mais le contrat backend `TypeEssaim` n'en accepte que 2 (dense/
 * tres_dense) : "masse sombre" et "masque partiellement" sont regroupés sous
 * "dense", seul "masque entièrement" (le cas le plus dense) donne "tres_dense".
 */
export function classifyAerialPopulation(
  input: AerialPopulationClassificationInput
): AerialPopulationClassification | null {
  if (!input.volSpontaneNonProvoque) {
    return null;
  }

  if (input.visibleSeulementDePres) {
    return 'vol_clair';
  }

  if (input.masseSombreSansMasquerPaysage) {
    return 'dense';
  }

  if (input.masquePaysage === 'partiellement') {
    return 'dense';
  }

  if (input.masquePaysage === 'entierement') {
    return 'tres_dense';
  }

  return null;
}

// Anciens brouillons locaux : `type_essaim` a pu être enregistré avant la bascule sur les
// 3 catégories officielles (vol_clair/dense/tres_dense), avec les 5 valeurs internes
// d'origine de `classifyAerialPopulation`. Même règle de regroupement qu'alors.
const LEGACY_AERIAL_CLASSIFICATION: Record<string, AerialPopulationClassification | null> = {
  non_classe: null,
  essaim_densite_moyenne: 'dense',
  essaim_densite_forte: 'dense',
  essaim_densite_tres_forte: 'tres_dense',
};

/** Normalise une valeur `type_essaim` chargée depuis la base, qu'elle soit déjà au
 * format officiel ou héritée d'un brouillon antérieur à ce format. */
export function normalizeAerialClassification(raw: string | null | undefined): AerialPopulationClassification | null {
  if (!raw) return null;
  if (raw === 'vol_clair' || raw === 'dense' || raw === 'tres_dense') return raw;
  return LEGACY_AERIAL_CLASSIFICATION[raw] ?? null;
}

/** Fenêtre de proximité anti-doublon (#107, §2.2 point 16 du manuel) — valeurs par défaut à confirmer avec le référent métier. */
export const DOUBLON_DISTANCE_SEUIL_M = 200;
export const DOUBLON_DELAI_SEUIL_H = 2;

export interface FicheProspectionProche {
  prospecteurId: string;
  latitude: number;
  longitude: number;
  /** Horodatage de soumission de la fiche (ISO 8601). */
  timestamp: string;
}

export interface AntiDoublonValidationInput {
  prospecteurId: string;
  latitude: number;
  longitude: number;
  /** Horodatage de soumission de la fiche en cours (ISO 8601). */
  timestamp: string;
  /** Fiches déjà soumises à comparer (locales et/ou serveur, toute source disponible offline). */
  fichesProches: FicheProspectionProche[];
}

/** Distance orthodromique (Haversine) en mètres entre deux positions GPS. */
function distanceMetres(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const RAYON_TERRE_M = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return RAYON_TERRE_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Avertissement anti-doublon (#107, §2.2 point 16 du manuel) : une fiche
 * soumise à moins de DOUBLON_DISTANCE_SEUIL_M mètres et
 * DOUBLON_DELAI_SEUIL_H heures d'une fiche déjà soumise par un AUTRE
 * prospecteur est signalée, sans bloquer l'enregistrement. Une fiche du
 * même prospecteur (suivi normal d'un site) est toujours exclue.
 */
export function validateAntiDoublon(input: AntiDoublonValidationInput): ValidationResult {
  const blocages: string[] = [];
  const avertissements: string[] = [];

  const tsCourant = new Date(input.timestamp).getTime();

  const doublon = input.fichesProches.find((fiche) => {
    if (fiche.prospecteurId === input.prospecteurId) {
      return false;
    }
    const ecartHeures = Math.abs(tsCourant - new Date(fiche.timestamp).getTime()) / 3_600_000;
    if (ecartHeures > DOUBLON_DELAI_SEUIL_H) {
      return false;
    }
    const distance = distanceMetres(input.latitude, input.longitude, fiche.latitude, fiche.longitude);
    return distance <= DOUBLON_DISTANCE_SEUIL_M;
  });

  if (doublon) {
    avertissements.push(
      `Doublon possible : une fiche a déjà été soumise par un autre prospecteur à moins de ${DOUBLON_DISTANCE_SEUIL_M} m et ${DOUBLON_DELAI_SEUIL_H} h de cette position.`
    );
  }

  return { blocages, avertissements };
}

/** Seuil d'écart (ratio, dans un sens ou l'autre) déclenchant l'alerte (#106, §2.2 point 15 du manuel) — valeur par défaut à confirmer avec le référent métier. */
export const ECART_HISTORIQUE_SEUIL_RATIO = 2;

export interface EcartHistoriqueValidationInput {
  densiteMoyActuelle: number | null;
  /** Densité moyenne de la dernière observation connue sur le même point de suivi, si elle existe. */
  derniereDensiteMoyConnue: number | null;
}

/**
 * Avertissement "écart important vs dernière observation connue au même
 * site" (#106, §2.2 point 15 du manuel) : quand un point de suivi (station
 * fixe) a déjà une observation antérieure pour ce type de cible, un écart de
 * densité moyenne d'au moins ECART_HISTORIQUE_SEUIL_RATIO fois (à la hausse
 * ou à la baisse) déclenche une alerte "confirmer avant envoi", sans
 * bloquer l'enregistrement. Sans observation antérieure connue, aucune
 * alerte n'est déclenchée.
 */
export function validateEcartHistorique(input: EcartHistoriqueValidationInput): ValidationResult {
  const blocages: string[] = [];
  const avertissements: string[] = [];

  const { densiteMoyActuelle, derniereDensiteMoyConnue } = input;
  if (densiteMoyActuelle != null && derniereDensiteMoyConnue != null && derniereDensiteMoyConnue > 0) {
    const ratio = densiteMoyActuelle / derniereDensiteMoyConnue;
    if (ratio >= ECART_HISTORIQUE_SEUIL_RATIO || ratio <= 1 / ECART_HISTORIQUE_SEUIL_RATIO) {
      avertissements.push(
        `Écart important par rapport à la dernière observation connue sur ce point de suivi (densité moyenne précédente : ${derniereDensiteMoyConnue}). Confirmer avant envoi.`
      );
    }
  }

  return { blocages, avertissements };
}
