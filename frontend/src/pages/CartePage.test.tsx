import type React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { api } from '../api/client'
import { CartePage } from './CartePage'

vi.mock('../api/client', () => ({
  api: { get: vi.fn() },
}))

// react-leaflet ne fonctionne pas dans jsdom (pas de layout réel pour le
// renderer SVG/canvas de Leaflet) — on simule les composants utilisés par
// CartePage pour tester le nombre de marqueurs et la navigation au clic.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  CircleMarker: ({
    children,
    eventHandlers,
  }: {
    children: React.ReactNode
    eventHandlers?: { click?: () => void }
  }) => (
    <button data-testid="marker" onClick={() => eventHandlers?.click?.()}>
      {children}
    </button>
  ),
  Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>

const stations = [
  { id: 's1', code: 'ST1', nom: 'Station 1', latitude: -18.9, longitude: 47.5 },
  { id: 's2', code: 'ST2', nom: 'Station 2', latitude: -20.1, longitude: 46.8 },
]

const campagnes = [{ id: 'c1', name: 'Campagne 2026' }]

const prospections = [
  {
    id: 'p1',
    campagne_id: 'c1',
    station_id: 's1',
    statut: 'validee',
    n_fiche: 'F-001',
    latitude: null,
    longitude: null,
    infestations: [{ id: 'i1', type_cible: 'essaim', surface_totale: 60, densite_moy: null, comportement: null }],
  },
  {
    id: 'p2',
    campagne_id: 'c1',
    station_id: 's2',
    statut: 'brouillon',
    n_fiche: 'F-002',
    latitude: null,
    longitude: null,
    infestations: [],
  },
]

function renderPage(initialPath = '/carte', data: unknown[] = prospections) {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/prospections') return Promise.resolve({ data })
    if (url === '/campagnes') return Promise.resolve({ data: campagnes })
    if (url === '/stations') return Promise.resolve({ data: stations })
    return Promise.resolve({ data: [] })
  })

  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/carte" element={<CartePage />} />
          <Route path="/prospections/:id" element={<div>Détail de p1</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CartePage — carte des infestations (#17)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('affiche un marqueur uniquement pour les fiches avec infestation', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText(/1 fiche avec infestation/)).toBeInTheDocument())
    expect(screen.getAllByTestId('marker')).toHaveLength(1)
  })

  it('applique le filtre statut (persisté dans l’URL) et exclut les fiches ne correspondant pas', async () => {
    renderPage('/carte?statut=brouillon')
    await waitFor(() => expect(screen.getByText(/0 fiche avec infestation/)).toBeInTheDocument())
  })

  it('applique le filtre station (persisté dans l’URL)', async () => {
    renderPage('/carte?station=s2')
    await waitFor(() => expect(screen.getByText(/0 fiche avec infestation/)).toBeInTheDocument())
  })

  it("affiche la situation d'infestation acridienne dans le popup du marqueur", async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText(/1 fiche avec infestation/)).toBeInTheDocument())

    expect(screen.getByText("Situation d'infestation acridienne")).toBeInTheDocument()
    expect(screen.getByText('Surface infestée : 60 ha')).toBeInTheDocument()
    expect(screen.getByText(/essaim — 60 ha — densité — — —/)).toBeInTheDocument()
  })

  it('affiche aussi une fiche extensive qui a une surface infestée et des coordonnées', async () => {
    renderPage('/carte', [
      ...prospections,
      {
        id: 'p3',
        campagne_id: 'c1',
        station_id: null,
        statut: 'validee',
        n_fiche: 'F-003',
        type_prospection: 'extensive',
        latitude: -21.2,
        longitude: 45.9,
        surface_infestee: 30,
        infestations: [],
      },
    ])
    await waitFor(() => expect(screen.getByText(/2 fiches avec infestation/)).toBeInTheDocument())

    expect(screen.getAllByTestId('marker')).toHaveLength(2)
    expect(screen.getByText('Surface infestée : 30 ha')).toBeInTheDocument()
    expect(screen.getByText('Prospection extensive')).toBeInTheDocument()
  })

  it('navigue vers la fiche au clic sur un marqueur', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText(/1 fiche avec infestation/)).toBeInTheDocument())

    const markers = screen.getAllByTestId('marker')
    expect(markers).toHaveLength(1)
    markers[0].click()

    await waitFor(() => expect(screen.getByText('Détail de p1')).toBeInTheDocument())
  })
})
