import { useCallback, useEffect, useState } from 'react';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import { aujourdhuiIso, chargerResumeEquipe, ResumeEquipe } from '@/lib/equipe-db';
import type { EquipeLocale } from '@/lib/referentiel-db';

/**
 * Site, aéronef ou dernière intervention de l'équipe donnée (#641), lus dans le référentiel local.
 * `null` tant que rien n'est chargé ou sans équipe. `recharger` relit — retour sur l'écran, synchro.
 */
export function useResumeEquipe(equipe: EquipeLocale | null): {
  resume: ResumeEquipe | null;
  recharger: () => void;
} {
  const [resume, setResume] = useState<ResumeEquipe | null>(null);
  const signalerChargement = useSignalerChargement('resume-equipe');
  const equipeId = equipe?.id ?? null;
  const type = equipe?.type ?? null;

  const charger = useCallback(() => {
    if (!equipeId || !type) return Promise.resolve(null);
    return chargerResumeEquipe({ id: equipeId, type }, aujourdhuiIso());
  }, [equipeId, type]);

  useEffect(() => {
    let annule = false;
    charger()
      .then((r) => {
        if (!annule) setResume(r);
      })
      .catch((error) => signalerChargement(error, { equipeId }));
    return () => {
      annule = true;
    };
  }, [charger, equipeId, signalerChargement]);

  const recharger = useCallback(() => {
    charger()
      .then((r) => setResume((prev) => (JSON.stringify(prev) === JSON.stringify(r) ? prev : r)))
      .catch((error) => signalerChargement(error, { equipeId }));
  }, [charger, equipeId, signalerChargement]);

  return { resume, recharger };
}
