/**
 * #suivi-heures-de-vol : le backend (`app/domain/fiche_vol.py`, routes
 * `/fiches-vol`) existait déjà, complet, sans aucune vue côté portail web —
 * cette page en est la première consultation.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { api } from '../api/client'
import { FichesVolPage } from './FichesVolPage'

vi.mock('../api/client', () => ({
  api: { get: vi.fn() },
}))

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>

const FICHES_VOL = [
  {
    id: 'fv-1',
    numero_fiche: '2026-08-14-MDGA21-A21',
    date_vol: '2026-08-14',
    compagnie: 'Aero Services',
    immatriculation: '5R-MDG',
    base_code: 'MDGA21',
    base_nom: 'Ambovombe',
    pilote: 'Jean Rakoto',
    mecanicien: 'Paul Andria',
    statut: 'brouillon',
    duree_totale_minutes: 95,
  },
  {
    id: 'fv-2',
    numero_fiche: '2026-08-13-TLR-B12',
    date_vol: '2026-08-13',
    compagnie: 'Air Fret',
    immatriculation: '5R-TLR',
    base_code: 'TLR',
    base_nom: 'Toliara',
    pilote: 'Marc Randria',
    mecanicien: 'Ali Hasan',
    statut: 'validee',
    duree_totale_minutes: 187,
  },
]

function mockApi() {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/fiches-vol') return Promise.resolve({ data: FICHES_VOL })
    return Promise.resolve({ data: [] })
  })
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/fiches-vol']}>
        <FichesVolPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function rows() {
  return within(screen.getByRole('table')).getAllByRole('row').slice(1)
}

describe('FichesVolPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('liste les fiches de vol avec durée totale formatée HH:MM', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(rows()).toHaveLength(2))
    expect(screen.getByText('2026-08-14-MDGA21-A21')).toBeInTheDocument()
    // 95 min = 1h35
    expect(screen.getByText('01:35')).toBeInTheDocument()
    // 187 min = 3h07
    expect(screen.getByText('03:07')).toBeInTheDocument()
  })

  it('affiche un état vide explicite plutôt qu’un tableau silencieusement blanc, quand aucune fiche n’existe', async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === '/fiches-vol') return Promise.resolve({ data: [] })
      return Promise.resolve({ data: [] })
    })
    renderPage()

    await waitFor(() =>
      expect(screen.getByText(/Aucune fiche de vol trouvée/)).toBeInTheDocument(),
    )
  })

  it('recherche sur le n° de fiche, l’immatriculation et le pilote', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(rows()).toHaveLength(2))
    fireEvent.change(screen.getByLabelText('Recherche'), { target: { value: 'randria' } })

    await waitFor(() => expect(rows()).toHaveLength(1))
    expect(screen.getByText('2026-08-13-TLR-B12')).toBeInTheDocument()
  })

  it('filtre par statut via les pastilles (Brouillon / Validée)', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(rows()).toHaveLength(2))
    fireEvent.click(screen.getByRole('button', { name: 'Validée' }))

    await waitFor(() => expect(rows()).toHaveLength(1))
    expect(screen.getByText('2026-08-13-TLR-B12')).toBeInTheDocument()
  })

  it('affiche le compteur de fiches et le résumé de filtre', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(screen.getByText('2 fiches')).toBeInTheDocument())
    expect(screen.getByText('Filtre : tous statuts')).toBeInTheDocument()
  })
})
