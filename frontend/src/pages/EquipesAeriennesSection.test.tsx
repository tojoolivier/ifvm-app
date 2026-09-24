import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { api } from '../api/client'
import { EquipesAeriennesSection } from './EquipesAeriennesSection'

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}))

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>
const mockedPost = api.post as unknown as ReturnType<typeof vi.fn>
const mockedPut = api.put as unknown as ReturnType<typeof vi.fn>

type Membre = { user_id: string; fonction: string; nom: string | null; prenom: string | null }

const CHEF_TOKY = { id: 'chef-1', nom: 'Rabe', prenom: 'Toky' }
const CHEF_LALA = { id: 'chef-2', nom: 'Rasoa', prenom: 'Lala' }

const EQUIPE_IHOSY = {
  id: 'equipe-1',
  nom: 'Équipe Ihosy',
  type: 'aerien',
  aeronef: {
    id: 'aeronef-1',
    immatriculation: '5R-MJA',
    societe: 'Heli Madagascar',
    volume_cuve_l: 800,
  } as { id: string; immatriculation: string; societe: string; volume_cuve_l: number } | null,
  // Référentiel unifié (ADR-018) : chef, pilote, mécanicien et consultant sont des
  // membres porteurs de leur `fonction`, plus des colonnes de l'équipe.
  membres: [
    { user_id: 'chef-1', fonction: 'chef', nom: 'Rabe', prenom: 'Toky' },
    { user_id: 'u-p1', fonction: 'pilote', nom: 'Rakoto', prenom: 'Jean' },
    { user_id: 'u-m1', fonction: 'mecanicien', nom: 'Andria', prenom: 'Paul' },
  ] as Membre[],
  actif: true,
}
const EQUIPE_LIBRE = {
  id: 'equipe-2',
  nom: 'Équipe Toliara',
  type: 'aerien',
  aeronef: null,
  membres: [
    { user_id: 'chef-2', fonction: 'chef', nom: 'Rasoa', prenom: 'Lala' },
    { user_id: 'u-p2', fonction: 'pilote', nom: 'Randria', prenom: 'Marc' },
    { user_id: 'u-m2', fonction: 'mecanicien', nom: 'Hasan', prenom: 'Ali' },
    { user_id: 'u-c2', fonction: 'consultant_international', nom: 'Smith', prenom: 'John' },
    { user_id: 'u-x2', fonction: 'membre', nom: 'Voahangy', prenom: '' },
  ] as Membre[],
  actif: true,
}

const BASE_IHOSY = {
  id: 'base-1',
  parent_site_id: null,
  equipe_id: 'equipe-1',
  numero: 'IHO01',
  localite: 'Ihosy',
  actif: true,
}

function mockApi({
  chefs = [CHEF_TOKY, CHEF_LALA],
  equipes = [EQUIPE_IHOSY, EQUIPE_LIBRE],
  bases = [BASE_IHOSY],
}: {
  chefs?: typeof CHEF_TOKY[]
  equipes?: typeof EQUIPE_IHOSY[]
  bases?: typeof BASE_IHOSY[]
} = {}) {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/users/chefs-de-base') return Promise.resolve({ data: chefs })
    if (url === '/equipes?type=aerien') return Promise.resolve({ data: equipes })
    if (url === '/sites-aeriens') return Promise.resolve({ data: bases })
    return Promise.resolve({ data: [] })
  })
}

function saisirHelicoptere() {
  fireEvent.change(screen.getByLabelText('Immatriculation *'), { target: { value: '5R-MJA' } })
  fireEvent.change(screen.getByLabelText('Société *'), { target: { value: 'Heli Madagascar' } })
  fireEvent.change(screen.getByLabelText('Volume de cuve (L) *'), { target: { value: '800' } })
}

function renderSection() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <EquipesAeriennesSection />
    </QueryClientProvider>,
  )
}

