/**
 * Schéma local des vols (#644), à part de `referentiel-db.ts` : ce cache n'a rien d'un référentiel et
 * change pour d'autres raisons. Le DDL est créé par la migration de base (`db-baseline.ts`).
 */

/** Colonnes propres à une catégorie : nulles pour les autres. Une seule liste sert au DDL et à la migration. */
export const COLONNES_VOL_FACULTATIVES = [
  { name: 'site_principal_id', type: 'TEXT' },
  { name: 'stand_id', type: 'TEXT' },
  { name: 'base_secondaire_id', type: 'TEXT' },
  { name: 'motif', type: 'TEXT' },
  { name: 'lieu_depart', type: 'TEXT' },
  { name: 'lieu_arrivee', type: 'TEXT' },
  { name: 'libelle_lieu', type: 'TEXT' },
] as const;

export const VOL_DDL = `
    -- Vols saisis sur l'appareil (#644), toutes origines confondues : c'est ce que lit « Mes vols ».
    -- Seules les lignes 'saisie_directe' (convoyage, divers) et 'traitement' partent du lot des vols ;
    -- celles de la mise en place voyagent avec leur déplacement (site_aerien_deplacement.vol_json) et
    -- celles de la prospection avec leur fiche : elles sont seulement marquées synchronisées à l'envoi.
    CREATE TABLE IF NOT EXISTS vol (
      id TEXT PRIMARY KEY NOT NULL,
      categorie TEXT NOT NULL,
      origine TEXT NOT NULL,
      equipe_id TEXT NOT NULL,
      aeronef_id TEXT NOT NULL,
      date_vol TEXT NOT NULL,
      heure_debut TEXT NOT NULL,
      heure_fin TEXT NOT NULL,
      ${COLONNES_VOL_FACULTATIVES.map((c) => `${c.name} ${c.type},`).join('\n      ')}
      statut_sync TEXT NOT NULL DEFAULT 'local',
      cree_le TEXT NOT NULL
    );

    -- Rattachement d'un vol à l'opération qui l'a produit (#644, #610) : un vol d'application couvre
    -- un traitement, un vol de prospection couvre une ou plusieurs prospections (« Ce vol couvre
    -- aussi »). type = 'traitement' | 'prospection', ref_id = id de la fiche (autre base SQLite).
    CREATE TABLE IF NOT EXISTS vol_lien (
      vol_id TEXT NOT NULL REFERENCES vol(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      ref_id TEXT NOT NULL,
      PRIMARY KEY (vol_id, ref_id)
    );

    CREATE INDEX IF NOT EXISTS ix_vol_lien_ref_id ON vol_lien(ref_id);
`;
