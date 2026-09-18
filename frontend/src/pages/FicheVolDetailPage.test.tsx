import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { api } from '../api/client'
import { FicheVolDetailPage } from './FicheVolDetailPage'

vi.mock('../api/client', () => ({
  api: { get: vi.fn() },
}))

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>

const FICHE_VOL = {
  id: 'fv-1',
  numero_fiche: '2026-08-14-MDGA21-A21',
  date_vol: '2026-08-14',
  compagnie: 'Aero Services',
  immatriculation: '5R-MDG',
  base_code: 'MDGA21',
  base_nom: 'Ambovombe',
  stand_nom: 'Stand Nord',
  base_numero: 'MDGA21',
  base_localite: 'Ambovombe',
  stand_numero: 'S1',
  stand_localite: 'Stand Nord',
  pilote: 'Jean Rakoto',
  mecanicien: 'Paul Andria',
  chef_de_base_id: 'u-chef',
  consultant_international: null,
  pesticide_nom_commercial: 'Icon 10 CS',
  pesticide_quantite_disponible: 200,
  pesticide_quantite_recue: 50,
  pesticide_quantite_utilisee: 10,
  pesticide_quantite_restante: 190,
  futs_disponible: 4,
  futs_recues: 1,
  futs_pleins: 3,
  futs_vides: 1,
  observations: 'RAS',
  statut: 'brouillon',
  vols: [
    {
      id: 'v-1',
      numero: 1,
      type_vol: 'MEP',
      heure_debut: '08:00:00',
      heure_fin: '08:35:00',
      rotation_id: 'r-1',
      prospection_id: null,
      observations: null,
      duree_minutes: 35,
      numero_cuve: '1',
      produit_nom: 'Icon 10 CS',
      bloc: {
        numero: 1,
        nom: 'Bloc 1',
        localite: 'Betioky-Sud',
        surface_theorique_ha: 12.5,
        surface_protegee_ha: null,
        surface_traitee_ha: 10,
        largeur_andain_m: 18,
        interpasse_m: 45,
        hauteur_vol_min_m: 8,
        hauteur_vol_max_m: 12,
        observation: 'RAS',
        espece: 'LMC',
        vols_clairs_essaims: 'Quelques vols clairs observés',
      },
    },
    {
      id: 'v-2',
      numero: 2,
      type_vol: 'PROSPECTION',
      heure_debut: '09:00:00',
      heure_fin: '10:00:00',
      rotation_id: null,
      prospection_id: 'p-1',
      observations: 'Survol de contrôle',
      duree_minutes: 60,
      numero_cuve: null,
      produit_nom: null,
      bloc: null,
    },
  ],
  signatures: [
    { id: 's-1', role: 'PILOTE', signataire_nom: 'Jean Rakoto', horodatage: '2026-08-14T09:10:00Z' },
  ],
  duree_totale_minutes: 95,
}

// Volontairement distincts de `duree_totale_minutes` (95) de la fixture ci-dessus,
// sinon leurs libellés « HH:MM » se confondent dans le rendu (deux « 01:35 »).
const CUMULS = { jour: 50, semaine: 245, mois: 610, total: 4820 }

