/**
 * Schéma local du stock de pesticides (#645), à part de `referentiel-db.ts` qui en inclut le DDL.
 * Deux tables, deux rôles : `stock_solde` est le dernier solde connu du serveur (cache, remplacé à
 * chaque pull) ; `mouvement_pesticide_local` est la file des mouvements saisis sur l'appareil.
 */
export const STOCK_DDL = `
    -- Dernier solde synchronisé par (site, produit, unité). L'unité fait partie de la clé : L et kg
    -- ne s'additionnent jamais.
    CREATE TABLE IF NOT EXISTS stock_solde (
      site_id TEXT NOT NULL,
      pesticide_id TEXT NOT NULL,
      unite TEXT NOT NULL CHECK (unite IN ('L', 'kg')),
      quantite REAL NOT NULL,
      PRIMARY KEY (site_id, pesticide_id, unite)
    );

    -- Approvisionnements et transferts saisis sur l'appareil (#645). L'id est celui du serveur
    -- (envoi idempotent, #639). La consommation n'est jamais saisie ici : le serveur la génère (#609).
    CREATE TABLE IF NOT EXISTS mouvement_pesticide_local (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('approvisionnement', 'transfert')),
      pesticide_id TEXT NOT NULL,
      site_id TEXT NOT NULL,
      site_destination_id TEXT,
      quantite REAL NOT NULL CHECK (quantite > 0),
      unite TEXT NOT NULL CHECK (unite IN ('L', 'kg')),
      date_mouvement TEXT NOT NULL,
      statut_sync TEXT NOT NULL DEFAULT 'local' CHECK (statut_sync IN ('local', 'synced', 'echec')),
      cree_le TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS ix_mouvement_pesticide_local_site ON mouvement_pesticide_local(site_id);
`;
