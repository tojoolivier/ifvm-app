/**
 * `runTask` — troisième frontière de capture d'ADR-012 (décisions 1 et 3).
 *
 * Couvre la **tâche de fond** : ce qui part d'un `useEffect`, d'un timer ou
 * d'un abonnement, et que ni `useAsyncAction` (geste de l'agent) ni
 * `ErrorBoundary` (rendu React) ne voient passer. C'est le seul endroit du
 * mobile où une promesse peut légitimement flotter — parce qu'elle ne flotte
 * plus : `runTask` ne rejette jamais.
 *
 * **Il n'y a rien derrière cette frontière.** #160 a établi qu'aucun filet
 * global n'existe en release : ce qui n'est pas capturé ici disparaît sans
 * trace. D'où l'absence totale d'échappatoire — pas de niveau `silent`, pas de
 * `try/finally` sans `catch`, pas de valeur de retour indiscernable d'un
 * succès.
 */
import { logger, type Traitement } from './logger';

/**
 * **Obligatoire, sans valeur par défaut.**
 *
 * Les deux colonnes `runTask` de la matrice sont plates : au fond, c'est la
 * criticité de la *tâche* qui décide du traitement, pas la nature de l'erreur —
 * le même `NetworkError` est bénin pendant l'auto-sync du référentiel et grave
 * à l'ouverture de la base. Un défaut choisirait à la place du développeur ;
 * l'exiger force la prononciation, et la rend visible en revue.
 */
export type Criticality = 'best-effort' | 'essential';

export interface TaskOptions {
  /**
   * Nom de la tâche, en notation pointée (`sync.referentiel`, `startup.db`).
   * L'échec est journalisé sous `<name>.failed` — c'est ce qui rend le journal
   * greppable.
   */
  name: string;
  criticality: Criticality;
  /** Contexte figé, joint à chaque ligne de journal de la tâche. */
  context?: Record<string, unknown>;
}

/**
 * Le résultat **dit** l'échec.
 *
 * Décision 1 : il est interdit de retourner une valeur indiscernable d'un
 * succès (`null`, `true`, `[]`). Une union discriminée oblige l'appelant à
 * regarder `ok` avant de lire `value`, et transporte le `traitement` déduit
 * jusqu'à la couche d'affichage.
 */
export type TaskOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; error: unknown; traitement: Traitement };

/**
 * Exécute `job` derrière la frontière : journalise tout échec, n'en avale
 * aucun, et ne rejette jamais.
 *
 * @example
 * void runTask(() => syncReferentiel(), {
 *   name: 'sync.referentiel',
 *   criticality: 'best-effort',
 * });
 */
export async function runTask<T>(
  job: () => T | Promise<T>,
  { name, criticality, context = {} }: TaskOptions
): Promise<TaskOutcome<T>> {
  const log = logger.child({ task: name, ...context }, `runTask:${criticality}`);

  try {
    // `job()` est appelé DANS le `try` : une exception synchrone levée avant le
    // premier `await` traverserait sinon la frontière.
    return { ok: true, value: await job() };
  } catch (error) {
    const traitement = log.failure(`${name}.failed`, error);
    return { ok: false, error, traitement };
  }
}
