#!/usr/bin/env node

/**
 * Vérifie que `package-lock.json` ne pointe que vers le registre npm officiel.
 *
 * Contexte (2026-09-18) : `frontend/package-lock.json` épinglait 3 paquets
 * (react-leaflet, @react-leaflet/core, leaflet) sur `registry.npmmirror.com`
 * — généré par un `npm install` lancé sur une machine dont npm était
 * configuré sur ce miroir. `npm ci` respecte l'URL `resolved` exacte du
 * lockfile, pas la config registry locale du runner : le build Docker
 * (deploy.yml) échouait de façon répétée sur ECONNRESET, ~3 minutes après le
 * début du job, loin de la cause réelle.
 *
 * Ce script tourne tôt (juste après checkout, avant `npm ci`) pour échouer en
 * une fraction de seconde avec un message explicite plutôt que de laisser
 * `npm ci` échouer 3 minutes plus tard sur une erreur réseau qui ne dit pas
 * d'où vient le mauvais registre. `frontend/.npmrc` et `mobile/.npmrc`
 * épinglent déjà le registre officiel pour tout `npm install` futur ; ce
 * script est le filet de sécurité si un lockfile généré ailleurs (registre
 * d'entreprise, `--registry` explicite, etc.) est commité malgré tout.
 *
 * Usage: node scripts/check-lockfile-registry.js <chemin/vers/package-lock.json>
 */

const fs = require('fs');
const path = require('path');

const OFFICIAL_REGISTRY = 'https://registry.npmjs.org/';

function main(argv) {
  const lockfilePath = argv[0];
  if (!lockfilePath) {
    console.error('Usage: node scripts/check-lockfile-registry.js <package-lock.json>');
    return 1;
  }

  const resolvedPath = path.resolve(lockfilePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`ERREUR: fichier introuvable: ${resolvedPath}`);
    return 1;
  }

  const content = fs.readFileSync(resolvedPath, 'utf8');
  const matches = content.matchAll(/"resolved":\s*"(https:\/\/[^"]+)"/g);

  const offending = [];
  for (const match of matches) {
    const url = match[1];
    if (!url.startsWith(OFFICIAL_REGISTRY)) {
      offending.push(url);
    }
  }

  if (offending.length > 0) {
    console.error(
      `ERREUR: ${offending.length} paquet(s) de ${lockfilePath} ne pointent pas vers ${OFFICIAL_REGISTRY} :`,
    );
    for (const url of offending) {
      console.error(`  - ${url}`);
    }
    console.error('');
    console.error(
      'Cause probable : `npm install` a été lancé sur une machine dont npm est configuré ' +
        'sur un autre registre (miroir régional, proxy d\'entreprise). Corrige le fichier ' +
        '(remplace le domaine dans les lignes "resolved" — le champ "integrity" ne change pas ' +
        'et continue de valider le contenu téléchargé), ou régénère-le avec ' +
        `\`npm config get registry\` pointant vers ${OFFICIAL_REGISTRY}.`,
    );
    return 1;
  }

  console.log(`OK: ${lockfilePath} ne référence que ${OFFICIAL_REGISTRY}.`);
  return 0;
}

process.exit(main(process.argv.slice(2)));
