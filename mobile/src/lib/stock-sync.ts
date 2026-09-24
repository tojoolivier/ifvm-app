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
  labelDe: (mouvement) => `${mouvement.type === 'transfert' ? 'Transfert' : 'Approvisionnement'} · ${mouvement.date_mouvement}`,
  marquerEchec: marquerMouvementEnEchec,
  syncOne: async (mouvement, token) => {
    await exigerSiteSynchronise(mouvement.site_id);
    if (mouvement.site_destination_id) await exigerSiteSynchronise(mouvement.site_destination_id);
    await apiClient.createMouvementPesticide(token, {
      id: mouvement.id,
      type: mouvement.type,
      pesticide_id: mouvement.pesticide_id,
      site_id: mouvement.site_id,
      site_destination_id: mouvement.site_destination_id,
      quantite: mouvement.quantite,
      unite: mouvement.unite,
      date_mouvement: mouvement.date_mouvement,
    });
    await marquerMouvementSynchronise(mouvement.id);
  },
};

/** Mouvements d'abord (le solde lu ensuite les inclut), puis remplacement du cache des soldes. */
export async function synchroniserStock(token: string): Promise<ResumeSync> {
  const resume = await syncAll(await listMouvementsEnAttente(), token, lotMouvement);
  await remplacerSoldesServeur(await apiClient.getSoldesPesticide(token));
  return resume;
}
