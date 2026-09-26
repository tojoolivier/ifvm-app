import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { api } from '../api/client'
import { DashboardPage } from './DashboardPage'

vi.mock('../api/client', () => ({
  api: { get: vi.fn() },
}))

// Leaflet ne se dessine pas dans jsdom : on simule les composants de la carte des zones.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="carte-zones">{children}</div>
  ),
  TileLayer: () => null,
  CircleMarker: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bulle">{children}</div>
  ),
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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
    date_prospection: '2026-08-17',
    surface_prospectee: 400,
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
  fiche({
    id: 'p9',
    n_fiche: 'PR-2025-0001-INT',
    campagne_id: 'c-close',
    surface_prospectee: 99999,
    surface_infestee: 9999,
  }),
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
  it('affiche les 5 indicateurs de surface et de pesticide de la campagne en cours', async () => {
    renderPage()

    // 400 × 3 : la fiche de la campagne clôturée (99 999) est exclue.
    await waitFor(() =>
      expect(within(tuile('Surface prospectée')).getByText('1 200')).toBeInTheDocument(),
    )

    // 100 × 3 = 300 ha infestés, soit 25 % des 1 200 ha prospectés.
    expect(within(tuile('Surface infestée')).getByText('300')).toBeInTheDocument()
    expect(screen.getByText('25 % de la surface prospectée')).toBeInTheDocument()

    // 150 ha traités sur 300 ha infestés ; rien de protégé dans ce jeu de données.
    expect(within(tuile('Surface traitée')).getByText('150')).toBeInTheDocument()
    expect(screen.getByText('50 % de la surface infestée')).toBeInTheDocument()
    expect(within(tuile('Surface protégée')).getByText('0')).toBeInTheDocument()
    expect(screen.getByText('0 % de la surface infestée')).toBeInTheDocument()

    // Aucun pesticide renseigné : 0 L et 0 kg, côte à côte.
    expect(within(tuile('Pesticide consommé')).getAllByText('0')).toHaveLength(2)
  })

  it('ne montre plus les tuiles Prospections, Taux de validation ni Interventions', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByText('Surface prospectée')).toBeInTheDocument())
    expect(screen.queryByText('Taux de validation')).not.toBeInTheDocument()
    expect(screen.queryByText('Interventions réalisées')).not.toBeInTheDocument()
  })

  it('cumule surface protégée et pesticide en L et kg, aérien et terrestre confondus', async () => {
    mockApi({
      '/traitements': [
        // Terrestre au sol, produit de choc, 90 L.
        {
          ...TRAITEMENTS[0],
          terrestre: {
            surface_traitee_ha: 150,
            surface_protegee_ha: null,
            total_pesticide_l: 90,
            pesticide_unite: 'L',
          },
        },
        // Terrestre au sol, produit de barrière, 30 kg (champ `_l` mais unité kg).
        {
          ...TRAITEMENTS[0],
          id: 't2',
          numero_fiche: 'CRT-2026-0037',
          terrestre: {
            surface_traitee_ha: null,
            surface_protegee_ha: 30,
            total_pesticide_l: 30,
            pesticide_unite: 'kg',
          },
        },
        // Aérien barrière : 60 ha protégés, 1 000 L et 40 kg déjà séparés par l'API.
        {
          ...TRAITEMENTS[0],
          id: 't3',
          numero_fiche: 'CRT-2026-0038',
          type_traitement: 'AERIEN',
          terrestre: null,
          aerien: {
            pilote: 'Rakoto A.',
            surface_traitee_ha: 0,
            surface_protegee_ha: 60,
            total_pesticide_l: 1000,
            total_pesticide_kg: 40,
          },
        },
      ],
    })
    renderPage()

    // 30 + 60 = 90 ha protégés, soit 30 % des 300 ha infestés.
    await waitFor(() =>
      expect(within(tuile('Surface protégée')).getByText('90')).toBeInTheDocument(),
    )
    expect(screen.getByText('30 % de la surface infestée')).toBeInTheDocument()

    // 90 + 1 000 = 1 090 L ; 30 + 40 = 70 kg — jamais additionnés entre eux.
    const pesticide = within(tuile('Pesticide consommé'))
    expect(pesticide.getByText(/1\s090/)).toBeInTheDocument()
    expect(pesticide.getByText('70')).toBeInTheDocument()
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
      expect(screen.getByText(/cumul déclaré · toutes campagnes/)).toBeInTheDocument(),
    )
  })

  it('trace l’évolution de la campagne et la recale quand on change de campagne', async () => {
    renderPage()

    // Le placeholder a laissé place au graphique : 3 fiches × 100 ha infestés.
    await waitFor(() =>
      expect(
        within(screen.getByText('Infestée', { selector: 'li' })).getByText('300 ha'),
      ).toBeInTheDocument(),
    )
    expect(screen.queryByText(/Graphique d’évolution — à brancher/)).not.toBeInTheDocument()

    // Campagne clôturée : ses 9 999 ha remplacent ceux de la campagne en cours,
    // et le sous-titre nomme la campagne choisie.
    fireEvent.change(screen.getByDisplayValue(/Campagne 2025-2026/), {
      target: { value: 'c-close' },
    })
    await waitFor(() =>
      expect(
        within(screen.getByText('Infestée', { selector: 'li' })).getByText(/9\s999 ha/),
      ).toBeInTheDocument(),
    )
    expect(
      screen.getByText('Superficies infestées, traitées et protégées — Campagne 2024-2025'),
    ).toBeInTheDocument()
  })

  it('remplace le placeholder de la carte par les zones suivies, selon la lecture choisie', async () => {
    mockApi({
      '/prospections': [
        fiche({ id: 'p1', region: 'Atsimo-Andrefana', latitude: -22, longitude: 44 }),
        fiche({ id: 'p2', region: 'Menabe', latitude: -20, longitude: 44.5, surface_infestee: 0 }),
      ],
    })
    renderPage()

    expect(screen.queryByText(/Carte de Madagascar — à brancher/)).not.toBeInTheDocument()
    // Lecture « Infestation » par défaut : Menabe (0 ha infesté) n'apparaît pas.
    await waitFor(() => expect(screen.getAllByTestId('bulle')).toHaveLength(1))
    expect(within(screen.getAllByTestId('bulle')[0]).getByText('Atsimo-Andrefana')).toBeInTheDocument()

    // Lecture « Prospection » : les deux régions.
    fireEvent.click(screen.getByRole('button', { name: 'Prospection' }))
    expect(screen.getAllByTestId('bulle')).toHaveLength(2)
  })
})