function mockApi({ ficheVol = FICHE_VOL, cumuls = CUMULS, users = [{ id: 'u-chef', nom: 'Rasoa Chef', role: 'chef_de_base' }] } = {}) {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/fiches-vol/fv-1') return Promise.resolve({ data: ficheVol })
    if (url === '/fiches-vol/cumuls') return Promise.resolve({ data: cumuls })
    if (url === '/users/') return Promise.resolve({ data: users })
    return Promise.resolve({ data: [] })
  })
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/fiches-vol/fv-1']}>
        <Routes>
          <Route path="/fiches-vol/:id" element={<FicheVolDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('FicheVolDetailPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('affiche l’en-tête avec le n° de fiche, la date, l’immatriculation et la compagnie', async () => {
    mockApi()
    renderPage()

    const header = await screen.findByTestId('fiche-vol-header')
    expect(within(header).getByText('2026-08-14-MDGA21-A21')).toBeInTheDocument()
    expect(within(header).getByText('2026-08-14 · 5R-MDG · Aero Services')).toBeInTheDocument()
  })

  it('résout le chef de base via l’annuaire, pas son identifiant brut', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(screen.getByText('Rasoa Chef')).toBeInTheDocument())
  })

  it('liste les vols avec type libellé, horaire, durée et rattachement', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(screen.getByText('Mise en place')).toBeInTheDocument())
    expect(screen.getByText('08:00 → 08:35')).toBeInTheDocument()
    expect(screen.getByText('00:35')).toBeInTheDocument()
    expect(screen.getByText('Survol de contrôle')).toBeInTheDocument()
  })

  it('le lien de rattachement d’un vol de prospection pointe vers la fiche de prospection', async () => {
    mockApi()
    renderPage()

    const lien = await screen.findByRole('link', { name: 'Voir la fiche ›' })
    expect(lien).toHaveAttribute('href', '/prospections/p-1')
  })

  it('liste les signatures avec rôle libellé', async () => {
    mockApi()
    renderPage()

    const table = (await screen.findByText('Signatures')).closest('section')!
    expect(within(table).getByText('Pilote')).toBeInTheDocument()
    expect(within(table).getByText('Jean Rakoto')).toBeInTheDocument()
  })

  it('affiche les cumuls jour/semaine/mois/total de l’appareil, formatés HH:MM', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(screen.getByText('00:50')).toBeInTheDocument()) // jour = 50 min
    expect(screen.getByText('04:05')).toBeInTheDocument() // semaine = 245 min
    expect(screen.getByText('10:10')).toBeInTheDocument() // mois = 610 min
    expect(screen.getByText('80:20')).toBeInTheDocument() // total = 4820 min
  })

  it('interroge les cumuls avec la date de vol et l’immatriculation de la fiche', async () => {
    mockApi()
    renderPage()

    await waitFor(() =>
      expect(mockedGet).toHaveBeenCalledWith('/fiches-vol/cumuls', {
        params: { reference: '2026-08-14', immatriculation: '5R-MDG' },
      }),
    )
  })

  it('affiche les observations quand elles sont renseignées', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(screen.getByText('RAS')).toBeInTheDocument())
  })

  it('affiche un bandeau d’erreur explicite si la fiche est introuvable (404)', async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === '/fiches-vol/fv-1') {
        const err = new Error('404') as Error & { response: { status: number; data: { detail: string } } }
        err.response = { status: 404, data: { detail: 'fiche de vol introuvable' } }
        return Promise.reject(err)
      }
      return Promise.resolve({ data: [] })
    })
    renderPage()

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByText('Ressource introuvable')).toBeInTheDocument()
    expect(screen.getByText('fiche de vol introuvable')).toBeInTheDocument()
  })

  it('marque la fiche validée « Lecture seule », pas une fiche brouillon', async () => {
    mockApi({ ficheVol: { ...FICHE_VOL, statut: 'validee' } })
    renderPage()

    await waitFor(() => expect(screen.getByText('🔒 Lecture seule')).toBeInTheDocument())
  })

  it('ne montre pas « Lecture seule » pour une fiche brouillon', async () => {
    mockApi()
    renderPage()

    await screen.findByTestId('fiche-vol-header')
    expect(screen.queryByText('🔒 Lecture seule')).not.toBeInTheDocument()
  })
})

describe('FicheVolDetailPage — impression A4 (#fiche-vol-impression)', () => {
  beforeEach(() => {
    window.print = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("n'affiche pas le bouton d'export pour une fiche brouillon", async () => {
    mockApi()
    renderPage()

    await screen.findByTestId('fiche-vol-header')
    expect(screen.queryByRole('button', { name: /Imprimer A4/i })).not.toBeInTheDocument()
  })

  it('affiche le bouton d’export pour une fiche validée et déclenche window.print au clic', async () => {
    mockApi({ ficheVol: { ...FICHE_VOL, statut: 'validee' } })
    renderPage()

    await screen.findByTestId('fiche-vol-header')
    const button = screen.getByRole('button', { name: /Imprimer A4/i })
    expect(screen.queryByTestId('fiche-imprimable')).not.toBeInTheDocument()

    button.click()

    await waitFor(() => expect(screen.getByTestId('fiche-imprimable')).toBeInTheDocument())
    expect(window.print).toHaveBeenCalledTimes(1)

    const fiche = screen.getByTestId('fiche-imprimable')
    expect(within(fiche).getByText('Fiche n° 2026-08-14-MDGA21-A21')).toBeInTheDocument()
    // Ligne du tableau blocs, résolue par jointure Rotation -> Bloc -> Cible.
    expect(within(fiche).getByText(/Bloc 1/)).toBeInTheDocument()
    expect(within(fiche).getByText('Betioky-Sud')).toBeInTheDocument()
    expect(within(fiche).getByText('12.5 ha')).toBeInTheDocument()
    // Le vol de prospection (sans bloc rattaché) n'a pas de ligne dans ce tableau.
    expect(within(fiche).queryByText('Survol de contrôle')).not.toBeInTheDocument()
    // Indicateur essaims global, pas une colonne par bloc.
    expect(within(fiche).getByText(/Quelques vols clairs observés/)).toBeInTheDocument()
  })
})
