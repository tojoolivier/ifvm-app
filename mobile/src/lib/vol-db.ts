import { PreconditionError } from './errors';
import { generateId } from './id';
import { getReferentielDb } from './referentiel-db';
import { type CategorieVol, type VolSaisi, validerVol } from './vol-regles';

/**
 * Vols locaux (#644). Convoyage et divers se saisissent ici (écran autonome) ; les vols de mise en
 * place, d'application et de prospection sont écrits par leur opération et apparaissent dans
 * « Mes vols » avec leur origine. Même convention que `site-aerien-db.ts` : refus lisible
 * (`PreconditionError`), écriture hors-ligne, envoi par `vol-sync.ts`.
 */

export type OrigineVol = 'traitement' | 'prospection' | 'installation_site' | 'saisie_directe';
export type StatutSyncVol = 'local' | 'synced' | 'echec';

export interface VolLocal {
  id: string;
  categorie: CategorieVol;
  origine: OrigineVol;
  date_vol: string;
  heure_debut: string;
  heure_fin: string;
  lieu_depart: string | null;
  lieu_arrivee: string | null;
  libelle_lieu: string | null;
  statut_sync: StatutSyncVol;
}

const COLONNES = `id, categorie, origine, date_vol, heure_debut, heure_fin, lieu_depart, lieu_arrivee,
       libelle_lieu, statut_sync`;

/** Tous les vols de l'équipe, quelle que soit leur origine, du plus récent au plus ancien. */
export async function listVols(equipeId: string): Promise<VolLocal[]> {
  const db = await getReferentielDb();
  return db.getAllAsync<VolLocal>(
    `SELECT ${COLONNES} FROM vol WHERE equipe_id = ? ORDER BY date_vol DESC, heure_debut DESC`,
    [equipeId]
  );
}

export interface VolAutonomeDemande extends Omit<VolSaisi, 'categorie'> {
  categorie: Extract<CategorieVol, 'convoyage' | 'divers'>;
  equipeId: string;
}

/** Enregistre un convoyage ou un vol divers — les seuls vols saisis hors d'une opération. */
export async function creerVolAutonome(demande: VolAutonomeDemande): Promise<string> {
  const erreurs = validerVol(demande, { dependantIds: [] });
  if (erreurs.length > 0) throw new PreconditionError(erreurs.join('\n'));

  const db = await getReferentielDb();
  const id = generateId();
  const convoyage = demande.categorie === 'convoyage';
  await db.runAsync(
    `INSERT INTO vol
       (id, categorie, origine, equipe_id, aeronef_id, date_vol, heure_debut, heure_fin,
        motif, lieu_depart, lieu_arrivee, libelle_lieu, statut_sync, cree_le)
     VALUES (?, ?, 'saisie_directe', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', ?)`,
    [
      id,
      demande.categorie,
      demande.equipeId,
      demande.aeronefId,
      demande.date,
      demande.debut,
      demande.fin,
      demande.motif.trim(),
      convoyage ? demande.lieuDepart.trim() : null,
      convoyage ? demande.lieuArrivee.trim() : null,
      convoyage ? `${demande.lieuDepart.trim()} → ${demande.lieuArrivee.trim()}` : demande.motif.trim(),
      new Date().toISOString(),
    ]
  );
  return id;
}

/** Trace locale du vol de mise en place (envoyé avec son déplacement) pour « Mes vols ». */
export async function tracerVolInstallation(
  db: Awaited<ReturnType<typeof getReferentielDb>>,
  vol: {
    id: string;
    equipeId: string;
    aeronefId: string | null;
    date: string;
    debut: string;
    fin: string;
    sitePrincipalId: string;
    standId: string | null;
    libelleLieu: string;
  }
): Promise<void> {
  if (!vol.aeronefId) throw new PreconditionError('L’équipe n’a aucun aéronef en service : impossible de saisir un vol.');
  await db.runAsync(
    `INSERT INTO vol
       (id, categorie, origine, equipe_id, aeronef_id, date_vol, heure_debut, heure_fin,
        site_principal_id, stand_id, libelle_lieu, statut_sync, cree_le)
     VALUES (?, 'mise_en_place', 'installation_site', ?, ?, ?, ?, ?, ?, ?, ?, 'local', ?)`,
    [
      vol.id,
      vol.equipeId,
      vol.aeronefId,
      vol.date,
      vol.debut,
      vol.fin,
      vol.sitePrincipalId,
      vol.standId,
      vol.libelleLieu,
      new Date().toISOString(),
    ]
  );
}

export type VolEnAttenteLocal = VolLocal & {
  equipe_id: string;
  aeronef_id: string;
  motif: string | null;
  site_principal_id: string | null;
  stand_id: string | null;
  base_secondaire_id: string | null;
  /** Traitement couvert par un vol d'application (`vol_lien`). */
  traitement_id: string | null;
};

const SELECT_EN_ATTENTE = `SELECT ${COLONNES}, equipe_id, aeronef_id, motif, site_principal_id, stand_id,
       base_secondaire_id,
       (SELECT ref_id FROM vol_lien WHERE vol_id = vol.id AND type = 'traitement') AS traitement_id
     FROM vol`;

