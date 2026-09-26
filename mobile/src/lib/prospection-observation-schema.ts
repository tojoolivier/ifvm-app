import { boolean, mixed, object } from 'yup';
import type { FiltreObservation } from '@/lib/prospection-observation';

/** Schéma du filtre : « Aucun criquet » ou au moins une grille cochée. */
export function creerObservationSchema(t: (cle: string) => string) {
  return object({
    aucunCriquet: boolean().required().default(false),
    grilles: mixed<FiltreObservation['grilles']>()
      .default({})
      .test('choix', t('prospection.observation.erreurs.choix'), function (grilles) {
        return this.parent.aucunCriquet || Object.keys(grilles ?? {}).length > 0;
      })
      .test('phases', t('prospection.observation.erreurs.phases'), (grilles) =>
        Object.values(grilles ?? {}).every((g) => g.phases.length > 0)
      )
      .test('stades', t('prospection.observation.erreurs.stades'), (grilles) =>
        Object.values(grilles ?? {}).every((g) => Object.values(g.stades).some((liste) => liste.length > 0))
      ),
  });
}
