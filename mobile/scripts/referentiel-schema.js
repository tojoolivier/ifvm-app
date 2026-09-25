#!/usr/bin/env node

/**
 * Génère le DDL SQLite du référentiel local depuis le contrat OpenAPI (#675).
 *
 * Le référentiel est un cache jetable, reconstruit depuis le serveur quand sa version de schéma
 * change : son DDL ne s'écrit donc plus à la main. Ce script lit `api-schema.generated.ts`
 * (lui-même issu de `npm run generate:api-types`) et produit `referentiel-schema.generated.ts`.
 *
 * Correspondance des types : string -> TEXT (date-time comprise : ISO 8601), boolean -> INTEGER,
 * number -> REAL, tableaux/objets -> TEXT (JSON). Un champ est NOT NULL s'il est requis et non
 * `| null` dans le contrat.
 *
 * Même règle que `check-schema-drift.js` : une extraction qui ne comprend pas ce qu'elle lit
 * lève, elle ne dégrade jamais en silence.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const config = require('./referentiel-schema.config');

const SCHEMA_PATH = path.join('src', 'lib', 'api-schema.generated.ts');
const OUT_PATH = path.join('src', 'lib', 'referentiel-schema.generated.ts');

/** Champs d'un schéma du contrat : [{ name, type, required, nullable }]. */
function extraireChamps(source, schemaName) {
  const bloc = source.match(new RegExp(`\\b${schemaName}: \\{([\\s\\S]*?)\\n {8}\\};`, 'm'));
  if (!bloc) throw new Error(`Schéma OpenAPI "${schemaName}" introuvable dans ${SCHEMA_PATH}`);

  const champs = [];
  for (const ligne of bloc[1].split('\n')) {
    const m = ligne.match(/^ {12}([a-z_][a-z0-9_]*)(\?)?:\s*(.*)$/);
    if (!m) continue;
    const [, name, optionnel, valeur] = m;
    if (!valeur.endsWith(';')) {
      throw new Error(
        `${schemaName}.${name} : type sur plusieurs lignes, non géré par le générateur. ` +
          `Mets referentiel-schema.js à jour plutôt que d'omettre ce champ.`
      );
    }
    const type = valeur.slice(0, -1).trim();
    const sansNull = type.replace(/\s*\|\s*null\b/, '').replace(/\bnull\s*\|\s*/, '');
    champs.push({
      name,
      type: sansNull,
      required: !optionnel,
      nullable: sansNull !== type,
    });
  }
  if (champs.length === 0) throw new Error(`Schéma "${schemaName}" : aucun champ extrait.`);
  return champs;
}

