import { apiClient } from './api-client';
import { type VolLocal, listVolsEnAttente, marquerVolEnEchec, marquerVolSynchronise } from './vol-db';
import { type LotSync, type ResumeSync, syncAll } from './sync-lot';

/**
 * Envoi des vols saisis directement (convoyage, divers — #644). Création idempotente par `id`
 * client (#639) : rejouer après une coupure ne double pas le vol. Les autres origines partent avec
 * leur opération (déplacement, traitement, prospection).
 */
type VolEnAttente = Awaited<ReturnType<typeof listVolsEnAttente>>[number];

const lotVol: LotSync<VolEnAttente> = {
  nom: 'vol.creation',
  idDe: (vol) => vol.id,
  labelDe: (vol: VolLocal) => `Vol ${vol.categorie} · ${vol.date_vol}`,
  marquerEchec: marquerVolEnEchec,
  syncOne: async (vol, token) => {
    await apiClient.createVol(token, {
      id: vol.id,
      type: vol.categorie,
      equipe_id: vol.equipe_id,
      aeronef_id: vol.aeronef_id,
      date_vol: vol.date_vol,
      heure_debut: vol.heure_debut,
      heure_fin: vol.heure_fin,
      motif: vol.motif,
      lieu_depart: vol.lieu_depart,
      lieu_arrivee: vol.lieu_arrivee,
    });
    await marquerVolSynchronise(vol.id);
  },
};

export async function synchroniserVols(token: string): Promise<ResumeSync> {
  return syncAll(await listVolsEnAttente(), token, lotVol);
}
