import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { api } from '../api/client'
import { TraitementsPage } from './TraitementsPage'

vi.mock('../api/client', () => ({
  api: { get: vi.fn() },
}))

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>

function traitementAerien() {
  return {
    id: 't-aerien',
    numero_fiche: 'Jean-AERIEN-2026-08-12',
    type_traitement: 'AERIEN',
    mode_traitement: 'BARRIERE',
    date_traitement: '2026-08-12',
    localite: 'Beroroha',
    statut: 'validee',
    aerien: {
      pilote: 'Jean Rakoto',
      mecanicien: 'Paul Randria',
      nb_rotations: 4,
      total_pesticide_l: 1060,
      // Barrière : la surface est protégée, jamais traitée (migration 0081).
      surface_traitee_ha: 0,
      surface_protegee_ha: 320,
      surface_restante_ha: null,
    },
    terrestre: null,
    signatures: [
      { id: 's1', role: 'PILOTE', signataire_nom: 'Jean Rakoto', horodatage: '2026-08-13T08:00:00Z' },
      { id: 's2', role: 'MECANICIEN', signataire_nom: 'Paul Randria', horodatage: '2026-08-13T08:00:00Z' },
      { id: 's3', role: 'CHEF_DE_BASE', signataire_nom: 'Marie Rabe', horodatage: '2026-08-13T08:00:00Z' },
    ],
  }
}

function traitementTerrestreAvecRestante() {
  return {
    id: 't-terrestre',
    numero_fiche: 'Hery-TERRESTRE-2026-08-05',
    type_traitement: 'TERRESTRE',
    mode_traitement: 'TOTAL',
    date_traitement: '2026-08-05',
    localite: 'Ihosy',
    statut: 'validee',
    aerien: null,
    terrestre: { surface_traitee_ha: 5, surface_cumulee_ha: 5, surface_restante_ha: 3 },
    signatures: [
      { id: 's4', role: 'CHEF_EQUIPE', signataire_nom: 'Hery Rasoa', horodatage: '2026-08-05T09:00:00Z' },
    ],
  }
}

