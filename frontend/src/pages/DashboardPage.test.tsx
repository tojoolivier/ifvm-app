import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { api } from '../api/client'
import { DashboardPage } from './DashboardPage'

vi.mock('../api/client', () => ({
  api: { get: vi.fn() },
}))

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>

// « Maintenant » figé : la colonne « Reçue » et la fenêtre de 24 h en dépendent.
const MAINTENANT = new Date('2026-08-17T10:00:00')

const CAMPAGNES = [
  { id: 'c-active', name: 'Campagne 2025-2026', start_date: '2025-10-01', end_date: null },
  { id: 'c-close', name: 'Campagne 2024-2025', start_date: '2024-10-01', end_date: '2025-06-30' },
]

const STATIONS = [
  { id: 's1', code: 'ST-014', nom: 'Ankazoabo' },
  { id: 's2', code: 'ST-009', nom: 'Sakaraha' },
]

function fiche(over: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    type_prospection: 'intensive',
    campagne_id: 'c-active',
    station_id: 's1',
    prospecteur_id: 'u1',
    statut: 'validee',
    n_fiche: 'PR-2026-0148-INT',
    n_releve: null,
    date_prospection: '2026-08-17',
    surface_infestee: 100,
    created_at: new Date('2026-08-17T09:40:00').toISOString(),
    updated_at: new Date('2026-08-17T09:40:00').toISOString(),
    ...over,
  }
}

const PROSPECTIONS = [
  fiche(),
  fiche({
    id: 'p2',
    n_fiche: 'PR-2026-0147-INT',
    statut: 'rejetee',
    surface_infestee: 100,
    created_at: new Date('2026-08-17T09:30:00').toISOString(),
  }),
  fiche({
    id: 'p3',
    n_fiche: 'PR-2026-0146-EXT',
    type_prospection: 'extensive',
    station_id: 's2',
    // Non statuée : ne doit entrer ni au numérateur ni au dénominateur du taux.
    statut: 'en_attente',
    created_at: new Date('2026-08-17T09:20:00').toISOString(),
  }),
  // Autre campagne : ne doit peser sur aucun indicateur.
  fiche({ id: 'p9', n_fiche: 'PR-2025-0001-INT', campagne_id: 'c-close', surface_infestee: 9999 }),
]

const TRAITEMENTS = [
  {
    id: 't1',
    prospection_id: 'p1',
    numero_fiche: 'CRT-2026-0036',
    type_traitement: 'TERRESTRE',
    date_traitement: '2026-08-17',
    localite: 'Zone Sakaraha',
    statut: 'validee',
    created_at: new Date('2026-08-17T09:00:00').toISOString(),
    updated_at: new Date('2026-08-17T09:00:00').toISOString(),
    aerien: null,
    terrestre: { surface_traitee_ha: 150 },
    signatures: [{ role: 'CHEF_EQUIPE', signataire_nom: 'Soa Lalao' }],
  },
]

