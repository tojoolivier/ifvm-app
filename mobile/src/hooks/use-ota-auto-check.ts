import { useEffect } from 'react';
import { AppState } from 'react-native';

import { doitVerifierAuto, lireDernierCheck, otaActif, verifierMaintenant } from '@/lib/ota';
import { logger } from '@/lib/logger';

/** Un check auto au plus toutes les 6 h ; le bouton du profil force au-delà. */
export const INTERVALLE_CHECK_AUTO_MS = 6 * 60 * 60 * 1000;

/**
 * Vérifie les mises à jour OTA si le dernier check est assez ancien.
 *
 * Extrait du hook pour être testable sans moteur de rendu — même motif que
 * `checkAndSyncReferentiel`. Ne rejette jamais : `verifierMaintenant` est
 * derrière `runTask`, et la lecture du dernier check est best-effort (au pire
 * on revérifie une fois de trop).
 */
export async function verifierOtaSiNecessaire(maintenant: Date = new Date()): Promise<void> {
  if (!otaActif()) return;

  const dernier = await lireDernierCheck().catch((error) => {
    logger.ignore(error, 'lecture du dernier check OTA impossible avant le check auto');
    return null;
  });
  if (!doitVerifierAuto(dernier, maintenant, INTERVALLE_CHECK_AUTO_MS)) return;

  await verifierMaintenant();
}

/**
 * Câble le check auto : au montage (lancement de l'app) et à chaque retour au
 * premier plan — même déclencheur que `useReferentielAutoSync`, l'app n'ayant
 * pas d'événement « reconnexion réseau » propre.
 *
 * `pret` est passé à `false` tant que `demarrerApp` n'a pas ouvert le stockage :
 * sinon le premier check partirait avant que `lireDernierCheck` puisse lire son
 * horodatage, et se rejouerait à chaque démarrage à froid.
 */
export function useOtaAutoCheck(pret: boolean): void {
  useEffect(() => {
    if (!pret) return;

    void verifierOtaSiNecessaire();

    const subscription = AppState.addEventListener('change', (etat) => {
      if (etat === 'active') {
        void verifierOtaSiNecessaire();
      }
    });

    return () => subscription.remove();
  }, [pret]);
}
