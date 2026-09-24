import * as SQLite from 'expo-sqlite';
import { AppError, LocalReadError, LocalWriteError } from './errors';
import { appliquerMigrations } from './db-migrations';
import { logger } from './logger';
import { MIGRATIONS_CAPTURES } from './migrations-captures';

const DB_NAME = 'ifvm.db';

const log = logger.child({ module: 'prospection-db' });

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/** Ouvre (et migre au besoin) la base locale, en la mémorisant entre appels. */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openAndMigrate();
  }
  return dbPromise;
}

/** Réservé aux tests : force la réouverture de la base au prochain `getDb()`. */
export function resetDbForTests(): void {
  dbPromise = null;
}

/**
 * Ouverture et migration — le point du mobile où un silence coûte le plus cher.
 *
 * ADR-012 décision 2 : tout échec ici devient `LocalWriteError`. La classe
 * n'est pas un détail de journal, c'est ce qui décide du traitement — BLOQUER
 * plutôt qu'INFORMER — parce qu'une base non migrée signifie que **la saisie à
 * venir sera perdue**, pas seulement que la précédente est illisible.
 */
async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  let db: SQLite.SQLiteDatabase;

  try {
    db = await SQLite.openDatabaseAsync(DB_NAME);
  } catch (error) {
    throw new LocalWriteError(
      `Ouverture de la base locale ${DB_NAME} impossible`,
      { cause: error }
    );
  }

  // Réglages de connexion : hors transaction, donc hors des migrations.
  try {
    await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  } catch (error) {
    throw new LocalWriteError('Réglage de la base locale impossible', { cause: error });
  }

  await appliquerMigrations(db, MIGRATIONS_CAPTURES);

  log.event('db.ouverte', { base: DB_NAME });

  // La migration a tourné sur le handle nu, pour garder ses messages d'échec
  // à elle ; les dépôts reçoivent le handle typé.
  return typerLesEchecs(db);
}

/**
 * Quelle classe du jeu fermé porte l'échec de quelle méthode SQLite.
 *
 * Une lecture ratée est `LocalReadError` : la donnée est déjà perdue, l'agent
 * n'a aucun recours. Une écriture ratée est `LocalWriteError` : l'agent est en
 * train de saisir et **perdra tout** s'il continue — d'où un traitement
 * BLOQUER là où la lecture se contente d'INFORMER (ADR-012 décision 3).
 */
type ConstructeurErreur = new (
  message: string,
  options?: { cause?: unknown }
) => AppError;

const CLASSE_PAR_METHODE: Record<string, ConstructeurErreur | undefined> = {
  getAllAsync: LocalReadError,
  getFirstAsync: LocalReadError,
  runAsync: LocalWriteError,
  execAsync: LocalWriteError,
  withTransactionAsync: LocalWriteError,
};

/**
 * Rend un handle qui type ses propres échecs.
 *
 * Les dépôts font une centaine d'appels SQLite **sans un seul `try`** : les
 * typer un par un, c'était cent occasions d'en oublier un — et un oubli ne se
 * voit pas, il produit juste un `(bug)` de plus dans le journal et un
 * « Signaler au support » là où l'agent méritait « Réessayer d'enregistrer ».
 * Le typage vit donc au seul endroit par lequel tous passent.
 *
 * **Le `this` de chaque méthode reste la vraie base**, y compris pour celles
 * qu'on n'enveloppe pas. Ce n'est pas une précaution de principe : lu dans
 * `node_modules/expo-sqlite`, `closeAsync()` fait
 * `unregisterDatabaseForDevToolsAsync(this)`, et un `this` valant l'enveloppe
 * au lieu de la base ne correspondrait à aucune entrée du registre. Le défaut
 * serait resté invisible — il est gardé par `__DEV__`, et **tous les tests
 * mockent `expo-sqlite` par des objets nus**, donc aucun n'aurait pu l'attraper.
 * C'est le motif que ce dépôt collectionne : du code d'apparence correcte que
 * rien n'exerce.
 *
 * Un `Proxy` plutôt qu'un `Object.create` : il lie le récepteur une fois pour
 * toutes, au lieu de laisser chaque méthode non listée hériter du mauvais.
 */
function typerLesEchecs(db: SQLite.SQLiteDatabase): SQLite.SQLiteDatabase {
  return new Proxy(db, {
    get(base, propriete) {
      const membre = Reflect.get(base, propriete, base) as unknown;

      if (typeof membre !== 'function') return membre;

      const appel = membre as (...a: unknown[]) => unknown;
      const Classe = CLASSE_PAR_METHODE[propriete as string];

      // Méthode hors du tableau : rendue telle quelle, mais liée à la base.
      if (!Classe) return appel.bind(base);

      return async (...args: unknown[]): Promise<unknown> => {
        try {
          return await appel.apply(base, args);
        } catch (error) {
          // Déjà typée : c'est le cas d'un `withTransactionAsync` dont le
          // rappel lève une `PreconditionError`. La réenvelopper ferait lire
          // « impossible d'enregistrer » à la place du message écrit pour
          // l'agent.
          if (error instanceof AppError) throw error;

          throw new Classe(`${String(propriete)} a échoué sur la base locale`, {
            cause: error,
          });
        }
      };
    },
  });
}
