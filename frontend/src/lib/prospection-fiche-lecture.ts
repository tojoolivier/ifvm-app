// Logique pure de synthèse pour la vue imprimable / export PDF d'une fiche
// validée (#19). Toutes les valeurs sont dérivées des données déjà chargées
// par ProspectionDetailPage — aucune resaisie ni recalcul divergent.

export const STATUT_VALIDE = 'validee'

export interface PopulationRead {
  id: string
  espece: string
  categorie: string
  densite_diffuse: number | null
  densite_groupee: number | null
}

export interface CaptureRead {
  id: string
  espece: string
  categorie: string
  phase: string
  stade: string
  effectif: number
}

export interface InfestationRead {
  id: string
  type_cible: string
  surface_totale: number | null
  densite_moy: number | null
  comportement: string | null
}

export const PHENOTYPES: { value: string; label: string }[] = [
  { value: 'solitaire', label: 'Solitaires' },
  { value: 'solitaro_trans', label: 'Solitaro-trans' },
  { value: 'transiens', label: 'Transiens' },
  { value: 'gregaire', label: 'Grégaires' },
]

// "essaim" a disparu (migration backend 0031) : Dense et Très dense sont désormais des
// types de cible à part entière, au même niveau que Vol clair.
export const TYPE_CIBLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'tache_larvaire', label: 'Tache larvaire' },
  { value: 'bande_larvaire', label: 'Bande larvaire' },
  { value: 'vol_clair', label: 'Vol clair' },
  { value: 'dense', label: 'Dense' },
  { value: 'tres_dense', label: 'Très dense' },
]

/** Une fiche n'est imprimable/exportable (#19) que si elle a atteint le statut final Validé. */
export function isFicheValidee(statut: string): boolean {
  return statut === STATUT_VALIDE
}

export interface EspeceSyntheseViewModel {
  espece: string
  totalCaptures: number
  densiteDiffuse: number | null
  densiteGroupee: number | null
  phenotypeDominantLabel: string
}

/** Synthèse par espèce (LMC/NSE) : totaux capturés, densité /ha, phénotype dominant. */
export function buildEspecesSynthese(
  captures: CaptureRead[],
  populations: PopulationRead[],
): EspeceSyntheseViewModel[] {
  const especes = [...new Set([...captures.map((c) => c.espece), ...populations.map((p) => p.espece)])].sort()

  return especes.map((espece) => {
    const especeCaptures = captures.filter((c) => c.espece === espece)
    const totalCaptures = especeCaptures.reduce((sum, c) => sum + c.effectif, 0)

    const parPhase = new Map<string, number>()
    for (const c of especeCaptures) {
      parPhase.set(c.phase, (parPhase.get(c.phase) ?? 0) + c.effectif)
    }
    let dominant: string | null = null
    let max = 0
    for (const [phase, total] of parPhase) {
      if (total > max) {
        max = total
        dominant = phase
      }
    }

    const especePopulations = populations.filter((p) => p.espece === espece)
    const densiteDiffuse = especePopulations.reduce<number | null>(
      (acc, p) => (p.densite_diffuse != null ? (acc ?? 0) + p.densite_diffuse : acc),
      null,
    )
    const densiteGroupee = especePopulations.reduce<number | null>(
      (acc, p) => (p.densite_groupee != null ? (acc ?? 0) + p.densite_groupee : acc),
      null,
    )

    return {
      espece,
      totalCaptures,
      densiteDiffuse,
      densiteGroupee,
      phenotypeDominantLabel: dominant ? PHENOTYPES.find((p) => p.value === dominant)?.label ?? dominant : '—',
    }
  })
}

export interface InfestationSyntheseViewModel {
  hasInfestation: boolean
  typeLabel: string
  surfaceTotale: number | null
  comportementLabel: string
}

/** Synthèse infestation : type de cible, surface, comportement — dérivée de prospection_infestation. */
export function buildInfestationSynthese(infestations: InfestationRead[]): InfestationSyntheseViewModel {
  const infestation = infestations[0]
  if (!infestation) {
    return { hasInfestation: false, typeLabel: '—', surfaceTotale: null, comportementLabel: '—' }
  }
  return {
    hasInfestation: true,
    typeLabel: TYPE_CIBLE_OPTIONS.find((o) => o.value === infestation.type_cible)?.label ?? infestation.type_cible,
    surfaceTotale: infestation.surface_totale,
    comportementLabel:
      infestation.comportement === 'deplacement' ? 'Déplacement' : infestation.comportement === 'repos' ? 'Repos' : '—',
  }
}

