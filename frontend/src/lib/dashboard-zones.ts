// Données de la carte « Zones suivies par région » du tableau de bord.
//
// Une bulle par région, posée au centre des fiches qui s'y rattachent et
// dimensionnée par leur nombre. Trois lectures, au choix de l'utilisateur :
// ce qui a été prospecté, ce qui est infesté, ce qui a été traité ou protégé.
//
// Logique pure (pas de Leaflet ni de React) pour rester testable dans jsdom.

import {
  surfaceProtegeeDe,
  surfaceTraiteeDe,
  type DashboardProspection,
  type DashboardStation,
  type DashboardTraitement,
} from './dashboard-metrics'

export type ModeZone = 'prospection' | 'infestation' | 'traitement'

export interface ZoneRegion {
  /** Clé stable : région normalisée, ou identifiant de la fiche si elle n'a pas de région. */
  cle: string
  region: string
  latitude: number
  longitude: number
  /** Nombre de fiches (prospection ou traitement selon le mode) rattachées à la zone. */
  nFiches: number
  /** Surface cumulée en hectares, dans la lecture du mode. */
  surfaceHa: number
}

export interface ResultatZones {
  zones: ZoneRegion[]
  /** Fiches sans coordonnées exploitables : comptées à part, jamais placées au hasard. */
  sansPosition: number
}

export const SANS_REGION = 'Sans région'

interface ElementZone {
  id: string
  region: string | null
  latitude: number | null
  longitude: number | null
  surfaceHa: number
}

function nettoyer(valeur: string | null | undefined): string | null {
  const v = valeur?.trim()
  return v ? v : null
}

/** « Atsimo-Andrefana » et « atsimo andrefana » désignent la même région. */
function normaliser(region: string): string {
  return region
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function coordonnees(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): [number, number] | null {
  return latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude)
    ? [latitude, longitude]
    : null
}

export function buildZones(
  mode: ModeZone,
  prospections: DashboardProspection[],
  traitements: DashboardTraitement[],
  stations: DashboardStation[],
): ResultatZones {
  const stationParId = new Map(stations.map((s) => [s.id, s]))
  const fichesParId = new Map(prospections.map((p) => [p.id, p]))

  // Position d'une fiche de prospection : ses coordonnées, à défaut celles de sa station.
  const positionFiche = (p: DashboardProspection): [number, number] | null => {
    const propre = coordonnees(p.latitude, p.longitude)
    if (propre) return propre
    const station = p.station_id ? stationParId.get(p.station_id) : undefined
    return coordonnees(station?.latitude, station?.longitude)
  }

  const elements: ElementZone[] = []

  if (mode === 'traitement') {
    for (const t of traitements) {
      const surfaceHa = surfaceTraiteeDe(t) + surfaceProtegeeDe(t)
      // Une fiche de traitement sans surface n'a rien traité : elle ne dessine pas de zone.
      if (!(surfaceHa > 0)) continue
      const fiche = fichesParId.get(t.prospection_id)
      const position = coordonnees(t.latitude, t.longitude) ?? (fiche ? positionFiche(fiche) : null)
      elements.push({
        id: t.id,
        region: nettoyer(t.region) ?? nettoyer(fiche?.region),
        latitude: position?.[0] ?? null,
        longitude: position?.[1] ?? null,
        surfaceHa,
      })
    }
  } else {
    for (const p of prospections) {
      const surfaceHa =
        mode === 'infestation' ? (p.surface_infestee ?? 0) : (p.surface_prospectee ?? 0)
      // Infestation : seules les fiches où du criquet a été déclaré comptent.
      if (mode === 'infestation' && !(surfaceHa > 0)) continue
      const position = positionFiche(p)
      elements.push({
        id: p.id,
        region: nettoyer(p.region),
        latitude: position?.[0] ?? null,
        longitude: position?.[1] ?? null,
        surfaceHa,
      })
    }
  }

  const groupes = new Map<
    string,
    { region: string; somLat: number; somLon: number; n: number; surfaceHa: number }
  >()
  let sansPosition = 0
  for (const e of elements) {
    if (e.latitude == null || e.longitude == null) {
      sansPosition++
      continue
    }
    // Sans région, une fiche reste une bulle à elle : moyenner des fiches
    // éparpillées sur l'île donnerait un point qui ne désigne rien.
    const cle = e.region ? normaliser(e.region) : `sans-region:${e.id}`
    const g = groupes.get(cle) ?? {
      region: e.region ?? SANS_REGION,
      somLat: 0,
      somLon: 0,
      n: 0,
      surfaceHa: 0,
    }
    g.somLat += e.latitude
    g.somLon += e.longitude
    g.n += 1
    g.surfaceHa += e.surfaceHa
    groupes.set(cle, g)
  }

  const zones = [...groupes.entries()]
    .map(([cle, g]) => ({
      cle,
      region: g.region,
      latitude: g.somLat / g.n,
      longitude: g.somLon / g.n,
      nFiches: g.n,
      surfaceHa: g.surfaceHa,
    }))
    // Les grosses bulles d'abord : dessinées en dessous, les petites restent cliquables.
    .sort((a, b) => b.nFiches - a.nFiches || a.region.localeCompare(b.region, 'fr'))

  return { zones, sansPosition }
}

const RAYON_MIN = 7
const RAYON_MAX = 30

/**
 * Rayon en pixels d'une bulle. L'aire est proportionnelle au nombre de fiches
 * (rayon ∝ √n) : une région à 4 fiches a une bulle deux fois plus large, pas
 * quatre fois, ce que l'œil lit correctement.
 */
export function rayonBulle(nFiches: number, maxFiches: number): number {
  if (maxFiches <= 0) return RAYON_MIN
  return RAYON_MIN + (RAYON_MAX - RAYON_MIN) * Math.sqrt(Math.max(0, nFiches) / maxFiches)
}
