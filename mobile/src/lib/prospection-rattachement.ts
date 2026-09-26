export interface Coordonnees {
  latitude: number;
  longitude: number;
}

export interface Localisable {
  latitude: number | null;
  longitude: number | null;
}

const RAYON_TERRE_M = 6_371_000;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Distance à vol d'oiseau (haversine), en mètres. */
function distanceM(a: Coordonnees, b: Coordonnees): number {
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * RAYON_TERRE_M * Math.asin(Math.sqrt(h));
}

/** Candidat le plus proche de `position` ; ceux sans coordonnées sont ignorés. */
export function plusProche<T extends Localisable>(
  position: Coordonnees,
  candidats: readonly T[]
): { item: T; distanceM: number } | null {
  let meilleur: { item: T; distanceM: number } | null = null;
  for (const item of candidats) {
    if (item.latitude == null || item.longitude == null) continue;
    const d = distanceM(position, { latitude: item.latitude, longitude: item.longitude });
    if (!meilleur || d < meilleur.distanceM) meilleur = { item, distanceM: d };
  }
  return meilleur;
}

/** « 350 m » sous 1 km, « 2,1 km » au-dessus (virgule française). */
export function formaterDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(1).replace('.', ',')} km`;
}

/** Emprise de Madagascar (marge comprise) : écarte le (0, 0) d'un GPS muet et les fautes de frappe. */
export function coordonneesValides(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -26 &&
    latitude <= -11 &&
    longitude >= 43 &&
    longitude <= 51
  );
}
