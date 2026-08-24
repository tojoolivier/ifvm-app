/**
 * Le store des erreurs visibles — ADR-012 décision 5, issue #172.
 *
 * L'ancienne version gardait une seule erreur (`current: GlobalError | null`)
 * et l'écrasait à chaque nouvelle. Autrement dit : le dispositif chargé de
 * rendre les erreurs visibles en avalait une sur deux, en silence. C'est
 * exactement la famille de bugs qu'ADR-012 éradique.
 *
 * Le remplacement tient en trois règles :
 *
 * - **Une entrée par classe.** Cinq échecs réseau ne font pas cinq bannières
 *   empilées — ils font une bannière qui dit « cinq ». La classe est la bonne
 *   clé de regroupement parce que c'est déjà elle qui décide du message, de
 *   l'action et du traitement : deux erreurs de même classe sont, du point de
 *   vue de l'agent, la même erreur.
 * - **La plus grave est montrée, les autres sont comptées.** Jamais jetées :
 *   « +N autres › » mène au journal, où elles sont toutes.
 * - **`JOURNAL` n'entre pas.** Le traitement dit déjà que l'agent n'a rien à
 *   voir ; le laisser entrer ferait une bannière que la matrice interdit.
 */
import { create } from 'zustand';
import { toFriendlyError, type ActionErreur } from './friendly-error';
import { traitementDe, type Frontiere, type Traitement } from './logger';

export interface GlobalError {
  /** Clé de dédoublonnage : nom de la classe typée, ou `(bug)`. */
  classe: string;
  message: string;
  detail: string | null;
  action: ActionErreur | null;
  /** `BLOQUER` ou `INFORMER` — `JOURNAL` n'atteint jamais ce store. */
  traitement: Exclude<Traitement, 'JOURNAL'>;
  /** Nombre de signalements fusionnés depuis la dernière fermeture. */
  occurrences: number;
  /** Horodatage du dernier signalement, en millisecondes. */
  vueA: number;
  /** Reprise de l'action d'origine, quand la frontière en fournit une. */
  retry?: () => void;
}

interface ErrorState {
  erreurs: GlobalError[];
}

interface ErrorActions {
  /**
   * Signale une erreur et renvoie le traitement déduit, pour que la frontière
   * sache ce qu'elle a déclenché. Retourne `JOURNAL` sans rien stocker quand
   * l'erreur ne doit pas s'afficher.
   */
  signaler: (error: unknown, frontiere: Frontiere, retry?: () => void) => Traitement;
  /** Ferme une classe d'erreur. Les autres restent affichées. */
  dismiss: (classe: string) => void;
  dismissAll: () => void;
}

const RANG: Record<GlobalError['traitement'], number> = { BLOQUER: 1, INFORMER: 0 };

/**
 * La plus grave des erreurs ouvertes, ou `null`.
 *
 * L'ordre est **le traitement d'abord, la récence ensuite**. Pas de table de
 * gravité par classe : le traitement est déjà la mesure de l'insistance due à
 * l'agent (décision 3), en ajouter une seconde créerait deux vérités à tenir
 * d'accord. À traitement égal, la plus récente est celle qui décrit ce que
 * l'agent vient de faire.
 */
export function laPlusGrave(erreurs: readonly GlobalError[]): GlobalError | null {
  return erreurs.reduce<GlobalError | null>((meilleure, e) => {
    if (!meilleure) return e;
    if (RANG[e.traitement] !== RANG[meilleure.traitement]) {
      return RANG[e.traitement] > RANG[meilleure.traitement] ? e : meilleure;
    }
    return e.vueA >= meilleure.vueA ? e : meilleure;
  }, null);
}

/**
 * Le N de « +N autres › » : les **classes** restantes, pas les occurrences.
 * L'agent compte des problèmes distincts, pas des répétitions du même.
 */
export function autresQueLaPlusGrave(erreurs: readonly GlobalError[]): number {
  return Math.max(0, erreurs.length - 1);
}

export const useErrorStore = create<ErrorState & ErrorActions>((set) => ({
  erreurs: [],

  signaler: (error, frontiere, retry) => {
    const traitement = traitementDe(error, frontiere);
    if (traitement === 'JOURNAL') return traitement;

    const { classe, message, detail, action } = toFriendlyError(error);

    set((state) => {
      const existante = state.erreurs.find((e) => e.classe === classe);
      const fusionnee: GlobalError = {
        classe,
        message,
        detail,
        action,
        traitement,
        occurrences: (existante?.occurrences ?? 0) + 1,
        vueA: Date.now(),
        // Le dernier `retry` gagne : c'est celui du geste que l'agent vient de
        // faire. Rejouer le premier des cinq le renverrait dans le passé.
        retry: retry ?? existante?.retry,
      };
      return {
        erreurs: existante
          ? state.erreurs.map((e) => (e.classe === classe ? fusionnee : e))
          : [...state.erreurs, fusionnee],
      };
    });

    return traitement;
  },

  dismiss: (classe) => set((state) => ({ erreurs: state.erreurs.filter((e) => e.classe !== classe) })),

  dismissAll: () => set({ erreurs: [] }),
}));
