import { cn } from '@/lib/utils'

/**
 * Les 5 statuts du workflow de validation d'une fiche (CONTEXT.md) —
 * mapping couleurs exact docs/design_handoff_web/README.md §Design tokens.
 */
export const STATUTS = ['brouillon', 'en_attente', 'verifiee', 'validee', 'rejetee'] as const

export type Statut = (typeof STATUTS)[number]

export const STATUT_LABELS: Record<Statut, string> = {
  brouillon: 'Brouillon',
  en_attente: 'En attente',
  verifiee: 'Vérifiée',
  validee: 'Validée',
  rejetee: 'Rejetée',
}

const STATUT_CLASSES: Record<Statut, string> = {
  brouillon: 'bg-ifvm-brouillon-bg text-ifvm-brouillon-text border-ifvm-brouillon-border',
  en_attente: 'bg-ifvm-amber-bg text-ifvm-amber-text border-ifvm-amber-border',
  verifiee: 'bg-ifvm-blue-bg text-ifvm-blue-text border-ifvm-blue-border',
  validee: 'bg-ifvm-green-bg text-ifvm-green-text border-ifvm-green-border',
  rejetee: 'bg-ifvm-danger-bg text-ifvm-danger-text border-ifvm-danger-border',
}

export function StatusBadge({ statut }: { statut: string }) {
  const key = (STATUTS as readonly string[]).includes(statut) ? (statut as Statut) : null
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-[9px] py-[3px] font-sans text-[10px] font-bold',
        key ? STATUT_CLASSES[key] : 'bg-ifvm-brouillon-bg text-ifvm-brouillon-text border-ifvm-brouillon-border',
      )}
    >
      {key ? STATUT_LABELS[key] : statut}
    </span>
  )
}
