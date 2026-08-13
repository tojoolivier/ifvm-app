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

/** Précision GPS au-delà de laquelle la position est jugée inexploitable sur le terrain. */
const GPS_ACCURACY_SEUIL_BLOQUANT_M = 50;

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

  if (input.accuracy != null && input.accuracy > GPS_ACCURACY_SEUIL_BLOQUANT_M) {
    blocages.push(
      `Précision GPS insuffisante (${Math.round(input.accuracy)} m, seuil ${GPS_ACCURACY_SEUIL_BLOQUANT_M} m). Veuillez recapturer la position.`
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
const TYPES_DIRECTION_OBLIGATOIRE = ['bande_larvaire', 'vol_clair', 'essaim'];

export function validateComportementDirection(input: ComportementDirectionValidationInput): ValidationResult {
  const blocages: string[] = [];
  const avertissements: string[] = [];

  if (TYPES_DIRECTION_OBLIGATOIRE.includes(input.typeCible) && !input.directionRenseignee) {
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
