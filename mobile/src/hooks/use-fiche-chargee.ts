import { useEffect, useState } from 'react';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';

/**
 * Charge une fiche du cache local. Rend `undefined` tant qu'elle se charge, `null` si elle n'est plus
 * dans le cache (supprimée par une synchronisation), sinon la fiche. Commun aux quatre écrans de
 * fiche du référentiel, qui répétaient le même effet de lecture et le même signalement d'erreur.
 *
 * `charger` doit avoir une identité stable (fonction de module, ou `useCallback`) : c'est une
 * dépendance de l'effet.
 */
export function useFicheChargee<T>(source: string, cle: string, charger: (cle: string) => Promise<T | null>): T | null | undefined {
  const signalerChargement = useSignalerChargement(source);
  const [fiche, setFiche] = useState<T | null | undefined>(undefined);

  useEffect(() => {
    charger(cle)
      .then(setFiche)
      .catch((error) => signalerChargement(error, { source, cle }));
  }, [charger, cle, source, signalerChargement]);

  return fiche;
}
