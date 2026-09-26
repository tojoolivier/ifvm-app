/**
 * Schéma local des saisies de site aérien (#643), à part de `referentiel-db.ts` : ce ne sont pas des
 * caches du serveur mais des données saisies sur l'appareil, créées par la migration de base.
 */

/** Colonnes de `site_aerien_deplacement` ajoutées après sa création initiale (étape de base, figée). */
export const COLONNES_DEPLACEMENT = [
  { name: 'renomme', type: 'INTEGER NOT NULL DEFAULT 0' },
  { name: 'dependants_json', type: "TEXT NOT NULL DEFAULT '[]'" },
  { name: 'vol_json', type: 'TEXT' },
  { name: 'erreur', type: 'TEXT' },
] as const;

export const SITE_AERIEN_DDL = `
    -- Historique des implantations (#643). Pas un miroir du serveur : le pull n'embarque que la
    -- position active, l'historique local est celui des déplacements faits sur cet appareil
    -- (plus ce que l'écran rafraîchit en ligne). 'local' = créée hors-ligne, pas encore envoyée.
    CREATE TABLE IF NOT EXISTS site_aerien_position (
      id TEXT PRIMARY KEY NOT NULL,
      site_id TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      altitude REAL,
      date_debut TEXT NOT NULL,
      date_fin TEXT,
      localite TEXT NOT NULL,
      statut_sync TEXT NOT NULL DEFAULT 'synced'
    );

    CREATE INDEX IF NOT EXISTS ix_site_aerien_position_site_id ON site_aerien_position(site_id);

    -- File des déplacements à envoyer (#643) : un déplacement groupé = une ligne, rejouée dans
    -- l'ordre de saisie une fois les sites concernés synchronisés. Le vol de mise en place
    -- facultatif voyage avec elle (vol_json) : il n'a de sens qu'après le déplacement.
    CREATE TABLE IF NOT EXISTS site_aerien_deplacement (
      id TEXT PRIMARY KEY NOT NULL,
      site_id TEXT NOT NULL,
      numero TEXT NOT NULL,
      localite TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      altitude REAL,
      -- 1 si numéro/localité ont changé : seul cas où l'envoi passe par PUT /sites-aeriens/{id}
      -- (réservé au chef côté serveur, alors que le déplacement lui-même ne l'est pas).
      renomme INTEGER NOT NULL DEFAULT 0,
      dependants_json TEXT NOT NULL DEFAULT '[]',
      vol_json TEXT,
      cree_le TEXT NOT NULL,
      statut_sync TEXT NOT NULL DEFAULT 'local',
      erreur TEXT
    );
`;
