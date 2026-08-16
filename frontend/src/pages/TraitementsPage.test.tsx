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
    aerien: { pilote: 'Jean Rakoto', mecanicien: 'Paul Randria', nb_rotations: 4, total_pesticide_l: 1060 },
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

function renderPage() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/traitements']}>
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
    expect(screen.getByText('Jean Rakoto')).toBeInTheDocument()
    expect(screen.getByText('3/5')).toBeInTheDocument()

    const restante = screen.getByText('3 ha')
    expect(restante).toBeInTheDocument()
    expect(restante.className).toMatch(/ifvm-amber-text/)

    expect(screen.getByText('1/5')).toBeInTheDocument()
    expect(screen.getByText('Hery Rasoa')).toBeInTheDocument()
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
    const restante = screen.getByText('0 ha')
    expect(restante.className).not.toMatch(/ifvm-amber-text/)
  })
})
