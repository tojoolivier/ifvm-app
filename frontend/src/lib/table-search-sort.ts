import type { DataTableSort } from '@/components/ui/data-table'

/** Nombre de lignes par page — même valeur partout où un tableau est paginé. */
export const PAGE_SIZE = 15

/** Recherche insensible aux accents et à la casse ("Réunion" trouvé par "reunion"). */
export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/**
 * Compare deux `sortValue` de colonne. `null` (valeur absente, « — » à
 * l'affichage) est toujours relégué en fin de liste, quel que soit le sens du
 * tri — sinon un tri descendant ferait remonter les lignes incomplètes en
 * premier, ce qui n'aide personne.
 */
export function compareSortValues(
  a: string | number | boolean | null,
  b: string | number | boolean | null,
): number {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  if (typeof a === 'boolean' || typeof b === 'boolean') return Number(a) - Number(b)
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'fr', { sensitivity: 'base', numeric: true })
}

/** Bascule asc -> desc -> aucun tri au clic répété sur le même en-tête de colonne. */
export function nextSort(current: DataTableSort | null, key: string): DataTableSort | null {
  if (!current || current.key !== key) return { key, direction: 'asc' }
  if (current.direction === 'asc') return { key, direction: 'desc' }
  return null
}
