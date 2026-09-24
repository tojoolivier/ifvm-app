import { PreconditionError } from './errors';
import { generateId } from './id';
import { getReferentielDb } from './referentiel-db';
import {
  type PositionSaisie,
  type SiteSaisi,
  type VolMiseEnPlaceSaisi,
  jourPrecedent,
  validerCreationGroupee,
  validerDeplacement,
  validerSiteSecondaire,
  validerVolMiseEnPlace,
} from './site-aerien-regles';

/**
 * Écritures locales des sites aériens sous l'équipe (#643) : tout se saisit hors-ligne, puis
 * `site-aerien-sync.ts` envoie dans l'ordre. Les règles vivent dans `site-aerien-regles.ts` ;
 * ici on les applique (refus lisible, `PreconditionError`) puis on écrit en une transaction.
 */

/** 'echec' : le serveur a refusé, la ligne sort de la file (cf. `sync-lot.ts`). */
export type StatutSyncSite = 'local' | 'synced' | 'echec';

export interface PositionLocale {
  id: string;
  site_id: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  date_debut: string;
  date_fin: string | null;
  localite: string;
  statut_sync: StatutSyncSite;
}

export interface SiteAerienLocal {
  id: string;
  parent_site_id: string | null;
  equipe_id: string | null;
  numero: string;
  localite: string;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  date_debut_position: string | null;
  statut_sync: StatutSyncSite;
}

const aujourdhuiParDefaut = (): string => {
  const maintenant = new Date();
  const deux = (n: number) => String(n).padStart(2, '0');
  return `${maintenant.getFullYear()}-${deux(maintenant.getMonth() + 1)}-${deux(maintenant.getDate())}`;
};

function refuser(erreurs: string[]): never {
  throw new PreconditionError(erreurs.join('\n'));
}

// ==========================================================================
// Lectures
// ==========================================================================

const COLONNES_SITE = `id, parent_site_id, equipe_id, numero, localite, latitude, longitude, altitude,
       date_debut_position, statut_sync`;

/**
 * Sites d'une équipe aérienne : ses principaux puis leurs secondaires. Les secondaires locaux (créés
 * ici, pas encore partis) rejoignent leur principal par `parent_site_id`, comme ceux du pull.
 */
export async function listSitesAeriensEquipe(equipeId: string): Promise<SiteAerienLocal[]> {
  const db = await getReferentielDb();
  return db.getAllAsync<SiteAerienLocal>(
    `SELECT ${COLONNES_SITE} FROM site_aerien
     WHERE actif = 1 AND (
       equipe_id = ?
       OR parent_site_id IN (SELECT id FROM site_aerien WHERE equipe_id = ?)
     )
     ORDER BY CASE WHEN parent_site_id IS NULL THEN 0 ELSE 1 END, numero`,
    [equipeId, equipeId]
  );
}

/** Historique des implantations d'un site, la plus récente d'abord. */
export async function listPositionsSite(siteId: string): Promise<PositionLocale[]> {
  const db = await getReferentielDb();
  return db.getAllAsync<PositionLocale>(
    `SELECT id, site_id, latitude, longitude, altitude, date_debut, date_fin, localite, statut_sync
     FROM site_aerien_position WHERE site_id = ? ORDER BY date_debut DESC, date_fin IS NULL DESC`,
    [siteId]
  );
}

export interface DeplacementLocal {
  id: string;
  site_id: string;
  numero: string;
  localite: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  renomme: number;
  dependants_json: string;
  vol_json: string | null;
  cree_le: string;
  statut_sync: string;
  erreur: string | null;
}

// ==========================================================================
// File d'envoi — lue par `site-aerien-sync.ts`
// ==========================================================================

/** Sites à envoyer, principaux d'abord : le serveur refuse (409) un dépendant sans son principal. */
export async function listSitesEnAttente(): Promise<SiteAerienLocal[]> {
  const db = await getReferentielDb();
  return db.getAllAsync<SiteAerienLocal>(
    `SELECT ${COLONNES_SITE} FROM site_aerien WHERE statut_sync = 'local'
     ORDER BY CASE WHEN parent_site_id IS NULL THEN 0 ELSE 1 END, updated_at`
  );
}

export async function getStatutSite(siteId: string): Promise<StatutSyncSite | null> {
  const db = await getReferentielDb();
  const ligne = await db.getFirstAsync<{ statut_sync: StatutSyncSite }>(
    'SELECT statut_sync FROM site_aerien WHERE id = ?',
    [siteId]
  );
  return ligne?.statut_sync ?? null;
}

