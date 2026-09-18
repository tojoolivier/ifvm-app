import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { api } from '../api/client'
import { StationsSection } from './StationsSection'

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}))

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>
const mockedPost = api.post as unknown as ReturnType<typeof vi.fn>
const mockedPut = api.put as unknown as ReturnType<typeof vi.fn>

const POSTE = { id: 'pa1', nom: 'Poste Beroroha' }
const COMMUNE = { id: 'cm1', nom: 'Beroroha' }

function stationFixe(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1',
    code: 'ST-014',
    nom: 'Beroroha',
    pa_id: 'pa1',
    pa_code: 'PA-04',
    pa_nom: 'Poste Beroroha',
    commune_id: 'cm1',
    district: 'District Beroroha',
    region: 'Région Atsimo',
    latitude: -21.66,
    longitude: 45.17,
    altitude: 120,
    actif: true,
    created_at: '2026-08-01T00:00:00Z',
    ...overrides,
  }
}

function mockApi({
  prospections = [],
  stations = [stationFixe()],
  postes = [POSTE],
  communes = [COMMUNE],
}: {
  prospections?: { station_id: string | null }[]
  stations?: ReturnType<typeof stationFixe>[]
  postes?: typeof POSTE[]
  communes?: typeof COMMUNE[]
} = {}) {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/stations') return Promise.resolve({ data: stations })
    if (url === '/prospections') return Promise.resolve({ data: prospections })
    if (url === '/postes-acridiens') return Promise.resolve({ data: postes })
    if (url === '/communes') return Promise.resolve({ data: communes })
    return Promise.resolve({ data: [] })
  })
}

function renderPage() {
  // `retry: false` : sans ça, les tests d'erreur attendent les 3 tentatives par défaut.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/administration']}>
        <StationsSection />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('StationsSection — même présentation que ReferentielsPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('affiche la carte d’en-tête et la carte Enregistrements', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(screen.getByText('Beroroha')).toBeInTheDocument())

    expect(screen.getByRole('heading', { name: 'Stations' })).toBeInTheDocument()
    expect(screen.getByText('station_fixe')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Enregistrements' })).toBeInTheDocument()
  })

  it('affiche code (mono vert), station, coordonnées (mono) et état (badge)', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(screen.getByText('Beroroha')).toBeInTheDocument())

    const code = screen.getByText('ST-014')
    expect(code.className).toMatch(/ifvm-green-text/)

    // Format du prototype : décimale française, séparateur « · ».
    expect(screen.getByText('-21,6600 · 45,1700')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it("l'écriture est disponible depuis #133 : le bouton + Nouvelle station ouvre une modale", async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(screen.getByText('Beroroha')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: '+ Nouvelle station' }))

    expect(screen.getByRole('dialog', { name: 'Nouvelle station' })).toBeInTheDocument()
  })

  it('affiche la colonne Prospections avec le compte réel dérivé de GET /prospections (pas fabriqué)', async () => {
    mockApi({ prospections: [{ station_id: 's1' }, { station_id: 's1' }, { station_id: 'autre' }] })
    renderPage()

    await waitFor(() => expect(screen.getByText('Beroroha')).toBeInTheDocument())

    const row = screen.getByText('Beroroha').closest('tr')!
    expect(row).toHaveTextContent('2')
  })

  it("remplit la colonne Aire protégée avec le poste acridien renvoyé par l'API (pa_nom)", async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(screen.getByText('Beroroha')).toBeInTheDocument())

    expect(screen.getByRole('columnheader', { name: 'Aire protégée' })).toBeInTheDocument()
    expect(screen.getByText('Poste Beroroha')).toBeInTheDocument()
  })

  it('affiche un bandeau si GET /stations échoue', async () => {
    mockedGet.mockImplementation((url: string) =>
      url === '/stations'
        ? Promise.reject({ response: { status: 500, data: { detail: 'Base indisponible' } } })
        : Promise.resolve({ data: [] }),
    )
    renderPage()

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Erreur 500'))
    expect(screen.getByRole('alert')).toHaveTextContent('Base indisponible')
  })

  it('demande les stations des deux états et rend le badge Inactive', async () => {
    mockApi({ stations: [stationFixe(), stationFixe({ id: 's2', code: 'ST-020', nom: 'Sakaraha', actif: false })] })
    renderPage()

    await waitFor(() => expect(screen.getByText('Sakaraha')).toBeInTheDocument())

    expect(mockedGet).toHaveBeenCalledWith('/stations', { params: { inclure_inactifs: true } })
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('crée une station via POST /stations', async () => {
    mockApi()
    mockedPost.mockResolvedValue({ data: stationFixe({ id: 's2', code: 'ST-020', nom: 'Isalo' }) })
    renderPage()

    await waitFor(() => expect(screen.getByText('Beroroha')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '+ Nouvelle station' }))

    const modal = within(screen.getByRole('dialog', { name: 'Nouvelle station' }))
    fireEvent.change(modal.getByLabelText('Code *'), { target: { value: 'ST-020' } })
    fireEvent.change(modal.getByLabelText('Nom *'), { target: { value: 'Isalo' } })
    fireEvent.change(modal.getByLabelText('Poste acridien *'), { target: { value: 'pa1' } })
    fireEvent.change(modal.getByLabelText('Commune *'), { target: { value: 'cm1' } })
    fireEvent.change(modal.getByLabelText('Latitude *'), { target: { value: '-22.5' } })
    fireEvent.change(modal.getByLabelText('Longitude *'), { target: { value: '45.3' } })
    fireEvent.click(modal.getByRole('button', { name: 'Créer' }))

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith('/stations', {
        code: 'ST-020',
        nom: 'Isalo',
        pa_id: 'pa1',
        commune_id: 'cm1',
        latitude: -22.5,
        longitude: 45.3,
        altitude: null,
      }),
    )
  })

  it('modifie une station via PUT /stations/{id}, actif compris', async () => {
    mockApi()
    mockedPut.mockResolvedValue({ data: stationFixe() })
    renderPage()

    await waitFor(() => expect(screen.getByText('Beroroha')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Modifier ST-014' }))

    const modal = within(screen.getByRole('dialog', { name: 'Modifier ST-014' }))
    expect(modal.getByLabelText('Code *')).toHaveValue('ST-014')
    expect(modal.getByText('District Beroroha')).toBeInTheDocument()
    expect(modal.getByText('Région Atsimo')).toBeInTheDocument()

    fireEvent.change(modal.getByLabelText('Nom *'), { target: { value: 'Beroroha Renommé' } })
    fireEvent.click(modal.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() =>
      expect(mockedPut).toHaveBeenCalledWith('/stations/s1', {
        code: 'ST-014',
        nom: 'Beroroha Renommé',
        pa_id: 'pa1',
        commune_id: 'cm1',
        latitude: -21.66,
        longitude: 45.17,
        altitude: 120,
        actif: true,
      }),
    )
  })

  it('recherche filtre les lignes (code, station…)', async () => {
    mockApi({ stations: [stationFixe(), stationFixe({ id: 's2', code: 'ST-020', nom: 'Isalo', pa_nom: 'Poste Isalo' })] })
    renderPage()

    await waitFor(() => expect(screen.getByText('Isalo')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('Rechercher…'), { target: { value: 'isalo' } })

    expect(screen.getByText('Isalo')).toBeInTheDocument()
    expect(screen.queryByText('Beroroha')).not.toBeInTheDocument()
  })
})
