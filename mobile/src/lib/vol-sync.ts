import { apiClient } from './api-client';
import { NetworkError } from './errors';
import { getTraitement } from './traitement-repository';
import {
  type VolEnAttenteLocal,
  type VolLocal,
  listVolsEnAttente,
  marquerVolEnEchec,
  marquerVolSynchronise,
} from './vol-db';
import { type LotSync, type ResumeSync, syncAll } from './sync-lot';

/**
 * Envoi des vols (#644). Création idempotente par `id` client (#639) : rejouer après une coupure
 * ne double pas le vol. Trois chemins :
 * - saisie directe (convoyage, divers) : partent ici ;
 * - application : partent une fois leur traitement synchronisé, puis `PATCH /vols/{id}` les y rattache (#610) ;
 * - mise en place : voyagent avec leur déplacement (`site-aerien-sync.ts`).
 */
async function creerSurLeServeur(vol: VolEnAttenteLocal, token: string): Promise<void> {
  await apiClient.createVol(token, {
    id: vol.id,
    type: vol.categorie,
    equipe_id: vol.equipe_id,
    aeronef_id: vol.aeronef_id,
    date_vol: vol.date_vol,
    heure_debut: vol.heure_debut,
    heure_fin: vol.heure_fin,
    site_principal_id: vol.site_principal_id,
    stand_id: vol.stand_id,
    base_secondaire_id: vol.base_secondaire_id,
    motif: vol.motif,
    lieu_depart: vol.lieu_depart,
    lieu_arrivee: vol.lieu_arrivee,
  });
}

async function exigerTraitementSynchronise(traitementId: string | null): Promise<void> {
  const traitement = traitementId ? await getTraitement(traitementId) : null;
  if (traitement?.statut_sync !== 'synced') {
    throw new NetworkError('Le traitement n’est pas encore synchronisé — le vol partira ensuite.');
  }
}

const lotVol: LotSync<VolEnAttenteLocal> = {
  nom: 'vol.creation',
  idDe: (vol) => vol.id,
  labelDe: (vol: VolLocal) => `Vol ${vol.categorie} · ${vol.date_vol}`,
  marquerEchec: marquerVolEnEchec,
  syncOne: async (vol, token) => {
    // Un vol d'application se rattache à un traitement qui doit exister sur le serveur : tant qu'il ne
    // l'est pas, le vol reste dans la file (`NetworkError`), ce n'est pas un échec de l'agent.
    const traitementId = vol.origine === 'traitement' ? vol.traitement_id : null;
    if (vol.origine === 'traitement') await exigerTraitementSynchronise(traitementId);
    await creerSurLeServeur(vol, token);
    if (traitementId) await apiClient.updateVol(token, vol.id, { traitement_id: traitementId });
    await marquerVolSynchronise(vol.id);
  },
};

export async function synchroniserVols(token: string): Promise<ResumeSync> {
  return syncAll(await listVolsEnAttente(), token, lotVol);
}
