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

/** Vols de saisie directe à envoyer, dans l'ordre de saisie. */
export async function listVolsEnAttente(): Promise<
  (VolLocal & { equipe_id: string; aeronef_id: string; motif: string | null })[]
> {
  const db = await getReferentielDb();
  return db.getAllAsync(
    `SELECT ${COLONNES}, equipe_id, aeronef_id, motif FROM vol
     WHERE statut_sync = 'local' AND origine = 'saisie_directe' ORDER BY cree_le`
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
