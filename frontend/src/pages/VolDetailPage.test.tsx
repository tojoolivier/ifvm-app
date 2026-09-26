import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { api } from '../api/client'
import { VolDetailPage } from './VolDetailPage'

vi.mock('../api/client', () => ({
  api: { get: vi.fn() },
}))

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>

const EQUIPE = {
  id: 'e1',
  nom: 'Équipe Ihosy',
  type: 'aerien',
  actif: true,
  membres: [{ user_id: 'cb-1', fonction: 'chef', nom: 'Rakoto', prenom: 'Zo' }],
}
const AERONEF = { id: 'a1', immatriculation: '5R-MJA', societe: 'Heli Madagascar', volume_cuve_l: 800, actif: true }
const SITES = [
  { id: 's1', numero: 'IHO01', localite: 'Ihosy', parent_site_id: null, equipe_id: 'e1', actif: true },
  { id: 's2', numero: 'IHO02', localite: 'Ihosy Sud', parent_site_id: 's1', equipe_id: null, actif: true },
]

function vol(surcharges: Record<string, unknown> = {}) {
  return {
    id: 'v1',
    type: 'application',
    equipe_id: 'e1',
    aeronef_id: 'a1',
    site_principal_id: 's1',
    stand_id: 's2',
    base_secondaire_id: null,
    traitement_id: null,
    date_vol: '2026-08-12',
    heure_debut: '08:00:00',
    heure_fin: '09:30:00',
    motif: null,
    lieu_depart: null,
    lieu_arrivee: null,
    observations: null,
    ...surcharges,
  }
}

function erreurHttp(status: number, detail: string) {
  const err = new Error(String(status)) as Error & { response: { status: number; data: { detail: string } } }
  err.response = { status, data: { detail } }
  return err
}

