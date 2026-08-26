/**
 * Seuils de précision GPS, partagés entre l'acquisition (`location.ts`) et la
 * validation métier (`prospection-validation.ts`) — une seule source pour éviter
 * qu'un seuil d'acquisition dérive de son seuil de rejet.
 *
 * Les valeurs se lisent en mètres de rayon (le `accuracy` d'expo-location, ~68 %
 * de confiance). Elles supposent une acquisition en fix GNSS : le mode par défaut
 * d'expo-location (`Accuracy.Balanced`) se contente d'une triangulation réseau et
 * rend 300–500 m en brousse, ce qui ne dit rien de la capacité réelle de l'appareil.
 */

/**
 * Précision visée avant d'arrêter la convergence : atteignable en quelques
 * secondes en extérieur dégagé, c'est-à-dire la situation normale d'une prospection.
 * Sert aussi de seuil d'avertissement à la validation.
 */
export const PRECISION_GPS_CIBLE_M = 15;

/**
 * Au-delà, le point ne localise plus la tache observée de façon exploitable :
 * une tache larvaire se compte en dizaines de mètres.
 */
export const PRECISION_GPS_SEUIL_BLOQUANT_M = 50;

/** Délai maximal laissé au GPS pour converger avant de retenir le meilleur fix obtenu. */
export const PRECISION_GPS_TIMEOUT_MS = 20_000;
