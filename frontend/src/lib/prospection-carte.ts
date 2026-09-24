// Logique pure pour la carte des infestations (#17) : position des marqueurs
// et sévérité, dérivées des fiches déjà chargées par CartePage (mêmes filtres
// que ProspectionsPage) — aucun appel API supplémentaire. Toute fiche (intensive
// ou extensive) qui déclare une surface infestée ou au moins une infestation est
// cartographiée dès qu'elle a une position.

import { comportementInfestationLabel, typeCibleLabel, type InfestationRead } from './prospection-fiche-lecture'

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
  /** Surface infestée déclarée sur la fiche elle-même (ha), pour toute fiche intensive ou extensive. */
  surface_infestee?: number | null
  type_prospection?: string
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

function sommeSurfaces(infestations: InfestationRead[]): number | null {
  return infestations.reduce<number | null>(
    (acc, i) => (i.surface_totale != null ? (acc ?? 0) + i.surface_totale : acc),
    null,
  )
}

/**
 * Sévérité dérivée de la surface infestée (ha) — celle de la fiche si fournie, sinon la
 * somme des surfaces des infestations —, à défaut de la densité moyenne.
 */
export function computeSeverite(
  infestations: InfestationRead[],
  surfaceFiche?: number | null,
): SeveriteNiveau {
  const surface = surfaceFiche ?? sommeSurfaces(infestations)
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

/** Une infestation acridienne de la fiche, prête à afficher dans le popup du marqueur. */
export interface CarteInfestationLigne {
  typeLabel: string
  surfaceTotale: number | null
  densiteMoy: number | null
  comportementLabel: string
}

export interface CarteMarker {
  prospectionId: string
  latitude: number
  longitude: number
  severite: SeveriteNiveau
  nFiche: string | null
  typeProspection: string | null
  /** Situation d'infestation : une ligne par infestation de la fiche. */
  infestations: CarteInfestationLigne[]
  /** Surface infestée cumulée (ha) ; `null` si aucune surface n'est renseignée. */
  surfaceTotale: number | null
}

export function buildInfestationLignes(infestations: InfestationRead[]): CarteInfestationLigne[] {
  return infestations.map((i) => ({
    typeLabel: typeCibleLabel(i.type_cible),
    surfaceTotale: i.surface_totale,
    densiteMoy: i.densite_moy,
    comportementLabel: comportementInfestationLabel(i.comportement),
  }))
}

/**
 * Un marqueur par fiche ayant une surface infestée (> 0) ou au moins une infestation
 * renseignée, quel que soit son type (intensive/extensive). Position
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
    const surfaceFiche = p.surface_infestee ?? null
    const aSurfaceInfestee = surfaceFiche != null && surfaceFiche > 0
    if (p.infestations.length === 0 && !aSurfaceInfestee) continue

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
      severite: computeSeverite(p.infestations, surfaceFiche),
      nFiche: p.n_fiche,
      typeProspection: p.type_prospection ?? null,
      infestations: buildInfestationLignes(p.infestations),
      surfaceTotale: surfaceFiche ?? sommeSurfaces(p.infestations),
    })
  }

  return markers
}
