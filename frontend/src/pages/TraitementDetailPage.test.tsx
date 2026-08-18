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

    expect(screen.getByTestId('traitement-header')).toHaveClass('bg-ifvm-green-text')
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

    expect(screen.getByText(/3,2 ha/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /la fiche de prospection/ })).toHaveAttribute(
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

  it('marque les EPI absents d’une pastille rouge et liste les zones exposées', async () => {
    renderPage(
      traitementAerien({
        zones_exposees: { habitations: true, ruchers: true, cultures: false },
      }),
    )
    await waitFor(() => expect(screen.getByText('Jean-AERIEN-2026-08-12')).toBeInTheDocument())

    // `kit_boite: false` dans la fixture, les quatre autres à true : c'est
    // l'état lu par un lecteur d'écran qui compte, pas la teinte de la pastille.
    expect(screen.getByText('Boîte à pharmacie').parentElement).toHaveTextContent('absent')
    expect(screen.getByText('Combinaison').parentElement).toHaveTextContent('présent')
    expect(screen.getByText('Habitations, Ruchers')).toBeInTheDocument()
  })

  it('affiche les axes de risque avec un badge de niveau teinté', async () => {
    renderPage(
      traitementAerien({
        evaluation_risque: { sol: 'FAIBLE', abeilles: 'ELEVE' },
      }),
    )
    await waitFor(() => expect(screen.getByText('Jean-AERIEN-2026-08-12')).toBeInTheDocument())

    expect(screen.getByText('Sol')).toBeInTheDocument()
    expect(screen.getByText('Faible').className).toMatch(/ifvm-green-bg/)
    expect(screen.getByText('Élevé').className).toMatch(/ifvm-danger-bg/)
  })

  it('affiche le panneau Surfaces avec la restante détachée en ambre', async () => {
    renderPage(
      traitementAerien({
        type_traitement: 'TERRESTRE',
        aerien: null,
        terrestre: {
          heure_debut: '06:00:00',
          heure_fin: '10:00:00',
          vitesse_vent_ms: 1.8,
          surface_traitee_ha: 860,
          surface_cumulee_ha: 1040,
          surface_restante_ha: 160,
          surface_restante_abandonnee: false,
          motif_surface_restante_abandonnee: null,
          reprise_traitement: false,
          traitement_origine_id: null,
          produits: [],
        },
      }),
    )
    await waitFor(() => expect(screen.getByText('Jean-AERIEN-2026-08-12')).toBeInTheDocument())

    expect(screen.getByText('Surfaces (ha)')).toBeInTheDocument()
    // `toLocaleString('fr-FR')` sépare les milliers par une espace insécable
    // que la normalisation de Testing Library ne ramène pas à un espace simple.
    expect(screen.getByText('Cumulée (reprises)').parentElement?.textContent).toMatch(/1.040/)
    expect(screen.getByText('Restante').className).toMatch(/ifvm-amber-text/)
  })

  it('garde les panneaux Surfaces et Chaîne de reprise sur une fiche aérienne', async () => {
    // La fiche détaillée de la maquette est aérienne et porte pourtant les deux
    // panneaux : ils ne doivent pas être conditionnés au bloc terrestre.
    renderPage(traitementAerien())
    await waitFor(() => expect(screen.getByText('Jean-AERIEN-2026-08-12')).toBeInTheDocument())

    expect(screen.getByText('Surfaces (ha)')).toBeInTheDocument()
    expect(screen.getByText('Chaîne de reprise')).toBeInTheDocument()
    // Le snapshot de cible reste lisible même sans bloc terrestre.
    expect(screen.getByText('Infestée (snapshot)').parentElement?.textContent).toMatch(/3,2/)
  })

  it('formate l’horodatage de signature comme la maquette (sans secondes)', async () => {
    renderPage(
      traitementAerien({
        signatures: [
          { id: 's1', role: 'PILOTE', signataire_nom: 'Jean Rakoto', horodatage: '2026-08-12T17:04:33' },
        ],
      }),
    )
    await waitFor(() => expect(screen.getByText('Jean-AERIEN-2026-08-12')).toBeInTheDocument())

    expect(screen.getByText('2026-08-12 17:04')).toBeInTheDocument()
  })

  it('propose un onglet de retour vers la liste des fiches', async () => {
    renderPage(traitementAerien())
    await waitFor(() => expect(screen.getByText('Jean-AERIEN-2026-08-12')).toBeInTheDocument())

    expect(screen.getByRole('link', { name: 'Liste des fiches' })).toHaveAttribute(
      'href',
      '/traitements',
    )
    expect(
      screen.getByRole('link', { name: 'Détail · Jean-AERIEN-2026-08-12' }),
    ).toHaveAttribute('aria-current', 'page')
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

    // Maquette : « Origine : <lien> → cette fiche. Une seule reprise possible
    // par fiche d'origine. »
    expect(screen.getByText(/Une seule reprise possible par fiche d'origine/)).toHaveTextContent(
      'Origine :',
    )
    expect(screen.getByRole('link', { name: "fiche d'origine" })).toHaveAttribute(
      'href',
      '/traitements/origine-1',
    )
  })
})
