import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { RepartitionProspections } from './RepartitionProspections'
import type { DashboardProspection } from '@/lib/dashboard-metrics'

function prospection(over: Partial<DashboardProspection> = {}): DashboardProspection {
  return {
    id: 'p1',
    type_prospection: 'intensive',
    campagne_id: 'c1',
    station_id: null,
    prospecteur_id: 'u1',
    statut: 'validee',
    n_fiche: 'PR-1',
    date_prospection: '2025-10-05',
    surface_prospectee: 100,
    surface_infestee: 10,
    created_at: '2025-10-05T08:00:00Z',
    updated_at: '2025-10-05T08:00:00Z',
    ...over,
  }
}

// 3 intensives (400 ha), 1 extensive (1 000 ha), 1 validation (50 ha).
const FICHES = [
  prospection({ id: 'a', surface_prospectee: 300 }),
  prospection({ id: 'b', surface_prospectee: 100 }),
  prospection({ id: 'c', surface_prospectee: null }),
  prospection({ id: 'd', type_prospection: 'extensive', surface_prospectee: 1000 }),
  prospection({ id: 'e', type_prospection: 'validation', surface_prospectee: 50 }),
]

function renderRepartition(over: Partial<React.ComponentProps<typeof RepartitionProspections>> = {}) {
  return render(
    <RepartitionProspections
      prospections={FICHES}
      perimetre="campagne en cours"
      enChargement={false}
      {...over}
    />,
  )
}

/** Lignes de données du tableau (sans l'en-tête). */
function lignes(): HTMLElement[] {
  return within(screen.getByRole('table')).getAllByRole('row').slice(1)
}

describe('RepartitionProspections', () => {
  it('répartit les prospections par type, en nombre de fiches par défaut', () => {
    renderRepartition()

    expect(screen.getByText('5 fiches — campagne en cours')).toBeInTheDocument()

    const [intensive, extensive, validation] = lignes()
    expect(within(intensive).getByRole('rowheader')).toHaveTextContent('Intensive')
    expect(within(intensive).getByText('3')).toBeInTheDocument()
    expect(within(intensive).getByText('60 %')).toBeInTheDocument()
    expect(within(extensive).getByRole('rowheader')).toHaveTextContent('Extensive')
    expect(within(extensive).getByText('20 %')).toBeInTheDocument()
    expect(within(validation).getByRole('rowheader')).toHaveTextContent('Validation')
    expect(screen.getAllByRole('button', { name: /fiche/ })).toHaveLength(3)
  })

  it('passe à la surface prospectée, où l’extensive domine', () => {
    renderRepartition()

    fireEvent.click(screen.getByRole('button', { name: 'Surface (ha)' }))

    expect(within(lignes()[0]).getByRole('rowheader')).toHaveTextContent('Extensive')
    // 1 000 ha sur 1 450 ha au total.
    expect(within(lignes()[0]).getByText('69 %')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Part de la surface' })).toBeInTheDocument()
  })

  it('n’affiche que les types présents, et un type inconnu sans changement de code', () => {
    renderRepartition({
      prospections: [
        prospection({ id: 'a', type_prospection: 'intensive' }),
        prospection({ id: 'b', type_prospection: 'aerienne' }),
      ],
    })

    // À égalité de fiches, l'ordre est alphabétique.
    const rangees = lignes()
    expect(rangees.map((r) => within(r).getByRole('rowheader').textContent)).toEqual([
      'Aerienne',
      'Intensive',
    ])
    expect(screen.queryByText('Extensive')).not.toBeInTheDocument()
  })

  it('garde la même couleur pour un type, quels que soient les autres types présents', () => {
    const { unmount } = renderRepartition({
      prospections: [prospection({ type_prospection: 'validation' })],
    })
    const seul = screen.getByRole('button', { name: /Validation/ })
    const couleurSeul = seul.style.background
    unmount()

    renderRepartition()
    const avecAutres = screen.getByRole('button', { name: /Validation/ })
    expect(avecAutres.style.background).toBe(couleurSeul)
  })

  it('montre une infobulle au survol d’un segment et estompe les autres', () => {
    renderRepartition()
    const segment = screen.getByRole('button', { name: /^Extensive/ })

    fireEvent.pointerEnter(segment)

    const infobulle = screen.getByRole('status')
    expect(within(infobulle).getByText('Extensive')).toBeInTheDocument()
    expect(within(infobulle).getByText('1 fiche')).toBeInTheDocument()
    expect(within(infobulle).getByText('1 000 ha')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Intensive/ })).toHaveClass('opacity-45')

    fireEvent.pointerLeave(segment)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('offre la même infobulle au clavier', () => {
    renderRepartition()
    const segment = screen.getByRole('button', { name: /^Validation/ })

    fireEvent.focus(segment)
    expect(within(screen.getByRole('status')).getByText('Validation')).toBeInTheDocument()

    fireEvent.blur(segment)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('nomme chaque segment en toutes lettres pour les lecteurs d’écran', () => {
    renderRepartition()
    expect(
      screen.getByRole('button', { name: 'Intensive : 3 fiches, 400 ha, 60 %' }),
    ).toBeInTheDocument()
  })

  it('affiche un message plutôt qu’une barre vide', () => {
    renderRepartition({ prospections: [] })
    expect(screen.getByText('Aucune prospection sur cette campagne.')).toBeInTheDocument()
  })

  it('indique le chargement', () => {
    renderRepartition({ prospections: [], enChargement: true })
    expect(screen.getByText('Chargement…')).toBeInTheDocument()
  })
})