function mockApi(overrides: Record<string, unknown> = {}) {
  mockedGet.mockImplementation((url: string) => {
    if (url in overrides) return Promise.resolve({ data: overrides[url] })
    if (url === '/prospections') return Promise.resolve({ data: PROSPECTIONS })
    if (url === '/traitements') return Promise.resolve({ data: TRAITEMENTS })
    if (url === '/campagnes') return Promise.resolve({ data: CAMPAGNES })
    if (url === '/stations') return Promise.resolve({ data: STATIONS })
    if (url === '/users/') return Promise.resolve({ data: [{ id: 'u1', nom: 'Randria Jean', role: 'prospecteur' }] })
    return Promise.resolve({ data: [] })
  })
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** Retrouve la carte KPI portant ce libellé uppercase (le label, puis sa carte). */
function tuile(label: string): HTMLElement {
  return screen.getByText(label).parentElement as HTMLElement
}

/** Retrouve la carte d'une section par son titre. */
function section(titre: string): HTMLElement {
  return screen.getByRole('heading', { name: titre }).parentElement as HTMLElement
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(MAINTENANT)
  mockApi()
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('DashboardPage — maquette §1', () => {
  it('affiche les 4 indicateurs de la campagne en cours', async () => {
    renderPage()

    // 3 fiches sur c-active — même ensemble que le pipeline —, dont 2 intensives.
    await waitFor(() => expect(within(tuile('Prospections')).getByText('3')).toBeInTheDocument())
    expect(screen.getByText('dont 2 intensives · campagne en cours')).toBeInTheDocument()

    // 100 + 100 + 100 : la fiche de la campagne clôturée (9999) est exclue.
    expect(within(tuile('Surface infestée')).getByText('300')).toBeInTheDocument()
    expect(within(tuile('Surface traitée')).getByText('150')).toBeInTheDocument()
    expect(screen.getByText('50 % de la surface infestée')).toBeInTheDocument()

    // 1 validée / 1 rejetée statuées → 50 %.
    expect(within(tuile('Taux de validation')).getByText('50')).toBeInTheDocument()
    expect(screen.getByText('50 % rejetées (motif renseigné)')).toBeInTheDocument()
  })

  it('rend le pipeline de validation et son lien vers les fiches', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByText('Pipeline de validation')).toBeInTheDocument())
    expect(screen.getByText('Brouillon (mobile, non synchronisé)')).toBeInTheDocument()
    expect(screen.getByText('Vérifiée — en attente validation finale')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Voir les fiches/ })).toHaveAttribute(
      'href',
      '/prospections',
    )
  })

  it('classe les stations par nombre de fiches', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByText('Ankazoabo')).toBeInTheDocument())
    const codes = within(section('Top stations'))
      .getAllByText(/^ST-0/)
      .map((n) => n.textContent)
    expect(codes).toEqual(['ST-014', 'ST-009'])
  })

  it('liste l’activité des dernières 24 h, du plus récent au plus ancien', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByText('Activité récente')).toBeInTheDocument())
    expect(screen.getByText('Dernières 24 h')).toBeInTheDocument()

    const lignes = screen.getAllByRole('row').slice(1)
    expect(within(lignes[0]).getByText('PR-2026-0148-INT')).toBeInTheDocument()
    expect(within(lignes[0]).getByText('il y a 20 min')).toBeInTheDocument()
    expect(within(lignes[0]).getByText('ST-014 Ankazoabo')).toBeInTheDocument()
    expect(within(lignes[3]).getByText('CRT-2026-0036')).toBeInTheDocument()
    expect(within(lignes[3]).getByText('Traitement terrestre')).toBeInTheDocument()
    expect(within(lignes[3]).getByText('Soa Lalao')).toBeInTheDocument()
  })

  it('affiche un message plutôt qu’un tableau vide sans activité récente', async () => {
    mockApi({
      '/prospections': [fiche({ created_at: '2026-08-01T09:00:00Z', updated_at: '2026-08-01T09:00:00Z' })],
      '/traitements': [],
    })
    renderPage()

    await waitFor(() =>
      expect(
        screen.getByText('Aucune fiche reçue dans les dernières 24 h.'),
      ).toBeInTheDocument(),
    )
  })

  it('écarte du cumul les traitements rattachés à une autre campagne', async () => {
    mockApi({
      // Rattaché à la fiche de la campagne clôturée : hors périmètre.
      '/traitements': [{ ...TRAITEMENTS[0], id: 't-hors', prospection_id: 'p9' }],
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Surface traitée')).toBeInTheDocument())
    expect(within(tuile('Surface traitée')).getByText('0')).toBeInTheDocument()
  })

  it('signale les traitements sans surface exclus du cumul', async () => {
    mockApi({
      '/traitements': [
        {
          ...TRAITEMENTS[0],
          id: 't-aerien',
          type_traitement: 'AERIEN',
          terrestre: null,
          aerien: { pilote: 'Rakoto A.' },
        },
      ],
    })
    renderPage()

    await waitFor(() =>
      expect(screen.getByText(/traitement sans surface traitée/)).toBeInTheDocument(),
    )
  })

  it('affiche un bandeau quand les fiches ne se chargent pas', async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === '/prospections') return Promise.reject({ response: { status: 403 } })
      return Promise.resolve({ data: [] })
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Erreur 403')).toBeInTheDocument())
  })

  it('retombe sur toutes les campagnes quand aucune n’est active', async () => {
    mockApi({ '/campagnes': [CAMPAGNES[1]] })
    renderPage()

    await waitFor(() =>
      expect(screen.getByText(/intensives · toutes campagnes/)).toBeInTheDocument(),
    )
  })
})
