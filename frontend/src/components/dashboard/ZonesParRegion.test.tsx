import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { ZonesParRegion } from './ZonesParRegion'
import type {
  DashboardProspection,
  DashboardStation,
  DashboardTraitement,
} from '@/lib/dashboard-metrics'

// Leaflet ne se dessine pas dans jsdom (pas de mise en page réelle) : on simule
// les composants pour tester ce que le tableau de bord leur demande.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="carte-zones">{children}</div>
  ),
  TileLayer: () => null,
  CircleMarker: ({
    children,
    radius,
    center,
  }: {
    children: React.ReactNode
    radius: number
    center: [number, number]
  }) => (
    <div data-testid="bulle" data-rayon={radius} data-centre={center.join(',')}>
      {children}
    </div>
  ),
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

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
    surface_prospectee: 400,
    surface_infestee: 100,
    region: 'Atsimo-Andrefana',
    latitude: -22,
    longitude: 44,
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

// Atsimo-Andrefana : 3 fiches (dont 1 sans infestation). Menabe : 1 fiche. 1 fiche sans position.
const PROSPECTIONS = [
  prospection({ id: 'a', surface_infestee: 100, surface_prospectee: 300 }),
  prospection({ id: 'b', surface_infestee: 40, surface_prospectee: 200 }),
  prospection({ id: 'c', surface_infestee: 0, surface_prospectee: 100 }),
  prospection({ id: 'd', region: 'Menabe', latitude: -20, longitude: 44.5, surface_infestee: 10 }),
  prospection({ id: 'e', latitude: null, longitude: null }),
]
const TRAITEMENTS = [traitement({ id: 't1', prospection_id: 'a' })]
const STATIONS: DashboardStation[] = []

function renderCarte(over: Partial<React.ComponentProps<typeof ZonesParRegion>> = {}) {
  return render(
    <ZonesParRegion
      prospections={PROSPECTIONS}
      traitements={TRAITEMENTS}
      stations={STATIONS}
      perimetre="campagne en cours"
      enChargement={false}
      {...over}
    />,
  )
}

describe('ZonesParRegion', () => {
  it('ouvre sur l’infestation : une bulle par région infestée, taille selon les fiches', () => {
    renderCarte()

    // Atsimo-Andrefana (2 fiches infestées : a et b ; c à 0 est écartée) et Menabe (1).
    const bulles = screen.getAllByTestId('bulle')
    expect(bulles).toHaveLength(2)
    const [grosse, petite] = bulles
    expect(within(grosse).getByText('Atsimo-Andrefana')).toBeInTheDocument()
    expect(within(grosse).getByText('2 fiches avec infestation')).toBeInTheDocument()
    expect(within(grosse).getByText('140 ha infestée')).toBeInTheDocument()
    expect(within(petite).getByText('Menabe')).toBeInTheDocument()
    expect(within(petite).getByText('1 fiche avec infestation')).toBeInTheDocument()
    // La région la plus suivie a la plus grande bulle.
    expect(Number(grosse.dataset.rayon)).toBeGreaterThan(Number(petite.dataset.rayon))
    expect(screen.getByRole('button', { name: 'Infestation' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('passe à la prospection : toutes les fiches positionnées comptent', () => {
    renderCarte()

    fireEvent.click(screen.getByRole('button', { name: 'Prospection' }))

    const bulles = screen.getAllByTestId('bulle')
    expect(bulles).toHaveLength(2)
    expect(within(bulles[0]).getByText('3 fiches de prospection')).toBeInTheDocument()
    expect(within(bulles[0]).getByText('600 ha prospectée')).toBeInTheDocument()
  })

  it('passe au traitement : les régions où l’on a traité ou protégé', () => {
    renderCarte()

    fireEvent.click(screen.getByRole('button', { name: 'Traitement' }))

    const bulles = screen.getAllByTestId('bulle')
    expect(bulles).toHaveLength(1)
    // Le traitement hérite de la région de la fiche de prospection liée.
    expect(within(bulles[0]).getByText('Atsimo-Andrefana')).toBeInTheDocument()
    expect(within(bulles[0]).getByText('1 fiche de traitement')).toBeInTheDocument()
    expect(within(bulles[0]).getByText('50 ha traitée ou protégée')).toBeInTheDocument()
  })

  it('signale les fiches sans position au lieu de les placer au hasard', () => {
    renderCarte({ prospections: PROSPECTIONS })
    fireEvent.click(screen.getByRole('button', { name: 'Prospection' }))

    expect(screen.getByText(/1 fiche sans position, non placée sur la carte/)).toBeInTheDocument()
  })

  it('offre les mêmes régions sous forme de liste', () => {
    renderCarte()

    fireEvent.click(screen.getByRole('button', { name: 'Voir en liste' }))

    expect(screen.queryByTestId('carte-zones')).not.toBeInTheDocument()
    const table = screen.getByRole('table')
    expect(within(table).getByRole('columnheader', { name: 'Surface infestée (ha)' })).toBeInTheDocument()
    const lignes = within(table).getAllByRole('row')
    expect(lignes).toHaveLength(1 + 2)
    expect(within(lignes[1]).getByRole('rowheader')).toHaveTextContent('Atsimo-Andrefana')
    expect(within(lignes[1]).getByText('140')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Voir la carte' }))
    expect(screen.getByTestId('carte-zones')).toBeInTheDocument()
  })

  it('affiche un message plutôt qu’une carte muette sans zone', () => {
    renderCarte({ prospections: [], traitements: [] })
    expect(screen.getByText('Aucune zone à afficher (infestation).')).toBeInTheDocument()
    expect(screen.queryAllByTestId('bulle')).toHaveLength(0)
  })

  it('indique le chargement', () => {
    renderCarte({ prospections: [], traitements: [], enChargement: true })
    expect(screen.getByText('Chargement…')).toBeInTheDocument()
  })
})
