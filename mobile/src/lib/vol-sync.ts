import { apiClient } from './api-client';
import { NetworkError } from './errors';
import { getTraitement } from './traitement-repository';
import {
  type TypeLienVol,
  type VolEnAttenteLocal,
  type VolLocal,
  getVolDeOperation,
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
 * - prospection : partent juste avant leur première fiche (`syncOneProspection`), car
 *   `prospection.vol_id` référence le vol ;
 * - mise en place : voyagent avec leur déplacement (`site-aerien-sync.ts`).
 */
type VolEnAttente = VolEnAttenteLocal;

async function creerSurLeServeur(vol: VolEnAttente, token: string): Promise<void> {
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

const lotVol: LotSync<VolEnAttente> = {
  nom: 'vol.creation',
  idDe: (vol) => vol.id,
  labelDe: (vol: VolLocal) => `Vol ${vol.categorie} · ${vol.date_vol}`,
  marquerEchec: marquerVolEnEchec,
  syncOne: async (vol, token) => {
    // Le vol d'application se rattache à un traitement qui doit exister sur le serveur : tant qu'il
    // ne l'est pas, le vol reste dans la file (`NetworkError`), ce n'est pas un échec de l'agent.
    const traitementId = vol.origine === 'traitement' ? vol.traitement_id : null;
    if (vol.origine === 'traitement') {
      const traitement = traitementId ? await getTraitement(traitementId) : null;
      if (!traitement || traitement.statut_sync !== 'synced') {
        throw new NetworkError('Le traitement n’est pas encore synchronisé — le vol partira ensuite.');
      }
    }
    await creerSurLeServeur(vol, token);
    if (traitementId) await apiClient.updateVol(token, vol.id, { traitement_id: traitementId });
    await marquerVolSynchronise(vol.id);
  },
};

export async function synchroniserVols(token: string): Promise<ResumeSync> {
  return syncAll(await listVolsEnAttente(), token, lotVol);
}

/**
 * Le vol d'une prospection, envoyé s'il ne l'est pas encore ; rend son id pour `prospection.vol_id`
 * (`null` : la fiche n'a pas de vol). Une erreur remonte : la fiche ne peut pas partir sans son vol.
 */
export async function assurerVolDeProspection(token: string, prospectionId: string): Promise<string | null> {
  const type: TypeLienVol = 'prospection';
  const vol = await getVolDeOperation(type, prospectionId);
  if (!vol) return null;
  if (vol.statut_sync !== 'synced') {
    const [enAttente] = await listVolsEnAttente(vol.id);
    if (!enAttente) return vol.id;
    await creerSurLeServeur(enAttente, token);
    await marquerVolSynchronise(vol.id);
  }
  return vol.id;
}
