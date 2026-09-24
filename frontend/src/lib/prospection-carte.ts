// Logique pure pour la carte des infestations (#17) : position des marqueurs
// et sévérité, dérivées des fiches déjà chargées par CartePage (mêmes filtres
// que ProspectionsPage) — aucun appel API supplémentaire. Toute fiche (intensive
// ou extensive) qui déclare une surface infestée ou au moins une infestation est
// cartographiée dès qu'elle a une position.

import { comportementInfestationLabel, typeCibleLabel, type InfestationRead } from './prospection-fiche-lecture'
import { libelleSurfaceTraitee, surfaceTraiteeOuProtegee } from './traitement-fiche'

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
  // Bases aériennes déclarées sur la fiche (prospection extensive en mode aérien).
  base?: string | null
  base_numero?: number | null
  base_date_installation?: string | null
  base_latitude?: number | null
  base_longitude?: number | null
  base_secondaire?: string | null
  base_secondaire_date_installation?: string | null
  base_secondaire_latitude?: number | null
  base_secondaire_longitude?: number | null
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

// ---------------------------------------------------------------------------
// Surfaces traitées : un marqueur par fiche de traitement (aérien ou terrestre)
// qui a traité ou protégé une surface (> 0).
// ---------------------------------------------------------------------------

type Surface = number | string | null

export interface CarteTraitement {
  id: string
  prospection_id: string
  numero_fiche: string
  type_traitement: string
  mode_traitement: string | null
  date_traitement: string
  latitude: number | null
  longitude: number | null
  aerien: { surface_traitee_ha?: Surface; surface_protegee_ha?: Surface; surface_restante_ha?: Surface } | null
  terrestre: { surface_traitee_ha?: Surface; surface_protegee_ha?: Surface; surface_restante_ha?: Surface } | null
}

export interface TraitementMarker {
  traitementId: string
  latitude: number
  longitude: number
  numeroFiche: string
  typeTraitement: string
  modeTraitement: string | null
  dateTraitement: string
  /** « Traitée » (produit de choc) ou « Protégée » (produit de barrière). */
  libelleSurface: 'Traitée' | 'Protégée'
  surfaceHa: number
  surfaceRestanteHa: number | null
}

function enNombre(valeur: Surface | undefined): number | null {
  if (valeur == null || valeur === '') return null
  const nombre = typeof valeur === 'number' ? valeur : Number(valeur)
  return Number.isFinite(nombre) ? nombre : null
}

/**
 * Un marqueur par traitement dont la surface traitée (ou protégée, en mode barrière) est
 * > 0. Position : coordonnées propres au traitement, sinon celles de la fiche de
 * prospection liée (ponctuelles, puis station). Sans position exploitable, il est ignoré.
 */
export function buildTraitementMarkers(
  traitements: CarteTraitement[],
  prospections: CarteProspection[],
  stations: CarteStation[],
): TraitementMarker[] {
  const prospectionMap = new Map(prospections.map((p) => [p.id, p]))
  const stationMap = new Map(stations.map((s) => [s.id, s]))
  const markers: TraitementMarker[] = []

  for (const t of traitements) {
    const surfaceHa = enNombre(surfaceTraiteeOuProtegee(t))
    if (surfaceHa == null || surfaceHa <= 0) continue

    let latitude = t.latitude
    let longitude = t.longitude
    if (latitude == null || longitude == null) {
      const prospection = prospectionMap.get(t.prospection_id)
      latitude = prospection?.latitude ?? null
      longitude = prospection?.longitude ?? null
      if ((latitude == null || longitude == null) && prospection?.station_id) {
        const station = stationMap.get(prospection.station_id)
        latitude = station?.latitude ?? null
        longitude = station?.longitude ?? null
      }
    }
    if (latitude == null || longitude == null) continue

    const specialisation = t.terrestre ?? t.aerien
    markers.push({
      traitementId: t.id,
      latitude,
      longitude,
      numeroFiche: t.numero_fiche,
      typeTraitement: t.type_traitement,
      modeTraitement: t.mode_traitement,
      dateTraitement: t.date_traitement,
      libelleSurface: libelleSurfaceTraitee(t),
      surfaceHa,
      surfaceRestanteHa: enNombre(specialisation?.surface_restante_ha),
    })
  }

  return markers
}

// ---------------------------------------------------------------------------
// Bases aériennes : les bases (principale et secondaire) déclarées sur les fiches
// de prospection extensive en mode aérien — un déplacement de base se lit comme
// l'apparition d'une base secondaire, avec sa date d'installation.
// ---------------------------------------------------------------------------

