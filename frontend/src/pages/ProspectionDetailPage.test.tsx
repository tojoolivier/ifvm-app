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
    altitude: null as number | null,
    region: null as string | null,
    district: null as string | null,
    commune: null as string | null,
    station_libre: null as string | null,
    hauteur_herbe_cm: null as number | null,
    verdissement_pourcent: null as number | null,
    surface_station: 100,
    surface_prospectee: 80,
    surface_infestee: 0,
    vegetation: null,
    sol: null,
    degats_cultures: null,
    avertissements: [] as string[],
    populations: [],
    captures: [],
    infestations: [],
  }
}

function renderPage(statut: string, overrides: Partial<ReturnType<typeof baseProspection>> = {}) {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/prospections/p1')
      return Promise.resolve({ data: { ...baseProspection(statut), ...overrides } })
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

describe('ProspectionDetailPage — impression A4 (#19)', () => {
  beforeEach(() => {
    window.print = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("n'affiche pas le bouton d'export pour une fiche non validée", async () => {
    renderPage('en_attente')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'F-001' })).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /Imprimer A4/i })).not.toBeInTheDocument()
  })

  it('affiche le bouton d\'export pour une fiche validée et déclenche window.print au clic', async () => {
    renderPage('validee')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'F-001' })).toBeInTheDocument())

    const button = screen.getByRole('button', { name: /Imprimer A4/i })
    expect(button).toBeInTheDocument()

    expect(screen.queryByTestId('fiche-imprimable')).not.toBeInTheDocument()
    button.click()

    await waitFor(() => expect(screen.getByTestId('fiche-imprimable')).toBeInTheDocument())
    expect(window.print).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Fiche n° F-001')).toBeInTheDocument()
    expect(screen.getByText(/Validé ✓/)).toBeInTheDocument()
  })
})

describe('ProspectionDetailPage — avertissements « à vérifier » (#106)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("n'affiche pas de bandeau quand la fiche n'a aucun avertissement", async () => {
    renderPage('en_attente', { avertissements: [] })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'F-001' })).toBeInTheDocument())

    expect(screen.queryByText(/Avertissements de la fiche/)).not.toBeInTheDocument()
  })

  it('affiche chaque avertissement déclenché à la saisie, visible en revue', async () => {
    renderPage('en_attente', {
      avertissements: [
        'Essaim/vol clair signalé de nuit : comportement forcé sur « posé ».',
        'Écart important par rapport à la dernière observation connue sur ce point de suivi.',
      ],
    })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'F-001' })).toBeInTheDocument())

    expect(screen.getByText('Avertissements de la fiche · 2')).toBeInTheDocument()
    expect(
      screen.getByText('Essaim/vol clair signalé de nuit : comportement forcé sur « posé ».')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Écart important par rapport à la dernière observation connue sur ce point de suivi.')
    ).toBeInTheDocument()
  })
})

describe('ProspectionDetailPage — maquette §5 du handoff', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("porte le n° de fiche et le contexte dans l'en-tête vert", async () => {
    renderPage('verifiee', { commune: 'Beroroha' })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'F-001' })).toBeInTheDocument())

    expect(screen.getByText(/Intensive · Beroroha · 2026-07-10/)).toBeInTheDocument()
    expect(screen.getByText('Vérifiée')).toBeInTheDocument()
  })

  it('rend les quatre blocs de lecture de la maquette', async () => {
    renderPage('verifiee')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'F-001' })).toBeInTheDocument())

    expect(screen.getByText('D · Infestation — spécialisation')).toBeInTheDocument()
    expect(screen.getByText('A · Référence & localisation')).toBeInTheDocument()
    expect(screen.getByText('B · Captures par phase')).toBeInTheDocument()
    expect(screen.getByText('E · Végétation & sol')).toBeInTheDocument()
  })

  it('sépare les cartes larve et imago', async () => {
    renderPage('verifiee')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'F-001' })).toBeInTheDocument())

    expect(screen.getByText('Larve · bande larvaire')).toBeInTheDocument()
    expect(screen.getByText('Imago · vol clair')).toBeInTheDocument()
  })

  it('affiche la piste de validation avec une étape en attente', async () => {
    renderPage('verifiee')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'F-001' })).toBeInTheDocument())

    expect(screen.getByText('Piste de validation')).toBeInTheDocument()
    expect(screen.getByText('en attente')).toBeInTheDocument()
  })

  it("propose les actions du rôle et la création de traitement", async () => {
    // Le mock renvoie le rôle validation_finale ; la fiche vérifiée est statuable.
    renderPage('verifiee')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'F-001' })).toBeInTheDocument())

    expect(screen.getByRole('button', { name: 'Valider la fiche' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rejeter avec motif' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Créer une fiche de traitement' }),
    ).toBeInTheDocument()
  })

  it("masque les boutons de statut quand le rôle ne le permet pas", async () => {
    renderPage('brouillon')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'F-001' })).toBeInTheDocument())

    expect(screen.queryByRole('button', { name: 'Valider la fiche' })).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Créer une fiche de traitement' }),
    ).toBeInTheDocument()
  })
})
