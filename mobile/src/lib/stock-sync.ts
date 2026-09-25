import { apiClient } from './api-client';
import { NetworkError } from './errors';
import { getStatutSite } from './site-aerien-db';
import {
  type MouvementLocal,
  listMouvementsEnAttente,
  marquerMouvementEnEchec,
  marquerMouvementSynchronise,
  remplacerSoldesServeur,
} from './stock-db';
import { libelleTypeMouvement } from './stock-regles';
import { type LotSync, type ResumeSync, syncAll } from './sync-lot';

/**
 * Envoi des mouvements de stock puis rafraîchissement des soldes (#645). Création idempotente par
 * `id` client (#639) : rejouer après une coupure ne double pas le mouvement. Même convention que
 * `vol-sync.ts` : l'unitaire lève, le lot résume.
 *
 * Un mouvement dont le site n'est pas encore connu du serveur reste **dans la file**
 * (`NetworkError`) : c'est l'état normal d'un site créé hors-ligne, pas un échec de l'agent.
 */
async function exigerSiteSynchronise(siteId: string): Promise<void> {
  if ((await getStatutSite(siteId)) === 'local') {
    throw new NetworkError('Le site n’est pas encore synchronisé — le mouvement partira ensuite.');
  }
}

const lotMouvement: LotSync<MouvementLocal> = {
  nom: 'stock.mouvement',
  idDe: (mouvement) => mouvement.id,
  labelDe: (mouvement) => `${libelleTypeMouvement(mouvement.type)} · ${mouvement.date_mouvement}`,
  marquerEchec: marquerMouvementEnEchec,
  syncOne: async (mouvement, token) => {
    await exigerSiteSynchronise(mouvement.site_id);
    if (mouvement.site_destination_id) await exigerSiteSynchronise(mouvement.site_destination_id);
    // Tout `MouvementLocal` sauf son statut local est déjà le corps du contrat.
    const { statut_sync: _statutLocal, ...corps } = mouvement;
    await apiClient.createMouvementPesticide(token, corps);
    await marquerMouvementSynchronise(mouvement.id);
  },
};

/** Mouvements d'abord (le solde lu ensuite les inclut), puis remplacement du cache des soldes. */
export async function synchroniserStock(token: string): Promise<ResumeSync> {
  const resume = await syncAll(await listMouvementsEnAttente(), token, lotMouvement);
  await remplacerSoldesServeur(await apiClient.getSoldesPesticide(token));
  return resume;
}
