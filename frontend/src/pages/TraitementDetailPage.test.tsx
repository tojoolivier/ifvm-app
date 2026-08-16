import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { api } from '../api/client'
import { TraitementDetailPage } from './TraitementDetailPage'

vi.mock('../api/client', () => ({
  api: { get: vi.fn() },
}))

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>

const pesticidePull = {
  data: {
    pesticides: {
      upserts: [
        { id: 'pest-1', code: 'PEST-FEN', nom: 'Fenitrothion', actif: true, updated_at: '2026-01-01T00:00:00Z' },
      ],
      server_time: '2026-01-01T00:00:00Z',
    },
  },
}

function traitementAerien(overrides: Record<string, unknown> = {}) {
  return {
    id: 't1',
    prospection_id: 'p1',
    numero_fiche: 'Jean-AERIEN-2026-08-12',
    type_traitement: 'AERIEN',
    mode_traitement: 'BARRIERE',
    date_traitement: '2026-08-12',
    date_validation: '2026-08-13',
    localite: 'Beroroha',
    region: 'Atsimo-Andrefana',
    district: 'Beroroha',
    commune: 'Beroroha',
    statut: 'validee',
    cible: {
      espece: 'LMC',
      repartition_population: 'GROUPEE',
      surface_infestee_ha: 3.2,
      petites_larves: 'non renseigné',
      grandes_larves: 'non renseigné',
      vols_clairs_essaims: 'non renseigné',
    },
    aerien: {
      pilote: 'Jean Rakoto',
      mecanicien: 'Paul Randria',
      nb_rotations: 2,
      total_pesticide_l: 530,
      rotations: [
        {
          id: 'r1',
          numero: 1,
          numero_cuve: 'CUVE-01',
          produit_id: 'pest-1',
          quantite_l: 265,
          temperature_debut_c: 29,
          temperature_fin_c: 31,
          vent_debut_ms: 2.5,
          vent_fin_ms: 3.1,
        },
        {
          id: 'r2',
          numero: 2,
          numero_cuve: 'CUVE-02',
          produit_id: 'pest-1',
          quantite_l: 265,
          temperature_debut_c: 30,
          temperature_fin_c: 32,
          vent_debut_ms: 2.5,
          vent_fin_ms: 3.1,
        },
      ],
    },
    terrestre: null,
    kit_combinaison: true,
    kit_gants: true,
    kit_lunettes: true,
    kit_masques: true,
    kit_boite: false,
    empoisonnement: false,
    empoisonnement_type: null,
    empoisonnement_mode: null,
    empoisonnement_autre: null,
    evaluation_risque: null,
    comportement_anormal: false,
    comportement_non_cibles: null,
    mortalite: false,
    mortalite_familles: null,
    signatures: [
      { id: 's1', role: 'PILOTE', signataire_nom: 'Jean Rakoto', horodatage: '2026-08-13T08:00:00Z' },
      { id: 's2', role: 'MECANICIEN', signataire_nom: 'Paul Randria', horodatage: '2026-08-13T08:00:00Z' },
      { id: 's3', role: 'CHEF_DE_BASE', signataire_nom: 'Marie Rabe', horodatage: '2026-08-13T08:00:00Z' },
    ],
    ...overrides,
  }
}

