import { cn } from '@/lib/utils'

/**
 * Pilule de la maquette — `padding 3px 9px`, rayon plein, `700 10px`
 * (docs/design_handoff_web/README.md §Design tokens). Trois écrans la
 * réutilisent (badge de type, niveau de risque, état de signature) : la
 * factoriser évite que les trois copies dérivent.
 *
 * `tone` porte le trio fond / texte / bordure, toujours pris dans la palette
 * `ifvm-*`.
 */
export function Pill({
  tone,
  className,
  children,
}: {
  tone: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-[9px] py-[3px] font-sans text-[10px] font-bold',
        tone,
        className,
      )}
    >
      {children}
    </span>
  )
}

export const PILL_TONES = {
  aerien: 'bg-ifvm-blue-bg text-ifvm-blue-text border-ifvm-blue-border',
  terrestre: 'bg-ifvm-green-bg text-ifvm-green-text border-ifvm-green-border',
  signe: 'bg-ifvm-green-bg text-ifvm-green-text border-ifvm-green-border',
  neutre: 'bg-ifvm-brouillon-bg text-ifvm-brouillon-text border-ifvm-brouillon-border',
} as const
