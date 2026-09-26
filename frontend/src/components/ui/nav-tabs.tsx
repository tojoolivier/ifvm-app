import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

/**
 * Bandeau d'onglets de la maquette (`padding 9px 16px`, rayon `9px`,
 * `700 12px`) — prototype `data-screen-label="Traitements"`, ligne 590.
 *
 * Le handoff décrit ces onglets comme un « état local, pas de route dédiée ».
 * Côté web la fiche a bien son URL (`/traitements/:id`, déjà routée et liée
 * depuis la prospection) : on garde donc la navigation réelle et on rend
 * l'onglet actif à partir de l'écran courant, plutôt que d'inventer un état
 * parallèle qui casserait les liens profonds.
 */
export interface NavTabItem {
  label: string
  to: string
  active: boolean
}

export function NavTabs({ items, ariaLabel }: { items: NavTabItem[]; ariaLabel: string }) {
  return (
    <nav aria-label={ariaLabel} className="flex flex-wrap items-center gap-2">
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          aria-current={item.active ? 'page' : undefined}
          className={cn(
            'rounded-[9px] border px-4 py-[9px] font-sans text-[12px] font-bold transition-colors',
            item.active
              ? 'border-ifvm-green-text bg-ifvm-green-text text-white'
              : 'border-ifvm-brouillon-border bg-background text-ifvm-text-tertiary hover:bg-ifvm-brouillon-bg',
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
