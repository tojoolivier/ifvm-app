import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { api } from '../api/client'
import { SynthesesPage } from './SynthesesPage'

vi.mock('../api/client', () => ({
  api: { get: vi.fn() },
}))

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>

const STATIONS = [
  { id: 's-014', code: 'ST-014', nom: 'Ankazoabo' },
  { id: 's-021', code: 'ST-021', nom: 'Betioky' },
]

const UTILISATEURS = [
  { id: 'u-1', prenom: 'Jean', nom: 'Randria', email: 'j@x.mg', role: 'prospecteur', actif: true, created_at: '' },
  { id: 'u-2', prenom: 'Paul', nom: 'Andria', email: 'p@x.mg', role: 'prospecteur', actif: true, created_at: '' },
]

function fiche(overrides: Record<string, unknown>) {
  return {
    id: 'p-1',
    campagne_id: 'c-1',
    station_id: 's-014',
    prospecteur_id: 'u-1',
    statut: 'validee',
    n_fiche: 'PR-2026-0148-INT',
    date_prospection: '2026-07-15',
    region: 'Androy',
    district: null,
    commune: null,
    latitude: null,
    longitude: null,
    surface_prospectee: null,
    surface_infestee: 100,
    updated_at: '2026-07-16T08:00:00Z',
    populations: [],
    captures: [],
    ...overrides,
  }
}

const PROSPECTIONS = [
  fiche({
    id: 'p-1',
    station_id: 's-014',
    prospecteur_id: 'u-1',
    date_prospection: '2026-07-15',
    region: 'Androy',
    surface_infestee: 300,
    populations: [
      { id: 'pop-1', espece: 'Locusta migratoria', categorie: 'imago', densite_diffuse: 600, densite_groupee: 640 },
    ],
    captures: [
      { id: 'cap-1', espece: 'Locusta migratoria', categorie: 'imago', phase: 'gregaire', stade: 'A1', effectif: 12480 },
    ],
  }),
  fiche({
    id: 'p-2',
    station_id: 's-021',
    prospecteur_id: 'u-2',
    date_prospection: '2026-08-20',
    region: 'Menabe',
    surface_infestee: 100,
    populations: [
      { id: 'pop-2', espece: 'Oedaleus spp.', categorie: 'imago', densite_diffuse: 110, densite_groupee: null },
    ],
    captures: [
      { id: 'cap-2', espece: 'Oedaleus spp.', categorie: 'imago', phase: 'solitaire', stade: 'A1', effectif: 760 },
    ],
  }),
]

const TRAITEMENTS = [
  { id: 't-1', region: 'Androy', date_traitement: '2026-07-20', terrestre: { surface_traitee_ha: 150 } },
  { id: 't-2', region: 'Menabe', date_traitement: '2026-08-22', terrestre: { surface_traitee_ha: 23 } },
]

function mockApi({ traitementsFail = false } = {}) {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/prospections') return Promise.resolve({ data: PROSPECTIONS })
    if (url === '/traitements') {
      return traitementsFail
        ? Promise.reject(new Error('500'))
        : Promise.resolve({ data: TRAITEMENTS })
    }
    if (url === '/stations') return Promise.resolve({ data: STATIONS })
    if (url === '/users/') return Promise.resolve({ data: UTILISATEURS })
    return Promise.resolve({ data: [] })
  })
}

function renderPage(entry = '/syntheses') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <SynthesesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function rows() {
  return within(screen.getByRole('table')).getAllByRole('row').slice(1)
}

