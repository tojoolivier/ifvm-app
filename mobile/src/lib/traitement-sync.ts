import * as Network from 'expo-network';
import type { components } from './api-schema.generated';
import { apiClient, conflitSync } from './api-client';
import {
  DraftTraitement,
  markTraitementConflict,
  markTraitementEchec,
  markTraitementSynced,
  ServerTraitement,
} from './traitement-repository';
import { logger } from './logger';
import { avecConnexion, syncAll, type LotSync, type ResumeSync } from './sync-lot';

const log = logger.child({ module: 'traitement-sync' });

/** Le réseau, tel que l'appareil le voit à cet instant. */
async function estEnLigne(): Promise<boolean> {
  const network = await Network.getNetworkStateAsync();
  return Boolean(network.isConnected && network.isInternetReachable);
}

function parseJsonField<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    // Silence délibéré : le champ est optionnel côté backend, et `null` est
    // une valeur qu'il sait recevoir. Refuser toute la synchronisation pour un
    // champ annexe corrompu bloquerait une fiche par ailleurs complète — mais
    // la corruption, elle, doit se voir dans le journal.
    log.ignore(
      error,
      'Champ JSON local corrompu — envoyé à null plutôt que de bloquer la fiche entière.'
    );
    return null;
  }
}

/**
 * Le stockage local garde ces champs comme des tableaux d'espèces cochées
 * (["Oiseaux", "Poissons"]) — le backend attend un objet (dict[str, Any]).
 * On convertit à la frontière API uniquement, sans toucher au modèle local.
 */
function especesArrayToDict(value: string | null | undefined): Record<string, boolean> | null {
  const list = parseJsonField<string[]>(value);
  if (!list || list.length === 0) return null;
  return Object.fromEntries(list.map((espece) => [espece, true]));
}

/**
 * Construit le corps commun de POST /traitements/sync. `base_updated_at` est le
 * dernier `updated_at` serveur connu du client, tenu dans la colonne dédiée
 * `server_updated_at` (distincte de `updated_at`, que toute écriture locale
 * modifie). Pour une fiche jamais encore synchronisée, on retombe sur
 * `created_at` : plus ancien que tout `updated_at` serveur réel, ce qui ne
 * peut que déclencher un conflit détecté trop tôt — jamais un écrasement
 * silencieux d'une version serveur plus récente.
 */
function buildTraitementSyncPayload(draft: DraftTraitement): components['schemas']['TraitementSyncPush'] {
  const common = {
    id: draft.id,
    base_updated_at: draft.server_updated_at ?? draft.created_at,
    prospection_id: draft.prospection_id,
    numero_fiche: draft.numero_fiche,
    type_traitement: draft.type_traitement,
    mode_traitement: draft.mode_traitement as components['schemas']['TraitementSyncPush']['mode_traitement'],
    date_traitement: draft.date_traitement as string,
    date_validation: draft.date_validation as string,
    localite: draft.localite as string,
    region: draft.region,
    district: draft.district,
    commune: draft.commune,
    latitude: draft.latitude,
    longitude: draft.longitude,
    altitude: draft.altitude,
    kit_combinaison: draft.kit_combinaison ?? 0,
    kit_gants: draft.kit_gants ?? 0,
    kit_lunettes: draft.kit_lunettes ?? 0,
    kit_masques: draft.kit_masques ?? 0,
    kit_botte: draft.kit_botte ?? 0,
    zones_exposees: parseJsonField<Record<string, boolean>>(draft.zones_exposees),
    hauteur_strate_herbeuse_m: draft.hauteur_strate_herbeuse_m,
    hauteur_strate_arboree_m: draft.hauteur_strate_arboree_m,
    recouvrement_percent: draft.recouvrement_percent,
    empoisonnement: !!draft.empoisonnement,
    empoisonnement_type: draft.empoisonnement_type as components['schemas']['TraitementSyncPush']['empoisonnement_type'],
    empoisonnement_mode: draft.empoisonnement_mode as components['schemas']['TraitementSyncPush']['empoisonnement_mode'],
    empoisonnement_autre: draft.empoisonnement_autre,
    evaluation_risque: parseJsonField<Record<string, string>>(draft.evaluation_risque),
    comportement_anormal: !!draft.comportement_anormal,
    comportement_non_cibles: especesArrayToDict(draft.comportement_non_cibles),
    mortalite: !!draft.mortalite,
    mortalite_familles: especesArrayToDict(draft.mortalite_familles),
    observations: draft.observations,
    statut: draft.statut,
  };

  if (draft.type_traitement === 'AERIEN' && draft.aerien) {
    return {
      ...common,
      aerien: {
        pilote: draft.aerien.pilote,
        mecanicien: draft.aerien.mecanicien,
        chef_de_base_id: draft.aerien.chef_de_base_id,
        consultant_international: draft.aerien.consultant_international,
        immatricule_aeronef: draft.aerien.immatricule_aeronef,
        // surface_traitee_ha n'y figure plus (migration 0046) : dérivée des rotations
        // côté serveur, plus un champ accepté par TraitementSyncPush.
        pesticide_recu_l: draft.aerien.pesticide_recu_l,
      },
    };
  }

  if (draft.type_traitement === 'TERRESTRE' && draft.terrestre) {
    return {
      ...common,
      terrestre: {
        heure_debut: draft.terrestre.heure_debut,
        heure_fin: draft.terrestre.heure_fin,
        vitesse_vent_ms: draft.terrestre.vitesse_vent_ms,
        direction_vent: draft.terrestre.direction_vent,
        temperature_c: draft.terrestre.temperature_c,
        chef_equipe_id: draft.terrestre.chef_equipe_id,
        agent_encadreur_id: draft.terrestre.agent_encadreur_id,
        consultant_international: draft.terrestre.consultant_international,
        surface_atomiseur_ha: draft.terrestre.surface_atomiseur_ha,
        surface_disque_rotatif_ha: draft.terrestre.surface_disque_rotatif_ha,
        surface_ulvamast_ha: draft.terrestre.surface_ulvamast_ha,
        surface_restante_abandonnee: draft.terrestre.surface_restante_abandonnee,
        motif_surface_restante_abandonnee: draft.terrestre.motif_surface_restante_abandonnee,
        essence_litres: draft.terrestre.essence_litres,
        nb_piles: draft.terrestre.nb_piles,
        pesticide_recu_l: draft.terrestre.pesticide_recu_l,
        reprise_traitement: draft.terrestre.reprise_traitement,
        traitement_origine_id: draft.terrestre.traitement_origine_id,
      } as components['schemas']['TraitementTerrestreCreate'],
    };
  }

  return common;
}

