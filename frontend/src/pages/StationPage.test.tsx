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

function stationFixe() {
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
  }
}

function mockApi({ prospections = [] }: { prospections?: { station_id: string | null }[] } = {}) {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/stations') return Promise.resolve({ data: [stationFixe()] })
    if (url === '/prospections') return Promise.resolve({ data: prospections })
    return Promise.resolve({ data: [] })
  })
}

function renderPage() {
  const queryClient = new QueryClient()
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

    expect(screen.getByText('-21.6600, 45.1700')).toBeInTheDocument()
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

  it("affiche la colonne Aire protégée vide et signale qu'elle n'est pas exposée par l'API (StationFixeRead)", async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(screen.getByText('Beroroha')).toBeInTheDocument())

    expect(screen.getByRole('columnheader', { name: 'Aire protégée' })).toBeInTheDocument()
    expect(screen.getByText(/aire protégée.*n'est pas exposée par l'API/is)).toBeInTheDocument()
  })
})