beforeEach(() => {
  mockApi()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('SynthesesPage — barre de filtres (maquette §9)', () => {
  it('affiche les trois pastilles de groupement, « Espèce » active par défaut', async () => {
    renderPage()
    await screen.findByText('Agrégats par espèce')

    expect(screen.getByRole('button', { name: 'Espèce' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Station' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Prospecteur' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('expose les deux boutons d’export de la maquette', async () => {
    renderPage()
    await screen.findByText('Agrégats par espèce')

    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export rapport PDF' })).toBeInTheDocument()
  })

  it('restreint les agrégats à la période saisie', async () => {
    renderPage()
    await screen.findByText('Locusta migratoria')
    expect(rows()).toHaveLength(2)

    fireEvent.change(screen.getByLabelText('Fin de période'), { target: { value: '2026-07-31' } })

    await waitFor(() => expect(rows()).toHaveLength(1))
    expect(screen.getByText('Locusta migratoria')).toBeInTheDocument()
    expect(screen.queryByText('Oedaleus spp.')).not.toBeInTheDocument()
  })
})

describe('SynthesesPage — tableau des agrégats', () => {
  it('affiche fiches, individus, densité moyenne et surface infestée', async () => {
    renderPage()
    await screen.findByText('Locusta migratoria')

    const cells = within(rows()[0]).getAllByRole('cell')
    expect(cells[0]).toHaveTextContent('Locusta migratoria')
    expect(cells[1]).toHaveTextContent('1')
    expect(cells[2]).toHaveTextContent('12 480')
    expect(cells[3]).toHaveTextContent('620') // (600 + 640) / 2
    expect(cells[4]).toHaveTextContent('300')
  })

  it('change d’axe d’agrégation au clic sur une pastille', async () => {
    renderPage()
    await screen.findByText('Agrégats par espèce')

    fireEvent.click(screen.getByRole('button', { name: 'Prospecteur' }))

    await screen.findByText('Agrégats par prospecteur')
    expect(screen.getByText('Jean Randria')).toBeInTheDocument()
    expect(screen.getByText('Paul Andria')).toBeInTheDocument()
  })

  it('résout le libellé des stations sur l’axe station', async () => {
    renderPage()
    await screen.findByText('Agrégats par espèce')

    fireEvent.click(screen.getByRole('button', { name: 'Station' }))

    await screen.findByText('Agrégats par station')
    expect(screen.getByText('ST-014 — Ankazoabo')).toBeInTheDocument()
  })

  it('lit l’axe depuis l’URL pour qu’une synthèse soit partageable', async () => {
    renderPage('/syntheses?groupe=station')
    await screen.findByText('Agrégats par station')
  })
})

describe('SynthesesPage — couverture du traitement', () => {
  it('rapporte la surface traitée à la surface infestée, par région', async () => {
    renderPage()
    await screen.findByText('Couverture du traitement')

    const androy = await screen.findByRole('meter', { name: 'Couverture Androy' })
    expect(androy).toHaveAttribute('aria-valuenow', '50') // 150 / 300
    const menabe = screen.getByRole('meter', { name: 'Couverture Menabe' })
    expect(menabe).toHaveAttribute('aria-valuenow', '23') // 23 / 100
  })

  it('borne les traitements sur la même période que les prospections', async () => {
    renderPage()
    await screen.findByRole('meter', { name: 'Couverture Menabe' })

    // Au 31/07, la fiche Menabe (20/08) et son traitement (22/08) sortent tous
    // deux de la fenêtre : la zone disparaît au lieu d'afficher un ratio faussé.
    fireEvent.change(screen.getByLabelText('Fin de période'), { target: { value: '2026-07-31' } })

    await waitFor(() =>
      expect(screen.queryByRole('meter', { name: 'Couverture Menabe' })).not.toBeInTheDocument(),
    )
    expect(screen.getByRole('meter', { name: 'Couverture Androy' })).toHaveAttribute(
      'aria-valuenow',
      '50',
    )
  })

  it('signale l’indisponibilité des traitements au lieu d’afficher 0 % partout', async () => {
    mockApi({ traitementsFail: true })
    renderPage()

    await screen.findByText('Traitements indisponibles — couverture non calculable.')
    expect(screen.queryByRole('meter')).not.toBeInTheDocument()
  })
})

describe('SynthesesPage — export', () => {
  it('décrit le contenu de l’export dans l’encart vert de la maquette', async () => {
    renderPage()
    await screen.findByText("Contenu de l'export")
    expect(screen.getByText(/UTF‑8 avec BOM/)).toBeInTheDocument()
  })

  it('désactive les exports quand la période ne retient aucune fiche', async () => {
    renderPage()
    await screen.findByText('Agrégats par espèce')

    fireEvent.change(screen.getByLabelText('Début de période'), { target: { value: '2027-01-01' } })

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Export CSV' })).toBeDisabled(),
    )
    expect(screen.getByRole('button', { name: 'Export rapport PDF' })).toBeDisabled()
  })

  it('télécharge un CSV portant sur le jeu filtré', async () => {
    const createObjectURL = vi.fn(() => 'blob:csv')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    renderPage()
    await screen.findByText('Locusta migratoria')
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }))

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(click).toHaveBeenCalledTimes(1)

    click.mockRestore()
    vi.unstubAllGlobals()
  })
})
