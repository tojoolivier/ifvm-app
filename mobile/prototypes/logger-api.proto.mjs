/**
 * PROTOTYPE JETABLE — ticket #156 (carte wayfinder #150)
 * ------------------------------------------------------
 * Question : à quoi ressemble l'appel qu'on écrit à la place de console.*,
 * et est-ce assez agréable pour être réellement utilisé ?
 *
 * Trois formes d'API concurrentes, les MÊMES trois sites réels réécrits dans
 * chacune, et le journal .jsonl effectivement produit, imprimé à la fin.
 *
 * Lancer :  node mobile/prototypes/logger-api.proto.mjs [A|B|C]
 * Ne PAS fusionner dans main. Le code retenu sera réécrit proprement.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Socle commun : le puits (sink) et les erreurs typées de #155
// ─────────────────────────────────────────────────────────────────────────────

const JOURNAL = [];
let CORRELATION = 'a1b2c3';           // #153 : un id par « session d'usage »
const sink = (line) => JOURNAL.push({ ...line, at: '2026-08-22T09:14:02Z', cid: CORRELATION });

class NetworkError      extends Error {}
class AuthError         extends Error {}
class LocalReadError    extends Error {}
class LocalWriteError   extends Error {}
class ReferentialError  extends Error {}
class PermissionError   extends Error {}
class PreconditionError extends Error {}

// La matrice de #155, sous forme exécutable.
const TRAITEMENT = {
  useAsyncAction: { AuthError: 'BLOQUER', LocalWriteError: 'BLOQUER', _: 'INFORMER' },
  'runTask:best-effort': { _: 'JOURNAL' },
  'runTask:essential':   { _: 'INFORMER' },
  errorBoundary:         { _: 'BLOQUER' },
};
const classeDe = (e) => (e instanceof Error && e.constructor !== Error ? e.constructor.name : '(bug)');
const traitementDe = (e, frontiere) => {
  const col = TRAITEMENT[frontiere] ?? TRAITEMENT.useAsyncAction;
  return col[classeDe(e)] ?? col._;
};

const banner = (t) => console.log(`\n\x1b[1m${'─'.repeat(78)}\n${t}\n${'─'.repeat(78)}\x1b[0m`);
const code = (t) => console.log(t.replace(/^\n/, ''));

// ═════════════════════════════════════════════════════════════════════════════
// FORME A — niveaux plats + scope enfant   (style pino / winston)
//   log.<niveau>(event, context?, error?)
// ═════════════════════════════════════════════════════════════════════════════

const makeA = (bindings = {}) => {
  const emit = (level) => (event, context = {}, error) =>
    sink({ level, event, ...bindings, ...context,
           err: error ? { class: classeDe(error), message: error.message } : undefined });
  return {
    debug: emit('debug'), info: emit('info'), warn: emit('warn'), error: emit('error'),
    child: (more) => makeA({ ...bindings, ...more }),
  };
};

function sitesA() {
  // ── Site 1 : lib/prospection-db.ts:329-334 (migration SQLite) ──────────────
  const log = makeA().child({ module: 'prospection-db' });
  log.info('migration.column.adding', { column: 'region' });
  try { throw new LocalWriteError('table prospection is locked'); }
  catch (e) { log.error('migration.column.failed', { column: 'region' }, e); }

  // ── Site 2 : app/(app)/profile.tsx:147-177 (prise de photo) ───────────────
  const logP = makeA().child({ screen: 'profile' });
  logP.debug('camera.permission.checked', { status: 'granted' });
  try { throw new Error("Camera unavailable"); }
  catch (e) { logP.error('camera.capture.failed', {}, e); }

  // ── Site 3 : lib/api-client.ts:527 (requête HTTP échouée) ─────────────────
  const logH = makeA().child({ module: 'api-client' });
  logH.warn('http.response', { method: 'POST', url: '/prospections', status: null, ms: 8043 },
            new NetworkError('Network request failed'));
}

const SRC_A = `
// prospection-db.ts
const log = logger.child({ module: 'prospection-db' });
log.info('migration.column.adding', { column: col.name });
try { await db.execAsync(...); }
catch (e) { log.error('migration.column.failed', { column: col.name }, e); }

// profile.tsx
const log = logger.child({ screen: 'profile' });
log.debug('camera.permission.checked', { status });
catch (e) { log.error('camera.capture.failed', {}, e); }

// api-client.ts
log.warn('http.response', { method, url, status, ms }, error);`;

// ═════════════════════════════════════════════════════════════════════════════
// FORME B — un seul appel, tout dans l'objet
//   log({ level, event, ...context, error })
// ═════════════════════════════════════════════════════════════════════════════

const logB = ({ error, ...rest }) =>
  sink({ ...rest, err: error ? { class: classeDe(error), message: error.message } : undefined });

function sitesB() {
  logB({ level: 'info', event: 'migration.column.adding', module: 'prospection-db', column: 'region' });
  try { throw new LocalWriteError('table prospection is locked'); }
  catch (error) { logB({ level: 'error', event: 'migration.column.failed', module: 'prospection-db', column: 'region', error }); }

  logB({ level: 'debug', event: 'camera.permission.checked', screen: 'profile', status: 'granted' });
  try { throw new Error('Camera unavailable'); }
  catch (error) { logB({ level: 'error', event: 'camera.capture.failed', screen: 'profile', error }); }

  logB({ level: 'warn', event: 'http.response', module: 'api-client',
         method: 'POST', url: '/prospections', status: null, ms: 8043,
         error: new NetworkError('Network request failed') });
}

const SRC_B = `
// prospection-db.ts
log({ level: 'info', event: 'migration.column.adding',
      module: 'prospection-db', column: col.name });
catch (error) { log({ level: 'error', event: 'migration.column.failed',
                      module: 'prospection-db', column: col.name, error }); }

// profile.tsx
log({ level: 'debug', event: 'camera.permission.checked',
      screen: 'profile', status });
catch (error) { log({ level: 'error', event: 'camera.capture.failed',
                      screen: 'profile', error }); }

// api-client.ts
log({ level: 'warn', event: 'http.response', module: 'api-client',
      method, url, status, ms, error });`;

// ═════════════════════════════════════════════════════════════════════════════
// FORME C — le niveau est DÉDUIT de la taxonomie, pas choisi
//   log.event(nom, ctx)  ·  log.failure(err, ctx)  ·  ignore(err, raison)
// ═════════════════════════════════════════════════════════════════════════════

const makeC = (bindings = {}, frontiere = 'runTask:best-effort') => ({
  /** Un fait notable. Jamais un échec. */
  event: (name, context = {}) => sink({ level: 'info', event: name, ...bindings, ...context }),

  /** Un échec. Le NIVEAU et le TRAITEMENT sont déduits de la classe × frontière. */
  failure: (error, context = {}) => {
    const traitement = traitementDe(error, frontiere);
    sink({ level: traitement === 'JOURNAL' ? 'warn' : 'error',
           event: 'failure', ...bindings, ...context,
           classe: classeDe(error), traitement, err: { message: error.message } });
    return traitement;                    // la frontière s'en sert pour l'affichage
  },

  /** Silence délibéré — #155. La raison va DANS le journal. */
  ignore: (error, raison) =>
    sink({ level: 'debug', event: 'ignored', ...bindings, raison, err: { class: classeDe(error), message: error.message } }),

  child: (more, f = frontiere) => makeC({ ...bindings, ...more }, f),
});

