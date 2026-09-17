import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { api } from '../api/client'
import { EquipesAeriennesPage } from './EquipesAeriennesPage'

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}))

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>
const mockedPost = api.post as unknown as ReturnType<typeof vi.fn>
const mockedPut = api.put as unknown as ReturnType<typeof vi.fn>

const CHEF_TOKY = { id: 'chef-1', nom: 'Rabe', prenom: 'Toky' }
const CHEF_LALA = { id: 'chef-2', nom: 'Rasoa', prenom: 'Lala' }

const EQUIPE_IHOSY = { id: 'equipe-1', nom: 'Équipe Ihosy', chef_de_base_id: 'chef-1', actif: true }
const EQUIPE_LIBRE = { id: 'equipe-2', nom: 'Équipe Toliara', chef_de_base_id: 'chef-2', actif: true }

const BASE_IHOSY = {
  id: 'base-1',
  parent_base_id: null,
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
    if (url === '/equipes-aeriennes') return Promise.resolve({ data: equipes })
    if (url === '/bases-aeriennes') return Promise.resolve({ data: bases })
    return Promise.resolve({ data: [] })
  })
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <EquipesAeriennesPage />
    </QueryClientProvider>,
  )
}

describe('EquipesAeriennesPage — assigner un chef de base à une base aérienne', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('liste les équipes avec leur chef de base et la base qu’elles portent', async () => {
    mockApi()
    renderPage()

    await screen.findByText('Équipe Ihosy')
    expect(screen.getByText('Toky Rabe')).toBeInTheDocument()
    // « IHO01 » apparaît deux fois : colonne « Base principale » de la table
    // Équipes, et colonne « N° » de la table Bases.
    expect(screen.getAllByText('IHO01').length).toBe(2)
    // Équipe Toliara ne porte encore aucune base.
    expect(screen.getByText(/Aucune —/)).toBeInTheDocument()
  })

  it('crée une équipe aérienne avec un chef de base', async () => {
    mockApi()
    mockedPost.mockResolvedValue({
      data: { id: 'equipe-3', nom: 'Équipe Betroka', chef_de_base_id: 'chef-2', actif: true },
    })
    renderPage()

    await screen.findByText('Équipe Ihosy')
    fireEvent.click(screen.getByText('+ Nouvelle équipe'))

    fireEvent.change(screen.getByLabelText('Nom *'), { target: { value: 'Équipe Betroka' } })
    fireEvent.change(screen.getByLabelText('Chef de base *'), { target: { value: 'chef-2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer' }))

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith('/equipes-aeriennes', {
        nom: 'Équipe Betroka',
        chef_de_base_id: 'chef-2',
      }),
    )
  })

  it('crée une base aérienne rattachée à une équipe encore libre', async () => {
    mockApi()
    mockedPost.mockResolvedValue({
      data: { id: 'base-2', parent_base_id: null, equipe_id: 'equipe-2', numero: 'TLR01', localite: 'Toliara', actif: true },
    })
    renderPage()

    await screen.findByText('Équipe Ihosy')
    fireEvent.click(screen.getByText('+ Nouvelle base'))

    fireEvent.change(screen.getByLabelText('Numéro *'), { target: { value: 'TLR01' } })
    fireEvent.change(screen.getByLabelText('Localité *'), { target: { value: 'Toliara' } })
    fireEvent.change(screen.getByLabelText('Équipe (chef de base) *'), { target: { value: 'equipe-2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer' }))

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith('/bases-aeriennes', {
        numero: 'TLR01',
        localite: 'Toliara',
        equipe_id: 'equipe-2',
      }),
    )
  })

  it('désactive « + Nouvelle base » quand aucune équipe n’est encore libre', async () => {
    mockApi({ equipes: [EQUIPE_IHOSY] })
    renderPage()

    await screen.findByText('Équipe Ihosy')
    expect(screen.getByText('+ Nouvelle base')).toBeDisabled()
  })

  it('réaffecte le chef de base d’une base en changeant son équipe', async () => {
    mockApi()
    mockedPut.mockResolvedValue({ data: { ...BASE_IHOSY, equipe_id: 'equipe-2' } })
    renderPage()

    await screen.findByText('Ihosy')
    const ligne = screen.getByText('Ihosy').closest('tr')!
    const select = within(ligne).getByLabelText('Équipe assignée à la base IHO01')
    fireEvent.change(select, { target: { value: 'equipe-2' } })

    await waitFor(() =>
      expect(mockedPut).toHaveBeenCalledWith('/bases-aeriennes/base-1', { equipe_id: 'equipe-2' }),
    )
  })

  it('affiche une bannière d’erreur si les équipes aériennes ne peuvent pas être chargées', async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === '/equipes-aeriennes') {
        const err = new Error('500') as Error & { response: { status: number; data: { detail: string } } }
        err.response = { status: 500, data: { detail: 'panne serveur' } }
        return Promise.reject(err)
      }
      if (url === '/users/chefs-de-base') return Promise.resolve({ data: [CHEF_TOKY] })
      if (url === '/bases-aeriennes') return Promise.resolve({ data: [] })
      return Promise.resolve({ data: [] })
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('panne serveur')).toBeInTheDocument())
  })
})