const STRATE_LABELS: Record<string, string> = {
  arboree: 'Arborée',
  arbustive: 'Arbustive',
  buissonneuse: 'Buissonneuse',
  herbeuse: 'Herbeuse',
  cultures_seches: 'Cultures sèches',
  sol_nu: 'Sol nu',
}

const HUMIDITE_LABELS: Record<string, string> = {
  surface: 'Surf.',
  '0_5cm': '0,5 cm',
  '5_12cm': '5-12 cm',
  '12_30cm': '12-30',
  gt_30cm: '>30',
}

const TEXTURE_LABELS: Record<string, string> = {
  limoneuse: 'Limoneuse',
  argileuse: 'Argileuse',
  sable_fin: 'Sable fin',
  gravier: 'Gravier',
  cailloux: 'Cailloux',
}

const DEGATS_LABELS: Record<string, string> = {
  nuls: 'Nuls',
  faibles: 'Faibles',
  moyens: 'Moyens',
  forts: 'Forts',
}

/**
 * Synthèse végétation/sol : recouvrement des strates + humidité/texture/dégâts.
 * `vegetation`/`sol` sont les JSONB archivaux renvoyés tels quels par l'API (ADR-006).
 */
export function buildVegetationSummary(
  vegetation: Record<string, unknown> | null,
  sol: Record<string, unknown> | null,
  degatsCultures: string | null,
): string {
  const strates = (vegetation?.strates as Record<string, { recouvrement?: number }> | undefined) ?? {}
  const strateParts = Object.entries(strates)
    .filter(([, detail]) => (detail?.recouvrement ?? 0) > 0)
    .map(([key, detail]) => `${STRATE_LABELS[key] ?? key} ${detail.recouvrement}%`)
    .join(', ')
  const total = Object.values(strates).reduce((sum, detail) => sum + (detail?.recouvrement ?? 0), 0)

  const parts: string[] = [`Strates (${total}%) : ${strateParts || '—'}`]
  const humidite = sol?.humidite as string | undefined
  // Sélection multiple côté mobile (veg.tsx) : `sol.texture` est un tableau. Un ancien
  // brouillon enregistré avant l'ajout du multi-select peut encore porter une simple
  // string — les deux formats sont acceptés pour ne pas faire disparaître la texture.
  const textureRaw = sol?.texture as string | string[] | undefined
  const textures = Array.isArray(textureRaw) ? textureRaw : textureRaw ? [textureRaw] : []
  if (humidite) parts.push(`Humidité ${HUMIDITE_LABELS[humidite] ?? humidite}`)
  if (textures.length > 0) {
    parts.push(`Texture ${textures.map((t) => TEXTURE_LABELS[t] ?? t).join(', ')}`)
  }
  if (degatsCultures) parts.push(`Dégâts culture ${DEGATS_LABELS[degatsCultures] ?? degatsCultures}`)
  return parts.join(' · ')
}

export interface FicheImprimableInput {
  n_fiche: string | null
  date_prospection: string
  latitude: number | null
  longitude: number | null
  surface_station: number | null
  surface_prospectee: number | null
  surface_infestee: number | null
  vegetation: Record<string, unknown> | null
  sol: Record<string, unknown> | null
  degats_cultures: string | null
  captures: CaptureRead[]
  populations: PopulationRead[]
  infestations: InfestationRead[]
}

export interface FicheImprimableViewModel {
  nFiche: string
  dateProspection: string
  positionGps: string
  surfaceStation: number | null
  surfaceProspectee: number | null
  surfaceInfestee: number | null
  especes: EspeceSyntheseViewModel[]
  infestation: InfestationSyntheseViewModel
  vegetationSummary: string
}

/** Construit la vue imprimable (#19) à partir de la fiche déjà chargée — aucun nouvel appel API. */
export function buildFicheImprimable(prospection: FicheImprimableInput): FicheImprimableViewModel {
  return {
    nFiche: prospection.n_fiche ?? '—',
    dateProspection: prospection.date_prospection,
    positionGps: formatCoordinates(prospection.latitude, prospection.longitude),
    surfaceStation: prospection.surface_station,
    surfaceProspectee: prospection.surface_prospectee,
    surfaceInfestee: prospection.surface_infestee,
    especes: buildEspecesSynthese(prospection.captures, prospection.populations),
    infestation: buildInfestationSynthese(prospection.infestations),
    vegetationSummary: buildVegetationSummary(prospection.vegetation, prospection.sol, prospection.degats_cultures),
  }
}

function formatCoordinates(latitude: number | null, longitude: number | null): string {
  if (latitude == null || longitude == null) return '—'
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
}
