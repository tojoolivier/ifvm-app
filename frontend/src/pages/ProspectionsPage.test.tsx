import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { api } from '../api/client'
import { ProspectionsPage } from './ProspectionsPage'

vi.mock('../api/client', () => ({
  api: { get: vi.fn() },
}))

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>

const STATIONS = [
  { id: 's-014', code: 'ST-014', nom: 'Ankazoabo', pa_code: 'PA-01' },
  { id: 's-021', code: 'ST-021', nom: 'Betioky', pa_code: 'PA-02' },
]

const UTILISATEURS = [
  { id: 'u-1', nom: 'Randria Jean', role: 'prospecteur' },
  { id: 'u-2', nom: 'Andria Paul', role: 'prospecteur' },
]

const PROSPECTIONS = [
  {
    id: 'p-1',
    n_fiche: 'PR-2026-0148-INT',
    type_prospection: 'intensive',
    date_prospection: '2026-08-14',
    prospecteur_id: 'u-1',
    station_id: 's-014',
    surface_infestee: 1200,
    statut: 'verifiee',
  },
  {
    id: 'p-2',
    n_fiche: 'PR-2026-0146-EXT',
    type_prospection: 'extensive',
    date_prospection: '2026-08-13',
    prospecteur_id: 'u-2',
    station_id: 's-021',
    surface_infestee: null,
    statut: 'validee',
  },
]

/** Route les trois requêtes de la page ; `/users/` peut échouer (403 non-admin). */
function mockApi({ usersFail = false } = {}) {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/prospections') return Promise.resolve({ data: PROSPECTIONS })
    if (url === '/stations') return Promise.resolve({ data: STATIONS })
    if (url === '/users/') {
      return usersFail
        ? Promise.reject(new Error('403'))
        : Promise.resolve({ data: UTILISATEURS })
    }
    return Promise.resolve({ data: [] })
  })
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/prospections']}>
        <ProspectionsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function rows() {
  return within(screen.getByRole('table')).getAllByRole('row').slice(1)
}

describe('ProspectionsPage — maquette §3 du handoff', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('affiche les colonnes de la maquette dans l’ordre', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())

    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent)
    expect(headers).toEqual([
      'N° de fiche',
      'Type',
      'Date',
      'Prospecteur',
      'Station',
      'Surf. inf. (ha)',
      'Statut',
      '',
    ])
  })

  it('liste les deux types de prospection, pas seulement les intensives', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(rows()).toHaveLength(2))
    expect(screen.getByText('PR-2026-0148-INT')).toBeInTheDocument()
    expect(screen.getByText('PR-2026-0146-EXT')).toBeInTheDocument()
  })

  it('résout le prospecteur et la station en libellés lisibles', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(screen.getByText('Randria Jean')).toBeInTheDocument())
    expect(screen.getByText('ST-014 Ankazoabo')).toBeInTheDocument()
  })

  it('reste affichable quand /users/ est refusé (rôle non admin)', async () => {
    mockApi({ usersFail: true })
    renderPage()

    await waitFor(() => expect(rows()).toHaveLength(2))
    expect(screen.getByText('PR-2026-0148-INT')).toBeInTheDocument()
  })

  it('filtre par type via les pastilles de la maquette', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(rows()).toHaveLength(2))
    fireEvent.click(screen.getByRole('button', { name: 'Extensive' }))

    await waitFor(() => expect(rows()).toHaveLength(1))
    expect(screen.getByText('PR-2026-0146-EXT')).toBeInTheDocument()
  })

  it('filtre par statut via les pastilles de la maquette', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(rows()).toHaveLength(2))
    fireEvent.click(screen.getByRole('button', { name: 'Vérifiée' }))

    await waitFor(() => expect(rows()).toHaveLength(1))
    expect(screen.getByText('PR-2026-0148-INT')).toBeInTheDocument()
  })

  it('recherche sur le n° de fiche, l’agent et la station', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(rows()).toHaveLength(2))
    fireEvent.change(screen.getByLabelText('Recherche'), { target: { value: 'betioky' } })

    await waitFor(() => expect(rows()).toHaveLength(1))
    expect(screen.getByText('PR-2026-0146-EXT')).toBeInTheDocument()
  })

  it('affiche le compteur de fiches et le résumé de filtre', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(screen.getByText('2 fiches')).toBeInTheDocument())
    expect(screen.getByText('Filtre : tous types · tous statuts')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Intensive' }))
    await waitFor(() =>
      expect(screen.getByText('Filtre : Intensive · tous statuts')).toBeInTheDocument(),
    )
  })

  it('affiche la surface infestée en mono à droite, tiret si absente', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(screen.getByText('1 200')).toBeInTheDocument())
    expect(within(rows()[1]).getByText('—')).toBeInTheDocument()
  })

  it('propose « Ouvrir › » sur chaque ligne', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(screen.getAllByText('Ouvrir ›')).toHaveLength(2))
  })

  it('mémorise les filtres dans l’URL', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(rows()).toHaveLength(2))
    fireEvent.click(screen.getByRole('button', { name: 'Rejetée' }))

    await waitFor(() => expect(screen.getByText('0 fiche')).toBeInTheDocument())
    expect(screen.getByText('Aucune fiche trouvée.')).toBeInTheDocument()
  })
})
