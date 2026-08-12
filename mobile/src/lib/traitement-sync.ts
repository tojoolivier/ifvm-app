import * as Network from 'expo-network';
import { apiClient } from './api-client';
import {
  DraftTraitement,
  markTraitementConflict,
  markTraitementSynced,
  ServerTraitement,
} from './traitement-repository';

export interface TraitementSyncResult {
  synced: boolean;
  conflict?: boolean;
  serverVersion?: ServerTraitement;
}

function parseJsonField<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * Construit le corps commun de POST /traitements/sync. `base_updated_at` est le
 * dernier `updated_at` serveur connu du client : comme le schéma local ne
 * distingue pas un `server_updated_at` d'un `updated_at` local, on s'appuie sur
 * le fait que markTraitementSynced/markTraitementConflict réécrivent tous deux
 * `updated_at` avec la valeur issue de la réponse serveur — draft.updated_at
 * est donc, par construction, le dernier point de synchronisation connu.
 */
function buildTraitementSyncPayload(draft: DraftTraitement): Record<string, unknown> {
  const common = {
    id: draft.id,
    base_updated_at: draft.updated_at,
    prospection_id: draft.prospection_id,
    numero_fiche: draft.numero_fiche,
    type_traitement: draft.type_traitement,
    mode_traitement: draft.mode_traitement,
    date_traitement: draft.date_traitement,
    date_validation: draft.date_validation,
    localite: draft.localite,
    region: draft.region,
    district: draft.district,
    commune: draft.commune,
    latitude: draft.latitude,
    longitude: draft.longitude,
    altitude: draft.altitude,
    kit_combinaison: draft.kit_combinaison,
    kit_gants: draft.kit_gants,
    kit_lunettes: draft.kit_lunettes,
    kit_masques: draft.kit_masques,
    kit_boite: draft.kit_boite,
    zones_exposees: parseJsonField<Record<string, boolean>>(draft.zones_exposees),
    hauteur_strate_herbeuse_m: draft.hauteur_strate_herbeuse_m,
    hauteur_strate_arboree_m: draft.hauteur_strate_arboree_m,
    recouvrement_percent: draft.recouvrement_percent,
    empoisonnement: draft.empoisonnement,
    empoisonnement_type: draft.empoisonnement_type,
    empoisonnement_mode: draft.empoisonnement_mode,
    empoisonnement_autre: draft.empoisonnement_autre,
    evaluation_risque: parseJsonField<Record<string, string>>(draft.evaluation_risque),
    comportement_anormal: draft.comportement_anormal,
    comportement_non_cibles: parseJsonField<string[]>(draft.comportement_non_cibles),
    mortalite: draft.mortalite,
    mortalite_familles: parseJsonField<string[]>(draft.mortalite_familles),
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
        reprise_traitement: draft.terrestre.reprise_traitement,
        traitement_origine_id: draft.terrestre.traitement_origine_id,
      },
    };
  }

  return common;
}

async function pushTraitement(
  draft: DraftTraitement,
  token: string
): Promise<TraitementSyncResult> {
  const payload = buildTraitementSyncPayload(draft);
  const { status, body } = await apiClient.syncTraitement(token, payload);

  if (status === 409) {
    await markTraitementConflict(draft.id, body as ServerTraitement);
    return { synced: false, conflict: true, serverVersion: body as ServerTraitement };
  }

  await markTraitementSynced(draft.id);
  return { synced: true };
}

export async function enregistrerEtSynchroniserTraitement(
  draft: DraftTraitement,
  token: string
): Promise<TraitementSyncResult> {
  const network = await Network.getNetworkStateAsync();
  const isOnline = Boolean(network.isConnected && network.isInternetReachable);
  if (!isOnline) return { synced: false };

  try {
    return await pushTraitement(draft, token);
  } catch {
    return { synced: false };
  }
}

export async function retrySyncTraitement(draft: DraftTraitement, token: string): Promise<void> {
  const result = await pushTraitement(draft, token);

  if (result.conflict) {
    throw new Error(
      'Conflit de synchronisation : la fiche a été modifiée ou validée sur le serveur.'
    );
  }
}