/**
 * Les rotations/produits utilisés n'ont pas d'équivalent dans le corps de
 * POST /traitements/sync (TraitementSyncPush côté backend) — ce sont des
 * sous-ressources avec leurs propres endpoints (POST /traitements/{id}/rotations,
 * /produits). On les pousse après le sync principal, une fois qu'on est sûr
 * que le traitement existe côté serveur avec le même id.
 */
async function pushRotationsEtProduits(draft: DraftTraitement, token: string): Promise<void> {
  if (draft.type_traitement === 'AERIEN' && draft.aerien) {
    for (const rotation of draft.aerien.rotations) {
      // numero_cuve n'y figure pas : dérivé côté serveur de numero (migration 0046),
      // plus un champ accepté par RotationCreate.
      await apiClient.addRotation(token, draft.id, {
        produit_id: rotation.produit_id ?? '',
        quantite: rotation.quantite ?? 0,
        unite: (rotation.unite as 'L' | 'KG' | null) ?? 'L',
        surface_ha: rotation.surface_ha ?? 0,
        temperature_debut_c: rotation.temperature_debut_c ?? 0,
        temperature_fin_c: rotation.temperature_fin_c ?? 0,
        vent_debut_ms: rotation.vent_debut_ms ?? 0,
        vent_fin_ms: rotation.vent_fin_ms ?? 0,
        heure_debut: rotation.heure_debut ?? '00:00',
        heure_fin: rotation.heure_fin ?? '00:01',
        heure_ouverture_vanne: rotation.heure_ouverture_vanne ?? '00:00',
        heure_fermeture_vanne: rotation.heure_fermeture_vanne ?? '00:01',
        nom_commercial: rotation.nom_commercial ?? null,
      });
    }
  }

  if (draft.type_traitement === 'TERRESTRE' && draft.terrestre) {
    for (const produit of draft.terrestre.produits) {
      await apiClient.addProduitUtilise(token, draft.id, {
        produit_id: produit.produit_id ?? '',
        quantite_l: produit.quantite_l ?? 0,
        nom_commercial: produit.nom_commercial ?? null,
      });
    }
  }
}

/**
 * L'unitaire — ADR-012 décision 9. **Il lève**, et c'est tout ce qu'il fait
 * savoir : une fiche a une seule issue.
 *
 * Le 409 ne s'aplatit plus en `new Error('Conflit de synchronisation')` : la
 * version serveur, déjà payée d'un aller-retour réseau, voyage jointe à
 * l'erreur (`conflitSync`) jusqu'au résumé, où le lot décide de la persister.
 * C'est `syncAll` qui écrit `statut_sync`, pas cette fonction — l'unitaire ne
 * connaît pas le sort réservé à la fiche.
 */
export async function syncOneTraitement(draft: DraftTraitement, token: string): Promise<void> {
  const payload = buildTraitementSyncPayload(draft);
  const { status, body } = await apiClient.syncTraitement(token, payload);

  if (status === 409) {
    throw conflitSync(
      'La fiche a été modifiée ou validée sur le serveur.',
      body as ServerTraitement
    );
  }

  await pushRotationsEtProduits(draft, token);
  await markTraitementSynced(draft.id, (body as ServerTraitement)?.updated_at);
}

/** Ce que le domaine « traitement » fournit pour être synchronisé en lot. */
export const lotTraitement: LotSync<DraftTraitement> = {
  nom: 'traitement',
  syncOne: syncOneTraitement,
  idDe: (draft) => draft.id,
  labelDe: (draft) => draft.numero_fiche ?? `Fiche du ${draft.date_traitement ?? '—'}`,
  marquerEchec: markTraitementEchec,
  marquerConflit: async (id, serverVersion) => {
    await markTraitementConflict(id, serverVersion as ServerTraitement);
  },
};

/**
 * Enregistre localement puis tente l'envoi, et **résume**.
 *
 * Le `{ synced, syncError }` d'avant était le Data Clump que #173 avait
 * délibérément laissé en place : l'extraire avant de connaître la forme du
 * résumé aurait été le concevoir par le mauvais bout (#190).
 */
export async function enregistrerEtSynchroniserTraitement(
  draft: DraftTraitement,
  token: string
): Promise<ResumeSync> {
  return syncAll([draft], token, avecConnexion(lotTraitement, estEnLigne));
}

/** Synchronise un lot de traitements en attente. Ne lève jamais. */
export async function syncAllTraitements(
  drafts: DraftTraitement[],
  token: string
): Promise<ResumeSync> {
  return syncAll(drafts, token, lotTraitement);
}
