import { PreconditionError } from './errors';
import { generateId } from './id';
import { getReferentielDb } from './referentiel-db';
import {
  type MouvementEnAttente,
  type MouvementSaisi,
  type SoldeServeur,
  type TypeMouvementSaisi,
  type UniteStock,
  lireQuantite,
  validerMouvement,
} from './stock-regles';

/**
 * Stock de pesticides local (#645). Même convention que `vol-db.ts` : refus lisible
 * (`PreconditionError`), écriture hors-ligne, envoi par `stock-sync.ts`.
 */

export type StatutSyncMouvement = 'local' | 'synced' | 'echec';

export interface MouvementLocal {
  id: string;
  type: TypeMouvementSaisi;
  pesticide_id: string;
  site_id: string;
  site_destination_id: string | null;
  quantite: number;
  unite: UniteStock;
  date_mouvement: string;
  statut_sync: StatutSyncMouvement;
}

const COLONNES = `id, type, pesticide_id, site_id, site_destination_id, quantite, unite, date_mouvement, statut_sync`;

/** Enregistre un approvisionnement ou un transfert ; rend l'id, qui sera celui du serveur. */
export async function creerMouvement(saisie: MouvementSaisi): Promise<string> {
  const erreurs = validerMouvement(saisie);
  if (erreurs.length > 0) throw new PreconditionError(erreurs.join('\n'));

  const db = await getReferentielDb();
  const id = generateId();
  const maintenant = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO mouvement_pesticide_local
       (id, type, pesticide_id, site_id, site_destination_id, quantite, unite, date_mouvement, statut_sync, cree_le)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'local', ?)`,
    [
      id,
      saisie.type,
      saisie.pesticideId,
      saisie.siteId,
      saisie.type === 'transfert' ? saisie.siteDestinationId : null,
      lireQuantite(saisie.quantite),
      saisie.unite,
      maintenant.slice(0, 10),
      maintenant,
    ]
  );
  return id;
}

/** Mouvements à envoyer, dans l'ordre de saisie. */
export async function listMouvementsEnAttente(): Promise<MouvementLocal[]> {
  const db = await getReferentielDb();
  return db.getAllAsync<MouvementLocal>(
    `SELECT ${COLONNES} FROM mouvement_pesticide_local WHERE statut_sync = 'local' ORDER BY cree_le`
  );
}

/**
 * Ce qui s'ajoute au solde serveur à l'affichage : les mouvements pas encore partis. Un mouvement
 * refusé par le serveur n'a pas eu lieu, il ne compte pas.
 */
export async function listMouvementsPourSolde(): Promise<MouvementEnAttente[]> {
  const mouvements = await listMouvementsEnAttente();
  return mouvements.map(({ type, pesticide_id, site_id, site_destination_id, quantite, unite }) => ({
    type,
    pesticide_id,
    site_id,
    site_destination_id,
    quantite,
    unite,
  }));
}

/** Derniers mouvements saisis qui touchent le site (source ou destination), du plus récent au plus ancien. */
export async function listMouvementsSite(siteId: string, limite = 10): Promise<MouvementLocal[]> {
  const db = await getReferentielDb();
  return db.getAllAsync<MouvementLocal>(
    `SELECT ${COLONNES} FROM mouvement_pesticide_local
     WHERE site_id = ? OR site_destination_id = ?
     ORDER BY cree_le DESC LIMIT ?`,
    [siteId, siteId, limite]
  );
}

export async function marquerMouvementSynchronise(id: string): Promise<void> {
  const db = await getReferentielDb();
  await db.runAsync("UPDATE mouvement_pesticide_local SET statut_sync = 'synced' WHERE id = ?", [id]);
}

export async function marquerMouvementEnEchec(id: string): Promise<void> {
  const db = await getReferentielDb();
  await db.runAsync("UPDATE mouvement_pesticide_local SET statut_sync = 'echec' WHERE id = ?", [id]);
}

export async function listSoldesServeur(): Promise<SoldeServeur[]> {
  const db = await getReferentielDb();
  return db.getAllAsync<SoldeServeur>('SELECT site_id, pesticide_id, unite, quantite FROM stock_solde');
}

/** Le pull rend l'état complet : on remplace le cache, on ne le fusionne pas. */
export async function remplacerSoldesServeur(soldes: SoldeServeur[]): Promise<void> {
  const db = await getReferentielDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM stock_solde');
    for (const s of soldes) {
      await db.runAsync(
        'INSERT INTO stock_solde (site_id, pesticide_id, unite, quantite) VALUES (?, ?, ?, ?)',
        [s.site_id, s.pesticide_id, s.unite, s.quantite]
      );
    }
  });
}

/** Le stock est rattaché au site aérien **principal** : le serveur refuse un secondaire (422, #606). */
export interface SiteStock {
  id: string;
  numero: string;
  localite: string;
}

/**
 * Sites principaux actifs connus de l'appareil : un transfert peut partir vers le site principal
 * d'une autre équipe, mais jamais vers un stand ou une base secondaire.
 */
export async function listSitesPrincipaux(): Promise<SiteStock[]> {
  const db = await getReferentielDb();
  return db.getAllAsync<SiteStock>(
    'SELECT id, numero, localite FROM site_aerien WHERE actif = 1 AND parent_site_id IS NULL ORDER BY numero'
  );
}
