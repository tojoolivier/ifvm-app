import { apiClient } from './api-client';
import {
  type FicheLocale,
  appliquerRetourServeur,
  listerEnAttenteEnvoi,
  marquerProspectionEnEchec,
} from './prospection-db';
import { type LotSync, type ResumeSync, syncAll } from './sync-lot';
import { marquerVolSynchronise } from './vol-db';

/**
 * Envoi des fiches de prospection (#722) par l'outbox générique (#676). Création idempotente par
 * l'`id` client : le serveur rend la fiche déjà créée quand on rejoue le même id, donc une réponse
 * perdue puis un renvoi ne doublent rien. `revalide_de_id` et `vol_id` partent dans le corps.
 */
const lotProspection: LotSync<FicheLocale> = {
  nom: 'prospection.creation',
  idDe: (f) => f.fiche.id,
  labelDe: (f) => f.fiche.n_fiche ?? f.fiche.date_prospection,
  marquerEchec: marquerProspectionEnEchec,
  syncOne: async ({ fiche }, token) => {
    const reponse = await apiClient.createProspection(token, fiche);
    await appliquerRetourServeur(fiche.id, reponse);
    // Le vol de la prospection voyage avec elle : il est acquis en même temps.
    if (fiche.vol_id) await marquerVolSynchronise(fiche.vol_id);
  },
};

export async function synchroniserProspections(token: string): Promise<ResumeSync> {
  return syncAll(await listerEnAttenteEnvoi(), token, lotProspection);
}