function sitesC() {
  // Site 1 — migration : tâche de fond ESSENTIELLE (cf. #155)
  const log = makeC().child({ module: 'prospection-db' }, 'runTask:essential');
  log.event('migration.column.adding', { column: 'region' });
  try { throw new LocalWriteError('table prospection is locked'); }
  catch (e) { log.failure(e, { column: 'region' }); }

  // Site 2 — photo : geste explicite de l'agent
  const logP = makeC().child({ screen: 'profile' }, 'useAsyncAction');
  logP.event('camera.permission.checked', { status: 'granted' });
  try { throw new Error('Camera unavailable'); }         // non typée → (bug)
  catch (e) { logP.failure(e); }

  // Site 3 — HTTP : lib/, propage. Le log est un FAIT, pas un échec traité ici.
  const logH = makeC().child({ module: 'api-client' });
  logH.event('http.response', { method: 'POST', url: '/prospections', status: null, ms: 8043 });

  // Site 4 — le silence assumé de auth-store.ts:76
  const logA = makeC().child({ module: 'auth-store' });
  try { throw new LocalWriteError('SecureStore unavailable'); }
  catch (e) { logA.ignore(e, 'nettoyage best-effort du token'); }
}

const SRC_C = `
// prospection-db.ts — tâche de fond essentielle
const log = logger.child({ module: 'prospection-db' }, 'runTask:essential');
log.event('migration.column.adding', { column: col.name });
catch (e) { log.failure(e, { column: col.name }); }

// profile.tsx — geste de l'agent
const log = logger.child({ screen: 'profile' }, 'useAsyncAction');
log.event('camera.permission.checked', { status });
catch (e) { log.failure(e); }          // non typée -> (bug) -> INFORMER

// api-client.ts — lib/ propage, le log est un FAIT
log.event('http.response', { method, url, status, ms });

// auth-store.ts:76 — silence assumé
catch (e) { log.ignore(e, 'nettoyage best-effort du token'); }`;


// ═════════════════════════════════════════════════════════════════════════════
// FORME D — C corrigée : l'événement est TOUJOURS nommé, le niveau reste déduit
//   log.event(nom, ctx) · log.detail(nom, ctx) · log.failure(nom, err, ctx) · log.ignore(err, raison)
// ═════════════════════════════════════════════════════════════════════════════