function renderDetail(
  volCharge: Record<string, unknown> | 'introuvable',
  { prospections = [] as unknown[], traitement = { id: 't1', numero_fiche: 'TRT-AER-2026-08-12-001' } as unknown } = {},
  { erreurProspections = false, erreurTraitement = false } = {},
) {
  mockedGet.mockImplementation((url: string, config?: { params?: Record<string, string> }) => {
    if (url === '/vols/v1') {
      return volCharge === 'introuvable'
        ? Promise.reject(erreurHttp(404, 'Vol non trouvé'))
        : Promise.resolve({ data: volCharge })
    }
    if (url === '/users/me') return Promise.resolve({ data: { id: 'u1', nom: 'Test', role: 'admin' } })
    if (url === '/equipes/e1') return Promise.resolve({ data: EQUIPE })
    if (url === '/aeronefs/a1') return Promise.resolve({ data: AERONEF })
    if (url === '/sites-aeriens') return Promise.resolve({ data: SITES })
    if (url === '/traitements/t1') {
      return erreurTraitement ? Promise.reject(erreurHttp(404, 'introuvable')) : Promise.resolve({ data: traitement })
    }
    if (url === '/prospections') {
      if (erreurProspections) return Promise.reject(erreurHttp(500, 'panne'))
      return Promise.resolve({ data: config?.params?.vol_id === 'v1' ? prospections : [] })
    }
    return Promise.resolve({ data: [] })
  })

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/vols/v1']}>
        <Routes>
          <Route path="/vols/:id" element={<VolDetailPage />} />
          <Route path="/vols" element={<p>Liste des vols</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('VolDetailPage — détail d’un vol (#608, #610)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('affiche l’en-tête (date, catégorie, horaires, durée) et les champs communs', async () => {
    renderDetail(vol())

    await screen.findByText('Vol du 12/08/2026')
    expect(screen.getByTestId('vol-header')).toHaveTextContent('Application · 08:00 – 09:30 · 1 h 30')
    expect(await screen.findByText('5R-MJA')).toBeInTheDocument()
    expect(screen.getByText(/Heli Madagascar/)).toBeInTheDocument()
    // L'équipe du vol, avec son chef.
    await waitFor(() => expect(screen.getByTestId('fiche-equipe')).toHaveTextContent('Équipe Ihosy'))
    expect(screen.getByTestId('fiche-equipe')).toHaveTextContent('chef Zo Rakoto')
  })

  it('affiche les observations quand il y en a', async () => {
    renderDetail(vol({ observations: 'Vent de travers en fin de vol' }))

    expect(await screen.findByText('Vent de travers en fin de vol')).toBeInTheDocument()
  })

  it('le lien de retour ramène à la liste des vols', async () => {
    renderDetail(vol())

    const retour = await screen.findByRole('link', { name: '← Tous les vols' })
    expect(retour).toHaveAttribute('href', '/vols')
  })

  describe('champs par catégorie', () => {
    it('application : site principal et stand de remplissage', async () => {
      renderDetail(vol())

      await screen.findByText('Détails · application')
      expect(await screen.findByText('IHO01 — Ihosy')).toBeInTheDocument()
      expect(screen.getByText('IHO02 — Ihosy Sud')).toBeInTheDocument()
    })

    it('convoyage : motif et lieux, sans site', async () => {
      renderDetail(vol({ type: 'convoyage', site_principal_id: null, stand_id: null, motif: 'Rapatriement', lieu_depart: 'Ihosy', lieu_arrivee: 'Toliara' }))

      await screen.findByText('Détails · convoyage')
      expect(screen.getByText('Rapatriement')).toBeInTheDocument()
      expect(screen.getByText('Ihosy')).toBeInTheDocument()
      expect(screen.getByText('Toliara')).toBeInTheDocument()
      expect(screen.queryByText('Site principal')).not.toBeInTheDocument()
    })

    it('divers : le motif', async () => {
      renderDetail(vol({ type: 'divers', site_principal_id: null, stand_id: null, motif: 'Essai après maintenance' }))

      await screen.findByText('Détails · divers')
      expect(screen.getByText('Essai après maintenance')).toBeInTheDocument()
    })
  })

  describe('traitement lié (vol d’application)', () => {
    it('après rattachement : lien vers la fiche de traitement, avec son numéro', async () => {
      renderDetail(vol({ traitement_id: 't1' }))

      const lien = await screen.findByRole('link', { name: 'TRT-AER-2026-08-12-001' })
      expect(lien).toHaveAttribute('href', '/traitements/t1')
      expect(screen.getByText('Traitement lié')).toBeInTheDocument()
    })

    it('tant que le traitement n’est pas chargé, le lien porte l’identifiant', async () => {
      renderDetail(vol({ traitement_id: 't1' }), {}, { erreurTraitement: true })

      const lien = await screen.findByRole('link', { name: /introuvable|t1/ })
      expect(lien).toHaveAttribute('href', '/traitements/t1')
    })

    it('sans rattachement : le dit clairement, sans lien', async () => {
      renderDetail(vol({ traitement_id: null }))

      expect(await screen.findByText(/Aucun traitement aérien n'est encore rattaché à ce vol/)).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /TRT-/ })).not.toBeInTheDocument()
    })

    it('un vol qui n’est pas d’application n’a pas de section traitement', async () => {
      renderDetail(vol({ type: 'convoyage', motif: 'x', lieu_depart: 'a', lieu_arrivee: 'b' }))

      await screen.findByText('Détails · convoyage')
      expect(screen.queryByText('Traitement lié')).not.toBeInTheDocument()
    })
  })

  describe('prospections liées (vol de prospection)', () => {
    const vueProspection = { type: 'prospection', site_principal_id: null, stand_id: null }

    it('liste les fiches reliées au vol, avec un lien vers chacune', async () => {
      renderDetail(vol(vueProspection), {
        prospections: [
          { id: 'p1', n_fiche: 'F-001', n_message: null, date_prospection: '2026-08-12', statut: 'validee' },
          { id: 'p2', n_fiche: null, n_message: 'MSG-2026-0042', date_prospection: '2026-08-12', statut: 'en_attente' },
        ],
      })

      const liste = await screen.findByRole('list', { name: 'Prospections liées au vol' })
      const liens = within(liste).getAllByRole('link')
      expect(liens).toHaveLength(2)
      expect(liens[0]).toHaveAttribute('href', '/prospections/p1')
      expect(liens[0]).toHaveTextContent('F-001')
      // Sans n° de fiche, le n° de message sert de repère.
      expect(liens[1]).toHaveAttribute('href', '/prospections/p2')
      expect(liens[1]).toHaveTextContent('MSG-2026-0042')
    })

    it('interroge les prospections par vol_id', async () => {
      renderDetail(vol(vueProspection))

      await screen.findByText('Prospections liées')
      await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/prospections', { params: { vol_id: 'v1' } }))
    })

    it('sans fiche reliée : le dit clairement', async () => {
      renderDetail(vol(vueProspection), { prospections: [] })

      expect(await screen.findByText(/Aucune fiche de prospection n'est encore rattachée à ce vol/)).toBeInTheDocument()
    })

    it('erreur de chargement des prospections : bannière', async () => {
      renderDetail(vol(vueProspection), {}, { erreurProspections: true })

      expect(await screen.findByText('Impossible de charger les prospections de ce vol.')).toBeInTheDocument()
    })

    it('un vol qui n’est pas de prospection n’a pas de section prospections', async () => {
      renderDetail(vol())

      await screen.findByText('Vol du 12/08/2026')
      expect(screen.queryByText('Prospections liées')).not.toBeInTheDocument()
      expect(mockedGet).not.toHaveBeenCalledWith('/prospections', expect.anything())
    })
  })

  it('vol introuvable : message et retour à la liste', async () => {
    renderDetail('introuvable')

    expect(await screen.findByText('Vol non trouvé')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '← Tous les vols' })).toBeInTheDocument()
  })
})
