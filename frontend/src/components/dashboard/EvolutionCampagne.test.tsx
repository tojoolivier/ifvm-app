import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { EvolutionCampagne } from './EvolutionCampagne'
import type { DashboardProspection, DashboardTraitement } from '@/lib/dashboard-metrics'

function prospection(over: Partial<DashboardProspection> = {}): DashboardProspection {
  return {
    id: 'p1',
    type_prospection: 'intensive',
    campagne_id: 'c1',
    station_id: 's1',
    prospecteur_id: 'u1',
    statut: 'validee',
    n_fiche: 'PR-1',
    date_prospection: '2025-10-05',
    surface_prospectee: 400,
    surface_infestee: 100,
    created_at: '2025-10-05T08:00:00Z',
    updated_at: '2025-10-05T08:00:00Z',
    ...over,
  }
}

function traitement(over: Partial<DashboardTraitement> = {}): DashboardTraitement {
  return {
    id: 't1',
    prospection_id: 'p1',
    numero_fiche: 'CRT-1',
    type_traitement: 'TERRESTRE',
    date_traitement: '2025-10-06',
    localite: 'Zone',
    statut: 'validee',
    created_at: '2025-10-06T09:00:00Z',
    updated_at: '2025-10-06T09:00:00Z',
    aerien: null,
    terrestre: { surface_traitee_ha: 50, surface_protegee_ha: null },
    signatures: [],
    ...over,
  }
}

// 100 ha infestés le 5 oct., 50 ha le 15 nov. ; 50 ha traités le 6 oct.
const PROSPECTIONS = [
  prospection({ id: 'a', date_prospection: '2025-10-05', surface_infestee: 100 }),
  prospection({ id: 'b', date_prospection: '2025-11-15', surface_infestee: 50 }),
]
const TRAITEMENTS = [traitement()]

function renderGraphe(over: Partial<React.ComponentProps<typeof EvolutionCampagne>> = {}) {
  return render(
    <EvolutionCampagne
      prospections={PROSPECTIONS}
      traitements={TRAITEMENTS}
      perimetre="campagne en cours"
      enChargement={false}
      {...over}
    />,
  )
}

/** La légende porte la valeur finale de chaque série. */
function legende(nom: string): HTMLElement {
  return screen.getByText(nom, { selector: 'li' })
}

afterEach(() => vi.restoreAllMocks())

describe('EvolutionCampagne', () => {
  it('trace les trois courbes et affiche en légende le total final de chacune', () => {
    const { container } = renderGraphe()

    expect(container.querySelectorAll('polyline')).toHaveLength(3)
    // Cumul par défaut : les valeurs finales sont celles des tuiles du haut.
    expect(within(legende('Infestée')).getByText('150 ha')).toBeInTheDocument()
    expect(within(legende('Traitée')).getByText('50 ha')).toBeInTheDocument()
    expect(within(legende('Protégée')).getByText('0 ha')).toBeInTheDocument()
  })

  it('passe du cumul à la valeur de chaque période', () => {
    renderGraphe()

    fireEvent.click(screen.getByRole('button', { name: 'Par période' }))

    // Dernière décade (11–20 nov.) : seuls les 50 ha de la fiche du 15 nov.
    expect(within(legende('Infestée')).getByText('50 ha')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Par période' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('regroupe par mois à la demande', () => {
    const { container } = renderGraphe()
    expect(container.textContent).toContain('1 oct.')

    fireEvent.click(screen.getByRole('button', { name: 'Mois' }))

    // Le mois seul ne dit pas l'année : elle est précisée au premier point.
    expect(container.textContent).toContain('oct. 25')
    expect(container.textContent).not.toContain('1 oct.')
  })

  it('suit le clavier : une infobulle donne les trois valeurs de la période', () => {
    const { container } = renderGraphe()
    const svg = container.querySelector('svg') as SVGSVGElement

    fireEvent.focus(svg)
    // Focus : on tombe sur la dernière période.
    let infobulle = screen.getByRole('status')
    expect(within(infobulle).getByText('11–20 nov. 2025')).toBeInTheDocument()
    expect(within(infobulle).getByText('150 ha')).toBeInTheDocument()

    // Flèche gauche : la décade précédente, où le cumul infesté n'est encore que de 100.
    fireEvent.keyDown(svg, { key: 'ArrowLeft' })
    infobulle = screen.getByRole('status')
    expect(within(infobulle).getByText('1–10 nov. 2025')).toBeInTheDocument()
    expect(within(infobulle).getByText('100 ha')).toBeInTheDocument()

    fireEvent.keyDown(svg, { key: 'Escape' })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('suit le pointeur : le repère se cale sur la période la plus proche', () => {
    const { container } = renderGraphe()
    const svg = container.querySelector('svg') as SVGSVGElement
    // jsdom ne fait aucune mise en page : on fixe la taille du dessin (= son viewBox).
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 680,
      height: 250,
      right: 680,
      bottom: 250,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    const zone = container.querySelector('rect') as SVGRectElement

    // Tout à gauche du tracé : la toute première période (1–10 oct.).
    fireEvent(zone, new MouseEvent('pointermove', { clientX: 50, bubbles: true }))
    expect(within(screen.getByRole('status')).getByText('1–10 oct. 2025')).toBeInTheDocument()

    fireEvent.pointerLeave(zone)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('offre la même information sous forme de tableau', () => {
    renderGraphe()

    fireEvent.click(screen.getByRole('button', { name: 'Voir en tableau' }))

    const tableau = screen.getByRole('table')
    expect(within(tableau).getByRole('columnheader', { name: 'Infestée (ha)' })).toBeInTheDocument()
    // 1–10, 11–20, 21–31 oct., 1–10, 11–20 nov. : la décade sans fiche (11–20 oct.) est comblée.
    expect(within(tableau).getAllByRole('row')).toHaveLength(1 + 5)
    expect(within(tableau).getByRole('rowheader', { name: '11–20 nov. 2025' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Voir le graphique' })).toBeInTheDocument()
  })

  it('étend l’axe jusqu’aux bornes de la campagne', () => {
    renderGraphe({ debut: '2025-09-01', fin: '2025-11-30' })
    fireEvent.click(screen.getByRole('button', { name: 'Voir en tableau' }))

    const lignes = within(screen.getByRole('table')).getAllByRole('row')
    expect(within(lignes[1]).getByRole('rowheader')).toHaveTextContent('1–10 sept. 2025')
    expect(within(lignes[lignes.length - 1]).getByRole('rowheader')).toHaveTextContent(
      '21–30 nov. 2025',
    )
  })

  it('affiche un message plutôt qu’un axe vide', () => {
    renderGraphe({ prospections: [], traitements: [] })
    expect(screen.getByText('Aucune fiche datée sur cette campagne.')).toBeInTheDocument()
  })

  it('indique le chargement sans casser la mise en page', () => {
    renderGraphe({ prospections: [], traitements: [], enChargement: true })
    expect(screen.getByText('Chargement…')).toBeInTheDocument()
  })
})
