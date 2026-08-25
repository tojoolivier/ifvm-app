/**
 * SONDE JETABLE — issue #166. Ne jamais fusionner dans `main`.
 *
 * Répond aux 6 points de la checklist de #166 sur un build **release** :
 * le tracker de rejets de promesse d'Hermes existe-t-il, tire-t-il, avec
 * quels délais, et `rejection` est-il l'erreur d'origine ou une enveloppe ?
 *
 * Écrit via `global.nativeLoggingHook` et non `console.*` : en release,
 * `console.*` n'a pas de destination visible, alors que le hook natif écrit
 * directement dans logcat sous le tag `ReactNativeJS`.
 */

const TAG = '[SONDE-166]';

declare const global: typeof globalThis & {
  nativeLoggingHook?: (message: string, level: number) => void;
  HermesInternal?: {
    enablePromiseRejectionTracker?: (options: {
      allRejections?: boolean;
      onUnhandled?: (id: number, rejection: unknown) => void;
      onHandled?: (id: number) => void;
    }) => void;
    getRuntimeProperties?: () => Record<string, string>;
  };
};

function trace(message: string) {
  // niveau 3 = error, le plus visible dans logcat
  global.nativeLoggingHook?.(`${TAG} ${message}`, 3);
}

/** Classe typée maison : sert au point 6 (l'erreur est-elle enveloppée ?). */
class ErreurSonde extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErreurSonde';
  }
}

export function lancerSonde166() {
  trace('--- debut ---');

  // Point 1 — `global.HermesInternal` existe-t-il ?
  const hermes = global.HermesInternal;
  trace(`1. typeof HermesInternal = ${typeof hermes}`);
  if (hermes) {
    trace(`1b. cles HermesInternal = ${Object.keys(hermes).join(',')}`);
    try {
      const props = hermes.getRuntimeProperties?.();
      trace(`1c. runtimeProperties = ${JSON.stringify(props)}`);
    } catch (e) {
      trace(`1c. getRuntimeProperties a leve : ${String(e)}`);
    }
  }

  // Point 2 — `enablePromiseRejectionTracker` est-il une fonction ?
  const enable = hermes?.enablePromiseRejectionTracker;
  trace(`2. typeof enablePromiseRejectionTracker = ${typeof enable}`);
  if (typeof enable !== 'function') {
    trace('ARRET : pas de tracker. La decision 8 de ADR-012 tombe.');
    trace('--- fin ---');
    return;
  }

  // Horloges de départ, par test, pour le point 4.
  const t0: Record<string, number> = {};
  const dejaNonGere = new Set<number>();

  // Point 3 — installer nos propres options et voir si `onUnhandled` tire.
  try {
    enable.call(hermes, {
      allRejections: true,
      onUnhandled: (id, rejection) => {
        dejaNonGere.add(id);
        const nom =
          rejection instanceof Error ? rejection.constructor.name : typeof rejection;
        const message = rejection instanceof Error ? rejection.message : String(rejection);

        // Point 4 — délai réel entre le rejet et l'appel.
        const depart = t0[message];
        const delai = depart ? Date.now() - depart : -1;

        // Point 6 — erreur d'origine ou enveloppe ?
        const estTypee = rejection instanceof ErreurSonde;
        const cause = (rejection as { cause?: unknown })?.cause;
        const causeNom =
          cause instanceof Error ? cause.constructor.name : cause === undefined ? 'aucune' : typeof cause;

        trace(
          `3/4/6. onUnhandled id=${id} classe=${nom} message="${message}" ` +
            `delai=${delai}ms instanceof_ErreurSonde=${estTypee} cause=${causeNom}`,
        );
      },
      onHandled: (id) => {
        // Point 5 — `onHandled` tire-t-il, et seulement après `onUnhandled` ?
        trace(`5. onHandled id=${id} onUnhandled_avait_tire=${dejaNonGere.has(id)}`);
      },
    });
    trace('3. enablePromiseRejectionTracker appele sans lever');
  } catch (e) {
    trace(`3. enablePromiseRejectionTracker a LEVE : ${String(e)}`);
    trace('--- fin ---');
    return;
  }

  // Cas A — rejet d'une classe typée maison, jamais rattrapé.
  // Vérifie points 3, 4 et 6.
  t0['sonde-A-typee'] = Date.now();
  void Promise.reject(new ErreurSonde('sonde-A-typee'));

  // Cas B — TypeError : #160 annonce 100 ms au lieu de 2000 ms pour cette
  // famille. Vérifie si la constante côté C++ correspond.
  t0['sonde-B-typeerror'] = Date.now();
  void Promise.reject(new TypeError('sonde-B-typeerror'));

  // Cas C — rattrapage tardif : `.catch()` attaché à 3 s, bien après le
  // délai d'Hermes. `onUnhandled` doit avoir tiré, puis `onHandled`.
  t0['sonde-C-tardif'] = Date.now();
  const tardif = Promise.reject(new ErreurSonde('sonde-C-tardif'));
  setTimeout(() => {
    trace('5b. attachement du .catch() tardif (t+3000ms)');
    tardif.catch(() => {
      trace('5c. le .catch() tardif a bien recu le rejet');
    });
  }, 3000);

  // Cas D — rejet rattrapé immédiatement : `onUnhandled` ne DOIT PAS tirer.
  // Sert de témoin négatif : sans lui, un `onUnhandled` qui tire toujours
  // ressemblerait à un succès.
  t0['sonde-D-temoin'] = Date.now();
  void Promise.reject(new ErreurSonde('sonde-D-temoin')).catch(() => {});

  // Borne de fin : au-delà, tout silence est un résultat négatif et non une
  // mesure encore en vol.
  setTimeout(() => trace('--- fin (t+8000ms) ---'), 8000);
}
