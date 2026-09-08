import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { apiClient } from '@/lib/api-client';
import { components } from '@/lib/api-schema.generated';
import { runTask } from '@/lib/run-task';

export type Notification = components['schemas']['NotificationRead'];

/**
 * Centre de notifications in-app (mobile) — pas de push natif (choix produit,
 * pas d'infra `expo-notifications`/tokens à ce stade) : un GET au montage et
 * à chaque retour au premier plan, même déclencheur que `useOtaAutoCheck` /
 * `useReferentielAutoSync`, l'app n'ayant pas d'événement serveur propre.
 *
 * Derrière `runTask:best-effort` : une notification ratée n'est pas assez
 * grave pour bloquer l'agent, mais ne doit pas non plus disparaître sans
 * trace (cf. ADR-012).
 */
export function useNotifications(token: string | null) {
  const [items, setItems] = useState<Notification[]>([]);
  const [nonLues, setNonLues] = useState(0);
  const [chargement, setChargement] = useState(false);

  const rafraichir = useCallback(async () => {
    if (!token) return;
    setChargement(true);
    const outcome = await runTask(() => apiClient.getNotifications(token), {
      name: 'notifications.charger',
      criticality: 'best-effort',
    });
    setChargement(false);
    if (outcome.ok) {
      setItems(outcome.value.items);
      setNonLues(outcome.value.non_lues);
    }
  }, [token]);

  const marquerVues = useCallback(async () => {
    if (!token) return;
    await runTask(() => apiClient.marquerNotificationsVues(token), {
      name: 'notifications.marquer-vues',
      criticality: 'best-effort',
    });
    setNonLues(0);
    setItems((current) => current.map((n) => ({ ...n, lu: true })));
  }, [token]);

  useEffect(() => {
    // Différé hors du tick synchrone de l'effet (react-hooks/set-state-in-effect,
    // même motif que OtaSection) : `rafraichir` fait des `setState`, en appeler
    // un directement dans le corps de l'effet reste proscrit même via `void`.
    const id = setTimeout(() => void rafraichir(), 0);
    const subscription = AppState.addEventListener('change', (etat) => {
      if (etat === 'active') void rafraichir();
    });
    return () => {
      clearTimeout(id);
      subscription.remove();
    };
  }, [rafraichir]);

  return { items, nonLues, chargement, rafraichir, marquerVues };
}
