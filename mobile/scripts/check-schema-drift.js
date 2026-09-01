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
 *
 * ## Ce script lit du code, donc il casse quand le code bouge
 *
 * Il a déjà cassé une fois, en silence. Il repérait les colonnes de migration
 * en cherchant la fonction contenant la chaîne
 * `ALTER TABLE <table> ADD COLUMN` ; le jour où les quatre fonctions
 * `migrate*Table` ont fusionné en une seule dont l'`ALTER` interpole le nom de
 * table (`ALTER TABLE ${table} ...`), plus rien ne correspondait. Il ne s'est
 * pas plaint : il a rendu un ensemble vide, donc annoncé des dérives
 * imaginaires — et un garde-fou qui crie à tort est un garde-fou qu'on
 * apprend à ignorer, ce qui laisse ensuite passer la vraie dérive.
 *
 * D'où la règle appliquée ici, qui est celle d'ADR-012 transposée à l'outil :
 * **une extraction qui ne trouve rien lève, elle ne rend jamais du vide.**
 * Chaque `extraire*` ci-dessous échoue bruyamment plutôt que de dégrader.
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
  prospection_operation_aerienne: 'OperationAerienneCreate',
};

/** Les colonnes déclarées dans le `CREATE TABLE` d'une table. */
function extraireColonnesCreate(source, tableName) {
  const createRe = new RegExp(
    `CREATE TABLE IF NOT EXISTS ${tableName} \\(([\\s\\S]*?)\\n\\s*\\);`,
    'm'
  );
  const match = source.match(createRe);
  if (!match) {
    throw new Error(
      `CREATE TABLE de "${tableName}" introuvable dans ${DB_PATH}. ` +
        `Le schéma a été réorganisé : mets ce script à jour au lieu de le laisser ` +
        `rendre un ensemble vide.`
    );
  }

  const columns = new Set();
  for (const line of match[1].split('\n')) {
    const colMatch = line.trim().match(/^([a-z_][a-z0-9_]*)\s+[A-Z]/);
    if (colMatch) columns.add(colMatch[1]);
  }
  return columns;
}

/**
 * Les colonnes ajoutées après coup, table par table.
 *
 * La correspondance table -> liste n'est pas recopiée à la main : elle est lue
 * sur les appels `ajouterColonnesManquantes(db, 'table', COLONNES_X)`. Ajouter
 * une table sans toucher ce script suffit donc, et renommer une liste casse
 * bruyamment au lieu de passer inaperçu.
 */
function extraireColonnesDeMigration(source) {
  const appels = [
    ...source.matchAll(/ajouterColonnesManquantes\(\s*db,\s*'([a-z_]+)',\s*(COLONNES_\w+)\s*\)/g),
  ];
  if (appels.length === 0) {
    throw new Error(
      `Aucun appel \`ajouterColonnesManquantes(db, 'table', COLONNES_X)\` trouvé dans ` +
        `${DB_PATH}. Les migrations ont changé de forme : mets ce script à jour.`
    );
  }

  const parTable = {};
  for (const [, table, nomListe] of appels) {
    const listeRe = new RegExp(
      `const ${nomListe}: readonly Colonne\\[\\] = \\[([\\s\\S]*?)\\n\\];`,
      'm'
    );
    const liste = source.match(listeRe);
    if (!liste) {
      throw new Error(
        `Liste "${nomListe}" introuvable dans ${DB_PATH}, alors qu'un appel la référence.`
      );
    }

    const colonnes = new Set();
    for (const m of liste[1].matchAll(/name:\s*'([a-z_][a-z0-9_]*)'/g)) {
      colonnes.add(m[1]);
    }
    parTable[table] = colonnes;
  }
  return parTable;
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

  const migrations = extraireColonnesDeMigration(dbSource);

  let hasDrift = false;

  for (const [table, schemaName] of Object.entries(TABLE_TO_SCHEMA)) {
    const sqliteColumns = new Set([
      ...extraireColonnesCreate(dbSource, table),
      ...(migrations[table] ?? []),
    ]);
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
    console.error('sinon ajoute la colonne manquante dans prospection-db.ts : au CREATE TABLE');
    console.error('si elle est nouvelle pour tout le monde, et à la liste COLONNES_* correspondante');
    console.error('pour que les appareils déjà installés la reçoivent aussi.');
    process.exit(1);
  }

  console.log('\nAucune dérive détectée entre le contrat OpenAPI et le schéma SQLite mobile.');
}

main();