export async function marquerSiteSynchronise(siteId: string): Promise<void> {
  const db = await getReferentielDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE site_aerien SET statut_sync = 'synced' WHERE id = ?", [siteId]);
    await db.runAsync("UPDATE site_aerien_position SET statut_sync = 'synced' WHERE site_id = ?", [siteId]);
  });
}

export async function marquerSiteEnEchec(siteId: string): Promise<void> {
  const db = await getReferentielDb();
  await db.runAsync("UPDATE site_aerien SET statut_sync = 'echec' WHERE id = ?", [siteId]);
}

/** Déplacements à envoyer, dans l'ordre de saisie : chacun part de la position laissée par le précédent. */
export async function listDeplacementsEnAttente(): Promise<DeplacementLocal[]> {
  const db = await getReferentielDb();
  return db.getAllAsync<DeplacementLocal>(
    `SELECT id, site_id, numero, localite, latitude, longitude, altitude, renomme,
            dependants_json, vol_json, cree_le, statut_sync, erreur
     FROM site_aerien_deplacement WHERE statut_sync = 'local' ORDER BY cree_le`
  );
}

export async function marquerDeplacementSynchronise(deplacementId: string): Promise<void> {
  const db = await getReferentielDb();
  const ligne = await db.getFirstAsync<{ site_id: string; dependants_json: string }>(
    'SELECT site_id, dependants_json FROM site_aerien_deplacement WHERE id = ?',
    [deplacementId]
  );
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE site_aerien_deplacement SET statut_sync = 'synced' WHERE id = ?", [deplacementId]);
    if (!ligne) return;
    const sites = [ligne.site_id, ...(JSON.parse(ligne.dependants_json) as string[])];
    for (const siteId of sites) {
      await db.runAsync("UPDATE site_aerien_position SET statut_sync = 'synced' WHERE site_id = ?", [siteId]);
    }
  });
}

export async function marquerDeplacementEnEchec(deplacementId: string): Promise<void> {
  const db = await getReferentielDb();
  await db.runAsync("UPDATE site_aerien_deplacement SET statut_sync = 'echec' WHERE id = ?", [deplacementId]);
}

// ==========================================================================
// Création groupée « principal + dépendants »
// ==========================================================================

export interface LotCreation {
  equipeId: string;
  principal: SiteSaisi;
  stand: SiteSaisi;
  baseSecondaire: SiteSaisi;
  /** Jour local `YYYY-MM-DD` ; injecté par les tests. */
  aujourdhui?: string;
}

export interface SitesCrees {
  principalId: string;
  standId: string | null;
  baseSecondaireId: string | null;
}

/**
 * Enregistre 1 à 3 sites d'un coup, hors-ligne. Le principal reçoit l'équipe de travail ; les
 * dépendants n'en ont pas et pointent vers lui (`ck_site_aerienne_equipe_coherente`). Un dépendant
 * « même position » reprend celle du principal. Tout le lot est refusé, sans écriture partielle, si
 * une règle n'est pas tenue.
 */
export async function creerSitesGroupes(lot: LotCreation): Promise<SitesCrees> {
  const erreurs = validerCreationGroupee(lot);
  if (erreurs.length > 0) refuser(erreurs);

  const jour = lot.aujourdhui ?? aujourdhuiParDefaut();
  const principalId = generateId();
  const standId = lot.stand.actif ? generateId() : null;
  const baseSecondaireId = lot.baseSecondaire.actif ? generateId() : null;

  const sites: { id: string; parent: string | null; site: SiteSaisi }[] = [
    { id: principalId, parent: null, site: lot.principal },
  ];
  if (standId) sites.push({ id: standId, parent: principalId, site: lot.stand });
  if (baseSecondaireId) sites.push({ id: baseSecondaireId, parent: principalId, site: lot.baseSecondaire });

  const db = await getReferentielDb();
  await db.withTransactionAsync(async () => {
    for (const { id, parent, site } of sites) {
      const position: PositionSaisie =
        parent !== null && site.memePositionQuePrincipal ? lot.principal.position : site.position;
      await insererSiteLocal(db, {
        id,
        parentId: parent,
        equipeId: parent === null ? lot.equipeId : null,
        numero: site.numero,
        localite: site.localite,
        position,
        jour,
      });
    }
  });

  return { principalId, standId, baseSecondaireId };
}

export interface SiteSecondaireDemande {
  /** Principal existant sur l'appareil, ou créé dans un lot précédent. */
  parentId: string;
  site: SiteSaisi;
  aujourdhui?: string;
}

