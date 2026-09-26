import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { api } from '../api/client'
import { ConsommationPesticide } from './ConsommationPesticide'

vi.mock('../api/client', () => ({
  api: { get: vi.fn() },
}))

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>

const PESTICIDES = [
  { id: 'p1', code: 'FEN-01', nom: 'Fenitrothion', actif: true },
  { id: 'p2', code: 'DEL-02', nom: 'Deltamethrine', actif: true },
]
const SITES = [{ id: 's1', numero: 'IHO01', localite: 'Ihosy', parent_site_id: null, actif: true }]

function consommation(surcharges: Record<string, unknown>) {
  return {
    id: 'm?',
    type: 'consommation',
    pesticide_id: 'p1',
    site_id: 's1',
    site_destination_id: null,
    quantite: 10,
    unite: 'L',
    date_mouvement: '2026-09-02',
    created_at: '2026-09-02T10:00:00Z',
    traitement_id: 't1',
    ...surcharges,
  }
}

function renderComposant(mouvements: unknown[] | 'erreur') {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/mouvements-pesticide') {
      return mouvements === 'erreur' ? Promise.reject(new Error('500')) : Promise.resolve({ data: mouvements })
    }
    if (url === '/pesticides') return Promise.resolve({ data: PESTICIDES })
    if (url === '/sites-aeriens') return Promise.resolve({ data: SITES })
    return Promise.resolve({ data: [] })
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ConsommationPesticide traitementId="t1" />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

// #609 : la consommation générée remplace « Pesticide reçu » / « Stock restant » sur la fiche aérienne.
describe('ConsommationPesticide', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('demande au journal les mouvements de cette fiche', async () => {
    renderComposant([])

    await waitFor(() =>
      expect(mockedGet).toHaveBeenCalledWith('/mouvements-pesticide', { params: { traitement_id: 't1' } }),
    )
  })

  it('liste chaque produit consommé avec sa quantité et son unité', async () => {
    renderComposant([
      consommation({ id: 'm1', pesticide_id: 'p1', quantite: 265, unite: 'L' }),
      consommation({ id: 'm2', pesticide_id: 'p2', quantite: 12.5, unite: 'kg' }),
    ])

    const liste = await screen.findByRole('list', { name: 'Produits consommés' })
    const lignes = within(liste).getAllByRole('listitem')
    expect(lignes).toHaveLength(2)
    expect(within(lignes[0]).getByText('FEN-01 — Fenitrothion')).toBeInTheDocument()
    expect(within(lignes[0]).getByText('265 L')).toBeInTheDocument()
    expect(within(lignes[1]).getByText('DEL-02 — Deltamethrine')).toBeInTheDocument()
    expect(within(lignes[1]).getByText('12,5 kg')).toBeInTheDocument()
  })

  it('indique le site débité, et que les unités ne sont jamais additionnées', async () => {
    renderComposant([consommation({})])

    expect(await screen.findByText(/Débitée du stock de IHO01 — Ihosy/)).toBeInTheDocument()
    expect(screen.getByText(/ne sont\s+jamais additionnés/)).toBeInTheDocument()
  })

  it('renvoie vers la page Stock de pesticides', async () => {
    renderComposant([consommation({})])

    const lien = await screen.findByRole('link', { name: 'Voir le stock' })
    expect(lien).toHaveAttribute('href', '/stock-pesticides')
  })

  it('n’affiche que les consommations (jamais un approvisionnement ou un transfert)', async () => {
    renderComposant([consommation({ id: 'm1', quantite: 10 }), consommation({ id: 'm2', type: 'approvisionnement', quantite: 999 })])

    await screen.findByText('10 L')
    expect(screen.queryByText('999 L')).not.toBeInTheDocument()
  })

  it('sans consommation générée : le dit clairement', async () => {
    renderComposant([])

    expect(await screen.findByText(/Aucune consommation générée/)).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Produits consommés' })).not.toBeInTheDocument()
  })

  it('erreur de chargement : message, sans casser la fiche', async () => {
    renderComposant('erreur')

    expect(await screen.findByText('Impossible de charger la consommation.')).toBeInTheDocument()
  })

  it('ne parle plus de « Pesticide reçu » ni de « Stock restant »', async () => {
    renderComposant([consommation({})])

    await screen.findByText('10 L')
    expect(screen.queryByText(/Pesticide reçu/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Stock restant/i)).not.toBeInTheDocument()
  })
})
