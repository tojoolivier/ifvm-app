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
