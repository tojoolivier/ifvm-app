// Répartition des prospections par type — section du tableau de bord.
//
// Les types ne sont pas figés dans l'écran : on regroupe ce qui existe dans les
// fiches chargées. La base n'en autorise aujourd'hui que trois (contrainte SQL
// `intensive | extensive | validation`), mais un quatrième type apparaîtrait ici
// sans changement de code.
//
// Logique pure (pas de React) pour rester testable sans monter le rendu.

import type { DashboardProspection } from './dashboard-metrics'

export type MesureRepartition = 'fiches' | 'surface'

export interface PartType {
  /** Valeur brute de `type_prospection`. */
  type: string
  label: string
  nFiches: number
  /** Somme des `surface_prospectee`, en hectares (fiches sans surface comptées pour 0). */
  surfaceHa: number
  /** Valeur de la mesure choisie (nombre de fiches ou surface). */
  valeur: number
  /** Part de `valeur` dans le total de la mesure, en % arrondi à une décimale. */
  pct: number
}

const LABELS: Record<string, string> = {
  intensive: 'Intensive',
  extensive: 'Extensive',
  validation: 'Validation',
}

/**
 * Ordre fixe des types connus : la couleur d'un type est attachée à *lui*, pas à
 * son rang du moment — un filtre ou un changement d'effectifs ne doit jamais
 * repeindre une série. Les types inconnus viennent après, par ordre alphabétique.
 */
export const ORDRE_TYPES = ['intensive', 'extensive', 'validation'] as const

export function libelleType(type: string): string {
  return LABELS[type] ?? type.charAt(0).toUpperCase() + type.slice(1)
}

/** Rang stable d'un type pour lui attribuer sa couleur. */
export function rangCouleurType(type: string, typesPresents: string[]): number {
  const connu = (ORDRE_TYPES as readonly string[]).indexOf(type)
  if (connu >= 0) return connu
  const autres = typesPresents
    .filter((t) => !(ORDRE_TYPES as readonly string[]).includes(t))
    .sort((a, b) => a.localeCompare(b, 'fr'))
  return ORDRE_TYPES.length + Math.max(0, autres.indexOf(type))
}

export function buildRepartitionTypes(
  prospections: DashboardProspection[],
  mesure: MesureRepartition,
): PartType[] {
  const groupes = new Map<string, { nFiches: number; surfaceHa: number }>()
  for (const p of prospections) {
    const type = p.type_prospection?.trim()
    if (!type) continue
    const g = groupes.get(type) ?? { nFiches: 0, surfaceHa: 0 }
    g.nFiches += 1
    g.surfaceHa += p.surface_prospectee ?? 0
    groupes.set(type, g)
  }

  const valeurDe = (g: { nFiches: number; surfaceHa: number }) =>
    mesure === 'fiches' ? g.nFiches : g.surfaceHa
  const total = [...groupes.values()].reduce((somme, g) => somme + valeurDe(g), 0)

  return [...groupes.entries()]
    .map(([type, g]) => ({
      type,
      label: libelleType(type),
      nFiches: g.nFiches,
      surfaceHa: g.surfaceHa,
      valeur: valeurDe(g),
      pct: total > 0 ? Math.round((valeurDe(g) / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.valeur - a.valeur || a.label.localeCompare(b.label, 'fr'))
}
