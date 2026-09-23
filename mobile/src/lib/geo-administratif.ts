import geonamesMg from '@/data/geonames-mg.json';

/**
 * Géocodage inverse hors ligne (Région/District/Commune depuis un point GPS) —
 * repli de `reverseGeocode()` (`./location.ts`) quand le géocodeur natif
 * (`Location.reverseGeocodeAsync`, qui a besoin des services Google/Apple, donc
 * typiquement d'un accès réseau) échoue ou ne répond pas, cas courant en
 * brousse malgache hors couverture.
 *
 * Le jeu de données (`src/data/geonames-mg.json`, ~24 000 lieux habités
 * malgaches, généré par `scripts/generate-geonames-mg.js` depuis GeoNames —
 * CC BY 4.0, attribution posée sur l'écran Profil) est bundlé avec l'app :
 * une géographie administrative nationale qui ne change quasiment jamais,
 * pas un référentiel métier vivant — donc pas de synchro, contrairement au
 * reste du référentiel (`referentiel-sync.ts`).
 *
 * Cette table est indépendante de notre propre référentiel `commune` (très
 * partiel, dérivé des seules stations connues — cf. `referentiel-db.ts`) :
 * les noms de commune renvoyés ici sont ceux de GeoNames, pas forcément une
 * commune déjà connue de ce référentiel. Sans conséquence : Région/District/
 * Commune issus du géocodage inverse sont purement informatifs, jamais liés
 * à un `commune_id` (cf. les 3 écrans appelants de `reverseGeocode`).
 */

interface GeonamesMg {
  regions: string[];
  districts: string[];
  communes: string[];
  /** [latitude, longitude, indexRégion, indexDistrict, indexCommune] */
  points: [number, number, number, number, number][];
}

const donnees = geonamesMg as GeonamesMg;

export interface ZoneAdministrative {
  region: string;
  district: string;
  commune: string;
}

/**
 * Distance équirectangulaire (approximation plane, pas haversine) : à
 * l'échelle de Madagascar, l'erreur induite est négligeable devant l'espacement
 * réel entre points GeoNames — inutile d'alourdir un calcul répété ~24 000 fois
 * par appel avec des fonctions trigonométriques sphériques complètes. Seul
 * l'ORDRE des distances importe ici (plus proche voisin), pas leur valeur
 * exacte en mètres.
 */
function distanceCarreeApprox(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = lat1 - lat2;
  const dLon = (lon1 - lon2) * Math.cos((lat1 * Math.PI) / 180);
  return dLat * dLat + dLon * dLon;
}

/**
 * Point GeoNames le plus proche → sa Région/District/Commune. `null`
 * seulement si le jeu de données est vide (ne devrait jamais arriver en
 * pratique, c'est un fichier généré et commité) — jamais d'exception : un
 * géocodage hors ligne raté doit se comporter comme un géocodage natif raté
 * (cf. `reverseGeocode`), pas bloquer la fiche.
 */
export function resoudreZoneHorsLigne(latitude: number, longitude: number): ZoneAdministrative | null {
  const { points, regions, districts, communes } = donnees;
  let meilleurIndex = -1;
  let meilleureDistance = Infinity;

  for (let i = 0; i < points.length; i++) {
    const [plat, plon] = points[i];
    const distance = distanceCarreeApprox(latitude, longitude, plat, plon);
    if (distance < meilleureDistance) {
      meilleureDistance = distance;
      meilleurIndex = i;
    }
  }

  if (meilleurIndex === -1) return null;

  const [, , indexRegion, indexDistrict, indexCommune] = points[meilleurIndex];
  return {
    region: regions[indexRegion],
    district: districts[indexDistrict],
    commune: communes[indexCommune],
  };
}