/**
 * Vols à envoyer par le lot : saisie directe et application. Ceux de la mise en place partent avec
 * leur déplacement, ceux de la prospection avec leur fiche. Avec `volId`, ce seul vol (si non envoyé).
 */
export async function listVolsEnAttente(volId?: string): Promise<VolEnAttenteLocal[]> {
  const db = await getReferentielDb();
  if (volId) {
    return db.getAllAsync<VolEnAttenteLocal>(`${SELECT_EN_ATTENTE} WHERE id = ? AND statut_sync = 'local'`, [volId]);
  }
  return db.getAllAsync<VolEnAttenteLocal>(
    `${SELECT_EN_ATTENTE} WHERE statut_sync = 'local' AND origine IN ('saisie_directe', 'traitement')
     ORDER BY cree_le`
  );
}

export async function marquerVolSynchronise(volId: string): Promise<void> {
  const db = await getReferentielDb();
  await db.runAsync("UPDATE vol SET statut_sync = 'synced' WHERE id = ?", [volId]);
}

export async function marquerVolEnEchec(volId: string): Promise<void> {
  const db = await getReferentielDb();
  await db.runAsync("UPDATE vol SET statut_sync = 'echec' WHERE id = ?", [volId]);
}

export type TypeLienVol = 'traitement' | 'prospection';

export interface VolOperationDemande extends VolSaisi {
  equipeId: string;
  /** Sites dépendants du site principal : bornent le stand et la base secondaire. */
  dependantIds: string[];
  /** Fiches couvertes par ce vol : un traitement, ou une ou plusieurs prospections. */
  liens: { type: TypeLienVol; refId: string }[];
  /** Localité du site principal, affichée dans « Mes vols ». */
  libelleLieu: string;
}

/** Le vol lié à une fiche (`null` si elle n'en a pas encore). */
export async function getVolDeOperation(
  type: TypeLienVol,
  refId: string
): Promise<(VolLocal & { aeronef_id: string; site_principal_id: string | null; stand_id: string | null; base_secondaire_id: string | null }) | null> {
  const db = await getReferentielDb();
  return db.getFirstAsync(
    `SELECT vol.id, vol.categorie, vol.origine, vol.date_vol, vol.heure_debut, vol.heure_fin,
            vol.lieu_depart, vol.lieu_arrivee, vol.libelle_lieu, vol.statut_sync,
            vol.aeronef_id, vol.site_principal_id, vol.stand_id, vol.base_secondaire_id
     FROM vol JOIN vol_lien ON vol_lien.vol_id = vol.id
     WHERE vol_lien.type = ? AND vol_lien.ref_id = ?`,
    [type, refId]
  );
}

/**
 * Enregistre (ou met à jour) le vol d'une opération — application ou prospection. Un vol déjà
 * envoyé au serveur n'est plus modifiable (`VolUpdate` ne change que le traitement rattaché).
 */
export async function enregistrerVolOperation(demande: VolOperationDemande): Promise<string> {
  const erreurs = validerVol(demande, { dependantIds: demande.dependantIds });
  if (demande.liens.length === 0) erreurs.push('Aucune fiche à rattacher à ce vol.');
  if (erreurs.length > 0) throw new PreconditionError(erreurs.join('\n'));

  const db = await getReferentielDb();
  const existant = await db.getFirstAsync<{ id: string; statut_sync: StatutSyncVol }>(
    `SELECT vol.id, vol.statut_sync FROM vol JOIN vol_lien ON vol_lien.vol_id = vol.id
     WHERE vol_lien.ref_id = ?`,
    [demande.liens[0].refId]
  );
  if (existant && existant.statut_sync === 'synced') {
    throw new PreconditionError('Ce vol est déjà envoyé au serveur : il ne peut plus être modifié ici.');
  }

  const id = existant?.id ?? generateId();
  const origine: OrigineVol = demande.categorie === 'application' ? 'traitement' : 'prospection';
  const champs = [
    demande.equipeId,
    demande.aeronefId,
    demande.date,
    demande.debut,
    demande.fin,
    demande.sitePrincipalId,
    demande.standId,
    demande.baseSecondaireId,
    demande.libelleLieu,
  ];

  await db.withTransactionAsync(async () => {
    if (existant) {
      await db.runAsync(
        `UPDATE vol SET equipe_id = ?, aeronef_id = ?, date_vol = ?, heure_debut = ?, heure_fin = ?,
           site_principal_id = ?, stand_id = ?, base_secondaire_id = ?, libelle_lieu = ?, statut_sync = 'local'
         WHERE id = ?`,
        [...champs, id]
      );
      await db.runAsync('DELETE FROM vol_lien WHERE vol_id = ?', [id]);
    } else {
      await db.runAsync(
        `INSERT INTO vol
           (id, categorie, origine, equipe_id, aeronef_id, date_vol, heure_debut, heure_fin,
            site_principal_id, stand_id, base_secondaire_id, libelle_lieu, statut_sync, cree_le)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', ?)`,
        [id, demande.categorie, origine, ...champs, new Date().toISOString()]
      );
    }
    for (const lien of demande.liens) {
      await db.runAsync('INSERT INTO vol_lien (vol_id, type, ref_id) VALUES (?, ?, ?)', [id, lien.type, lien.refId]);
    }
  });
  return id;
}
