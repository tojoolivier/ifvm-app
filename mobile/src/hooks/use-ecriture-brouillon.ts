import { useCallback, useRef } from 'react';
import { useEquipeTravailStore } from '@/lib/equipe-travail-store';
import { enregistrerBrouillon, type SaisieProspection } from '@/lib/prospection-db';
import { listCampagnesLocal } from '@/lib/referentiel-db';

export type ResultatEcriture = { id: string } | { erreur: 'campagneIntrouvable' | 'equipeIntrouvable' };

/**
 * Écriture du brouillon de l'étape Référence. Les écritures s'enchaînent une à une (la capture GPS et
 * « Continuer » ne se marchent pas dessus) et seule la première crée la fiche.
 *
 * `existant` : le brouillon existe déjà (reprise) — aucune création.
 * La campagne est la première campagne active du référentiel local ; l'équipe, celle de travail.
 */
export function useEcritureBrouillon(existant: boolean) {
  const equipeId = useEquipeTravailStore((s) => s.equipeId);
  const dejaCree = useRef(existant);
  const file = useRef<Promise<unknown>>(Promise.resolve());

  return useCallback(
    (construire: (ids: { campagneId: string; equipeId: string }) => SaisieProspection): Promise<ResultatEcriture> => {
      const faire = async (): Promise<ResultatEcriture> => {
        const campagne = (await listCampagnesLocal())[0];
        if (!campagne) return { erreur: 'campagneIntrouvable' };
        if (!equipeId) return { erreur: 'equipeIntrouvable' };
        const id = await enregistrerBrouillon(
          construire({ campagneId: campagne.id, equipeId }),
          dejaCree.current ? {} : { creation: true }
        );
        dejaCree.current = true;
        return { id };
      };
      const suite = file.current.then(faire);
      file.current = suite.catch(() => undefined);
      return suite;
    },
    [equipeId]
  );
}
