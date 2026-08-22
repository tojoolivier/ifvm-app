/**
 * Expurgation des lignes de journal — ADR-012, décision 6.
 *
 * Le filtre vit ici, appelé par `sink()` **à l'écriture** : aucun secret ne
 * touche le disque, et l'export (ADR-012 décision 7) n'a donc aucune
 * responsabilité de confidentialité.
 *
 * Deux filets indépendants, parce que le seul filtre qui existait avant
 * (`redactBody`, par URL) était incomplet sans que rien ne le signale :
 *
 *  1. **par le nom de clé** — la liste ci-dessous ;
 *  2. **par la forme de la valeur** — toute chaîne ressemblant à un JWT est
 *     expurgée quel que soit son nom, ce qui attrape un champ inconnu
 *     (`session_key`, `otp`…) que la liste ne connaît pas encore.
 *
 * Corollaire imposé aux appelants : **on ne sérialise jamais avant `sink()`**.
 * Un corps déjà passé par `JSON.stringify` est une chaîne opaque dans laquelle
 * le filtre par clé ne voit rien — c'est exactement l'erreur de granularité qui
 * laissait fuiter les jetons. Une règle lint interdit `JSON.stringify` dans un
 * argument du logger.
 */

/**
 * Ce qui **authentifie ou autorise**, et rien d'autre.
 *
 * Le GPS, l'identité de l'agent et le contenu des fiches passent
 * délibérément : c'est la charge utile du diagnostic, et l'agent qui exporte
 * ses logs possède déjà ces données. Un jeton *authentifie* — qui l'obtient
 * devient l'agent ; une coordonnée *décrit*.
 */
const CLES_INTERDITES = new Set([
  'access_token',
  'refresh_token',
  'token',
  'accesstoken',
  'refreshtoken',
  'password',
  'new_password',
  'old_password',
  'motdepasse',
  'authorization',
  'api_key',
  'apikey',
  'secret',
  'client_secret',
]);

/** Un JWT : trois segments base64url séparés par des points, préfixe `eyJ`. */
const FORME_JWT = /^eyJ[\w-]+\.[\w-]+/;

/** Profondeur au-delà de laquelle on cesse de descendre (garde anti-cycle). */
const PROFONDEUR_MAX = 8;

/**
 * Empreinte courte et stable d'une valeur (djb2). Ne permet pas de remonter à
 * la valeur, mais permet de répondre à la seule question qu'un secret autorise :
 * *est-ce le même jeton qu'à la ligne d'avant ?* Sans elle, une boucle de
 * rafraîchissement qui échoue est illisible.
 */
function empreinte(valeur: string): string {
  let h = 5381;
  for (let i = 0; i < valeur.length; i++) {
    h = ((h << 5) + h + valeur.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, '0').slice(0, 4);
}

function masquer(valeur: unknown): string {
  return `[redacted:${empreinte(typeof valeur === 'string' ? valeur : String(valeur))}]`;
}

function cleInterdite(cle: string): boolean {
  return CLES_INTERDITES.has(cle.toLowerCase().replace(/[-\s]/g, '_'));
}

function valeurSuspecte(valeur: unknown): boolean {
  return typeof valeur === 'string' && FORME_JWT.test(valeur);
}

/**
 * Parcourt récursivement une valeur et remplace tout secret rencontré.
 *
 * Les cycles et les profondeurs excessives sont coupés plutôt que suivis : une
 * ligne de journal tronquée vaut mieux qu'un logger qui boucle.
 */
export function expurger<T>(valeur: T, _profondeur = 0, _vus = new WeakSet<object>()): T {
  if (_profondeur > PROFONDEUR_MAX) return '[profondeur max]' as unknown as T;

  if (valeurSuspecte(valeur)) return masquer(valeur) as unknown as T;

  if (valeur === null || typeof valeur !== 'object') return valeur;

  if (_vus.has(valeur as object)) return '[cycle]' as unknown as T;
  _vus.add(valeur as object);

  if (Array.isArray(valeur)) {
    return valeur.map((v) => expurger(v, _profondeur + 1, _vus)) as unknown as T;
  }

  // Une Error n'est pas un objet de données : on ne garde que ce qui diagnostique.
  if (valeur instanceof Error) {
    return {
      name: valeur.name,
      message: valeur.message,
      ...(valeur.stack ? { stack: valeur.stack } : {}),
    } as unknown as T;
  }

  const sortie: Record<string, unknown> = {};
  for (const [cle, v] of Object.entries(valeur as Record<string, unknown>)) {
    sortie[cle] = cleInterdite(cle) ? masquer(v) : expurger(v, _profondeur + 1, _vus);
  }
  return sortie as unknown as T;
}