/**
 * Crée un secondaire seul, rattaché à un principal déjà connu de l'appareil (#643). « Même position »
 * reprend celle du principal telle qu'elle est aujourd'hui, pas celle de sa création.
 */
export async function creerSiteSecondaire(demande: SiteSecondaireDemande): Promise<string> {
  const erreurs = validerSiteSecondaire(demande.site);
  if (erreurs.length > 0) refuser(erreurs);

  const db = await getReferentielDb();
  const parent = await db.getFirstAsync<Pick<SiteAerienLocal, 'id' | 'latitude' | 'longitude' | 'altitude'>>(
    'SELECT id, latitude, longitude, altitude FROM site_aerien WHERE id = ? AND parent_site_id IS NULL',
    [demande.parentId]
  );
  if (!parent) throw new PreconditionError('Le site principal est introuvable sur l’appareil. Synchronisez puis réessayez.');

  const id = generateId();
  const position: PositionSaisie = demande.site.memePositionQuePrincipal
    ? { latitude: parent.latitude, longitude: parent.longitude, altitude: parent.altitude }
    : demande.site.position;
  await db.withTransactionAsync(async () => {
    await insererSiteLocal(db, {
      id,
      parentId: parent.id,
      equipeId: null,
      numero: demande.site.numero,
      localite: demande.site.localite,
      position,
      jour: demande.aujourdhui ?? aujourdhuiParDefaut(),
    });
  });
  return id;
}

/** Une ligne `site_aerien` et sa position d'origine, toutes deux `'local'` : à envoyer. */
async function insererSiteLocal(
  db: Awaited<ReturnType<typeof getReferentielDb>>,
  site: {
    id: string;
    parentId: string | null;
    equipeId: string | null;
    numero: string;
    localite: string;
    position: PositionSaisie;
    jour: string;
  }
): Promise<void> {
  const { position } = site;
  await db.runAsync(
    `INSERT INTO site_aerien
       (id, parent_site_id, equipe_id, numero, localite, actif,
        latitude, longitude, altitude, date_debut_position, updated_at, statut_sync)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, 'local')`,
    [
      site.id,
      site.parentId,
      site.equipeId,
      site.numero.trim(),
      site.localite.trim(),
      position.latitude,
      position.longitude,
      position.altitude,
      site.jour,
      new Date().toISOString(),
    ]
  );
  await db.runAsync(
    `INSERT INTO site_aerien_position
       (id, site_id, latitude, longitude, altitude, date_debut, date_fin, localite, statut_sync)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?, 'local')`,
    [generateId(), site.id, position.latitude, position.longitude, position.altitude, site.jour, site.localite.trim()]
  );
}

// ==========================================================================
// Déplacement
// ==========================================================================

export interface VolMiseEnPlaceDemande extends VolMiseEnPlaceSaisi {
  equipeId: string;
}

export interface DeplacementDemande {
  siteId: string;
  numero: string;
  localite: string;
  position: PositionSaisie;
  /** Dépendants cochés « Déplacer aussi » — ils prennent la même position. */
  dependantIds: string[];
  /** Principal seulement : vol de mise en place facultatif de la même feuille. */
  vol: VolMiseEnPlaceDemande | null;
  aujourdhui?: string;
}

/**
 * Déplace le site et les dépendants cochés. Chaque site voit sa position active close à J-1 et une
 * nouvelle ouverte à J — sauf si l'active date d'aujourd'hui : elle est alors corrigée en place,
 * comme le serveur (`date_fin >= date_debut`). Un déplacement à envoyer est empilé, avec le vol.
 */
