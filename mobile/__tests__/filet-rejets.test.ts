import {
  installerFiletRejets,
  reinitialiserFiletPourTests,
  DELAI_AFFICHAGE_MS,
  type OptionsTracker,
} from '../src/lib/filet-rejets';
import {
  configureLogger,
  resetLoggerForTests,
  lignesEnAttente,
  type LogLine,
} from '../src/lib/logger';
import { useErrorStore } from '../src/lib/error-store';
import { NetworkError, LocalWriteError } from '../src/lib/errors';

const ecrites: LogLine[] = [];

/** Hermes factice : capture les options qu'on lui passe, sans rien exécuter. */
function hermesFactice() {
  const capture: { options: OptionsTracker | null } = { options: null };
  return {
    capture,
    tracker: {
      enablePromiseRejectionTracker: (o: OptionsTracker) => {
        capture.options = o;
      },
    },
  };
}

/** Installe le filet et rend les deux callbacks, pour ne pas répéter le `!`. */
function installerEtRecuperer() {
  const { capture, tracker } = hermesFactice();
  const installe = installerFiletRejets({ hermes: tracker, enDev: false });
  if (!capture.options) throw new Error('le tracker n a pas ete configure');
  return { installe, options: capture.options };
}

const erreursOuvertes = () => useErrorStore.getState().erreurs;

/**
 * Le journal complet : ce qui est parti au transport **et** ce qui attend
 * encore dans l'anneau. Seul `failure()` déclenche un flush ; `event()` écrit
 * sans forcer. Assertion sur le seul transport, `promise.late_catch` et
 * `promise.tracker_absent` seraient invisibles alors qu'ils sont bien écrits.
 */
const journalisees = (): readonly LogLine[] => [...ecrites, ...lignesEnAttente()];

