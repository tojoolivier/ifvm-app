import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { api } from '../api/client'
import { NouvelleProspectionPage } from './NouvelleProspectionPage'

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}))

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>
const mockedPost = api.post as unknown as ReturnType<typeof vi.fn>

const CAMPAGNES = [
  { id: 'c-1', name: 'Campagne 2025-2026', start_date: '2025-10-01', end_date: null },
]
const STATIONS = [{ id: 's-014', code: 'ST-014', nom: 'Ankazoabo', pa_code: 'PA-01' }]
const MOI = { id: 'u-1', nom: 'Randria Jean', role: 'prospecteur' }
const UTILISATEURS = [MOI, { id: 'u-2', nom: 'Andria Paul', role: 'prospecteur' }]

const BROUILLONS = [
  { id: 'p-1', prospecteur_id: 'u-1', statut: 'brouillon' },
  { id: 'p-2', prospecteur_id: 'u-1', statut: 'brouillon' },
  { id: 'p-3', prospecteur_id: 'u-2', statut: 'brouillon' },
  { id: 'p-4', prospecteur_id: 'u-1', statut: 'validee' },
]

function mockApi({ usersFail = false } = {}) {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/campagnes') return Promise.resolve({ data: CAMPAGNES })
    if (url === '/stations') return Promise.resolve({ data: STATIONS })
    if (url === '/users/me') return Promise.resolve({ data: MOI })
    if (url === '/prospections') return Promise.resolve({ data: BROUILLONS })
    if (url === '/users/') {
      return usersFail ? Promise.reject(new Error('403')) : Promise.resolve({ data: UTILISATEURS })
    }
    return Promise.resolve({ data: [] })
  })
  mockedPost.mockResolvedValue({ data: { id: 'p-neuve' } })
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/prospections/new']}>
        <NouvelleProspectionPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('NouvelleProspectionPage — maquette §4 du handoff', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('annonce que la saisie terrain complète se fait sur mobile', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(screen.getByText(/en-tête de fiche/)).toBeInTheDocument())
    expect(screen.getByText(/se fait sur mobile hors-ligne/)).toBeInTheDocument()
  })

  it('rend les deux sections de la maquette et l’encart latéral', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(screen.getByText('Références')).toBeInTheDocument())
    expect(screen.getByText('Affectation')).toBeInTheDocument()
    expect(screen.getByText('Ce qui est rempli sur le terrain')).toBeInTheDocument()
    expect(screen.getByText('File de l’agent sélectionné')).toBeInTheDocument()
  })

  it('bascule le type de prospection par segment', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(screen.getByRole('button', { name: 'Intensive' })).toBeInTheDocument())
    // Intensive est le défaut de la maquette.
    expect(screen.getByRole('button', { name: 'Intensive' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Extensive' }))
    expect(screen.getByRole('button', { name: 'Extensive' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('affiche le n° de fiche comme généré à l’enregistrement', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(screen.getByText('généré à l’enregistrement')).toBeInTheDocument())
  })

  it('compte les brouillons non synchronisés du prospecteur retenu', async () => {
    mockApi()
    renderPage()

    // u-1 porte 2 brouillons ; la fiche validée et celles de u-2 sont exclues.
    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument())
    expect(screen.getByText(/fiches ouvertes non synchronisées/)).toBeInTheDocument()
  })

  it('signale que l’affectation à un autre agent n’est pas exposée par l’API', async () => {
    mockApi()
    renderPage()

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Randria Jean' })).toBeInTheDocument(),
    )
    expect(screen.getByText(/force le prospecteur au créateur/)).toBeInTheDocument()
    // L'agent connecté est la seule pastille active ; les autres sont inertes.
    expect(screen.getByRole('button', { name: 'Randria Jean' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Andria Paul' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  it('exige une campagne avant de créer', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(screen.getByText('Références')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Créer et assigner' }))

    await waitFor(() =>
      expect(screen.getByText('Sélectionnez une campagne.')).toBeInTheDocument(),
    )
    expect(mockedPost).not.toHaveBeenCalled()
  })

  it('crée l’en-tête de fiche et n’envoie que les champs de la maquette', async () => {
    mockApi()
    renderPage()

    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Campagne 2025-2026' })).toBeInTheDocument(),
    )

    fireEvent.change(screen.getByLabelText(/Campagne/), { target: { value: 'c-1' } })
    fireEvent.change(screen.getByLabelText(/Date de prospection/), {
      target: { value: '2026-08-18' },
    })
    fireEvent.change(screen.getByLabelText(/Station/), { target: { value: 's-014' } })
    fireEvent.change(screen.getByLabelText('Localité'), { target: { value: 'Beroroha' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer et assigner' }))

    await waitFor(() => expect(mockedPost).toHaveBeenCalledTimes(1))
    expect(mockedPost).toHaveBeenCalledWith('/prospections', {
      type_prospection: 'intensive',
      campagne_id: 'c-1',
      date_prospection: '2026-08-18',
      station_id: 's-014',
      commune: 'Beroroha',
      statut: 'brouillon',
    })
  })

  it('reste utilisable quand /users/ est refusé (rôle non admin)', async () => {
    mockApi({ usersFail: true })
    renderPage()

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Randria Jean' })).toBeInTheDocument(),
    )
  })
})
