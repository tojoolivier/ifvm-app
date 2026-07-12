// Logique pure pour la carte des infestations (#17) : position des marqueurs
// et sévérité, dérivées des fiches déjà chargées par CartePage (mêmes filtres
// que ProspectionsPage) — aucun appel API supplémentaire.

import type { InfestationRead } from './prospection-fiche-lecture'

export interface CarteStation {
  id: string
  latitude: number
  longitude: number
}

export interface CarteProspection {
  id: string
  campagne_id: string
  station_id: string | null
  statut: string
  n_fiche: string | null
  latitude: number | null
  longitude: number | null
  infestations: InfestationRead[]
}

export interface CarteFiltres {
  statut?: string
  campagneId?: string
  stationId?: string
}

export function filterProspectionsForCarte<T extends CarteProspection>(
  prospections: T[],
  filtres: CarteFiltres,
): T[] {
  let result = prospections
  if (filtres.statut) result = result.filter((p) => p.statut === filtres.statut)
  if (filtres.campagneId) result = result.filter((p) => p.campagne_id === filtres.campagneId)
  if (filtres.stationId) result = result.filter((p) => p.station_id === filtres.stationId)
  return result
}

export type SeveriteNiveau = 'faible' | 'moyenne' | 'forte'

const SEUIL_FORTE_SURFACE = 50
const SEUIL_MOYENNE_SURFACE = 10
const SEUIL_FORTE_DENSITE = 20
const SEUIL_MOYENNE_DENSITE = 5

/** Sévérité dérivée de la surface infestée totale (ha), à défaut de la densité moyenne. */
export function computeSeverite(infestations: InfestationRead[]): SeveriteNiveau {
  const surface = infestations.reduce<number | null>(
    (acc, i) => (i.surface_tot != null ? (acc ?? 0) + i.surface_tot : acc),
    null,
  )
  if (surface != null) {
    if (surface >= SEUIL_FORTE_SURFACE) return 'forte'
    if (surface >= SEUIL_MOYENNE_SURFACE) return 'moyenne'
    return 'faible'
  }

  const densites = infestations
    .map((i) => i.densite_moy)
    .filter((d): d is number => d != null)
  if (densites.length > 0) {
    const densiteMax = Math.max(...densites)
    if (densiteMax >= SEUIL_FORTE_DENSITE) return 'forte'
    if (densiteMax >= SEUIL_MOYENNE_DENSITE) return 'moyenne'
    return 'faible'
  }

  return 'faible'
}

export interface CarteMarker {
  prospectionId: string
  latitude: number
  longitude: number
  severite: SeveriteNiveau
  nFiche: string | null
}

/**
 * Un marqueur par fiche ayant au moins une infestation renseignée. Position
 * ponctuelle (latitude/longitude propres à la fiche) si présente, sinon
 * position de la station rattachée.
 */
export function buildCarteMarkers<T extends CarteProspection>(
  prospections: T[],
  stations: CarteStation[],
): CarteMarker[] {
  const stationMap = new Map(stations.map((s) => [s.id, s]))
  const markers: CarteMarker[] = []

  for (const p of prospections) {
    if (p.infestations.length === 0) continue

    let latitude: number | null = p.latitude
    let longitude: number | null = p.longitude
    if ((latitude == null || longitude == null) && p.station_id) {
      const station = stationMap.get(p.station_id)
      if (station) {
        latitude = station.latitude
        longitude = station.longitude
      }
    }
    if (latitude == null || longitude == null) continue

    markers.push({
      prospectionId: p.id,
      latitude,
      longitude,
      severite: computeSeverite(p.infestations),
      nFiche: p.n_fiche,
    })
  }

  return markers
}
