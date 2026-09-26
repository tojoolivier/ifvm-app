// Série temporelle du graphique « Évolution de la campagne » du tableau de bord.
//
// Trois courbes — surface infestée, traitée, protégée — regroupées par décade
// (1-10, 11-20, 21-fin du mois : le pas de suivi du criquet) ou par mois. Les
// surfaces viennent des mêmes fiches que les tuiles du haut, et la version
// « cumulée » finit donc exactement sur les totaux des tuiles : le graphique et
// les chiffres ne peuvent pas se contredire.
//
// Logique pure, sans React ni `Date` locale : les dates de l'API sont des
// `YYYY-MM-DD` que l'on découpe à la main pour qu'un fuseau horaire ne les
// décale jamais d'un jour.

import {
  surfaceProtegeeDe,
  surfaceTraiteeDe,
  type DashboardProspection,
  type DashboardTraitement,
} from './dashboard-metrics'

export type Granularite = 'decade' | 'mois'

export interface PointEvolution {
  /** Identifiant stable du regroupement (`2025-10` ou `2025-10-2`). */
  cle: string
  /** Étiquette courte de l'axe (`oct.`, `11 oct.`). */
  label: string
  /** Étiquette complète pour l'infobulle et le tableau (`11–20 oct. 2025`). */
  libelleLong: string
  infestee: number
  traitee: number
  protegee: number
}

export interface OptionsEvolution {
  granularite: Granularite
  /** `true` : sommes courues depuis le début ; `false` : valeur de chaque période. */
  cumule: boolean
  /** Bornes de la campagne (`YYYY-MM-DD`). L'axe s'étend si des fiches en sortent. */
  debut?: string
  fin?: string
}

const MOIS_COURTS = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
]

interface Jour {
  annee: number
  mois: number // 0-11
  jour: number
}

function lireJour(iso: string | null | undefined): Jour | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  if (!m) return null
  const mois = Number(m[2]) - 1
  const jour = Number(m[3])
  if (mois < 0 || mois > 11 || jour < 1 || jour > 31) return null
  return { annee: Number(m[1]), mois, jour }
}

/**
 * Rang entier d'un regroupement : il croît avec le temps et se parcourt de un
 * en un, ce qui permet de remplir les périodes sans aucune fiche par des zéros.
 */
function rang({ annee, mois, jour }: Jour, granularite: Granularite): number {
  const rangMois = annee * 12 + mois
  if (granularite === 'mois') return rangMois
  const decade = jour <= 10 ? 0 : jour <= 20 ? 1 : 2
  return rangMois * 3 + decade
}

function dernierJourDuMois(annee: number, mois: number): number {
  return new Date(Date.UTC(annee, mois + 1, 0)).getUTCDate()
}

function decrire(r: number, granularite: Granularite): Pick<PointEvolution, 'cle' | 'label' | 'libelleLong'> {
  const rangMois = granularite === 'mois' ? r : Math.floor(r / 3)
  const annee = Math.floor(rangMois / 12)
  const mois = rangMois % 12
  const nomMois = MOIS_COURTS[mois]
  const mm = String(mois + 1).padStart(2, '0')

  if (granularite === 'mois') {
    return { cle: `${annee}-${mm}`, label: nomMois, libelleLong: `${nomMois} ${annee}` }
  }
  const decade = r % 3
  const debut = decade * 10 + 1
  const fin = decade === 2 ? dernierJourDuMois(annee, mois) : decade * 10 + 10
  return {
    cle: `${annee}-${mm}-${decade + 1}`,
    label: `${debut} ${nomMois}`,
    libelleLong: `${debut}–${fin} ${nomMois} ${annee}`,
  }
}

export function buildEvolution(
  prospections: DashboardProspection[],
  traitements: DashboardTraitement[],
  { granularite, cumule, debut, fin }: OptionsEvolution,
): PointEvolution[] {
  const parRang = new Map<number, { infestee: number; traitee: number; protegee: number }>()
  const ligne = (r: number) => {
    let l = parRang.get(r)
    if (!l) parRang.set(r, (l = { infestee: 0, traitee: 0, protegee: 0 }))
    return l
  }

  for (const p of prospections) {
    const jour = lireJour(p.date_prospection)
    if (jour) ligne(rang(jour, granularite)).infestee += p.surface_infestee ?? 0
  }
  for (const t of traitements) {
    const jour = lireJour(t.date_traitement)
    if (!jour) continue
    const l = ligne(rang(jour, granularite))
    l.traitee += surfaceTraiteeDe(t)
    l.protegee += surfaceProtegeeDe(t)
  }

  // Aucune fiche datée : un axe de zéros n'apprend rien, l'écran affiche un message.
  if (parRang.size === 0) return []

  const rangs = [...parRang.keys()]
  const jourDebut = lireJour(debut)
  const jourFin = lireJour(fin)
  const premier = Math.min(...rangs, ...(jourDebut ? [rang(jourDebut, granularite)] : []))
  const dernier = Math.max(...rangs, ...(jourFin ? [rang(jourFin, granularite)] : []))

  const points: PointEvolution[] = []
  let cumul = { infestee: 0, traitee: 0, protegee: 0 }
  for (let r = premier; r <= dernier; r++) {
    const l = parRang.get(r) ?? { infestee: 0, traitee: 0, protegee: 0 }
    cumul = {
      infestee: cumul.infestee + l.infestee,
      traitee: cumul.traitee + l.traitee,
      protegee: cumul.protegee + l.protegee,
    }
    points.push({ ...decrire(r, granularite), ...(cumule ? cumul : l) })
  }

  // Le mois seul ne dit pas l'année : on la précise au premier point et en janvier.
  if (granularite === 'mois') {
    return points.map((p, i) => {
      const [annee, mm] = p.cle.split('-')
      return i === 0 || mm === '01' ? { ...p, label: `${p.label} ${annee.slice(2)}` } : p
    })
  }
  return points
}

/**
 * Graduation « ronde » de l'axe vertical (1, 2, 5 × 10ⁿ) : les valeurs qu'on ne
 * lit pas directement sur la courbe se lisent sur l'axe.
 */
export function echelleY(maxValeur: number, nbGraduations = 4): { max: number; ticks: number[] } {
  if (!(maxValeur > 0)) return { max: 1, ticks: [0, 1] }
  const brut = maxValeur / nbGraduations
  const ordre = 10 ** Math.floor(Math.log10(brut))
  const residu = brut / ordre
  const pas = (residu <= 1 ? 1 : residu <= 2 ? 2 : residu <= 5 ? 5 : 10) * ordre
  const nb = Math.ceil(maxValeur / pas)
  const ticks = Array.from({ length: nb + 1 }, (_, i) => Number((i * pas).toFixed(6)))
  return { max: ticks[ticks.length - 1], ticks }
}
