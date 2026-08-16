import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { api } from '../api/client'
import { ReferentielsPage } from './ReferentielsPage'

vi.mock('../api/client', () => ({
  api: { get: vi.fn() },
}))

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>

function renderPage() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/referentiels']}>
        <ReferentielsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ReferentielsPage — 6 entités, campagnes exclue (gestion complète sur /campagnes)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("n'affiche pas d'onglet Campagnes", async () => {
    mockedGet.mockResolvedValue({
      data: {
        postes_acridiens: { upserts: [], server_time: '2026-08-16T00:00:00Z' },
        stations_fixes: { upserts: [], server_time: '2026-08-16T00:00:00Z' },
        utilisateurs_equipe: { upserts: [], server_time: '2026-08-16T00:00:00Z' },
        pesticides: { upserts: [], server_time: '2026-08-16T00:00:00Z' },
        cultures: { upserts: [], server_time: '2026-08-16T00:00:00Z' },
        codes_stades: { upserts: [], server_time: '2026-08-16T00:00:00Z' },
      },
    })
    renderPage()

    await waitFor(() => expect(screen.getByRole('tab', { name: /Postes acridiens/ })).toBeInTheDocument())

    expect(screen.queryByRole('tab', { name: /Campagnes/ })).not.toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(6)
  })
})
