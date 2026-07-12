// Logique pure d'agrégation et d'export CSV pour la page Synthèses (#18).
// Toutes les valeurs sont dérivées des fiches déjà chargées par
// SynthesesPage (mêmes filtres/données que ProspectionsPage) — aucun
// appel API supplémentaire, aucun recalcul divergent.

import type { CaptureRead, PopulationRead } from './prospection-fiche-lecture'

export interface SyntheseProspection {
  id: string
  campagne_id: string
  station_id: string | null
  statut: string
  n_fiche: string | null
  populations: PopulationRead[]
  captures: CaptureRead[]
}

export interface SyntheseFiltres {
  statut?: string
  campagneId?: string
  stationId?: string
}

export function filterProspectionsForSynthese<T extends SyntheseProspection>(
  prospections: T[],
  filtres: SyntheseFiltres,
): T[] {
  let result = prospections
  if (filtres.statut) result = result.filter((p) => p.statut === filtres.statut)
  if (filtres.campagneId) result = result.filter((p) => p.campagne_id === filtres.campagneId)
  if (filtres.stationId) result = result.filter((p) => p.station_id === filtres.stationId)
  return result
}

export interface AgregatEspece {
  espece: string
  densiteDiffuseMoyenne: number | null
  densiteGroupeeMoyenne: number | null
  capturesTotales: number
  nbFiches: number
}

function moyenne(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

/** Agrège densités moyennes et captures totales, groupées par une clé arbitraire (campagne, PA, ou espèce). */
export function buildAgregatsParEspece(prospections: SyntheseProspection[]): AgregatEspece[] {
  const especes = new Set<string>()
  for (const p of prospections) {
    for (const pop of p.populations) especes.add(pop.espece)
    for (const cap of p.captures) especes.add(cap.espece)
  }

  return [...especes].sort().map((espece) => {
    const diffuses: number[] = []
    const groupees: number[] = []
    let capturesTotales = 0
    const fichesConcernees = new Set<string>()

    for (const p of prospections) {
      for (const pop of p.populations) {
        if (pop.espece !== espece) continue
        if (pop.densite_diffuse !== null) diffuses.push(pop.densite_diffuse)
        if (pop.densite_groupee !== null) groupees.push(pop.densite_groupee)
        fichesConcernees.add(p.id)
      }
      for (const cap of p.captures) {
        if (cap.espece !== espece) continue
        capturesTotales += cap.effectif
        fichesConcernees.add(p.id)
      }
    }

    return {
      espece,
      densiteDiffuseMoyenne: moyenne(diffuses),
      densiteGroupeeMoyenne: moyenne(groupees),
      capturesTotales,
      nbFiches: fichesConcernees.size,
    }
  })
}

export interface AgregatGroupe {
  cle: string
  label: string
  parEspece: AgregatEspece[]
  nbFiches: number
}

/** Agrège par groupe (campagne ou PA), chaque groupe détaillé par espèce. */
export function buildAgregatsParGroupe(
  prospections: SyntheseProspection[],
  groupeDe: (p: SyntheseProspection) => string,
  labelDe: (cle: string) => string,
): AgregatGroupe[] {
  const groupes = new Map<string, SyntheseProspection[]>()
  for (const p of prospections) {
    const cle = groupeDe(p)
    if (!groupes.has(cle)) groupes.set(cle, [])
    groupes.get(cle)!.push(p)
  }

  return [...groupes.entries()]
    .map(([cle, fiches]) => ({
      cle,
      label: labelDe(cle),
      parEspece: buildAgregatsParEspece(fiches),
      nbFiches: fiches.length,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

const CSV_COLUMNS = ['Référence', 'Statut', 'Densité diffuse moy.', 'Densité groupée moy.', 'Captures totales'] as const

function csvEscape(value: string): string {
  if (/[",\n;]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

/** CSV du jeu de fiches filtré : référence, densités moyennes, captures, statut (AC #18). */
export function buildProspectionsCsv(prospections: SyntheseProspection[]): string {
  const lignes = prospections.map((p) => {
    const densitesDiffuses = p.populations
      .map((pop) => pop.densite_diffuse)
      .filter((v): v is number => v !== null)
    const densitesGroupees = p.populations
      .map((pop) => pop.densite_groupee)
      .filter((v): v is number => v !== null)
    const capturesTotales = p.captures.reduce((sum, c) => sum + c.effectif, 0)
    const moyDiffuse = moyenne(densitesDiffuses)
    const moyGroupee = moyenne(densitesGroupees)

    return [
      p.n_fiche ?? p.id,
      p.statut,
      moyDiffuse !== null ? moyDiffuse.toFixed(2) : '',
      moyGroupee !== null ? moyGroupee.toFixed(2) : '',
      String(capturesTotales),
    ]
      .map(csvEscape)
      .join(';')
  })

  return [CSV_COLUMNS.join(';'), ...lignes].join('\n')
}
