/**
 * Démarrage de l'application — premiers clients de `runTask({ criticality:
 * 'essential' })`.
 *
 * `getDb()` et `useDebugStore.init()` étaient des **promesses flottantes** dans
 * `_layout.tsx` : un échec de migration SQLite au lancement n'avait aucun
 * capteur, l'app continuait avec une base inutilisable et l'agent découvrait le
 * problème à la première saisie perdue.
 *
 * La logique vit ici, hors du composant, pour être testable sans moteur de
 * rendu. Le composant garde ce qui lui revient : brancher le résultat sur ce
 * que l'agent voit.
 */
import { runTask, type TaskOutcome } from './run-task';

export interface StartupDeps {
  /** Ouvre la base et joue les migrations. */
  ouvrirBase: () => Promise<unknown>;
  /** Relit la préférence « mode debug » depuis le stockage local. */
  initDebug: () => Promise<unknown>;
  /** Applique la rétention du journal — ADR-012 décision 4. */
  purgerJournal: () => Promise<unknown>;
}

export interface StartupOutcome {
  base: TaskOutcome<unknown>;
  debug: TaskOutcome<unknown>;
  journal: TaskOutcome<unknown>;
}

/**
 * Les deux tâches sont `essential` : elles lisent le stockage de l'appareil.
 * Si l'une échoue, ce n'est pas un incident isolé — c'est le signe que tout ce
 * que l'agent saisira ensuite sera perdu, et il doit en être informé.
 *
 * Elles sont indépendantes et tournent donc en parallèle ; `runTask` ne
 * rejetant jamais, `Promise.all` ne peut ni court-circuiter l'une des deux ni
 * faire rejeter `demarrerApp`.
 */
export async function demarrerApp(deps: StartupDeps): Promise<StartupOutcome> {
  const [base, debug] = await Promise.all([
    runTask(deps.ouvrirBase, { name: 'startup.db', criticality: 'essential' }),
    runTask(deps.initDebug, { name: 'startup.debug', criticality: 'essential' }),
  ]);

  // Après, et non en parallèle : la rétention des `detail` dépend du flag de
  // verbosité, que `initDebug` vient tout juste de relire. Purger avant, ce
  // serait purger selon la verbosité de la session précédente.
  //
  // `best-effort` : une purge ratée ne coûte que du stockage, jamais une
  // saisie. L'annoncer à l'agent l'inquiéterait pour rien — le journal, lui,
  // en garde la trace.
  const journal = await runTask(deps.purgerJournal, {
    name: 'startup.journal.purge',
    criticality: 'best-effort',
  });

  return { base, debug, journal };
}

/**
 * Le message d'un démarrage manqué, ou `null` si tout s'est ouvert.
 *
 * Un seul message pour les deux tâches : la cause technique diffère, la
 * conséquence terrain non — le stockage de l'appareil ne répond pas, et c'est
 * la saisie à venir qui est en jeu. Le détail par tâche est dans le journal.
 */
export function messageDeDemarrageManque(outcome: StartupOutcome): string | null {
  if (outcome.base.ok && outcome.debug.ok) return null;

  return 'Le stockage de l’appareil n’a pas pu être ouvert. Vos saisies risquent de ne pas être enregistrées — prévenez le support avant de continuer.';
}