function renderPage(traitement: ReturnType<typeof traitementAerien>) {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/traitements/t1') return Promise.resolve({ data: traitement })
    if (url === '/referentiel/pull') return Promise.resolve(pesticidePull)
    return Promise.resolve({ data: [] })
  })

  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/traitements/t1']}>
        <Routes>
          <Route path="/traitements/:id" element={<TraitementDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('TraitementDetailPage — conformité maquette (README §7)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('affiche un en-tête vert avec le sous-titre type/mode/localité/validation et la pilule lecture seule', async () => {
    renderPage(traitementAerien())
    await waitFor(() => expect(screen.getByText('Jean-AERIEN-2026-08-12')).toBeInTheDocument())

    expect(screen.getByTestId('traitement-header')).toHaveClass('bg-[#235a36]')
    expect(screen.getByText(/Aérien · mode Barrière · Beroroha · validée le 2026-08-13/)).toBeInTheDocument()
    expect(screen.getByText('🔒 Lecture seule')).toBeInTheDocument()
  })

  it("n'affiche pas la pilule lecture seule pour une fiche en brouillon", async () => {
    renderPage(traitementAerien({ statut: 'brouillon' }))
    await waitFor(() => expect(screen.getByText('Jean-AERIEN-2026-08-12')).toBeInTheDocument())
    expect(screen.queryByText('🔒 Lecture seule')).not.toBeInTheDocument()
  })

  it('affiche le bandeau cible (snapshot figé) avec le lien vers la prospection', async () => {
    renderPage(traitementAerien())
    await waitFor(() => expect(screen.getByText('Jean-AERIEN-2026-08-12')).toBeInTheDocument())

    expect(screen.getByText(/3.2 ha/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Voir la fiche de prospection/ })).toHaveAttribute(
      'href',
      '/prospections/p1',
    )
  })

  it('affiche le tableau des rotations avec le nom du produit résolu et le total', async () => {
    renderPage(traitementAerien())
    await waitFor(() => expect(screen.getByText('Jean-AERIEN-2026-08-12')).toBeInTheDocument())

    expect(screen.getByText('2 rotations · 530 l')).toBeInTheDocument()
    expect(screen.getByText('CUVE-01')).toBeInTheDocument()
    expect(screen.getAllByText('Fenitrothion')).toHaveLength(2)
  })

  it('affiche le tableau des produits utilisés pour une fiche terrestre', async () => {
    renderPage(
      traitementAerien({
        type_traitement: 'TERRESTRE',
        aerien: null,
        terrestre: {
          heure_debut: '06:00:00',
          heure_fin: '10:00:00',
          vitesse_vent_ms: 1.8,
          surface_traitee_ha: 5,
          surface_cumulee_ha: 5,
          surface_restante_ha: 3,
          surface_restante_abandonnee: true,
          motif_surface_restante_abandonnee: 'Panne matériel',
          reprise_traitement: false,
          traitement_origine_id: null,
          produits: [{ id: 'pu1', numero: 1, produit_id: 'pest-1', quantite_l: 180 }],
        },
      }),
    )
    await waitFor(() => expect(screen.getByText('Jean-AERIEN-2026-08-12')).toBeInTheDocument())

    expect(screen.getByText('Fenitrothion')).toBeInTheDocument()
    expect(screen.getByText('180')).toBeInTheDocument()
    expect(screen.getByText('Panne matériel')).toBeInTheDocument()
  })

  it('la matrice de signatures affiche « ne signe pas » pour les rôles non renseignés', async () => {
    renderPage(traitementAerien())
    await waitFor(() => expect(screen.getByText('Jean-AERIEN-2026-08-12')).toBeInTheDocument())

    expect(screen.getAllByText('ne signe pas')).toHaveLength(2)
  })

  it("affiche la reprise et le lien d'origine à partir de terrestre.reprise_traitement (pas d'un champ racine)", async () => {
    renderPage(
      traitementAerien({
        type_traitement: 'TERRESTRE',
        aerien: null,
        terrestre: {
          heure_debut: '06:00:00',
          heure_fin: '08:30:00',
          vitesse_vent_ms: 1.2,
          surface_traitee_ha: 3,
          surface_cumulee_ha: 8,
          surface_restante_ha: 0,
          surface_restante_abandonnee: null,
          motif_surface_restante_abandonnee: null,
          reprise_traitement: true,
          traitement_origine_id: 'origine-1',
          produits: [],
        },
      }),
    )
    await waitFor(() => expect(screen.getByText('Jean-AERIEN-2026-08-12')).toBeInTheDocument())

    expect(screen.getByText(/Reprise d'un traitement :/).parentElement).toHaveTextContent(
      "Reprise d'un traitement : Oui",
    )
    expect(screen.getByRole('link', { name: "Voir la fiche d'origine" })).toHaveAttribute(
      'href',
      '/traitements/origine-1',
    )
  })
})
