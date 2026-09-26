// Logique pure partagée par les fiches de lecture en tableaux (prospection et traitement),
// qui reproduisent les gabarits PDF du backend (`prospection_pdf.py`, `traitement_pdf.py`) :
// mêmes libellés, mêmes cases, mêmes règles de valeur vide. Hors composants pour être testée
// sans monter React.

export const TIRET = '—'

/**
 * Valeur affichée dans une cellule ou un champ, comme `_texte` / `_valeur_texte` des gabarits
 * PDF : vide → « — », booléen → « Oui » / « Non », le reste tel quel (jamais reformaté).
 */
export function texte(valeur: unknown): string {
  if (valeur === null || valeur === undefined || valeur === '') return TIRET
  if (typeof valeur === 'boolean') return valeur ? 'Oui' : 'Non'
  return String(valeur)
}

/** Comme `texte`, mais `null` pour une valeur vide : sert à distinguer un champ à remplir. */
export function texteOuNull(valeur: unknown): string | null {
  const t = texte(valeur)
  return t === TIRET ? null : t
}

const deuxChiffres = (n: number) => String(n).padStart(2, '0')

/**
 * Date au format français `jj/mm/aaaa`. Une date seule (`2026-09-24`) est lue telle quelle,
 * sans passer par `Date` : sinon le fuseau du navigateur pourrait la décaler d'un jour.
 * Un horodatage complet devient `jj/mm/aaaa hh:mm`.
 */
export function dateFr(valeur: string | null | undefined): string {
  if (!valeur) return TIRET
  const jour = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valeur)
  if (jour) return `${jour[3]}/${jour[2]}/${jour[1]}`
  const date = new Date(valeur)
  if (Number.isNaN(date.getTime())) return valeur
  return (
    `${deuxChiffres(date.getDate())}/${deuxChiffres(date.getMonth() + 1)}/${date.getFullYear()}` +
    ` ${deuxChiffres(date.getHours())}:${deuxChiffres(date.getMinutes())}`
  )
}

/** Partie date seule (`jj/mm/aaaa`) d'un horodatage ISO — « 1.4 Date de validation ». */
export function jourFr(valeur: string | null | undefined): string {
  return valeur ? dateFr(valeur.slice(0, 10)) : TIRET
}

// ---------------------------------------------------------------------------
// Familles d'espèces non cibles (§10 comportement, §11 mortalité du CRT)
// ---------------------------------------------------------------------------

/**
 * Libellés du formulaire papier. « Oiseux » (§10) et « Oiseaux » (§11) désignent la même
 * famille malgré l'orthographe divergente du document officiel lui-même.
 */
export const FAMILLES_COMPORTEMENT_PAPIER = [
  'Oiseux',
  'Reptile',
  'Insecte',
  'Mammifère',
  'Amphibien',
  'Poisson',
]
export const FAMILLES_MORTALITE_PAPIER = [
  'Oiseaux',
  'Reptile',
  'Insecte',
  'Mammifère',
  'Amphibien',
  'Poissons',
]

/** Sans accents, minuscules, sans pluriel : « Insectes utiles » et « Insecte » se rapprochent. */
export function normaliser(valeur: string): string {
  const racine = valeur
    .normalize('NFKD')
    .replace(/[^ -~]/g, '')
    .toLowerCase()
    .replace(/s+$/, '')
  return racine === 'oiseux' || racine === 'oiseaux' ? 'oiseau' : racine
}

export interface CasesFamilles {
  cases: { label: string; cochee: boolean }[]
  /** Clés saisies côté mobile sans correspondance papier (ex. « Abeilles ») : jamais perdues. */
  nonRapprochees: string[]
}

/**
 * Rapproche les familles cochées côté mobile (clés en toutes lettres) des libellés exacts du
 * formulaire papier, par comparaison insensible aux accents et aux pluriels.
 */
export function casesFamilles(
  familles: Record<string, unknown> | null | undefined,
  labelsPapier: string[],
): CasesFamilles {
  const cles = Object.keys(familles ?? {})
  const normalisees = new Map(cles.map((cle) => [cle, normaliser(cle)]))
  const rapprochees = new Set<string>()
  const cases = labelsPapier.map((label) => {
    const normeLabel = normaliser(label)
    let cochee = false
    for (const [cle, normeCle] of normalisees) {
      if (normeLabel.includes(normeCle) || normeCle.includes(normeLabel)) {
        cochee = true
        rapprochees.add(cle)
      }
    }
    return { label, cochee }
  })
  return { cases, nonRapprochees: cles.filter((cle) => !rapprochees.has(cle)) }
}

// ---------------------------------------------------------------------------
// Tracé de signature
// ---------------------------------------------------------------------------

/**
 * `viewBox` ajusté au tracé : le mobile enregistre un chemin SVG en coordonnées brutes de
 * l'écran, sans cadre. On l'encadre par sa boîte englobante pour l'afficher net, à la bonne
 * échelle, quelle que soit la taille du pavé de saisie. `null` si le tracé est vide.
 */
export function viewBoxTrace(trace: string | null | undefined): string | null {
  if (!trace) return null
  const nombres = trace.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
  if (nombres.length < 2) return null
  const xs = nombres.filter((_, i) => i % 2 === 0)
  const ys = nombres.filter((_, i) => i % 2 === 1)
  const marge = 3
  const minX = Math.min(...xs) - marge
  const minY = Math.min(...ys) - marge
  const largeur = Math.max(...xs) - Math.min(...xs) + 2 * marge
  const hauteur = Math.max(...ys) - Math.min(...ys) + 2 * marge
  return `${minX} ${minY} ${largeur} ${hauteur}`
}
