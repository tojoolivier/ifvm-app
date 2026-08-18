import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { api } from '../api/client'
import { CampagnesPage } from './CampagnesPage'

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}))

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>
const mockedPost = api.post as unknown as ReturnType<typeof vi.fn>

// Les statuts de la maquette §2 sont dérivés des dates : on fige « aujourd'hui »
// pour que le test ne se mette pas à échouer le jour où une borne est franchie.
const AUJOURDHUI = '2026-08-17'

const CAMPAGNES = [
  // En cours : commencée, sans date de fin → « Active ».
  {
    id: 'c-active',
    name: 'Campagne 2025-2026',
    start_date: '2025-10-01',
    end_date: null,
    created_at: '2025-09-20T08:00:00Z',
  },
  // Terminée : date de fin dépassée → « Clôturée ».
  {
    id: 'c-close',
    name: 'Campagne 2024-2025',
    start_date: '2024-10-01',
    end_date: '2025-06-30',
    created_at: '2024-09-20T08:00:00Z',
  },
  // Pas encore commencée → « En préparation ».
  {
    id: 'c-prep',
    name: 'Riposte Sud 2027',
    start_date: '2027-07-15',
    end_date: null,
    created_at: '2026-08-01T08:00:00Z',
  },
]

const PROSPECTIONS = [
  { id: 'p1', campagne_id: 'c-active' },
  { id: 'p2', campagne_id: 'c-active' },
  { id: 'p3', campagne_id: 'c-close' },
]

const TRAITEMENTS = [
  { id: 't1', prospection_id: 'p1' },
  { id: 't2', prospection_id: 'p3' },
]

function mockApi(overrides: Record<string, unknown> = {}) {
  mockedGet.mockImplementation((url: string) => {
    if (url in overrides) return Promise.resolve({ data: overrides[url] })
    if (url === '/campagnes') return Promise.resolve({ data: CAMPAGNES })
    if (url === '/prospections') return Promise.resolve({ data: PROSPECTIONS })
    if (url === '/traitements') return Promise.resolve({ data: TRAITEMENTS })
    return Promise.resolve({ data: [] })
  })
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/campagnes']}>
        <CampagnesPage today={AUJOURDHUI} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function ligne(nom: string) {
  const cellule = await screen.findByText(nom)
  return cellule.closest('tr') as HTMLTableRowElement
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('CampagnesPage — maquette §2 du handoff', () => {
  it("affiche le texte d'introduction de la maquette", async () => {
    mockApi()
    renderPage()
    expect(
      await screen.findByText(/Une seule campagne est active à la fois/i),
    ).toBeInTheDocument()
  })

  it('affiche les six colonnes de la maquette', async () => {
    mockApi()
    renderPage()
    await screen.findByText('Campagne 2025-2026')
    const entetes = screen.getAllByRole('columnheader').map((th) => th.textContent)
    expect(entetes).toEqual([
      'Campagne',
      'Début',
      'Fin',
      'Prospections',
      'Traitements',
      'Statut',
    ])
  })

  it('dérive le statut de chaque campagne à partir de ses dates', async () => {
    mockApi()
    renderPage()
    expect(within(await ligne('Campagne 2025-2026')).getByText('Active')).toBeInTheDocument()
    expect(within(await ligne('Campagne 2024-2025')).getByText('Clôturée')).toBeInTheDocument()
    expect(within(await ligne('Riposte Sud 2027')).getByText('En préparation')).toBeInTheDocument()
  })

  it('affiche « — » quand la campagne n’a pas de date de fin', async () => {
    mockApi()
    renderPage()
    expect(within(await ligne('Campagne 2025-2026')).getByText('—')).toBeInTheDocument()
    expect(within(await ligne('Campagne 2024-2025')).getByText('2025-06-30')).toBeInTheDocument()
  })

  it('compte les prospections et les traitements rattachés à chaque campagne', async () => {
    mockApi()
    renderPage()
    const active = within(await ligne('Campagne 2025-2026')).getAllByRole('cell')
    expect(active[3]).toHaveTextContent('2') // prospections p1 + p2
    expect(active[4]).toHaveTextContent('1') // traitement t1 (via p1)

    const prep = within(await ligne('Riposte Sud 2027')).getAllByRole('cell')
    expect(prep[3]).toHaveTextContent('0')
    expect(prep[4]).toHaveTextContent('0')
  })

  it('affiche « ? » plutôt qu’un 0 trompeur si les compteurs sont indisponibles', async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === '/campagnes') return Promise.resolve({ data: CAMPAGNES })
      return Promise.reject(new Error('boom'))
    })
    renderPage()
    const active = within(await ligne('Campagne 2025-2026')).getAllByRole('cell')
    await waitFor(() => expect(active[3]).toHaveTextContent('?'))
    expect(active[4]).toHaveTextContent('?')
  })

  it("n'expose aucune suppression : la maquette n'en a pas et #137 attend un arbitrage", async () => {
    mockApi()
    renderPage()
    await screen.findByText('Campagne 2025-2026')
    expect(screen.queryByText(/Supprimer/i)).not.toBeInTheDocument()
  })

  it('crée une campagne depuis le formulaire', async () => {
    mockApi()
    mockedPost.mockResolvedValue({ data: {} })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /Nouvelle campagne/i }))
    fireEvent.change(screen.getByLabelText(/Nom/i), { target: { value: 'Riposte Nord' } })
    fireEvent.change(screen.getByLabelText(/Date de début/i), {
      target: { value: '2026-09-01' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^Créer$/ }))

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith('/campagnes', {
        name: 'Riposte Nord',
        start_date: '2026-09-01',
        end_date: null,
      }),
    )
  })

  it('signale une erreur de chargement au lieu d’un tableau vide', async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === '/campagnes') return Promise.reject(new Error('boom'))
      return Promise.resolve({ data: [] })
    })
    renderPage()
    expect(await screen.findByText(/Impossible de charger les campagnes/i)).toBeInTheDocument()
  })
})
