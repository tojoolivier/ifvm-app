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
    mockedGet.mockResolvedValue({ data: [stationFixe()] })
    renderPage()

    await waitFor(() => expect(screen.getByText('Beroroha')).toBeInTheDocument())

    const code = screen.getByText('ST-014')
    expect(code.className).toMatch(/ifvm-green-text/)

    expect(screen.getByText('-21.66, 45.17')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it("n'affiche aucun formulaire de création — l'API ne porte pas les écritures sur station_fixe", async () => {
    mockedGet.mockResolvedValue({ data: [stationFixe()] })
    renderPage()

    await waitFor(() => expect(screen.getByText('Beroroha')).toBeInTheDocument())

    expect(screen.queryByText(/Nouvelle station/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it("n'affiche pas de colonne aire protégée ni prospections — absentes de l'API (StationFixeRead) — et le signale", async () => {
    mockedGet.mockResolvedValue({ data: [stationFixe()] })
    renderPage()

    await waitFor(() => expect(screen.getByText('Beroroha')).toBeInTheDocument())

    expect(screen.queryByText(/^Aire protégée$/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Prospections$/)).not.toBeInTheDocument()
    expect(screen.getByText(/aire protégée.*prospections|prospections.*aire protégée/is)).toBeInTheDocument()
  })
})
