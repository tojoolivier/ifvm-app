import { apiClient } from './api-client';
import { NetworkError } from './errors';
import {
  type FicheLocale,
  type ResumeFiche,
  appliquerRetourServeur,
  enregistrerDepuisServeur,
  listerARevalider,
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

/**
 * « Prospections à revalider » : la liste du serveur (`a_revalider=true`) fait foi, et ses fiches sont
 * gardées sur l'appareil pour pouvoir être clonées ensuite, même créées sur un autre appareil. Sans
 * réseau, repli sur la même règle appliquée aux fiches locales (`listerARevalider`).
 */
export async function chargerARevalider(token: string): Promise<ResumeFiche[]> {
  try {
    const lues = await apiClient.listProspections(token, { a_revalider: true });
    for (const lue of lues) await enregistrerDepuisServeur(lue);
    return lues.map((l) => ({
      id: l.id,
      type_prospection: l.type_prospection,
      n_fiche: l.n_fiche,
      date_prospection: l.date_prospection,
      statut: l.statut,
      statut_sync: 'synced',
      revalide_de_id: l.revalide_de_id ?? null,
      validated_at: l.validated_at ?? null,
      updated_at: l.updated_at,
    }));
  } catch (error) {
    if (!(error instanceof NetworkError)) throw error;
    return listerARevalider();
  }
}
