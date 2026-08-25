/**
 * Filet global des rejets de promesse — ADR-012 décision 8, issue #178.
 *
 * Quatrième et dernière frontière de capture : ce qui n'a traversé ni
 * `useAsyncAction`, ni `ErrorBoundary`, ni `runTask`, et qui n'est pas non plus
 * une exception synchrone — donc hors de portée d'`ErrorUtils`.
 *
 * ## Pourquoi nos propres options, et pas celles de RN/Expo
 *
 * Les options par défaut enveloppent le rejet dans `new Error(…, { cause })`.
 * Vu par `instanceof`, **tout rejet serait alors classé `(bug)`** alors que la
 * classe typée est dans `.cause` — le jeu fermé de sept classes deviendrait
 * muet à cette frontière précise.
 *
 * ## Ce que le relevé de #166 a établi, sur build release
 *
 * Le tracker existe, tire, et transmet l'erreur **d'origine** — non enveloppée.
 * Les délais mesurés côté Hermes sont de **2015 ms** pour une `Error` ordinaire
 * et **228 ms** pour `TypeError` / `ReferenceError` / `RangeError`. Les sept
 * classes d'ADR-012 héritant toutes d'`Error`, c'est 2015 ms qui s'applique en
 * pratique — le chemin rapide ne concerne que les bugs de programmation.
 *
 * ## Journal immédiat, affichage différé
 *
 * Le journal est écrit **dès `onUnhandled`** : Hermes a déjà attendu, rien ne
 * justifie d'attendre plus pour tracer. L'affichage, lui, attend
 * {@link DELAI_AFFICHAGE_MS}, annulable par `onHandled`.
 *
 * Ce délai ne protège pas d'un retard d'Hermes ; il protège d'un `.catch()`
 * attaché tardivement, qui rendrait la bannière mensongère. Il existe parce que
 * la bannière de la décision 5 **ne disparaît pas seule** : ne pouvant pas se
 * rétracter, elle ne doit pas s'afficher trop tôt.
 */
import { logger } from './logger';
import { useErrorStore } from './error-store';

/**
 * Délai avant affichage, annulable par `onHandled`.
 *
 * 500 ms est un compromis : assez long pour couvrir un `.catch()` attaché dans
 * la foulée par du code asynchrone, assez court pour que l'agent voie l'erreur
 * pendant qu'il fait encore le lien avec son geste.
 */
export const DELAI_AFFICHAGE_MS = 500;

/** Les options telles qu'Hermes les attend. */
export interface OptionsTracker {
  allRejections?: boolean;
  onUnhandled: (id: number, rejection: unknown) => void;
  onHandled: (id: number) => void;
}

/** La part d'`HermesInternal` qui nous intéresse. */
export interface Tracker {
  enablePromiseRejectionTracker?: (options: OptionsTracker) => void;
}

declare const global: typeof globalThis & {
  HermesInternal?: Tracker;
};

export interface OptionsFilet {
  /** Le tracker. Par défaut `global.HermesInternal`. */
  hermes?: Tracker;
  /** Par défaut `__DEV__`. En dev le filet s'efface : LogBox montre déjà mieux. */
  enDev?: boolean;
}

let installe = false;

/** Un minuteur d'affichage par rejet en vol, pour n'annuler que le bon. */
const enAttente = new Map<number, ReturnType<typeof setTimeout>>();

/** À cette frontière `traitementDe` rend toujours BLOQUER — rien à choisir. */
const journal = logger.child({}, 'global');

/**
 * Pose le filet. Renvoie `true` s'il a effectivement été posé.
 *
 * Le booléen n'est pas décoratif : l'appelant doit pouvoir distinguer « posé »
 * de « pas posé », sans quoi on retombe sur le motif que cet ADR éradique —
 * un filet supposé en place et jamais installé.
 */
export function installerFiletRejets(options: OptionsFilet = {}): boolean {
  const enDev = options.enDev ?? __DEV__;
  // En dev, LogBox affiche le rejet avec sa pile et sa source. Doubler ça d'une
  // bannière n'ajoute rien et masque l'outil le plus précis des deux.
  if (enDev) return false;

  if (installe) return false;

  const hermes = 'hermes' in options ? options.hermes : global.HermesInternal;
  const activer = hermes?.enablePromiseRejectionTracker;
  if (typeof activer !== 'function') {
    // On ne lève pas : l'absence de filet ne doit pas empêcher l'app de
    // démarrer. Mais elle est **journalisée**, parce qu'un filet absent qu'on
    // croit posé est précisément l'erreur silencieuse qu'ADR-012 traque.
    journal.event('promise.tracker_absent', {
      raison: hermes ? 'methode absente' : 'HermesInternal absent',
    });
    return false;
  }

  installe = true;

  activer.call(hermes, {
    // Sans ce drapeau, Hermes ne remonte que les rejets qu'il juge définitifs
    // et laisse passer ceux qui ont déjà été observés — donc une partie de ce
    // que le filet est censé rattraper.
    allRejections: true,

    onUnhandled: (id, rejection) => {
      // `rejection` est l'erreur D'ORIGINE, typée — pas une enveloppe. C'est ce
      // que #166 a vérifié sur build release, et ce que ces options préservent.
      journal.failure('promise.unhandled', rejection, { id });

      enAttente.set(
        id,
        setTimeout(() => {
          enAttente.delete(id);
          useErrorStore.getState().signaler(rejection, 'global');
        }, DELAI_AFFICHAGE_MS)
      );
    },

    onHandled: (id) => {
      const minuteur = enAttente.get(id);
      // Arrivé dans le délai, le `.catch()` annule l'affichage. Arrivé après,
      // il ne retire rien : la bannière ne se rétracte pas. Les deux cas se
      // distinguent dans le journal — sans quoi le support ne saurait pas si
      // une bannière vue par l'agent correspondait à un échec réel.
      if (minuteur) {
        clearTimeout(minuteur);
        enAttente.delete(id);
      }
      journal.event('promise.late_catch', { id, affichage_annule: minuteur !== undefined });
    },
  });

  return true;
}

/** Remet le module à zéro. Réservé aux tests. */
export function reinitialiserFiletPourTests() {
  installe = false;
  enAttente.forEach(clearTimeout);
  enAttente.clear();
}
