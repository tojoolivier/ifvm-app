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

  it('affiche des colonnes labellisées FR (pas les clés brutes) pour stations_fixes', async () => {
    mockedGet.mockResolvedValue({
      data: {
        postes_acridiens: { upserts: [], server_time: '2026-08-16T00:00:00Z' },
        stations_fixes: {
          upserts: [
            {
              id: 's1',
              code: 'STA-01',
              nom: 'Station Nord',
              pa_id: 'p1',
              latitude: -18.9,
              longitude: 47.5,
              altitude: 1200,
              actif: true,
              updated_at: '2026-08-16T00:00:00Z',
            },
          ],
          server_time: '2026-08-16T00:00:00Z',
        },
        utilisateurs_equipe: { upserts: [], server_time: '2026-08-16T00:00:00Z' },
        pesticides: { upserts: [], server_time: '2026-08-16T00:00:00Z' },
        cultures: { upserts: [], server_time: '2026-08-16T00:00:00Z' },
        codes_stades: { upserts: [], server_time: '2026-08-16T00:00:00Z' },
      },
    })
    renderPage()

    await waitFor(() => screen.getByRole('tab', { name: /Stations fixes/ }))
    screen.getByRole('tab', { name: /Stations fixes/ }).click()

    await waitFor(() => expect(screen.getByText('Latitude')).toBeInTheDocument())
    expect(screen.getByText('Altitude')).toBeInTheDocument()
    expect(screen.queryByText('pa_id')).not.toBeInTheDocument()
  })

  const emptyEntities = {
    postes_acridiens: { upserts: [], server_time: '2026-08-16T00:00:00Z' },
    stations_fixes: { upserts: [], server_time: '2026-08-16T00:00:00Z' },
    utilisateurs_equipe: { upserts: [], server_time: '2026-08-16T00:00:00Z' },
    pesticides: { upserts: [], server_time: '2026-08-16T00:00:00Z' },
    cultures: { upserts: [], server_time: '2026-08-16T00:00:00Z' },
    codes_stades: { upserts: [], server_time: '2026-08-16T00:00:00Z' },
  }

  it.each([
    {
      tabName: /Utilisateurs équipe/,
      entity: 'utilisateurs_equipe',
      row: { id: 'u1', nom: 'Rakoto', prenom: 'Jean', email: 'jean@ifvm.mg', role: 'chef', pa_id: 'p1', actif: true, updated_at: '2026-08-16T00:00:00Z' },
      expectedHeaders: ['Prénom', 'Rôle'],
      rawKeyNotShown: 'pa_id',
    },
    {
      tabName: /Pesticides/,
      entity: 'pesticides',
      row: { id: 'pe1', code: 'PES-01', nom: 'Deltaméthrine', actif: true, updated_at: '2026-08-16T00:00:00Z' },
      expectedHeaders: ['Code', 'Nom'],
      rawKeyNotShown: 'updated_at',
    },
    {
      tabName: /Cultures/,
      entity: 'cultures',
      row: { id: 'c1', code: 'CUL-01', nom: 'Riz', actif: true, updated_at: '2026-08-16T00:00:00Z' },
      expectedHeaders: ['Code', 'Nom'],
      rawKeyNotShown: 'updated_at',
    },
    {
      tabName: /Codes stades/,
      entity: 'codes_stades',
      row: { id: 'cs1', code: 'CS-01', espece: 'Locusta migratoria', libelle: 'Larve L1', actif: true, updated_at: '2026-08-16T00:00:00Z' },
      expectedHeaders: ['Espèce', 'Libellé'],
      rawKeyNotShown: 'espece',
    },
  ])('affiche des colonnes labellisées FR (pas les clés brutes) pour $entity', async ({ tabName, entity, row, expectedHeaders, rawKeyNotShown }) => {
    mockedGet.mockResolvedValue({
      data: { ...emptyEntities, [entity]: { upserts: [row], server_time: '2026-08-16T00:00:00Z' } },
    })
    renderPage()

    await waitFor(() => screen.getByRole('tab', { name: tabName }))
    screen.getByRole('tab', { name: tabName }).click()

    await waitFor(() => expect(screen.getByText(expectedHeaders[0])).toBeInTheDocument())
    for (const header of expectedHeaders) {
      expect(screen.getByText(header)).toBeInTheDocument()
    }
    expect(screen.queryByText(rawKeyNotShown)).not.toBeInTheDocument()
  })
})
