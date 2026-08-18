import { cn } from '@/lib/utils'

/**
 * Pastille de filtre du handoff — helper `chip(label, active)` du prototype
 * (`docs/design_handoff_web/Prototype Web IFVM.dc.html`, ~ligne 1226) :
 * active → fond vert plein, texte blanc ; inactive → fond `#faf7ef`,
 * texte `#6f6a59`, bordure `#e0d9c4`.
 */
export function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-[8px] border px-[13px] py-2 font-sans text-[11.5px] font-semibold transition-colors',
        active
          ? 'border-ifvm-green-text bg-ifvm-green-text text-white'
          : 'border-[#e0d9c4] bg-background text-ifvm-text-tertiary hover:bg-ifvm-brouillon-bg',
      )}
    >
      {label}
    </button>
  )
}
