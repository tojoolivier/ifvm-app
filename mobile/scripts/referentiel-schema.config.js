/**
 * Déclaration du miroir local du référentiel (#675) : ce qui n'est PAS dans le contrat OpenAPI.
 *
 * Le DDL des tables du référentiel est généré depuis `components['schemas']` de
 * `api-schema.generated.ts` (voir `referentiel-schema.js`). Ce fichier est la seule partie écrite
 * à la main, et elle est volontairement déclarative :
 *
 *  - `tables` : liste blanche schéma Pydantic -> table locale. Une table absente d'ici n'existe pas
 *    dans le cache ; un schéma `*SyncRead` du contrat absent d'ici ET de `schemasIgnores` fait
 *    échouer la génération (jamais d'omission silencieuse).
 *  - `omis` : champs du contrat volontairement sans colonne, avec la raison. Un champ omis qui
 *    n'existe plus dans le contrat fait aussi échouer la génération (déclaration périmée).
 *  - `local` : colonnes et index propres à l'appareil. Une colonne locale qui porte le nom d'un
 *    champ du contrat fait échouer la génération (la couche locale ne masque jamais le contrat).
 *
 * Inventaire cache jetable / donnée sacrée (le référentiel est reconstruit, le reste n'est jamais
 * touché par la reconstruction) :
 *
 *  Cache jetable — générées ici, DROP + pull complet quand la version de schéma change :
 *    poste_acridien, station_fixe, utilisateur_equipe, pesticide, culture, code_stade, campagne,
 *    lieu_aerien, equipe, equipe_membre, site_aerien, aeronef, equipe_aeronef.
 *  Cache jetable — hors périmètre du générateur (pas de schéma `*SyncRead`, alimentées par leur
 *    propre synchro, jamais migrées à la main) :
 *    stock_solde (stock-sync), referentiel_sync_meta (curseurs `since`).
 *  Donnée sacrée — jamais DROP, jamais générées :
 *    site_aerien_deplacement (file d'envoi), site_aerien_position (historique local),
 *    vol, vol_lien, mouvement_pesticide_local, et tout ce que contiennent db /
 *    traitement-db / journal-db (captures, outbox, journal).
 *  Cas mixte : site_aerien contient aussi des sites créés hors-ligne et pas encore envoyés
 *    (statut_sync <> 'synced', #643). La reconstruction les met de côté et les réinsère.
 */

const RAISON_SOFT_DELETE =
  'soft-delete (#674) : une ligne supprimée est purgée du cache au pull, jamais stockée';

const tables = [
  { table: 'poste_acridien', schema: 'PosteAcridienSyncRead' },
  {
    table: 'station_fixe',
    schema: 'StationFixeSyncRead',
    local: { index: ['pa_id'] },
  },
  { table: 'utilisateur_equipe', schema: 'UtilisateurEquipeSyncRead', sansSoftDelete: true },
  { table: 'pesticide', schema: 'PesticideSyncRead' },
  { table: 'culture', schema: 'CultureSyncRead' },
  { table: 'code_stade', schema: 'CodeStadeSyncRead' },
  { table: 'campagne', schema: 'CampagneSyncRead' },
  { table: 'lieu_aerien', schema: 'LieuAerienSyncRead' },
  { table: 'equipe', schema: 'EquipeSyncRead' },
  {
    table: 'equipe_membre',
    schema: 'EquipeMembreSyncRead',
    sansSoftDelete: true,
    primaryKey: ['equipe_id', 'user_id'],
    omis: { created_at: "aucun écran ne lit la date d'ajout d'un membre" },
    local: { index: ['user_id'] },
  },
  {
    table: 'site_aerien',
    schema: 'SiteAerienneSyncRead',
    local: {
      // Site créé sur le terrain (#643) : 'local' tant que le serveur ne l'a pas reçu.
      colonnes: [{ name: 'statut_sync', type: "TEXT NOT NULL DEFAULT 'synced'" }],
      index: ['equipe_id'],
    },
  },
  { table: 'aeronef', schema: 'AeronefSyncRead' },
  {
    table: 'equipe_aeronef',
    schema: 'EquipeAeronefSyncRead',
    local: { index: ['equipe_id'] },
  },
];

/** Schémas `*SyncRead` du contrat volontairement non miroités, avec la raison. */
const schemasIgnores = {
  ZoneAntiAcridienSyncRead:
    "la ZA n'est pas descendue sur le terrain : le poste acridien ne garde que `za_id`",
};

module.exports = { tables, schemasIgnores, RAISON_SOFT_DELETE };
