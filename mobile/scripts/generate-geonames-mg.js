#!/usr/bin/env node

/**
 * Génère `src/data/geonames-mg.json` — jeu de données compact utilisé par
 * `src/lib/geo-administratif.ts` pour le géocodage inverse hors ligne
 * (Région/District/Commune depuis un point GPS), en repli de
 * `reverseGeocode()` (`src/lib/location.ts`) quand le géocodeur natif
 * (réseau requis) échoue — cas courant en brousse malgache.
 *
 * Source : GeoNames (https://www.geonames.org), licence CC BY 4.0 —
 * attribution obligatoire (déjà posée dans le footer de l'écran Profil,
 * `src/app/(app)/profile.tsx`). Ne pas retirer cette mention si ce script
 * ou son jeu de données sont déplacés/republiés.
 *
 * Ce script est un outil de développement ponctuel, PAS une étape de build :
 * le jeu de données généré est commité tel quel et ne change qu'à une
 * ré-exécution manuelle (les limites administratives malgaches ne bougent
 * quasiment jamais). Nécessite `unzip` sur le PATH (présent nativement sur
 * macOS/Linux, et dans Git Bash sous Windows).
 *
 * Usage : node scripts/generate-geonames-mg.js
 *
 * ## Format du fichier généré
 *
 * Chaînes dédupliquées en index plutôt que répétées sur chaque point (un
 * JSON naïf {lat,lon,region,district,commune} par point pèserait plus de
 * 3× ce format, pour ~24 000 points) :
 *   { regions: string[], districts: string[], communes: string[],
 *     points: [lat, lon, regionIdx, districtIdx, communeIdx][] }
 *
 * ## Pourquoi la hiérarchie GeoNames colle exactement à Région/District/Commune
 *
 * Vérifié sur le dump réel (MG.txt) avant d'écrire ce script : admin1 = 23
 * lignes (régions), admin2 = 119 lignes (districts), admin3 = 1577 lignes
 * (communes) — ça correspond au découpage administratif malgache. Les noms
 * de communes n'ont PAS de fichier de correspondance séparé (contrairement
 * à admin1/admin2, cf. `admin1CodesASCII.txt`/`admin2Codes.txt`) : ils se
 * lisent sur les lignes `feature code = ADM3` du dump principal lui-même.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const BASE_URL = 'https://download.geonames.org/export/dump/';
const OUT_PATH = path.join(__dirname, '..', 'src', 'data', 'geonames-mg.json');

async function telecharger(nomFichier, destDir) {
  const url = BASE_URL + nomFichier;
  const reponse = await fetch(url);
  if (!reponse.ok) {
    throw new Error(`Téléchargement échoué (${reponse.status}) : ${url}`);
  }
  const buffer = Buffer.from(await reponse.arrayBuffer());
  const dest = path.join(destDir, nomFichier);
  fs.writeFileSync(dest, buffer);
  return dest;
}

/** `admin1CodesASCII.txt`/`admin2Codes.txt` : deux colonnes "code\tnom" (+ colonnes ignorées). */
function chargerCorrespondance(cheminFichier) {
  const table = new Map();
  for (const ligne of fs.readFileSync(cheminFichier, 'utf8').split('\n')) {
    if (!ligne.trim()) continue;
    const [code, nom] = ligne.split('\t');
    table.set(code, nom);
  }
  return table;
}

function genererDepuisDump(dumpPath, admin1Path, admin2Path) {
  const admin1 = chargerCorrespondance(admin1Path);
  const admin2 = chargerCorrespondance(admin2Path);
  const lignes = fs.readFileSync(dumpPath, 'utf8').split('\n').filter(Boolean);

  // Noms de commune (admin3) : lus sur les lignes ADM3 du dump lui-même —
  // aucun fichier de correspondance dédié pour ce niveau (cf. commentaire
  // d'en-tête).
  const nomAdmin3 = new Map();
  for (const ligne of lignes) {
    const colonnes = ligne.split('\t');
    if (colonnes[7] !== 'ADM3') continue;
    const cle = `MG.${colonnes[10]}.${colonnes[11]}.${colonnes[12]}`;
    nomAdmin3.set(cle, colonnes[1]);
  }

  const regions = [];
  const districts = [];
  const communes = [];
  const indexRegion = new Map();
  const indexDistrict = new Map();
  const indexCommune = new Map();
  const points = [];
  let ignores = 0;

  for (const ligne of lignes) {
    const colonnes = ligne.split('\t');
    const classeGeo = colonnes[6];
    const admin3 = colonnes[12];
    // Feature class "P" = lieu habité (ville, village, hameau...) — le seul
    // niveau assez dense pour une recherche « point le plus proche » fiable
    // à l'échelle d'une commune.
    if (classeGeo !== 'P' || !admin3) continue;

    const cleRegion = `MG.${colonnes[10]}`;
    const cleDistrict = `MG.${colonnes[10]}.${colonnes[11]}`;
    const cleCommune = `MG.${colonnes[10]}.${colonnes[11]}.${admin3}`;
    const nomRegion = admin1.get(cleRegion);
    const nomDistrict = admin2.get(cleDistrict);
    const nomCommune = nomAdmin3.get(cleCommune);
    // Une des trois correspondances manque (dump incohérent/évolution du
    // format) : on ignore le point plutôt que d'écrire un nom vide — la
    // recherche par plus proche voisin doit toujours retomber sur un point
    // complet.
    if (!nomRegion || !nomDistrict || !nomCommune) {
      ignores += 1;
      continue;
    }

    if (!indexRegion.has(nomRegion)) {
      indexRegion.set(nomRegion, regions.length);
      regions.push(nomRegion);
    }
    if (!indexDistrict.has(nomDistrict)) {
      indexDistrict.set(nomDistrict, districts.length);
      districts.push(nomDistrict);
    }
    if (!indexCommune.has(nomCommune)) {
      indexCommune.set(nomCommune, communes.length);
      communes.push(nomCommune);
    }

    points.push([
      // 4 décimales (~11 m à l'équateur) : largement suffisant pour une
      // recherche de plus proche voisin à l'échelle d'une commune.
      // Colonnes 4/5 (latitude/longitude) — pas 3/4 : la colonne 3 est
      // `alternatenames`, un texte libre, jamais une coordonnée.
      Math.round(parseFloat(colonnes[4]) * 10000) / 10000,
      Math.round(parseFloat(colonnes[5]) * 10000) / 10000,
      indexRegion.get(nomRegion),
      indexDistrict.get(nomDistrict),
      indexCommune.get(nomCommune),
    ]);
  }

  console.log(
    `${points.length} points retenus (${ignores} ignorés, correspondance incomplète), ` +
      `${regions.length} régions, ${districts.length} districts, ${communes.length} communes.`
  );

  return { regions, districts, communes, points };
}

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'geonames-mg-'));
  try {
    console.log('Téléchargement du jeu de données GeoNames Madagascar...');
    const zipPath = await telecharger('MG.zip', tmpDir);
    const admin1Path = await telecharger('admin1CodesASCII.txt', tmpDir);
    const admin2Path = await telecharger('admin2Codes.txt', tmpDir);

    execFileSync('unzip', ['-o', zipPath, '-d', tmpDir], { stdio: 'inherit' });
    const dumpPath = path.join(tmpDir, 'MG.txt');

    const jeuDeDonnees = genererDepuisDump(dumpPath, admin1Path, admin2Path);

    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, JSON.stringify(jeuDeDonnees));
    const tailleKo = Math.round(fs.statSync(OUT_PATH).size / 1024);
    console.log(`Écrit ${OUT_PATH} (${tailleKo} Ko).`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