function renderPage(initialEntry = '/traitements') {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <TraitementsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('TraitementsPage — colonnes maquette (README §7)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('affiche mode, responsable, surface traitée, restante en ambre et signatures n/5', async () => {
    mockedGet.mockResolvedValue({ data: [traitementAerien(), traitementTerrestreAvecRestante()] })
    renderPage()

    await waitFor(() => expect(screen.getByText('Jean-AERIEN-2026-08-12')).toBeInTheDocument())

    expect(screen.getByText('Barrière')).toBeInTheDocument()
    // Maquette : « Rakoto A. (chef de base) » — le responsable hiérarchique,
    // pas le pilote.
    expect(screen.getByText('Marie Rabe (chef de base)')).toBeInTheDocument()
    expect(screen.getByText('3/5')).toBeInTheDocument()

    // La maquette porte l'unité dans l'en-tête (« Traitée (ha) ») et laisse la
    // cellule en nombre nu, aligné à droite en mono.
    const restante = screen.getByText('3')
    expect(restante).toBeInTheDocument()
    expect(restante.className).toMatch(/ifvm-amber-text/)

    expect(screen.getByText('1/5')).toBeInTheDocument()
    expect(screen.getByText("Hery Rasoa (chef d'équipe)")).toBeInTheDocument()
  })

  /** Choc → surface traitée ; barrière (aérien) → surface protégée : même colonne, l'infobulle nomme la ligne. */
  it('nomme la surface de chaque ligne en infobulle : protégée pour l’aérien en barrière, traitée sinon', async () => {
    mockedGet.mockResolvedValue({ data: [traitementAerien(), traitementTerrestreAvecRestante()] })
    renderPage()

    await waitFor(() => expect(screen.getByText('320')).toBeInTheDocument())
    expect(screen.getByText('320')).toHaveAttribute('title', 'Surface protégée')
    // Terrestre (traitée 5 ha) : « Traitée », même si le mode de la fiche est TOTAL ici.
    expect(screen.getByText('5')).toHaveAttribute('title', 'Surface traitée')
  })

  it('teinte le badge Type : aérien en bleu, terrestre en vert (prototype ligne 1461)', async () => {
    mockedGet.mockResolvedValue({ data: [traitementAerien(), traitementTerrestreAvecRestante()] })
    renderPage()

    await waitFor(() => expect(screen.getByText('Aérien')).toBeInTheDocument())
    expect(screen.getByText('Aérien').className).toMatch(/ifvm-blue-bg/)
    expect(screen.getByText('Terrestre').className).toMatch(/ifvm-green-bg/)
  })

  it('teinte le compteur de signatures : vert si complet, ambre sinon', async () => {
    mockedGet.mockResolvedValue({
      data: [
        traitementAerien(),
        {
          ...traitementTerrestreAvecRestante(),
          id: 't-complet',
          numero_fiche: 'Complet-01',
          signatures: [
            { id: 'a', role: 'PILOTE', signataire_nom: 'A', horodatage: '' },
            { id: 'b', role: 'MECANICIEN', signataire_nom: 'B', horodatage: '' },
            { id: 'c', role: 'CHEF_DE_BASE', signataire_nom: 'C', horodatage: '' },
            { id: 'd', role: 'CHEF_EQUIPE', signataire_nom: 'D', horodatage: '' },
            { id: 'e', role: 'CONSULTANT_INTERNATIONAL', signataire_nom: 'E', horodatage: '' },
          ],
        },
      ],
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('5/5')).toBeInTheDocument())
    expect(screen.getByText('5/5').className).toMatch(/ifvm-green-text/)
    expect(screen.getByText('3/5').className).toMatch(/ifvm-amber-text/)
  })

  it('affiche les dix colonnes de la maquette + Localité, sans colonne Statut', async () => {
    mockedGet.mockResolvedValue({ data: [traitementAerien()] })
    renderPage()

    await waitFor(() => expect(screen.getByText('Jean-AERIEN-2026-08-12')).toBeInTheDocument())
    const entetes = screen.getAllByRole('columnheader').map((th) => th.textContent)
    expect(entetes).toEqual([
      'N° de fiche',
      'Localité',
      'Type',
      'Mode',
      'Date',
      'Responsable',
      'Traitée / protégée (ha)',
      'Restante',
      'Signatures',
      '',
    ])
  })

  /**
   * La localité vient de la fiche de prospection liée (station_nom/station_libre,
   * pré-remplie à la création du traitement) : elle doit apparaître juste à côté
   * du N° de fiche dans la liste, comme déjà fait sur « Mes fiches » côté mobile.
   */
  it('affiche la localité de la fiche de prospection liée, à côté du N° de fiche', async () => {
    mockedGet.mockResolvedValue({ data: [traitementAerien(), traitementTerrestreAvecRestante()] })
    renderPage()

    await waitFor(() => expect(screen.getByText('Jean-AERIEN-2026-08-12')).toBeInTheDocument())
    expect(screen.getByText('Beroroha')).toBeInTheDocument()
    expect(screen.getByText('Ihosy')).toBeInTheDocument()
  })

  it("n'affiche pas la surface restante en ambre quand elle est nulle", async () => {
    mockedGet.mockResolvedValue({
      data: [
        {
          ...traitementTerrestreAvecRestante(),
          id: 't-solde',
          numero_fiche: 'Solde-01',
          terrestre: { surface_traitee_ha: 5, surface_cumulee_ha: 5, surface_restante_ha: 0 },
        },
      ],
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Solde-01')).toBeInTheDocument())
    const restante = screen.getByText('0')
    expect(restante.className).not.toMatch(/ifvm-amber-text/)
  })
})

describe('TraitementsPage — 3 sous-sections (Lot D)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('« Toutes les fiches » est actif par défaut et ne filtre pas par statut/reprenable', async () => {
    mockedGet.mockResolvedValue({ data: [traitementAerien()] })
    renderPage()

    await waitFor(() => expect(screen.getByText('Jean-AERIEN-2026-08-12')).toBeInTheDocument())

    expect(screen.getByRole('link', { name: 'Toutes les fiches' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: 'Zones à reprendre' })).not.toHaveAttribute(
      'aria-current',
    )
    expect(screen.getByRole('link', { name: 'Brouillons' })).not.toHaveAttribute('aria-current')

    const [, params] = mockedGet.mock.calls[0]
    expect(params.params.reprenable).toBeUndefined()
    expect(params.params.statut).toBeUndefined()
  })

  it('« Zones à reprendre » active l’onglet et transmet reprenable=true à l’API', async () => {
    mockedGet.mockResolvedValue({ data: [] })
    renderPage('/traitements?reprenable=true')

    await waitFor(() => expect(mockedGet).toHaveBeenCalled())

    expect(screen.getByRole('link', { name: 'Zones à reprendre' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: 'Toutes les fiches' })).not.toHaveAttribute(
      'aria-current',
    )
    const [, params] = mockedGet.mock.calls[0]
    expect(params.params.reprenable).toBe('true')
  })

  it('« Brouillons » active l’onglet et transmet statut=brouillon à l’API', async () => {
    mockedGet.mockResolvedValue({ data: [] })
    renderPage('/traitements?statut=brouillon')

    await waitFor(() => expect(mockedGet).toHaveBeenCalled())

    expect(screen.getByRole('link', { name: 'Brouillons' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: 'Toutes les fiches' })).not.toHaveAttribute(
      'aria-current',
    )
    const [, params] = mockedGet.mock.calls[0]
    expect(params.params.statut).toBe('brouillon')
  })
})
