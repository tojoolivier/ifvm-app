/**
 * Démarrage de l'application — premiers clients de `runTask({ criticality:
 * 'essential' })`.
 *
 * Ces deux tâches étaient des **promesses flottantes** dans `_layout.tsx` : un
 * échec de migration SQLite au lancement n'avait aucun capteur, l'app
 * continuait avec une base inutilisable et l'agent découvrait le problème à la
 * première saisie perdue.
 *
 * La logique vit ici, hors du composant, pour être testable sans moteur de
 * rendu — `_layout.tsx` se contente de l'appeler.
 */
import { runTask, type TaskOutcome } from './run-task';

export interface StartupDeps {
  /** Ouvre la base et joue les migrations. */
  ouvrirBase: () => Promise<unknown>;
  /** Relit la préférence « mode debug » depuis le stockage local. */
  initDebug: () => Promise<unknown>;
  /** Pose le handler d'exceptions JS globales. */
  installerFiletGlobal: () => void;
}

export interface StartupOutcome {
  base: TaskOutcome<unknown>;
  debug: TaskOutcome<unknown>;
}

/**
 * Les deux tâches sont `essential` : elles lisent le stockage de l'appareil.
 * Si l'une échoue, ce n'est pas un incident isolé — c'est le signe que tout ce
 * que l'agent saisira ensuite sera perdu, et il doit en être informé.
 *
 * Elles sont indépendantes et tournent donc en parallèle ; `runTask` ne
 * rejetant jamais, `Promise.all` ne peut pas court-circuiter l'une des deux.
 */
export async function demarrerApp(deps: StartupDeps): Promise<StartupOutcome> {
  const [base, debug] = await Promise.all([
    runTask(deps.ouvrirBase, { name: 'startup.db', criticality: 'essential' }),
    runTask(deps.initDebug, { name: 'startup.debug', criticality: 'essential' }),
  ]);

  // Posé quoi qu'il arrive : c'est précisément quand le démarrage se passe mal
  // qu'on a besoin du filet.
  deps.installerFiletGlobal();

  return { base, debug };
}
