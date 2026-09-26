import type { components } from './api-schema.generated';
import { getDb } from './db';
import { PreconditionError } from './errors';
import { generateId } from './id';
import { creerOutbox } from './outbox';

/**
 * Fiches de prospection locales (#722) : brouillon, envoi, reprise, revalidation.
 *
 * Tous les types viennent du contrat OpenAPI (`api-schema.generated.ts`) : le stockage garde le
 * corps JSON de `ProspectionCreate` et de ses listes (cf. `prospection-schema.ts`), donc ce qui part
 * au serveur est exactement ce que l'écran a saisi. Pas de migration depuis l'ancien module (#726).
 */
type Schemas = components['schemas'];

export type StatutProspection = Schemas['StatutProspection'];
export type ProspectionCreate = Schemas['ProspectionCreate'];
export type ProspectionRead = Schemas['ProspectionRead'];
export type PopulationCreate = Schemas['PopulationCreate'];
export type CaptureCreate = Schemas['CaptureCreate'];
export type InfestationCreate = Schemas['InfestationCreate'];
export type OperationAerienneCreate = Schemas['OperationAerienneCreate'];

/** Ce que l'écran saisit : le contrat, sans l'identifiant (donné à la création) ni le statut (géré ici). */
export type SaisieProspection = Omit<ProspectionCreate, 'id' | 'statut'> & { id?: string };

