import { apiClient, statutHttpDe } from './api-client';
import { NetworkError } from './errors';
import {
  type DeplacementLocal,
  type SiteAerienLocal,
  getStatutSite,
  listDeplacementsEnAttente,
  listSitesEnAttente,
  marquerDeplacementEnEchec,
  marquerDeplacementSynchronise,
  marquerSiteEnEchec,
  marquerSiteSynchronise,
} from './site-aerien-db';
import { lireDependants, lireVolJson } from './site-aerien-regles';
import { marquerVolSynchronise } from './vol-db';
import { synchroniserVols } from './vol-sync';
import { type LotSync, type ResumeSync, syncAll } from './sync-lot';

/**
 * Envoi des sites aériens saisis sur le terrain (#643), dans l'ordre que le serveur exige (#655) :
 * les sites (principal puis dépendants), puis les déplacements, chacun suivi de son vol de mise en
 * place. Même convention que les fiches (ADR-012) : l'unitaire lève, le lot résume.
 *
 * Tout ce qui dépend d'une ligne pas encore partie reste **dans la file** (`NetworkError`, donc
 * `'file'`) : c'est l'état normal d'un principal encore hors-ligne, pas un échec de l'agent.
 */

/** Ce qui manque n'est pas une faute de l'agent : `NetworkError` garde la ligne dans la file (`'file'`). */
const erreurEnAttente = (message: string) => new NetworkError(message);

/**
 * Un 409 à la création d'un site est un refus de **contenu** (numéro déjà pris, id déjà utilisé),
 * pas un conflit de version : l'agent doit lire le motif, pas « modifiée sur le serveur ». On le
 * range donc comme un rejet de validation (`sync-lot.ts`) — sauf « parent inconnu », qui se rejoue.
 */
function traduireErreurCreation(error: unknown): unknown {
  if (statutHttpDe(error) !== 409) return error;
  const message = error instanceof Error ? error.message : 'Le serveur a refusé ce site.';
  if (message.includes('parent_site_id inconnu')) {
    return erreurEnAttente('Le site principal n’est pas encore connu du serveur — le dépendant repartira ensuite.');
  }
  return Object.assign(new NetworkError(message), { status: 422 });
}

const lotCreation: LotSync<SiteAerienLocal> = {
  nom: 'site-aerien.creation',
  idDe: (site) => site.id,
  labelDe: (site) => `Site ${site.numero} · ${site.localite}`,
  marquerEchec: marquerSiteEnEchec,
  syncOne: async (site, token) => {
    if (site.parent_site_id) {
      const statutParent = await getStatutSite(site.parent_site_id);
      if (statutParent === 'echec') {
        throw erreurEnAttente('Le site principal a été refusé par le serveur : corrigez-le avant ses dépendants.');
      }
      if (statutParent !== 'synced') {
        throw erreurEnAttente('Le site principal n’est pas encore synchronisé — le dépendant partira ensuite.');
      }
    }

    const position =
      site.latitude !== null && site.longitude !== null
        ? { latitude: site.latitude, longitude: site.longitude, altitude: site.altitude }
        : undefined;

    try {
      await apiClient.createSiteAerien(token, {
        id: site.id,
        numero: site.numero,
        localite: site.localite,
        // Le principal porte l'équipe de travail ; un dépendant pointe vers son principal.
        ...(site.parent_site_id ? { parent_site_id: site.parent_site_id } : { equipe_id: site.equipe_id }),
        ...(position ? { position } : {}),
      });
    } catch (error) {
      throw traduireErreurCreation(error);
    }
    await marquerSiteSynchronise(site.id);
  },
};

const lotDeplacement: LotSync<DeplacementLocal> = {
  nom: 'site-aerien.deplacement',
  idDe: (deplacement) => deplacement.id,
  labelDe: (deplacement) => `Déplacement · ${deplacement.localite}`,
  marquerEchec: marquerDeplacementEnEchec,
  syncOne: async (deplacement, token) => {
    const dependants = lireDependants(deplacement.dependants_json);
    for (const siteId of [deplacement.site_id, ...dependants]) {
      if ((await getStatutSite(siteId)) === 'local') {
        throw erreurEnAttente('Le site déplacé n’est pas encore synchronisé — le déplacement partira ensuite.');
      }
    }

    if (deplacement.renomme) {
      await apiClient.updateSiteAerien(token, deplacement.site_id, {
        numero: deplacement.numero,
        localite: deplacement.localite,
      });
    }
    await apiClient.deplacerSiteAerien(token, deplacement.site_id, {
      latitude: deplacement.latitude,
      longitude: deplacement.longitude,
      altitude: deplacement.altitude,
      dependants,
    });
    // Le vol n'a de sens qu'une fois le site installé ; son id client le rend rejouable (#639).
    if (deplacement.vol_json) {
      const vol = lireVolJson(deplacement.vol_json);
      await apiClient.createVol(token, vol);
      await marquerVolSynchronise(vol.id);
    }
    await marquerDeplacementSynchronise(deplacement.id);
  },
};

/** Sites d'abord, déplacements ensuite : un déplacement suppose le site connu du serveur. */
export async function synchroniserSitesAeriens(token: string): Promise<ResumeSync> {
  const sites = await syncAll(await listSitesEnAttente(), token, lotCreation);
  const deplacements = await syncAll(await listDeplacementsEnAttente(), token, lotDeplacement);
  const vols = await synchroniserVols(token);
  return {
    reussies: [...sites.reussies, ...deplacements.reussies, ...vols.reussies],
    echouees: [...sites.echouees, ...deplacements.echouees, ...vols.echouees],
    conflits: [...sites.conflits, ...deplacements.conflits, ...vols.conflits],
  };
}
