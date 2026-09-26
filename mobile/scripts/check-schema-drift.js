#!/usr/bin/env node

/**
 * Vérifie que chaque champ du contrat OpenAPI backend (api-schema.generated.ts,
 * régénéré via `npm run generate:api-types`) a une colonne SQLite correspondante
 * (désormais : chaque colonne miroir du stockage des fiches existe dans le contrat, #722). C'est le garde-fou anti-régression du bug `phase` :
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

const { verifierFraicheur, OUT_PATH: REFERENTIEL_OUT_PATH } = require('./referentiel-schema');

const SCHEMA_PATH = path.join(process.cwd(), 'src', 'lib', 'api-schema.generated.ts');

// Stockage des fiches de prospection (#722) : le corps de chaque ligne est du JSON typé par le contrat
// (`*Create`), donc il ne peut pas dériver. Ne restent des colonnes que les « miroirs » — copies d'un
// champ du contrat qu'il faut filtrer ou trier en SQL. Ce script vérifie le sens inverse de l'ancien :
// chaque miroir doit être un champ existant du schéma (un champ renommé côté backend casserait le SQL).
const PROSPECTION_DDL_PATH = path.join(process.cwd(), 'src', 'lib', 'prospection-schema.ts');
const TABLE_TO_SCHEMA = {
  prospection: 'ProspectionCreate',
  prospection_population: 'PopulationCreate',
  prospection_capture: 'CaptureCreate',
  prospection_infestation: 'InfestationCreate',
  prospection_operation_aerienne: 'OperationAerienneCreate',
};
// Colonnes propres à l'appareil : état de synchronisation, corps JSON, clés techniques.
const COLONNES_LOCALES = new Set([
  'statut_sync', 'validated_at', 'server_updated_at', 'corps', 'created_at', 'updated_at',
  'prospection_id', 'position',
]);

/** Les colonnes déclarées dans le `CREATE TABLE` d'une table. */
function extraireColonnesCreate(source, tableName) {
  const createRe = new RegExp(
    `CREATE TABLE IF NOT EXISTS ${tableName} \\(([\\s\\S]*?)\\n\\s*\\);`,
    'm'
  );
  const match = source.match(createRe);
  if (!match) {
    throw new Error(
      `CREATE TABLE de "${tableName}" introuvable dans ${PROSPECTION_DDL_PATH}. ` +
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
  const ddlSource = fs.readFileSync(PROSPECTION_DDL_PATH, 'utf8');
  const schemaSource = fs.readFileSync(SCHEMA_PATH, 'utf8');

  let hasDrift = false;

  for (const [table, schemaName] of Object.entries(TABLE_TO_SCHEMA)) {
    const miroirs = [...extraireColonnesCreate(ddlSource, table)].filter((c) => !COLONNES_LOCALES.has(c));
    const openapiFields = extractOpenApiFields(schemaSource, schemaName);
    const inconnus = miroirs.filter((c) => !openapiFields.has(c));

    if (inconnus.length > 0) {
      hasDrift = true;
      console.error(`\n❌ ${table} : colonnes absentes du contrat OpenAPI (${schemaName}) :`);
      for (const colonne of inconnus) console.error(`   - ${colonne}`);
    } else {
      console.log(`✅ ${table} : ${miroirs.length} colonnes miroir présentes dans ${schemaName}`);
    }
  }

  // Référentiel local (#675) : son DDL est généré depuis le contrat, il doit être à jour.
  const problemeReferentiel = verifierFraicheur(
    schemaSource,
    fs.readFileSync(path.join(process.cwd(), REFERENTIEL_OUT_PATH), 'utf8')
  );
  if (problemeReferentiel) {
    hasDrift = true;
    console.error(`\n❌ référentiel local : ${problemeReferentiel}`);
  } else {
    console.log('✅ référentiel local : DDL généré à jour avec le contrat');
  }

  if (hasDrift) {
    console.error('\nRégénère api-schema.generated.ts (npm run generate:api-types) si le backend a évolué,');
    console.error('sinon renomme la colonne miroir par une nouvelle étape de db-schema.ts et dans prospection-schema.ts.');
    process.exit(1);
  }

  console.log('\nAucune dérive détectée entre le contrat OpenAPI et le schéma SQLite mobile.');
}

main();