describe('EquipesAeriennesSection — assigner un chef de base à une base aérienne', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('liste les équipes avec chef de base, pilote, mécanicien, consultant et membres', async () => {
    mockApi()
    renderSection()

    await screen.findByText('Équipe Ihosy')
    expect(screen.getByText('Toky Rabe')).toBeInTheDocument()
    expect(screen.getByText('Jean Rakoto')).toBeInTheDocument()
    expect(screen.getByText('Paul Andria')).toBeInTheDocument()
    expect(screen.getByText('John Smith')).toBeInTheDocument()
    expect(screen.getByText('Voahangy')).toBeInTheDocument()
    // Hélicoptère de l'équipe : immatriculation, société et volume de cuve.
    expect(screen.getByText('5R-MJA')).toBeInTheDocument()
    expect(screen.getByText(/Heli Madagascar \(cuve 800 L\)/)).toBeInTheDocument()
    // Équipe Ihosy ne porte pas de consultant : affiché en repli, pas vide.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('crée une équipe aérienne avec chef de base, pilote et mécanicien requis', async () => {
    // Chef-2 (Lala Rasoa) libre : équipe Toliara (qui le dirige) exclue du mock.
    mockApi({ equipes: [EQUIPE_IHOSY] })
    mockedPost.mockResolvedValue({
      data: { id: 'equipe-3', nom: 'Équipe Betroka', chef_de_base_id: 'chef-2', actif: true },
    })
    renderSection()

    await screen.findByText('Équipe Ihosy')
    fireEvent.click(screen.getByText('+ Nouvelle équipe'))

    fireEvent.change(screen.getByLabelText('Nom *'), { target: { value: 'Équipe Betroka' } })
    fireEvent.change(screen.getByLabelText('Chef de base *'), { target: { value: 'chef-2' } })
    fireEvent.change(screen.getByLabelText('Pilote *'), { target: { value: 'Jean Rakoto' } })
    fireEvent.change(screen.getByLabelText('Mécanicien *'), { target: { value: 'Paul Andria' } })
    saisirHelicoptere()
    fireEvent.click(screen.getByRole('button', { name: 'Créer' }))

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith('/equipes', {
        nom: 'Équipe Betroka',
        type: 'aerien',
        aeronef: { immatriculation: '5R-MJA', societe: 'Heli Madagascar', volume_cuve_l: 800 },
        membres: [
          { user_id: 'chef-2', fonction: 'chef' },
          { nom: 'Jean Rakoto', fonction: 'pilote' },
          { nom: 'Paul Andria', fonction: 'mecanicien' },
        ],
      }),
    )
  })

  it('ne propose, pour le chef de base, que les chefs sans équipe déjà assignée', async () => {
    mockApi()
    renderSection()

    await screen.findByText('Équipe Ihosy')
    fireEvent.click(screen.getByText('+ Nouvelle équipe'))

    const select = screen.getByLabelText('Chef de base *')
    // Toky Rabe (chef-1) dirige déjà Équipe Ihosy, Lala Rasoa (chef-2) dirige
    // déjà Équipe Toliara — aucun chef libre.
    expect(within(select).queryByText('Toky Rabe')).not.toBeInTheDocument()
    expect(within(select).queryByText('Lala Rasoa')).not.toBeInTheDocument()
  })

  it('ajoute et retire des membres avant de créer une équipe', async () => {
    // Chef-2 (Lala Rasoa) libre : équipe Toliara (qui le dirige) exclue du mock.
    mockApi({ equipes: [EQUIPE_IHOSY] })
    mockedPost.mockResolvedValue({ data: {} })
    renderSection()

    await screen.findByText('Équipe Ihosy')
    fireEvent.click(screen.getByText('+ Nouvelle équipe'))

    const champMembre = screen.getByLabelText('Autres membres (facultatif)')
    fireEvent.change(champMembre, { target: { value: 'Rasoa Voahangy' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }))
    fireEvent.change(champMembre, { target: { value: 'Tovo Randria' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }))

    expect(screen.getByText('Rasoa Voahangy')).toBeInTheDocument()
    expect(screen.getByText('Tovo Randria')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retirer Rasoa Voahangy' }))
    expect(screen.queryByText('Rasoa Voahangy')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Nom *'), { target: { value: 'Équipe Betroka' } })
    fireEvent.change(screen.getByLabelText('Chef de base *'), { target: { value: 'chef-2' } })
    fireEvent.change(screen.getByLabelText('Pilote *'), { target: { value: 'X' } })
    fireEvent.change(screen.getByLabelText('Mécanicien *'), { target: { value: 'Y' } })
    saisirHelicoptere()
    fireEvent.click(screen.getByRole('button', { name: 'Créer' }))

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith(
        '/equipes',
        expect.objectContaining({
          membres: [
            { user_id: 'chef-2', fonction: 'chef' },
            { nom: 'X', fonction: 'pilote' },
            { nom: 'Y', fonction: 'mecanicien' },
            { nom: 'Tovo Randria', fonction: 'membre' },
          ],
        }),
      ),
    )
  })

  it('crée une base aérienne principale rattachée à une équipe encore libre', async () => {
    mockApi()
    mockedPost.mockResolvedValue({
      data: { id: 'base-2', parent_site_id: null, equipe_id: 'equipe-2', numero: 'TLR01', localite: 'Toliara', actif: true },
    })
    renderSection()

    await screen.findByText('Équipe Ihosy')
    fireEvent.click(screen.getByText('+ Nouvelle base'))

    fireEvent.change(screen.getByLabelText('Numéro *'), { target: { value: 'TLR01' } })
    fireEvent.change(screen.getByLabelText('Localité *'), { target: { value: 'Toliara' } })
    fireEvent.change(screen.getByLabelText('Équipe (chef de base) *'), { target: { value: 'equipe-2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer' }))

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith('/sites-aeriens', {
        numero: 'TLR01',
        localite: 'Toliara',
        equipe_id: 'equipe-2',
      }),
    )
  })

  it('désactive « + Nouvelle base » quand aucune équipe n’est encore libre', async () => {
    mockApi({ equipes: [EQUIPE_IHOSY] })
    renderSection()

    await screen.findByText('Équipe Ihosy')
    expect(screen.getByText('+ Nouvelle base')).toBeDisabled()
  })

  it('réaffecte le chef de base d’une base en changeant son équipe', async () => {
    mockApi()
    mockedPut.mockResolvedValue({ data: { ...BASE_IHOSY, equipe_id: 'equipe-2' } })
    renderSection()

    await screen.findByText('Ihosy')
    const ligne = screen.getByText('Ihosy').closest('tr')!
    const select = within(ligne).getByLabelText('Équipe assignée à la base IHO01')
    fireEvent.change(select, { target: { value: 'equipe-2' } })

    await waitFor(() =>
      expect(mockedPut).toHaveBeenCalledWith('/sites-aeriens/base-1', { equipe_id: 'equipe-2' }),
    )
  })

  it('crée une base aérienne secondaire rattachée à une base principale', async () => {
    mockApi()
    mockedPost.mockResolvedValue({
      data: { id: 'base-3', parent_site_id: 'base-1', equipe_id: null, numero: 'IHO02', localite: 'Ihosy Sud', actif: true },
    })
    renderSection()

    await screen.findByText('Équipe Ihosy')
    fireEvent.click(screen.getByText('+ Nouvelle base secondaire'))

    fireEvent.change(screen.getByLabelText('Numéro *'), { target: { value: 'IHO02' } })
    fireEvent.change(screen.getByLabelText('Localité *'), { target: { value: 'Ihosy Sud' } })
    fireEvent.change(screen.getByLabelText('Base principale *'), { target: { value: 'base-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer' }))

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith('/sites-aeriens', {
        numero: 'IHO02',
        localite: 'Ihosy Sud',
        parent_site_id: 'base-1',
      }),
    )
  })
  it('affiche une bannière d’erreur si les équipes aériennes ne peuvent pas être chargées', async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === '/equipes?type=aerien') {
        const err = new Error('500') as Error & { response: { status: number; data: { detail: string } } }
        err.response = { status: 500, data: { detail: 'panne serveur' } }
        return Promise.reject(err)
      }
      if (url === '/users/chefs-de-base') return Promise.resolve({ data: [CHEF_TOKY] })
      if (url === '/sites-aeriens') return Promise.resolve({ data: [] })
      return Promise.resolve({ data: [] })
    })
    renderSection()

    await waitFor(() => expect(screen.getByText('panne serveur')).toBeInTheDocument())
  })
})
