import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Equipe } from '@/lib/equipes'
import { BasesAeriennesSection } from './BasesAeriennesSection'

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}))

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>
const mockedPost = api.post as unknown as ReturnType<typeof vi.fn>
const mockedPut = api.put as unknown as ReturnType<typeof vi.fn>

const EQUIPE_IHOSY = {
  id: 'equipe-1',
  nom: 'Équipe Ihosy',
  type: 'aerien',
  aeronef: null,
  membres: [{ user_id: 'chef-1', fonction: 'chef', nom: 'Rabe', prenom: 'Toky' }],
  actif: true,
} as unknown as Equipe
const EQUIPE_LIBRE = {
  id: 'equipe-2',
  nom: 'Équipe Toliara',
  type: 'aerien',
  aeronef: null,
  membres: [{ user_id: 'chef-2', fonction: 'chef', nom: 'Rasoa', prenom: 'Lala' }],
  actif: true,
} as unknown as Equipe
// Une équipe terrestre ne porte jamais de base aérienne : jamais proposée dans les sélecteurs.
const EQUIPE_TERRESTRE = {
  id: 'equipe-t',
  nom: 'Équipe Terrestre Betroka',
  type: 'terrestre',
  aeronef: null,
  membres: [{ user_id: 'chef-3', fonction: 'chef', nom: 'Rakoto', prenom: 'Zo' }],
  actif: true,
} as unknown as Equipe

const BASE_IHOSY = {
  id: 'base-1',
  parent_site_id: null,
  equipe_id: 'equipe-1',
  numero: 'IHO01',
  localite: 'Ihosy',
  actif: true,
}

function mockApi({ bases = [BASE_IHOSY] }: { bases?: (typeof BASE_IHOSY)[] } = {}) {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/sites-aeriens') return Promise.resolve({ data: bases })
    return Promise.resolve({ data: [] })
  })
}

function renderSection(equipes: Equipe[] = [EQUIPE_IHOSY, EQUIPE_LIBRE]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <BasesAeriennesSection equipes={equipes} />
    </QueryClientProvider>,
  )
}

describe('BasesAeriennesSection — assigner un chef de base à une base aérienne', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('liste les bases principales avec leur équipe et chef de base', async () => {
    mockApi()
    renderSection()

    await screen.findByText('IHO01')
    const ligne = screen.getByText('IHO01').closest('tr')!
    expect(within(ligne).getByLabelText('Équipe assignée à la base IHO01')).toHaveValue('equipe-1')
    expect(within(ligne).getByText('Équipe Ihosy — Toky Rabe')).toBeInTheDocument()
  })

  it('crée une base aérienne principale rattachée à une équipe encore libre', async () => {
    mockApi()
    mockedPost.mockResolvedValue({
      data: { id: 'base-2', parent_site_id: null, equipe_id: 'equipe-2', numero: 'TLR01', localite: 'Toliara', actif: true },
    })
    renderSection()

    await screen.findByText('IHO01')
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

  it('ne propose que des équipes aériennes actives et encore sans base principale', async () => {
    mockApi()
    renderSection([EQUIPE_IHOSY, EQUIPE_LIBRE, EQUIPE_TERRESTRE, { ...EQUIPE_LIBRE, id: 'equipe-off', nom: 'Équipe éteinte', actif: false }])

    await screen.findByText('IHO01')
    fireEvent.click(screen.getByText('+ Nouvelle base'))

    const select = screen.getByLabelText('Équipe (chef de base) *')
    // Ihosy porte déjà IHO01, la terrestre n'est pas aérienne, l'éteinte est inactive : reste Toliara.
    expect(within(select).getByText('Équipe Toliara — Lala Rasoa')).toBeInTheDocument()
    expect(within(select).queryByText(/Équipe Ihosy/)).not.toBeInTheDocument()
    expect(within(select).queryByText(/Terrestre Betroka/)).not.toBeInTheDocument()
    expect(within(select).queryByText(/éteinte/)).not.toBeInTheDocument()
  })

  it('désactive « + Nouvelle base » quand aucune équipe aérienne n’est encore libre', async () => {
    mockApi()
    renderSection([EQUIPE_IHOSY])

    await screen.findByText('IHO01')
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

    await screen.findByText('IHO01')
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

  it('affiche une bannière d’erreur si les bases aériennes ne peuvent pas être chargées', async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === '/sites-aeriens') {
        const err = new Error('500') as Error & { response: { status: number; data: { detail: string } } }
        err.response = { status: 500, data: { detail: 'panne serveur' } }
        return Promise.reject(err)
      }
      return Promise.resolve({ data: [] })
    })
    renderSection()

    await waitFor(() => expect(screen.getByText('panne serveur')).toBeInTheDocument())
  })
})