function typeSqlite(champ, contexte) {
  const t = champ.type;
  if (t === 'string') return 'TEXT';
  if (t === 'number') return 'REAL';
  if (t === 'boolean') return 'INTEGER';
  if (/^["']/.test(t)) return 'TEXT'; // union de littéraux (enum)
  if (t.endsWith('[]') || t.startsWith('{') || t.startsWith('Record<')) return 'TEXT';
  throw new Error(`${contexte}.${champ.name} : type TypeScript "${t}" sans correspondance SQLite.`);
}

function ddlTable(entree, source) {
  const contexte = `${entree.schema} -> ${entree.table}`;
  const champs = extraireChamps(source, entree.schema);
  const noms = new Set(champs.map((c) => c.name));

  const omis = { ...(entree.omis ?? {}) };
  if (!entree.sansSoftDelete) omis.deleted_at = config.RAISON_SOFT_DELETE;
  for (const nom of Object.keys(omis)) {
    if (!noms.has(nom)) {
      throw new Error(`${contexte} : le champ omis "${nom}" n'existe plus dans le contrat.`);
    }
  }

  const primaryKey = entree.primaryKey ?? ['id'];
  for (const nom of primaryKey) {
    if (!noms.has(nom)) throw new Error(`${contexte} : clé primaire "${nom}" absente du contrat.`);
  }

  const lignes = [];
  for (const champ of champs) {
    if (omis[champ.name]) continue;
    const pkSimple = primaryKey.length === 1 && primaryKey[0] === champ.name;
    const notNull = primaryKey.includes(champ.name) || (champ.required && !champ.nullable);
    lignes.push(
      `${champ.name} ${typeSqlite(champ, contexte)}${pkSimple ? ' PRIMARY KEY' : ''}${notNull ? ' NOT NULL' : ''}`
    );
  }

  for (const colonne of entree.local?.colonnes ?? []) {
    if (noms.has(colonne.name)) {
      throw new Error(
        `${contexte} : la colonne locale "${colonne.name}" porte le nom d'un champ du contrat.`
      );
    }
    lignes.push(`${colonne.name} ${colonne.type}`);
  }
  if (primaryKey.length > 1) lignes.push(`PRIMARY KEY (${primaryKey.join(', ')})`);

  const colonnesConnues = new Set([
    ...champs.filter((c) => !omis[c.name]).map((c) => c.name),
    ...(entree.local?.colonnes ?? []).map((c) => c.name),
  ]);
  const index = (entree.local?.index ?? []).map((colonne) => {
    if (!colonnesConnues.has(colonne)) {
      throw new Error(`${contexte} : index sur "${colonne}", colonne inexistante.`);
    }
    return `CREATE INDEX IF NOT EXISTS ix_${entree.table}_${colonne} ON ${entree.table}(${colonne});`;
  });

  return [
    `CREATE TABLE IF NOT EXISTS ${entree.table} (\n  ${lignes.join(',\n  ')}\n);`,
    ...index,
  ].join('\n\n');
}

/** Tout schéma `*SyncRead` du contrat doit être miroité ou explicitement ignoré. */
function verifierCouverture(source) {
  const presents = [...source.matchAll(/^ {8}([A-Za-z]+SyncRead): \{/gm)].map((m) => m[1]);
  if (presents.length === 0) throw new Error(`Aucun schéma *SyncRead trouvé dans ${SCHEMA_PATH}.`);

  const declares = new Set([
    ...config.tables.map((t) => t.schema),
    ...Object.keys(config.schemasIgnores),
  ]);
  const nonCouverts = presents.filter((s) => !declares.has(s));
  if (nonCouverts.length > 0) {
    throw new Error(
      `Schémas du contrat sans table locale ni omission déclarée : ${nonCouverts.join(', ')}. ` +
        `Ajoute-les à "tables" ou "schemasIgnores" dans referentiel-schema.config.js.`
    );
  }
  for (const nom of Object.keys(config.schemasIgnores)) {
    if (!presents.includes(nom)) {
      throw new Error(`schemasIgnores : "${nom}" n'existe plus dans le contrat.`);
    }
  }
}

/** Contenu complet de `referentiel-schema.generated.ts` pour un contrat donné. */
function genererModule(source) {
  verifierCouverture(source);
  const ddl = config.tables.map((t) => ddlTable(t, source)).join('\n\n');
  const version = crypto.createHash('sha1').update(ddl).digest('hex').slice(0, 12);
  const tables = config.tables.map((t) => `  '${t.table}',`).join('\n');
  return `// Fichier généré par \`npm run generate:referentiel-schema\` depuis api-schema.generated.ts.
// Ne pas modifier à la main : la couche locale se déclare dans scripts/referentiel-schema.config.js.

/** Tables du cache jetable du référentiel (DROP + pull complet quand la version change). */
export const REFERENTIEL_TABLES = [
${tables}
] as const;

/** Empreinte du DDL : change dès que le contrat ou la couche locale change. */
export const REFERENTIEL_SCHEMA_VERSION = '${version}';

export const REFERENTIEL_DDL = \`
${ddl}
\`;
`;
}

/**
 * Garde-fou de `check:schema-drift` : le module committé doit être exactement ce que le contrat
 * actuel produit. Un champ ajouté au contrat sans régénération, un schéma `*SyncRead` ni miroité ni
 * ignoré, une omission périmée : tout revient ici sous forme de message, jamais de silence.
 */
function verifierFraicheur(source, moduleCommite) {
  let attendu;
  try {
    attendu = genererModule(source);
  } catch (erreur) {
    return erreur.message;
  }
  if (attendu === moduleCommite) return null;

  const dansCommite = new Set(moduleCommite.split('\n'));
  const nouvelles = attendu
    .split('\n')
    .filter((ligne) => /^ {2}\w+ [A-Z]/.test(ligne) && !dansCommite.has(ligne))
    .map((ligne) => ligne.trim());
  return (
    `${OUT_PATH} n'est plus à jour avec le contrat OpenAPI` +
    (nouvelles.length ? ` (colonnes non couvertes : ${nouvelles.join(' ; ')})` : '') +
    '. Lance `npm run generate:referentiel-schema`.'
  );
}

function main() {
  const source = fs.readFileSync(path.join(process.cwd(), SCHEMA_PATH), 'utf8');
  fs.writeFileSync(path.join(process.cwd(), OUT_PATH), genererModule(source));
  console.log(`✅ ${OUT_PATH} généré (${config.tables.length} tables).`);
}

module.exports = { genererModule, extraireChamps, verifierFraicheur, OUT_PATH, SCHEMA_PATH };

if (require.main === module) main();