const makeD = (bindings = {}, frontiere = 'runTask:best-effort') => ({
  /** Fait notable, gardé dans l'export. */
  event:  (name, context = {}) => sink({ level: 'info',  event: name, ...bindings, ...context }),
  /** Fait d'investigation, verbeux, filtrable à l'export. */
  detail: (name, context = {}) => sink({ level: 'debug', event: name, ...bindings, ...context }),
  /** Échec NOMMÉ. Niveau et traitement déduits de la classe × frontière (#155). */
  failure: (name, error, context = {}) => {
    const traitement = traitementDe(error, frontiere);
    sink({ level: traitement === 'JOURNAL' ? 'warn' : 'error', event: name, ...bindings, ...context,
           classe: classeDe(error), traitement, err: { message: error.message } });
    return traitement;
  },
  /** Silence délibéré — #155. */
  ignore: (error, raison) =>
    sink({ level: 'debug', event: 'ignored', ...bindings, raison,
           classe: classeDe(error), err: { message: error.message } }),
  child: (more, f = frontiere) => makeD({ ...bindings, ...more }, f),
});

function sitesD() {
  const log = makeD().child({ module: 'prospection-db' }, 'runTask:essential');
  log.event('migration.column.adding', { column: 'region' });
  try { throw new LocalWriteError('table prospection is locked'); }
  catch (e) { log.failure('migration.column.failed', e, { column: 'region' }); }

  const logP = makeD().child({ screen: 'profile' }, 'useAsyncAction');
  logP.detail('camera.permission.checked', { status: 'granted' });
  try { throw new Error('Camera unavailable'); }
  catch (e) { logP.failure('camera.capture.failed', e); }

  const logH = makeD().child({ module: 'api-client' });
  logH.event('http.response', { method: 'POST', url: '/prospections', status: null, ms: 8043 });

  // Le MÊME NetworkError, aux deux frontières — la preuve que f(classe, frontière) tient.
  const bg = makeD().child({ module: 'referentiel-auto-sync' }, 'runTask:best-effort');
  const fg = makeD().child({ screen: 'sync' }, 'useAsyncAction');
  const net = new NetworkError('Network request failed');
  bg.failure('referentiel.pull.failed', net);
  fg.failure('referentiel.pull.failed', net);

  const logA = makeD().child({ module: 'auth-store' });
  try { throw new LocalWriteError('SecureStore unavailable'); }
  catch (e) { logA.ignore(e, 'nettoyage best-effort du token'); }
}

const SRC_D = `
// prospection-db.ts — tâche de fond essentielle
const log = logger.child({ module: 'prospection-db' }, 'runTask:essential');
log.event('migration.column.adding', { column: col.name });
catch (e) { log.failure('migration.column.failed', e, { column: col.name }); }

// profile.tsx — geste de l'agent
const log = logger.child({ screen: 'profile' }, 'useAsyncAction');
log.detail('camera.permission.checked', { status });   // verbeux, filtrable
catch (e) { log.failure('camera.capture.failed', e); } // non typée -> (bug)

// api-client.ts — lib/ propage ; le log est un FAIT, pas un échec traité ici
log.event('http.response', { method, url, status, ms });

// LE MÊME NetworkError, aux deux frontières
bg.failure('referentiel.pull.failed', net);   // best-effort
fg.failure('referentiel.pull.failed', net);   // geste de l'agent

// auth-store.ts:76 — silence assumé
catch (e) { log.ignore(e, 'nettoyage best-effort du token'); }`;

// ═════════════════════════════════════════════════════════════════════════════

const VARIANTES = {
  A: ['A — niveaux plats + scope enfant  ·  log.<niveau>(event, ctx, err)', SRC_A, sitesA],
  B: ['B — un seul appel structuré  ·  log({ level, event, ...ctx, error })', SRC_B, sitesB],
  C: ['C — le niveau est DÉDUIT de la taxonomie  ·  event / failure / ignore', SRC_C, sitesC],
  D: ['D — C corrigée : événement TOUJOURS nommé, niveau toujours déduit', SRC_D, sitesD],
};

const choix = (process.argv[2] || '').toUpperCase();
for (const [k, [titre, src, run]] of Object.entries(VARIANTES)) {
  if (choix && choix !== k) continue;
  banner(`FORME ${titre}`);
  console.log('\x1b[2mCE QU\'ON ÉCRIT :\x1b[0m'); code(src);
  JOURNAL.length = 0; run();
  console.log('\n\x1b[2mCE QUE LE SUPPORT REÇOIT (.jsonl) :\x1b[0m');
  for (const l of JOURNAL) console.log('  ' + JSON.stringify(l));
}