/** Ce que le stockage porte à part : l'état de la fiche, jamais saisi. */
export interface FicheLocale {
  /** Le corps tel qu'il partira au serveur (`id` et `statut` compris). */
  fiche: ProspectionCreate & { id: string };
  statut_sync: 'local' | 'synced' | 'echec' | 'conflict';
  validated_at: string | null;
  server_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResumeFiche {
  id: string;
  type_prospection: Schemas['TypeProspection'];
  n_fiche: string | null;
  date_prospection: string;
  statut: StatutProspection;
  statut_sync: FicheLocale['statut_sync'];
  revalide_de_id: string | null;
  validated_at: string | null;
  updated_at: string;
}

/** #revalidation-prospection : doit rester égal à `DELAI_REVALIDATION_JOURS` (backend/app/domain/prospection.py). */
export const DELAI_REVALIDATION_JOURS = 5;
/** Comme le serveur : l'intensive n'est jamais soumise à revalidation. */
const TYPES_SOUMIS_REVALIDATION = ['extensive', 'validation'] as const;
export const SUFFIXE_NUMERO_REVALIDATION = '-bis';

const outbox = creerOutbox({ table: 'prospection', base: getDb, horodate: true });
export const marquerProspectionEnEchec = outbox.marquerEnEchec;

const LISTES = [
  { cle: 'populations', table: 'prospection_population', cles: ['espece', 'categorie'] },
  { cle: 'captures', table: 'prospection_capture', cles: ['espece'] },
  { cle: 'infestations', table: 'prospection_infestation', cles: ['type_cible'] },
  { cle: 'operations_aeriennes', table: 'prospection_operation_aerienne', cles: ['type_operation'] },
] as const;

type ClesListes = (typeof LISTES)[number]['cle'];
type CorpsStocke = Omit<ProspectionCreate, ClesListes | 'id' | 'statut'>;

type Db = Awaited<ReturnType<typeof getDb>>;

interface LigneProspection {
  id: string;
  statut: StatutProspection;
  statut_sync: FicheLocale['statut_sync'];
  revalide_de_id: string | null;
  vol_id: string | null;
  validated_at: string | null;
  server_updated_at: string | null;
  corps: string;
  created_at: string;
  updated_at: string;
}

async function ecrireFiche(
  db: Db,
  fiche: ProspectionCreate & { id: string },
  etat: { statut_sync: FicheLocale['statut_sync']; validated_at?: string | null; server_updated_at?: string | null },
  maintenant: string
): Promise<void> {
  const { id, statut, populations, captures, infestations, operations_aeriennes, ...corps } = fiche;
  const listes = { populations, captures, infestations, operations_aeriennes };

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO prospection
         (id, type_prospection, campagne_id, equipe_id, station_id, n_fiche, date_prospection, statut,
          statut_sync, revalide_de_id, vol_id, validated_at, server_updated_at, corps, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         type_prospection = excluded.type_prospection, campagne_id = excluded.campagne_id,
         equipe_id = excluded.equipe_id, station_id = excluded.station_id, n_fiche = excluded.n_fiche,
         date_prospection = excluded.date_prospection, statut = excluded.statut,
         statut_sync = excluded.statut_sync, revalide_de_id = excluded.revalide_de_id,
         vol_id = excluded.vol_id, validated_at = excluded.validated_at,
         server_updated_at = excluded.server_updated_at, corps = excluded.corps,
         updated_at = excluded.updated_at`,
      [
        id,
        fiche.type_prospection,
        fiche.campagne_id,
        fiche.equipe_id,
        fiche.station_id ?? null,
        fiche.n_fiche ?? null,
        fiche.date_prospection,
        statut,
        etat.statut_sync,
        fiche.revalide_de_id ?? null,
        fiche.vol_id ?? null,
        etat.validated_at ?? null,
        etat.server_updated_at ?? null,
        JSON.stringify(corps satisfies CorpsStocke),
        maintenant,
        maintenant,
      ]
    );

    for (const { cle, table, cles } of LISTES) {
      await db.runAsync(`DELETE FROM ${table} WHERE prospection_id = ?`, [id]);
      const lignes = (listes[cle] ?? []) as Record<string, unknown>[];
      for (const [position, ligne] of lignes.entries()) {
        await db.runAsync(
          `INSERT INTO ${table} (prospection_id, position, ${cles.join(', ')}, corps)
           VALUES (?, ?, ${cles.map(() => '?').join(', ')}, ?)`,
          [id, position, ...cles.map((c) => String(ligne[c] ?? '')), JSON.stringify(ligne)]
        );
      }
    }
  });
}

async function lireFiche(db: Db, ligne: LigneProspection): Promise<FicheLocale> {
  const listes: Record<string, unknown[]> = {};
  for (const { cle, table } of LISTES) {
    const lignes = await db.getAllAsync<{ corps: string }>(
      `SELECT corps FROM ${table} WHERE prospection_id = ? ORDER BY position`,
      [ligne.id]
    );
    listes[cle] = lignes.map((l) => JSON.parse(l.corps));
  }
  return {
    fiche: {
      ...(JSON.parse(ligne.corps) as CorpsStocke),
      ...listes,
      id: ligne.id,
      statut: ligne.statut,
      revalide_de_id: ligne.revalide_de_id,
      vol_id: ligne.vol_id,
    } as ProspectionCreate & { id: string },
    statut_sync: ligne.statut_sync,
    validated_at: ligne.validated_at,
    server_updated_at: ligne.server_updated_at,
    created_at: ligne.created_at,
    updated_at: ligne.updated_at,
  };
}

async function ligneDe(db: Db, id: string): Promise<LigneProspection | null> {
  return db.getFirstAsync<LigneProspection>('SELECT * FROM prospection WHERE id = ?', [id]);
}

export async function getFiche(id: string): Promise<FicheLocale | null> {
  const db = await getDb();
  const ligne = await ligneDe(db, id);
  return ligne ? lireFiche(db, ligne) : null;
}

/**
 * Crée le brouillon, ou met à jour celui qu'on reprend (`saisie.id`). Écrire hors-ligne suffit :
 * rien ne part avant `soumettreFiche`. Une fiche déjà soumise ne se modifie plus.
 */
export async function enregistrerBrouillon(saisie: SaisieProspection): Promise<string> {
  const db = await getDb();
  const id = saisie.id ?? generateId();
  const existante = saisie.id ? await ligneDe(db, id) : null;

  if (saisie.id && !existante) throw new PreconditionError(`Brouillon ${id} introuvable sur cet appareil.`);
  if (existante && existante.statut !== 'brouillon') {
    throw new PreconditionError('Cette fiche est déjà soumise : elle ne peut plus être modifiée.');
  }

  await ecrireFiche(db, { ...saisie, id, statut: 'brouillon' }, { statut_sync: 'local' }, new Date().toISOString());
  if (existante) {
    // `created_at` n'est pas celui de la reprise.
    await db.runAsync('UPDATE prospection SET created_at = ? WHERE id = ?', [existante.created_at, id]);
  }
  return id;
}

/** Le brouillon devient une fiche à envoyer : `en_attente`, elle entre dans la file de synchronisation. */
export async function soumettreFiche(id: string): Promise<void> {
  const db = await getDb();
  const ligne = await ligneDe(db, id);
  if (!ligne) throw new PreconditionError(`Fiche ${id} introuvable sur cet appareil.`);
  if (ligne.statut !== 'brouillon') throw new PreconditionError('Cette fiche est déjà soumise.');
  await db.runAsync(
    "UPDATE prospection SET statut = 'en_attente', statut_sync = 'local', updated_at = ? WHERE id = ?",
    [new Date().toISOString(), id]
  );
}

/** Seul un brouillon se supprime : ce qui est connu du serveur ne se perd pas par un geste local. */
export async function supprimerBrouillon(id: string): Promise<void> {
  const db = await getDb();
  const ligne = await ligneDe(db, id);
  if (!ligne) return;
  if (ligne.statut !== 'brouillon') throw new PreconditionError('Seul un brouillon peut être supprimé.');
  await db.runAsync('DELETE FROM prospection WHERE id = ?', [id]);
}

const COLONNES_RESUME = `id, type_prospection, n_fiche, date_prospection, statut, statut_sync,
       revalide_de_id, validated_at, updated_at`;

/** Toutes les fiches de l'appareil, les plus récentes d'abord. */
export async function listerFiches(filtre: { statut?: StatutProspection } = {}): Promise<ResumeFiche[]> {
  const db = await getDb();
  const ou = filtre.statut ? 'WHERE statut = ?' : '';
  return db.getAllAsync<ResumeFiche>(
    `SELECT ${COLONNES_RESUME} FROM prospection ${ou} ORDER BY date_prospection DESC, updated_at DESC`,
    filtre.statut ? [filtre.statut] : []
  );
}

export const listerBrouillons = () => listerFiches({ statut: 'brouillon' });

/** La file d'envoi : fiches soumises que le serveur n'a pas encore acceptées (ni refusées). */
export async function listerEnAttenteEnvoi(): Promise<FicheLocale[]> {
  const db = await getDb();
  const lignes = await db.getAllAsync<LigneProspection>(
    "SELECT * FROM prospection WHERE statut != 'brouillon' AND statut_sync = 'local' ORDER BY created_at"
  );
  return Promise.all(lignes.map((l) => lireFiche(db, l)));
}

/**
 * Le serveur a accepté la fiche : on reporte son statut et `validated_at` (une revalidation ou une
 * fiche de validation naît déjà `validee` côté serveur, l'appareil ne peut pas le deviner).
 */
export async function appliquerRetourServeur(
  id: string,
  retour: { statut: string; validated_at: string | null }
): Promise<void> {
  const db = await getDb();
  const maintenant = new Date().toISOString();
  await db.runAsync(
    `UPDATE prospection SET statut = ?, validated_at = ?, statut_sync = 'synced',
       server_updated_at = ?, updated_at = ? WHERE id = ?`,
    [retour.statut, retour.validated_at, maintenant, maintenant, id]
  );
}

/** Fiches `validee` : ce que le traitement peut consommer hors ligne (la péremption est jugée en ligne). */
export async function listerDisponiblesPourTraitement(): Promise<ResumeFiche[]> {
  return listerFiches({ statut: 'validee' });
}

/**
 * Repli hors ligne de `GET /prospections?a_revalider=true` — même règle que le serveur : extensive ou
 * validation validée depuis plus de 5 jours, sans traitement, sans revalidation confirmée. Un
 * brouillon de revalidation ne compte pas (l'agent peut le reprendre).
 */
export async function listerARevalider(maintenant: Date = new Date()): Promise<ResumeFiche[]> {
  const db = await getDb();
  const seuil = new Date(maintenant.getTime() - DELAI_REVALIDATION_JOURS * 86_400_000).toISOString();
  return db.getAllAsync<ResumeFiche>(
    `SELECT ${COLONNES_RESUME} FROM prospection p
     WHERE p.type_prospection IN (${TYPES_SOUMIS_REVALIDATION.map(() => '?').join(', ')})
       AND p.validated_at IS NOT NULL AND julianday(p.validated_at) < julianday(?)
       AND NOT EXISTS (SELECT 1 FROM traitement t WHERE t.prospection_id = p.id)
       AND NOT EXISTS (SELECT 1 FROM prospection e WHERE e.revalide_de_id = p.id AND e.statut != 'brouillon')
     ORDER BY p.date_prospection DESC`,
    [...TYPES_SOUMIS_REVALIDATION, seuil]
  );
}

export function numeroDeRevalidation(numeroSource: string | null | undefined): string | null {
  return numeroSource ? `${numeroSource}${SUFFIXE_NUMERO_REVALIDATION}` : null;
}

/**
 * Crée le brouillon de revalidation par clonage complet de l'origine, sauf : identifiant, statut,
 * `validated_at` (c'est justement son ancienneté qui déclenche la revalidation), `vol_id` (le vol de
 * l'origine n'est pas celui d'aujourd'hui) et la date, remise à aujourd'hui. Les numéros gardent
 * « -bis ». Le brouillon jumeau existant est repris au lieu d'échouer sur l'unicité.
 */
export async function creerRevalidation(origineId: string, maintenant: Date = new Date()): Promise<string> {
  const db = await getDb();
  const enfant = await db.getFirstAsync<{ id: string; statut: StatutProspection }>(
    'SELECT id, statut FROM prospection WHERE revalide_de_id = ?',
    [origineId]
  );
  if (enfant?.statut === 'brouillon') return enfant.id;
  if (enfant) throw new PreconditionError('Cette fiche a déjà été revalidée.');

  const origine = await getFiche(origineId);
  if (!origine) {
    throw new PreconditionError(`Fiche ${origineId} introuvable sur cet appareil — à récupérer avant de la revalider.`);
  }

  const { id: _id, statut: _statut, ...clone } = origine.fiche;
  return enregistrerBrouillon({
    ...clone,
    revalide_de_id: origineId,
    vol_id: null,
    date_prospection: maintenant.toISOString().slice(0, 10),
    n_fiche: numeroDeRevalidation(clone.n_fiche),
    n_message: numeroDeRevalidation(clone.n_message),
  });
}

/** Champs de `*Read` que le contrat `*Create` n'a pas : à retirer avant de renvoyer une fiche au serveur. */
function versCreate<T extends { id?: unknown }>(ligne: T): Omit<T, 'id' | 'numero' | 'duree_minutes'> {
  const { id: _id, numero: _numero, duree_minutes: _duree, ...reste } = ligne as T & {
    numero?: unknown;
    duree_minutes?: unknown;
  };
  return reste;
}

/**
 * Matérialise sur l'appareil une fiche lue en ligne (créée sur un AUTRE appareil) pour la cloner ou
 * la lire hors ligne. N'écrase jamais une fiche déjà locale : un brouillon en cours reste intact.
 * Retourne vrai si la fiche a été écrite.
 */
export async function enregistrerDepuisServeur(lue: ProspectionRead): Promise<boolean> {
  const db = await getDb();
  if (await ligneDe(db, lue.id)) return false;

  const {
    prospecteur_id: _p, statut_sync: _s, created_at: _c, updated_at: _u, verified_by: _vb, verified_at: _va,
    validated_by: _vd, validated_at, prospecteur_nom: _pn, verified_by_nom: _vn, validated_by_nom: _dn,
    ...reste
  } = lue;

  const fiche = {
    ...reste,
    populations: (lue.populations ?? []).map(versCreate),
    captures: (lue.captures ?? []).map(versCreate),
    infestations: (lue.infestations ?? []).map(versCreate),
    operations_aeriennes: (lue.operations_aeriennes ?? []).map(versCreate),
  } as unknown as ProspectionCreate & { id: string };

  const maintenant = new Date().toISOString();
  await ecrireFiche(db, fiche, { statut_sync: 'synced', validated_at, server_updated_at: maintenant }, maintenant);
  return true;
}