beforeEach(() => {
  jest.useFakeTimers();
  ecrites.length = 0;
  resetLoggerForTests();
  reinitialiserFiletPourTests();
  useErrorStore.setState({ erreurs: [] });
  configureLogger({
    transport: {
      write: (lignes) => {
        ecrites.push(...lignes);
      },
    },
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('installation', () => {
  it('appelle le tracker avec allRejections, sinon les rejets deja suivis echappent', () => {
    const { installe, options } = installerEtRecuperer();

    expect(installe).toBe(true);
    expect(options.allRejections).toBe(true);
    expect(typeof options.onUnhandled).toBe('function');
    expect(typeof options.onHandled).toBe('function');
  });

  it("n'installe rien en dev, pour laisser LogBox faire son travail", () => {
    const { capture, tracker } = hermesFactice();

    expect(installerFiletRejets({ hermes: tracker, enDev: true })).toBe(false);
    expect(capture.options).toBeNull();
  });

  it("n'installe qu'une fois, meme appele deux fois", () => {
    const { capture, tracker } = hermesFactice();
    installerFiletRejets({ hermes: tracker, enDev: false });
    const premieres = capture.options;

    expect(installerFiletRejets({ hermes: tracker, enDev: false })).toBe(false);
    expect(capture.options).toBe(premieres);
  });
});

/**
 * #166 a mesure le tracker present et fonctionnel sur un build release. Ces
 * tests protegent le cas contraire : sur un moteur ou l'API manque, le filet
 * doit **le dire**, pas echouer en silence. Un filet absent qu'on croit pose
 * est exactement ce qu'ADR-012 eradique.
 */
describe('absence du tracker', () => {
  it('ne leve pas et renvoie false quand HermesInternal manque', () => {
    expect(installerFiletRejets({ hermes: undefined, enDev: false })).toBe(false);
  });

  it("ne leve pas quand l'objet existe mais pas la methode", () => {
    expect(installerFiletRejets({ hermes: {}, enDev: false })).toBe(false);
  });

  it("journalise l'absence, pour qu'elle soit visible dans l'export", () => {
    installerFiletRejets({ hermes: {}, enDev: false });

    expect(journalisees().map((l) => l.event)).toContain('promise.tracker_absent');
  });

  /**
   * `event()` n'entraine pas de flush, `failure()` si. Ecrite au demarrage,
   * cette ligne resterait sinon dans l'anneau memoire — et un crash dur
   * emporterait justement l'explication de pourquoi rien n'a ete capture.
   */
  it("ecrit l'absence jusqu'au transport, pas seulement dans l'anneau", () => {
    installerFiletRejets({ hermes: {}, enDev: false });

    expect(ecrites.map((l) => l.event)).toContain('promise.tracker_absent');
  });

  /**
   * #166 a mesure l'appel « sans lever ». Le garantir en code plutot qu'en
   * commentaire : une exception ici remonterait dans le `useEffect` racine et
   * empecherait le demarrage — le filet ferait tomber l'app qu'il protege.
   */
  it("ne laisse pas echapper une exception levee par le tracker", () => {
    const tracker = {
      enablePromiseRejectionTracker: () => {
        throw new Error('moteur hostile');
      },
    };

    expect(installerFiletRejets({ hermes: tracker, enDev: false })).toBe(false);
    expect(ecrites.map((l) => l.event)).toContain('promise.tracker_echec_installation');
  });

  it("ne se croit pas installe apres un echec, et retente au prochain appel", () => {
    let tentatives = 0;
    const capricieux = {
      enablePromiseRejectionTracker: () => {
        tentatives += 1;
        if (tentatives === 1) throw new Error('moteur hostile');
      },
    };

    installerFiletRejets({ hermes: capricieux, enDev: false });
    expect(installerFiletRejets({ hermes: capricieux, enDev: false })).toBe(true);
    expect(tentatives).toBe(2);
  });
});

describe('onUnhandled — le journal est immediat', () => {
  it('journalise des le rejet, sans attendre le delai d affichage', () => {
    const { options } = installerEtRecuperer();

    options.onUnhandled(1, new NetworkError('coupure'));

    const ligne = journalisees().find((l) => l.event === 'promise.unhandled');
    expect(ligne).toBeDefined();
    expect(ligne?.classe).toBe('NetworkError');
    expect(ligne?.id).toBe(1);
  });

  it('journalise meme si un .catch tardif annule ensuite l affichage', () => {
    const { options } = installerEtRecuperer();

    options.onUnhandled(1, new NetworkError('coupure'));
    options.onHandled(1);
    jest.advanceTimersByTime(DELAI_AFFICHAGE_MS * 2);

    expect(journalisees().filter((l) => l.event === 'promise.unhandled')).toHaveLength(1);
  });
});

describe("onUnhandled — l'affichage attend", () => {
  it("n'affiche rien avant le delai", () => {
    const { options } = installerEtRecuperer();

    options.onUnhandled(1, new NetworkError('coupure'));
    jest.advanceTimersByTime(DELAI_AFFICHAGE_MS - 1);

    expect(erreursOuvertes()).toHaveLength(0);
  });

  it('affiche une fois le delai ecoule', () => {
    const { options } = installerEtRecuperer();

    options.onUnhandled(1, new NetworkError('coupure'));
    jest.advanceTimersByTime(DELAI_AFFICHAGE_MS);

    expect(erreursOuvertes()).toHaveLength(1);
    expect(erreursOuvertes()[0].classe).toBe('NetworkError');
  });
});

describe('onHandled — le rattrapage tardif', () => {
  it("annule l'affichage quand il arrive dans le delai", () => {
    const { options } = installerEtRecuperer();

    options.onUnhandled(1, new NetworkError('coupure'));
    options.onHandled(1);
    jest.advanceTimersByTime(DELAI_AFFICHAGE_MS * 2);

    expect(erreursOuvertes()).toHaveLength(0);
  });

  it('journalise le rattrapage, annule ou non', () => {
    const { options } = installerEtRecuperer();

    options.onUnhandled(1, new NetworkError('coupure'));
    options.onHandled(1);

    expect(journalisees().map((l) => l.event)).toContain('promise.late_catch');
  });

  /**
   * Decision 8 : la banniere ne disparait pas seule, donc elle ne peut pas se
   * retracter. Un `.catch()` arrive apres l'affichage laisse la banniere en
   * place et ne produit qu'une ligne de journal.
   */
  it("ne retire pas la banniere quand il arrive apres l'affichage", () => {
    const { options } = installerEtRecuperer();

    options.onUnhandled(1, new NetworkError('coupure'));
    jest.advanceTimersByTime(DELAI_AFFICHAGE_MS);
    options.onHandled(1);

    expect(erreursOuvertes()).toHaveLength(1);
  });

  it("distingue dans le journal le rattrapage qui a annule de celui qui n'a rien pu annuler", () => {
    const { options } = installerEtRecuperer();

    options.onUnhandled(1, new NetworkError('a temps'));
    options.onHandled(1);
    options.onUnhandled(2, new NetworkError('trop tard'));
    jest.advanceTimersByTime(DELAI_AFFICHAGE_MS);
    options.onHandled(2);

    const rattrapages = journalisees().filter((l) => l.event === 'promise.late_catch');
    expect(rattrapages).toHaveLength(2);
    expect(rattrapages[0].affichage_annule).toBe(true);
    expect(rattrapages[1].affichage_annule).toBe(false);
  });
});

describe('plusieurs rejets en vol', () => {
  it("n'annule que le rejet rattrape, pas les autres", () => {
    const { options } = installerEtRecuperer();

    options.onUnhandled(1, new NetworkError('rattrape'));
    options.onUnhandled(2, new LocalWriteError('pas rattrape'));
    options.onHandled(1);
    jest.advanceTimersByTime(DELAI_AFFICHAGE_MS);

    expect(erreursOuvertes()).toHaveLength(1);
    expect(erreursOuvertes()[0].classe).toBe('LocalWriteError');
  });
});

/**
 * **Test de decision — ne pas simplifier.** #166 a etabli que `rejection`
 * arrive **non enveloppee** : c'est ce qui permet a `instanceof` de retrouver
 * la classe typee. Les options par defaut de RN et d'Expo enveloppent le rejet
 * dans `new Error(..., { cause: rejection })`, ce qui classerait **tout** rejet
 * comme `(bug)`. Si ce test tombe, c'est que le filet a recommence a passer une
 * enveloppe — et tout le typage de #155 devient muet a cette frontiere.
 */
describe('la classe typee survit au filet', () => {
  it("transmet l'erreur d'origine, pas une enveloppe", () => {
    const { options } = installerEtRecuperer();
    const origine = new NetworkError('coupure');

    options.onUnhandled(1, origine);
    jest.advanceTimersByTime(DELAI_AFFICHAGE_MS);

    expect(journalisees().find((l) => l.event === 'promise.unhandled')?.classe).toBe('NetworkError');
    expect(erreursOuvertes()[0].classe).toBe('NetworkError');
  });

  it("nomme (bug) ce qui n'appartient pas au jeu ferme, sans confondre les deux", () => {
    const { options } = installerEtRecuperer();

    options.onUnhandled(1, new TypeError('undefined is not a function'));
    jest.advanceTimersByTime(DELAI_AFFICHAGE_MS);

    expect(journalisees().find((l) => l.event === 'promise.unhandled')?.classe).toBe('(bug)');
  });
});
