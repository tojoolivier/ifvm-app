#!/usr/bin/env node

/**
 * Vérifie que chaque champ du contrat OpenAPI backend (api-schema.generated.ts,
 * régénéré via `npm run generate:api-types`) a une colonne SQLite correspondante
 * dans prospection-db.ts. C'est le garde-fou anti-régression du bug `phase` :
 * une colonne ajoutée côté backend et jamais répercutée côté mobile causait un
 * écran blanc silencieux (requête SQL en échec, promesse rejetée sans .catch).
 *
 * Ne vérifie PAS l'inverse : une colonne SQLite sans champ backend est acceptée
 * (brouillons/champs locaux légitimes).
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(process.cwd(), 'src', 'lib', 'prospection-db.ts');
const SCHEMA_PATH = path.join(process.cwd(), 'src', 'lib', 'api-schema.generated.ts');

// table SQLite -> schéma OpenAPI "*Create" correspondant
const TABLE_TO_SCHEMA = {
  prospection_population: 'PopulationCreate',
  prospection_capture: 'CaptureCreate',
  prospection_infestation: 'InfestationCreate',
};

function extractSqliteColumns(source, tableName) {
  const createRe = new RegExp(
    `CREATE TABLE IF NOT EXISTS ${tableName} \\(([\\s\\S]*?)\\n\\s*\\);`,
    'm'
  );
  const match = source.match(createRe);
  const columns = new Set();
  if (match) {
    for (const line of match[1].split('\n')) {
      const colMatch = line.trim().match(/^([a-z_][a-z0-9_]*)\s+[A-Z]/);
      if (colMatch) columns.add(colMatch[1]);
    }
  }

  // colonnes ajoutées après coup via ALTER TABLE dans migrate*Table() :
  // on isole d'abord la fonction de migration qui cible cette table (entre
  // deux `async function`), puis on en extrait sa liste columnsToAdd.
  const functionChunks = source.split(/(?=async function )/);
  const fnChunk = functionChunks.find((chunk) =>
    chunk.includes(`ALTER TABLE ${tableName} ADD COLUMN`)
  );
  if (fnChunk) {
    const listMatch = fnChunk.match(/columnsToAdd = \[([\s\S]*?)\n {2}\];/);
    if (listMatch) {
      const nameRe = /name:\s*'([a-z_][a-z0-9_]*)'/g;
      let m;
      while ((m = nameRe.exec(listMatch[1])) !== null) {
        columns.add(m[1]);
      }
    }
  }

  return columns;
}

function extractOpenApiFields(source, schemaName) {
  const re = new RegExp(`\\b${schemaName}: \\{([\\s\\S]*?)\\n {8}\\};`, 'm');
  const match = source.match(re);
  if (!match) {
    throw new Error(`Schéma OpenAPI "${schemaName}" introuvable dans ${SCHEMA_PATH}`);
  }
  const fields = new Set();
  const fieldRe = /^ {12}([a-z_][a-z0-9_]*)\??:/gm;
  let m;
  while ((m = fieldRe.exec(match[1])) !== null) {
    fields.add(m[1]);
  }
  return fields;
}

function main() {
  const dbSource = fs.readFileSync(DB_PATH, 'utf8');
  const schemaSource = fs.readFileSync(SCHEMA_PATH, 'utf8');

  let hasDrift = false;

  for (const [table, schemaName] of Object.entries(TABLE_TO_SCHEMA)) {
    const sqliteColumns = extractSqliteColumns(dbSource, table);
    const openapiFields = extractOpenApiFields(schemaSource, schemaName);

    const missing = [...openapiFields].filter((f) => !sqliteColumns.has(f));

    if (missing.length > 0) {
      hasDrift = true;
      console.error(`\n❌ ${table} : champs présents dans le contrat OpenAPI (${schemaName}) mais absents du schéma SQLite mobile :`);
      for (const field of missing) {
        console.error(`   - ${field}`);
      }
    } else {
      console.log(`✅ ${table} : à jour avec ${schemaName} (${openapiFields.size} champs)`);
    }
  }

  if (hasDrift) {
    console.error('\nRégénère api-schema.generated.ts (npm run generate:api-types) si le backend a évolué,');
    console.error('sinon ajoute les colonnes manquantes dans prospection-db.ts (CREATE TABLE + migrate*Table).');
    process.exit(1);
  }

  console.log('\nAucune dérive détectée entre le contrat OpenAPI et le schéma SQLite mobile.');
}

main();
