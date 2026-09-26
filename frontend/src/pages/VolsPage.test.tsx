import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { api } from '../api/client'
import { VolsPage } from './VolsPage'

vi.mock('../api/client', () => ({
  api: { get: vi.fn() },
}))

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>

const EQUIPES = [
  { id: 'e1', nom: 'Équipe Ihosy', type: 'aerien', actif: true, membres: [] },
  { id: 'e2', nom: 'Équipe Betroka', type: 'aerien', actif: true, membres: [] },
  { id: 'et', nom: 'Équipe Terrestre', type: 'terrestre', actif: true, membres: [] },
]
const AERONEFS = [
  { id: 'a1', immatriculation: '5R-MJA', societe: 'Heli Madagascar', volume_cuve_l: 800, actif: true },
  { id: 'a2', immatriculation: '5R-MJB', societe: 'Heli Madagascar', volume_cuve_l: 950, actif: true },
]
const SITES = [{ id: 's1', numero: 'IHO01', localite: 'Ihosy', parent_site_id: null, equipe_id: 'e1', actif: true }]

function vol(surcharges: Record<string, unknown>) {
  return {
    id: 'v?',
    type: 'application',
    equipe_id: 'e1',
    aeronef_id: 'a1',
    site_principal_id: null,
    stand_id: null,
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

/** Ajoute `duree_minutes` comme le fait le backend (`VolRead`), depuis les heures de la fixture. */
function avecDuree<T extends { heure_debut: unknown; heure_fin: unknown }>(v: T) {
  const minutes = (h: unknown) => {
    const [heures, mn] = String(h).split(':').map(Number)
    return heures * 60 + mn
  }
  return { ...v, duree_minutes: minutes(v.heure_fin) - minutes(v.heure_debut) }
}

// 90 min + 45 min + 60 min + 30 min = 225 min = 3 h 45. Le serveur fournit `duree_minutes` (champ calculé).
const VOLS = [
  vol({ id: 'v1', type: 'application', date_vol: '2026-08-10', site_principal_id: 's1', traitement_id: 't1' }),
  vol({
    id: 'v2',
    type: 'convoyage',
    equipe_id: 'e2',
    date_vol: '2026-08-12',
    heure_debut: '10:00:00',
    heure_fin: '10:45:00',
    motif: 'Rapatriement',
  }),
  vol({
    id: 'v3',
    type: 'application',
    aeronef_id: 'a2',
    date_vol: '2026-08-14',
    heure_debut: '07:00:00',
    heure_fin: '08:00:00',
  }),
  vol({
    id: 'v4',
    type: 'prospection',
    equipe_id: 'e2',
    aeronef_id: 'a2',
    date_vol: '2026-09-01',
    heure_debut: '06:00:00',
    heure_fin: '06:30:00',
  }),
]

function erreurHttp(status: number, detail: string) {
  const err = new Error(String(status)) as Error & { response: { status: number; data: { detail: string } } }
  err.response = { status, data: { detail } }
  return err
}

function mockApi(vols: unknown[] = VOLS) {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/vols') return Promise.resolve({ data: (vols as ReturnType<typeof vol>[]).map(avecDuree) })
    if (url === '/equipes') return Promise.resolve({ data: EQUIPES })
    if (url === '/aeronefs') return Promise.resolve({ data: AERONEFS })
    if (url === '/sites-aeriens') return Promise.resolve({ data: SITES })
    return Promise.resolve({ data: [] })
  })
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <VolsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const total = () => screen.getByTestId('total-heures-vol')

describe('VolsPage — liste des vols (#608, #610)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('liste les vols, du plus récent au plus ancien, avec équipe, aéronef, site, horaires et durée', async () => {
    mockApi()
    renderPage()

    await screen.findByText('01/09/2026')
    const lignes = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(lignes).toHaveLength(4)
    expect(within(lignes[0]).getByText('01/09/2026')).toBeInTheDocument() // v4, le plus récent
    expect(within(lignes[3]).getByText('10/08/2026')).toBeInTheDocument() // v1, le plus ancien

    const v1 = lignes[3]
    expect(within(v1).getByText('Application')).toBeInTheDocument()
    expect(within(v1).getByText('Équipe Ihosy')).toBeInTheDocument()
    expect(within(v1).getByText('5R-MJA')).toBeInTheDocument()
    expect(within(v1).getByText('IHO01 — Ihosy')).toBeInTheDocument()
    expect(within(v1).getByText('08:00 – 09:30')).toBeInTheDocument()
    expect(within(v1).getByText('1 h 30')).toBeInTheDocument()
  })

  it('affiche le nombre de vols et le total des heures de vol', async () => {
    mockApi()
    renderPage()

    await screen.findByText('01/09/2026')
    expect(total()).toHaveTextContent('4 vols')
    expect(total()).toHaveTextContent('3 h 45')
  })

  it('chaque date ouvre le détail du vol, et un vol relié à un traitement en donne le lien', async () => {
    mockApi()
    renderPage()

    await screen.findByText('10/08/2026')
    expect(screen.getByRole('link', { name: '10/08/2026' })).toHaveAttribute('href', '/vols/v1')
    expect(screen.getByRole('link', { name: 'Voir' })).toHaveAttribute('href', '/traitements/t1')
  })

  describe('filtres', () => {
    it('filtre par catégorie et recalcule le total', async () => {
      mockApi()
      renderPage()
      await screen.findByText('01/09/2026')

      fireEvent.change(screen.getByLabelText('Catégorie'), { target: { value: 'application' } })

      expect(screen.queryByText('12/08/2026')).not.toBeInTheDocument()
      expect(screen.getByText('10/08/2026')).toBeInTheDocument()
      expect(screen.getByText('14/08/2026')).toBeInTheDocument()
      expect(total()).toHaveTextContent('2 vols')
      expect(total()).toHaveTextContent('2 h 30') // 1 h 30 + 1 h
    })

    it('filtre par équipe (équipes aériennes seulement)', async () => {
      mockApi()
      renderPage()
      await screen.findByText('01/09/2026')

      const select = screen.getByLabelText('Équipe')
      expect(within(select).queryByText('Équipe Terrestre')).not.toBeInTheDocument()
      fireEvent.change(select, { target: { value: 'e2' } })

      expect(total()).toHaveTextContent('2 vols')
      expect(total()).toHaveTextContent('1 h 15') // 45 min + 30 min
    })

    it('filtre par aéronef', async () => {
      mockApi()
      renderPage()
      await screen.findByText('01/09/2026')

      fireEvent.change(screen.getByLabelText('Aéronef'), { target: { value: 'a2' } })

      expect(total()).toHaveTextContent('2 vols')
      expect(total()).toHaveTextContent('1 h 30') // 1 h + 30 min
    })

    it('filtre par période, bornes incluses', async () => {
      mockApi()
      renderPage()
      await screen.findByText('01/09/2026')

      fireEvent.change(screen.getByLabelText('Du'), { target: { value: '2026-08-12' } })
      fireEvent.change(screen.getByLabelText('Au'), { target: { value: '2026-08-14' } })

      expect(screen.getByText('12/08/2026')).toBeInTheDocument()
      expect(screen.getByText('14/08/2026')).toBeInTheDocument()
      expect(screen.queryByText('10/08/2026')).not.toBeInTheDocument()
      expect(screen.queryByText('01/09/2026')).not.toBeInTheDocument()
      expect(total()).toHaveTextContent('2 vols')
      expect(total()).toHaveTextContent('1 h 45') // 45 min + 1 h
    })

    it('combine plusieurs filtres', async () => {
      mockApi()
      renderPage()
      await screen.findByText('01/09/2026')

      fireEvent.change(screen.getByLabelText('Catégorie'), { target: { value: 'application' } })
      fireEvent.change(screen.getByLabelText('Aéronef'), { target: { value: 'a2' } })

      expect(total()).toHaveTextContent('1 vol')
      expect(total()).not.toHaveTextContent('1 vols')
      expect(total()).toHaveTextContent('1 h')
    })

    it('« Réinitialiser » n’apparaît qu’avec un filtre actif et remet toute la liste', async () => {
      mockApi()
      renderPage()
      await screen.findByText('01/09/2026')
      expect(screen.queryByRole('button', { name: 'Réinitialiser' })).not.toBeInTheDocument()

      fireEvent.change(screen.getByLabelText('Catégorie'), { target: { value: 'convoyage' } })
      expect(total()).toHaveTextContent('1 vol')
      fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser' }))

      expect(total()).toHaveTextContent('4 vols')
      expect(screen.getByLabelText('Catégorie')).toHaveValue('')
      expect(screen.queryByRole('button', { name: 'Réinitialiser' })).not.toBeInTheDocument()
    })

    it('aucun vol ne correspond : message dédié et total à zéro', async () => {
      mockApi()
      renderPage()
      await screen.findByText('01/09/2026')

      fireEvent.change(screen.getByLabelText('Du'), { target: { value: '2027-01-01' } })

      expect(screen.getByText('Aucun vol ne correspond à ces filtres.')).toBeInTheDocument()
      expect(total()).toHaveTextContent('0 vol')
      expect(total()).toHaveTextContent('0 min')
    })
  })

  it('sans aucun vol : message « Aucun vol enregistré. »', async () => {
    mockApi([])
    renderPage()

    expect(await screen.findByText('Aucun vol enregistré.')).toBeInTheDocument()
    expect(total()).toHaveTextContent('0 vol')
  })

  it('affiche une bannière d’erreur quand les vols ne peuvent pas être chargés', async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === '/vols') return Promise.reject(erreurHttp(500, 'panne serveur'))
      return Promise.resolve({ data: [] })
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('panne serveur')).toBeInTheDocument())
    expect(screen.queryByTestId('total-heures-vol')).not.toBeInTheDocument()
  })

  it('demande les équipes et aéronefs inactifs aussi : un vol passé peut les référencer', async () => {
    mockApi()
    renderPage()

    await screen.findByText('01/09/2026')
    expect(mockedGet).toHaveBeenCalledWith('/equipes', { params: { inclure_inactifs: true } })
    expect(mockedGet).toHaveBeenCalledWith('/aeronefs', { params: { inclure_inactifs: true } })
    expect(mockedGet).toHaveBeenCalledWith('/sites-aeriens', { params: { inclure_inactifs: true } })
  })
})
