import { cn } from '@/lib/utils'

/** Boutons segmentés du tableau de bord (choix exclusif, état lisible par `aria-pressed`). */
export function Segmente<T extends string | boolean>({
  legende,
  options,
  valeur,
  onChange,
}: {
  legende: string
  options: { valeur: T; label: string }[]
  valeur: T
  onChange: (v: T) => void
}) {
  return (
    <div
      role="group"
      aria-label={legende}
      className="flex gap-1 rounded-[9px] border border-[#e7e0cd] bg-[#edece3] p-[3px]"
    >
      {options.map((o) => (
        <button
          key={String(o.valeur)}
          type="button"
          aria-pressed={o.valeur === valeur}
          onClick={() => onChange(o.valeur)}
          className={cn(
            'rounded-[6px] px-[10px] py-[5px] font-sans text-[12px] font-semibold',
            o.valeur === valeur ? 'bg-ifvm-green-text text-white' : 'text-ifvm-text-tertiary',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
