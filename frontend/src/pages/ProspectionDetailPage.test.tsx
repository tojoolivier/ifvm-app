import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { api } from '../api/client'
import { ProspectionDetailPage } from './ProspectionDetailPage'

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), patch: vi.fn() },
}))

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>

function baseProspection(statut: string) {
  return {
    id: 'p1',
    type_prospection: 'intensive',
    campagne_id: 'c1',
    prospecteur_id: 'u1',
    station_id: null,
    date_prospection: '2026-07-10',
    statut,
    statut_sync: 'synced',
    n_fiche: 'F-001',
    n_releve: null,
    created_at: '2026-07-01T10:00:00Z',
    latitude: -18.5,
    longitude: 47.2,
    surface_station: 100,
    surface_prospectee: 80,
    surface_infestee: 0,
    vegetation: null,
    sol: null,
    degats_cultures: null,
    populations: [],
    captures: [],
    infestations: [],
  }
}

function renderPage(statut: string) {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/prospections/p1') return Promise.resolve({ data: baseProspection(statut) })
    if (url === '/prospections/p1/audit-log') return Promise.resolve({ data: [] })
    if (url === '/users/me') return Promise.resolve({ data: { id: 'u1', nom: 'Test', role: 'validation_finale' } })
    if (url === '/campagnes') return Promise.resolve({ data: [] })
    return Promise.resolve({ data: [] })
  })

  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/prospections/p1']}>
        <Routes>
          <Route path="/prospections/:id" element={<ProspectionDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ProspectionDetailPage — export PDF (#19)', () => {
  beforeEach(() => {
    window.print = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("n'affiche pas le bouton d'export pour une fiche non validée", async () => {
    renderPage('en_attente')
    await waitFor(() => expect(screen.getByText(/Fiche intensive/)).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /Exporter en PDF/i })).not.toBeInTheDocument()
  })

  it('affiche le bouton d\'export pour une fiche validée et déclenche window.print au clic', async () => {
    renderPage('validee')
    await waitFor(() => expect(screen.getByText(/Fiche intensive/)).toBeInTheDocument())

    const button = screen.getByRole('button', { name: /Exporter en PDF/i })
    expect(button).toBeInTheDocument()

    expect(screen.queryByTestId('fiche-imprimable')).not.toBeInTheDocument()
    button.click()

    await waitFor(() => expect(screen.getByTestId('fiche-imprimable')).toBeInTheDocument())
    expect(window.print).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Fiche n° F-001')).toBeInTheDocument()
    expect(screen.getByText(/Validé ✓/)).toBeInTheDocument()
  })
})