export type BaseAerienneType = 'principale' | 'secondaire'

export interface BaseAerienneMarker {
  /** Clé de déduplication : type + coordonnées arrondies (la même base revient sur plusieurs fiches). */
  key: string
  type: BaseAerienneType
  nom: string | null
  numero: number | null
  dateInstallation: string | null
  latitude: number
  longitude: number
  /** Nombre de fiches filtrées qui déclarent cette base. */
  nbFiches: number
  /** Première fiche qui la déclare — cible du lien « Voir la fiche ». */
  prospectionId: string
}

export function buildBaseAerienneMarkers(prospections: CarteProspection[]): BaseAerienneMarker[] {
  const bases = new Map<string, BaseAerienneMarker>()

  function ajouter(
    p: CarteProspection,
    type: BaseAerienneType,
    latitude: number | null | undefined,
    longitude: number | null | undefined,
    nom: string | null | undefined,
    numero: number | null | undefined,
    dateInstallation: string | null | undefined,
  ) {
    if (latitude == null || longitude == null) return
    const key = `${type}|${latitude.toFixed(4)}|${longitude.toFixed(4)}`
    const existante = bases.get(key)
    if (existante) {
      existante.nbFiches += 1
      existante.nom ??= nom ?? null
      existante.dateInstallation ??= dateInstallation ?? null
      return
    }
    bases.set(key, {
      key,
      type,
      nom: nom ?? null,
      numero: numero ?? null,
      dateInstallation: dateInstallation ?? null,
      latitude,
      longitude,
      nbFiches: 1,
      prospectionId: p.id,
    })
  }

  for (const p of prospections) {
    ajouter(p, 'principale', p.base_latitude, p.base_longitude, p.base, p.base_numero, p.base_date_installation)
    ajouter(
      p,
      'secondaire',
      p.base_secondaire_latitude,
      p.base_secondaire_longitude,
      p.base_secondaire,
      null,
      p.base_secondaire_date_installation,
    )
  }

  return [...bases.values()]
}

// ---------------------------------------------------------------------------
// Couches : quelles fiches l'utilisateur veut voir sur la carte.
// ---------------------------------------------------------------------------

export type CoucheCarte =
  | 'prospection_intensive'
  | 'prospection_extensive'
  | 'prospection_validation'
  | 'traitement_aerien'
  | 'traitement_terrestre'
  | 'base_aerienne'

export interface CoucheGroupe {
  groupe: string
  couches: { key: CoucheCarte; label: string }[]
}

export const COUCHES_CARTE: CoucheGroupe[] = [
  {
    groupe: 'Prospection',
    couches: [
      { key: 'prospection_intensive', label: 'Intensive' },
      { key: 'prospection_extensive', label: 'Extensive' },
      { key: 'prospection_validation', label: 'Validation' },
    ],
  },
  {
    groupe: 'Traitement',
    couches: [
      { key: 'traitement_aerien', label: 'Aérien' },
      { key: 'traitement_terrestre', label: 'Terrestre' },
    ],
  },
  {
    groupe: 'Base aérienne',
    couches: [{ key: 'base_aerienne', label: 'Déplacement de base aérienne' }],
  },
]

export const TOUTES_LES_COUCHES: CoucheCarte[] = COUCHES_CARTE.flatMap((g) => g.couches.map((c) => c.key))

/**
 * Couche d'une fiche de prospection selon son type. Un type absent ou inconnu (fiche plus
 * ancienne que le champ) reste visible tant qu'au moins une couche de prospection est cochée.
 */
export function coucheProspection(type: string | null | undefined): CoucheCarte | null {
  if (type === 'intensive') return 'prospection_intensive'
  if (type === 'extensive') return 'prospection_extensive'
  if (type === 'validation') return 'prospection_validation'
  return null
}

export function prospectionVisible(type: string | null | undefined, couches: ReadonlySet<CoucheCarte>): boolean {
  const couche = coucheProspection(type)
  if (couche) return couches.has(couche)
  return couches.has('prospection_intensive') || couches.has('prospection_extensive') || couches.has('prospection_validation')
}

export function traitementVisible(typeTraitement: string, couches: ReadonlySet<CoucheCarte>): boolean {
  if (typeTraitement === 'AERIEN') return couches.has('traitement_aerien')
  if (typeTraitement === 'TERRESTRE') return couches.has('traitement_terrestre')
  return couches.has('traitement_aerien') || couches.has('traitement_terrestre')
}
