import { useEffect, useState } from 'react';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import { type AeronefEquipe, listAeronefsEquipe } from '@/lib/equipe-db';

/**
 * Aéronefs de l'équipe de travail affectés le jour du vol (#644, #642) — l'affectation doit couvrir
 * cette date, comme le serveur. Le premier est retenu d'office ; `choisir` en désigne un autre quand
 * l'équipe en a plusieurs.
 */
export function useAeronefDuJour(equipeId: string | null, date: string, source: string) {
  const signalerChargement = useSignalerChargement(source);
  const [aeronefs, setAeronefs] = useState<AeronefEquipe[]>([]);
  const [choisiId, setChoisiId] = useState<string | null>(null);

  useEffect(() => {
    if (!equipeId) return;
    listAeronefsEquipe(equipeId, date)
      .then(setAeronefs)
      .catch((error) => signalerChargement(error, { source }));
  }, [equipeId, date, source, signalerChargement]);

  const aeronef = aeronefs.find((a) => a.id === choisiId) ?? aeronefs[0] ?? null;
  return { aeronef, aeronefs, choisir: setChoisiId };
}