export async function deplacerSites(demande: DeplacementDemande): Promise<void> {
  const db = await getReferentielDb();
  const jour = demande.aujourdhui ?? aujourdhuiParDefaut();

  const site = await db.getFirstAsync<SiteAerienLocal>(
    `SELECT ${COLONNES_SITE} FROM site_aerien WHERE id = ?`,
    [demande.siteId]
  );
  if (!site) throw new PreconditionError('Ce site est introuvable sur l’appareil. Synchronisez puis réessayez.');

  const dependants = await db.getAllAsync<SiteAerienLocal>(
    `SELECT ${COLONNES_SITE} FROM site_aerien WHERE parent_site_id = ? AND actif = 1`,
    [demande.siteId]
  );
  const idsDependants = new Set(dependants.map((d) => d.id));
  const etranger = demande.dependantIds.find((id) => !idsDependants.has(id));
  if (etranger) refuser(['Un site coché ne dépend pas du site déplacé.']);

  const erreurs = validerDeplacement(demande);
  if (demande.vol) {
    erreurs.push(...validerVolMiseEnPlace(demande.vol, { nbStands: dependants.length }));
    if (demande.vol.standId && !idsDependants.has(demande.vol.standId)) {
      erreurs.push('Le stand choisi ne dépend pas du site déplacé.');
    }
  }
  if (erreurs.length > 0) refuser(erreurs);

  const deplacementId = generateId();
  const volJson = demande.vol
    ? JSON.stringify({
        id: generateId(),
        type: 'mise_en_place',
        equipe_id: demande.vol.equipeId,
        aeronef_id: demande.vol.aeronefId,
        date_vol: jour,
        heure_debut: demande.vol.debut,
        heure_fin: demande.vol.fin,
        site_principal_id: demande.siteId,
        stand_id: demande.vol.standId,
      })
    : null;

  const { latitude, longitude, altitude } = demande.position;
  const numero = demande.numero.trim();
  const localite = demande.localite.trim();
  const renomme = numero !== site.numero || localite !== site.localite ? 1 : 0;

  await db.withTransactionAsync(async () => {
    const cibles: SiteAerienLocal[] = [site, ...dependants.filter((d) => demande.dependantIds.includes(d.id))];
    for (const cible of cibles) {
      const estPrincipal = cible.id === site.id;
      const libelle = estPrincipal ? localite : cible.localite;
      await installerPositionLocale(db, cible, jour, { latitude, longitude, altitude }, libelle);
      await db.runAsync(
        `UPDATE site_aerien
         SET latitude = ?, longitude = ?, altitude = ?, date_debut_position = ?,
             numero = ?, localite = ?, updated_at = ?
         WHERE id = ?`,
        [
          latitude,
          longitude,
          altitude,
          jour,
          estPrincipal ? numero : cible.numero,
          libelle,
          new Date().toISOString(),
          cible.id,
        ]
      );
    }

    await db.runAsync(
      `INSERT INTO site_aerien_deplacement
         (id, site_id, numero, localite, latitude, longitude, altitude, renomme,
          dependants_json, vol_json, cree_le, statut_sync)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local')`,
      [
        deplacementId,
        demande.siteId,
        numero,
        localite,
        latitude,
        longitude,
        altitude,
        renomme,
        JSON.stringify(demande.dependantIds),
        volJson,
        new Date().toISOString(),
      ]
    );
  });
}

async function installerPositionLocale(
  db: Awaited<ReturnType<typeof getReferentielDb>>,
  site: SiteAerienLocal,
  jour: string,
  position: PositionSaisie,
  localite: string
): Promise<void> {
  const active = await db.getFirstAsync<{ id: string; date_debut: string; localite: string }>(
    `SELECT id, date_debut, localite FROM site_aerien_position WHERE site_id = ? AND date_fin IS NULL`,
    [site.id]
  );

  if (active && active.date_debut >= jour) {
    // Même jour : clore à J-1 violerait `date_fin >= date_debut`, on corrige la position ouverte.
    await db.runAsync(
      `UPDATE site_aerien_position
       SET latitude = ?, longitude = ?, altitude = ?, localite = ?, statut_sync = 'local'
       WHERE id = ?`,
      [position.latitude, position.longitude, position.altitude, localite, active.id]
    );
    return;
  }

  const veille = jourPrecedent(jour);
  if (active) {
    await db.runAsync(`UPDATE site_aerien_position SET date_fin = ?, statut_sync = 'local' WHERE id = ?`, [
      veille,
      active.id,
    ]);
  } else if (site.latitude !== null && site.longitude !== null && site.date_debut_position) {
    // Site issu du pull : le serveur connaît l'ancienne implantation, pas nous. On la garde en
    // historique pour que la durée et le parcours restent lisibles hors-ligne.
    if (site.date_debut_position < jour) {
      await db.runAsync(
        `INSERT INTO site_aerien_position
           (id, site_id, latitude, longitude, altitude, date_debut, date_fin, localite, statut_sync)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
        [
          generateId(),
          site.id,
          site.latitude,
          site.longitude,
          site.altitude,
          site.date_debut_position,
          veille,
          site.localite,
        ]
      );
    }
  }

  await db.runAsync(
    `INSERT INTO site_aerien_position
       (id, site_id, latitude, longitude, altitude, date_debut, date_fin, localite, statut_sync)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?, 'local')`,
    [generateId(), site.id, position.latitude, position.longitude, position.altitude, jour, localite]
  );
}
