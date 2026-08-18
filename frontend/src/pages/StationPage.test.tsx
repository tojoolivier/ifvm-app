import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { api } from '../api/client'
import { StationPage } from './StationPage'

vi.mock('../api/client', () => ({
  api: { get: vi.fn() },
}))

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>

function stationFixe(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1',
    code: 'ST-014',
    nom: 'Beroroha',
    pa_id: 'pa1',
    pa_code: 'PA-04',
    pa_nom: 'Poste Beroroha',
    latitude: -21.66,
    longitude: 45.17,
    altitude: 120,
    actif: true,
    created_at: '2026-08-01T00:00:00Z',
    ...overrides,
  }
}

function mockApi({
  prospections = [],
  stations = [stationFixe()],
}: {
  prospections?: { station_id: string | null }[]
  stations?: ReturnType<typeof stationFixe>[]
} = {}) {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/stations') return Promise.resolve({ data: stations })
    if (url === '/prospections') return Promise.resolve({ data: prospections })
    return Promise.resolve({ data: [] })
  })
}

function renderPage() {
  // `retry: false` : sans ça, les tests d'erreur attendent les 3 tentatives par défaut.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/administration']}>
        <StationPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('StationPage — colonnes maquette (README §10, onglet Stations)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('affiche code (mono vert), station, coordonnées (mono) et état (badge)', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(screen.getByText('Beroroha')).toBeInTheDocument())

    const code = screen.getByText('ST-014')
    expect(code.className).toMatch(/ifvm-green-text/)

    // Format du prototype : décimale française, séparateur « · ».
    expect(screen.getByText('-21,6600 · 45,1700')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it("n'affiche aucun dialogue de création — l'API ne porte pas les écritures sur station_fixe", async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(screen.getByText('Beroroha')).toBeInTheDocument())

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('affiche la colonne Prospections avec le compte réel dérivé de GET /prospections (pas fabriqué)', async () => {
    mockApi({ prospections: [{ station_id: 's1' }, { station_id: 's1' }, { station_id: 'autre' }] })
    renderPage()

    await waitFor(() => expect(screen.getByText('Beroroha')).toBeInTheDocument())

    const row = screen.getByText('Beroroha').closest('tr')!
    expect(row).toHaveTextContent('2')
  })

  it("remplit la colonne Aire protégée avec le poste acridien renvoyé par l'API (pa_nom)", async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(screen.getByText('Beroroha')).toBeInTheDocument())

    expect(screen.getByRole('columnheader', { name: 'Aire protégée' })).toBeInTheDocument()
    expect(screen.getByText('Poste Beroroha')).toBeInTheDocument()
    expect(screen.queryByText(/n'est pas exposée par l'API/i)).not.toBeInTheDocument()
  })

  it('affiche un bandeau si GET /stations échoue', async () => {
    mockedGet.mockImplementation((url: string) =>
      url === '/stations'
        ? Promise.reject({ response: { status: 500, data: { detail: 'Base indisponible' } } })
        : Promise.resolve({ data: [] }),
    )
    renderPage()

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Erreur 500'))
    expect(screen.getByRole('alert')).toHaveTextContent('Base indisponible')
  })

  it('demande les stations des deux états et rend le badge Inactive', async () => {
    mockApi({ stations: [stationFixe(), stationFixe({ id: 's2', code: 'ST-020', nom: 'Sakaraha', actif: false })] })
    renderPage()

    await waitFor(() => expect(screen.getByText('Sakaraha')).toBeInTheDocument())

    expect(mockedGet).toHaveBeenCalledWith('/stations', { params: { inclure_inactifs: true } })
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })
})
