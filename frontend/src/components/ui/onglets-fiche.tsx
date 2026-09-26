import { cn } from '@/lib/utils'

/**
 * Onglets d'une fiche en lecture : « Fiche » (présentation en tableaux, comme le PDF) et
 * « Données BDD » (une carte par colonne de la base, pour la vérification).
 *
 * État local, sans route dédiée : contrairement à `NavTabs` (qui navigue entre écrans), ces
 * onglets basculent la vue d'une même page, donc des boutons `role="tab"` et non des liens.
 * Même gabarit visuel que `NavTabs` pour rester cohérent avec les onglets de la maquette.
 */
export type OngletFiche = 'fiche' | 'bdd'

const ONGLETS: { valeur: OngletFiche; label: string }[] = [
  { valeur: 'fiche', label: 'Fiche' },
  { valeur: 'bdd', label: 'Données BDD' },
]

export function OngletsFiche({
  actif,
  onChange,
}: {
  actif: OngletFiche
  onChange: (onglet: OngletFiche) => void
}) {
  return (
    <div role="tablist" aria-label="Présentation de la fiche" className="flex flex-wrap items-center gap-2">
      {ONGLETS.map((onglet) => {
        const selectionne = onglet.valeur === actif
        return (
          <button
            key={onglet.valeur}
            type="button"
            role="tab"
            aria-selected={selectionne}
            onClick={() => onChange(onglet.valeur)}
            className={cn(
              'rounded-[9px] border px-4 py-[9px] font-sans text-[12px] font-bold transition-colors',
              selectionne
                ? 'border-ifvm-green-text bg-ifvm-green-text text-white'
                : 'border-ifvm-brouillon-border bg-background text-ifvm-text-tertiary hover:bg-ifvm-brouillon-bg',
            )}
          >
            {onglet.label}
          </button>
        )
      })}
    </div>
  )
}
