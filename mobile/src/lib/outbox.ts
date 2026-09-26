import type * as SQLite from 'expo-sqlite';

/**
 * L'outbox : ce que les saisies locales en attente d'envoi ont en commun (#676).
 *
 * Le **sort** d'une saisie ratée est déjà une convention unique, dans `sync-lot.ts` (ADR-012 :
 * l'unitaire lève, le lot résume `{ reussies, echouees, conflits }` ; `NetworkError`/5xx la laissent
 * dans la file, un 4xx la passe en `'echec'`). Ce module est l'autre moitié : la **colonne**
 * `statut_sync` qui porte cet état en base, écrite au même endroit pour tous les domaines au lieu
 * d'un `UPDATE ... SET statut_sync` recopié par table.
 *
 * Le vocabulaire est celui de la base — `'local' | 'synced' | 'conflict' | 'echec'` — et pas un
 * quatrième (`sync-lot.ts`, `statutFicheDe`). Un domaine dont le passage à `'synced'` a des effets à
 * lui (rattacher les positions d'un site, stocker `server_updated_at`) garde sa fonction et ne
 * délègue que ce qui est commun : `marquerEnEchec`.
 */
export type StatutSync = 'local' | 'synced' | 'echec' | 'conflict';

/** Tables portant `statut_sync` : liste fermée, jamais un nom de table venu d'ailleurs dans du SQL. */
export type TableOutbox =
  | 'prospection'
  | 'traitement'
  | 'vol'
  | 'mouvement_pesticide_local'
  | 'site_aerien'
  | 'site_aerien_deplacement';

export interface OptionsOutbox {
  table: TableOutbox;
  /** La base, ouverte au moment de l'écriture (jamais capturée : les tests la rouvrent). */
  base: () => Promise<SQLite.SQLiteDatabase>;
  /** Vrai si la table a `updated_at` et qu'un changement de statut doit le rafraîchir. */
  horodate?: boolean;
}

export interface Outbox {
  /** Le serveur a accepté la saisie : elle sort de la file. */
  marquerSynchronise: (id: string) => Promise<void>;
  /** Le serveur l'a refusée : elle sort de la file et attend une action humaine. */
  marquerEnEchec: (id: string) => Promise<void>;
}

export function creerOutbox({ table, base, horodate = false }: OptionsOutbox): Outbox {
  const changerStatut = (statut: StatutSync) => async (id: string) => {
    const db = await base();
    const horodatage = horodate ? ', updated_at = ?' : '';
    const parametres = horodate ? [new Date().toISOString(), id] : [id];
    await db.runAsync(`UPDATE ${table} SET statut_sync = '${statut}'${horodatage} WHERE id = ?`, parametres);
  };

  return {
    marquerSynchronise: changerStatut('synced'),
    marquerEnEchec: changerStatut('echec'),
  };
}
