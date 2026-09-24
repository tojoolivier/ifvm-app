import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { useEquipeTravailStore } from '@/lib/equipe-travail-store';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import { EquipeLocale, listEquipesDeUtilisateur, listToutesEquipes } from '@/lib/referentiel-db';

/**
 * Équipes de l'agent connecté et équipe de travail courante (#641), lues dans le référentiel local
 * — utilisable hors-ligne. Choisit toute seule l'unique équipe d'un agent qui n'en a qu'une, et
 * oublie une équipe dont l'agent n'est plus membre (un administrateur, lui, voit toutes les équipes) : sans quoi les nouvelles saisies resteraient
 * rattachées à une équipe que l'écran ne montre plus.
 */
export function useEquipesDeTravail() {
  const userId = useAuthStore((s) => s.user?.id);
  const estAdmin = useAuthStore((s) => s.user?.role) === 'admin';
  const equipeId = useEquipeTravailStore((s) => s.equipeId);
  const isInitialized = useEquipeTravailStore((s) => s.isInitialized);
  const setEquipe = useEquipeTravailStore((s) => s.setEquipe);
  const [equipes, setEquipes] = useState<EquipeLocale[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const signalerChargement = useSignalerChargement('equipes-de-travail');

  // Mêmes lignes → même référence : pas de nouveau rendu inutile (un `useFocusEffect` qui
  // recharge à chaque retour sur l'écran ne doit pas se mordre la queue).
  const appliquer = useCallback((lignes: EquipeLocale[]) => {
    setEquipes((prev) => (JSON.stringify(prev) === JSON.stringify(lignes) ? prev : lignes));
    setIsLoaded(true);
  }, []);

  const lireEquipes = useCallback(
    () => (estAdmin ? listToutesEquipes() : listEquipesDeUtilisateur(userId as string)),
    [estAdmin, userId]
  );

  /** Relit le référentiel local — ex. au retour sur l'écran, après une synchro. */
  const recharger = useCallback(() => {
    if (!userId) return;
    lireEquipes()
      .then(appliquer)
      .catch((error) => signalerChargement(error, { source: 'listEquipesDeUtilisateur' }));
  }, [userId, lireEquipes, appliquer, signalerChargement]);

  useEffect(() => {
    if (!userId) return;
    let annule = false;
    lireEquipes()
      .then((lignes) => {
        if (!annule) appliquer(lignes);
      })
      .catch((error) => signalerChargement(error, { source: 'listEquipesDeUtilisateur' }));
    return () => {
      annule = true;
    };
  }, [userId, lireEquipes, appliquer, signalerChargement]);

  useEffect(() => {
    if (!userId || !isLoaded || !isInitialized) return;
    const connue = equipeId !== null && equipes.some((e) => e.id === equipeId);
    if (connue) return;
    if (equipes.length === 1) void setEquipe(userId, equipes[0].id);
    else if (equipeId !== null) void setEquipe(userId, null);
  }, [userId, isLoaded, isInitialized, equipes, equipeId, setEquipe]);

  const choisir = useCallback(
    async (id: string) => {
      if (userId) await setEquipe(userId, id);
    },
    [userId, setEquipe]
  );

  const courante = equipes.find((e) => e.id === equipeId) ?? null;

  return { equipes, courante, choisir, recharger, isLoaded };
}
