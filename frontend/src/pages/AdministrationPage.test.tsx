import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { api } from '../api/client'
import { AdministrationPage } from './AdministrationPage'

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn() },
}))

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>

function mockApi() {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/users/') return Promise.resolve({ data: [{ id: 'u1' }, { id: 'u2' }] })
    if (url === '/stations') {
      return Promise.resolve({
        data: [{ id: 's1', code: 'ST-014', nom: 'Beroroha', actif: true, latitude: null, longitude: null }],
      })
    }
    if (url === '/equipes?type=aerien') {
      return Promise.resolve({ data: [{ id: 'ea1', nom: 'Équipe Ihosy', chef_de_base_id: 'u1', actif: true }] })
    }
    if (url === '/equipes?type=terrestre') return Promise.resolve({ data: [] })
    return Promise.resolve({ data: [] })
  })
}

function nav() {
  return within(screen.getByRole('navigation', { name: 'Administration' }))
}

function renderPage() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/administration']}>
        <AdministrationPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AdministrationPage — même présentation que ReferentielsPage (nav + sections)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('affiche par défaut la section Utilisateurs, puis bascule sur Stations via la nav', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(nav().getByText('station_fixe')).toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Utilisateurs' })).toBeInTheDocument()

    fireEvent.click(nav().getByText('Stations'))

    await waitFor(() => expect(screen.getByText('Beroroha')).toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Stations' })).toBeInTheDocument()
  })

  it('affiche les 4 sections (Utilisateurs, Stations, Équipes aériennes, Équipes terrestres) avec un compteur chacune', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(nav().getByText('4 sections')).toBeInTheDocument())

    for (const [label, table] of [
      ['Utilisateurs', 'utilisateur'],
      ['Stations', 'station_fixe'],
      ['Équipes aériennes', 'equipe (aerien)'],
      ['Équipes terrestres', 'equipe (terrestre)'],
    ]) {
      expect(nav().getByText(label)).toBeInTheDocument()
      expect(nav().getByText(table)).toBeInTheDocument()
    }

    const utilisateursItem = nav().getByText('Utilisateurs').closest('button')!
    const stationsItem = nav().getByText('Stations').closest('button')!
    const equipesAeriennesItem = nav().getByText('Équipes aériennes').closest('button')!
    const equipesTerrestresItem = nav().getByText('Équipes terrestres').closest('button')!
    await waitFor(() => expect(within(utilisateursItem).getByText('2')).toBeInTheDocument())
    await waitFor(() => expect(within(stationsItem).getByText('1')).toBeInTheDocument())
    await waitFor(() => expect(within(equipesAeriennesItem).getByText('1')).toBeInTheDocument())
    await waitFor(() => expect(within(equipesTerrestresItem).getByText('0')).toBeInTheDocument())
  })

  it('le bouton "+ Nouvel utilisateur" ouvre le formulaire sur la section Utilisateurs', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(screen.getByRole('button', { name: '+ Nouvel utilisateur' })).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: '+ Nouvelle station' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '+ Nouvel utilisateur' }))

    expect(screen.getByRole('heading', { name: 'Nouvel utilisateur' })).toBeInTheDocument()
  })

  it('le bouton "+ Nouvelle station" est disponible sur la section Stations (écriture ouverte depuis #133)', async () => {
    mockApi()
    renderPage()

    fireEvent.click(await nav().findByText('Stations'))

    const button = await screen.findByRole('button', { name: '+ Nouvelle station' })
    expect(button).not.toBeDisabled()
    expect(screen.queryByRole('button', { name: '+ Nouvel utilisateur' })).not.toBeInTheDocument()
  })

  it('bascule sur Équipes aériennes et affiche EquipesAeriennesSection', async () => {
    mockApi()
    renderPage()

    fireEvent.click(await nav().findByText('Équipes aériennes'))

    await screen.findByText('Équipe Ihosy')
    expect(screen.getByRole('button', { name: '+ Nouvelle équipe' })).toBeInTheDocument()
  })

  it('bascule sur Équipes terrestres et affiche EquipesTerrestresSection', async () => {
    mockApi()
    renderPage()

    fireEvent.click(await nav().findByText('Équipes terrestres'))

    await waitFor(() => expect(screen.getByRole('button', { name: '+ Nouvelle équipe' })).toBeInTheDocument())
    expect(screen.getByText('Aucune équipe terrestre.')).toBeInTheDocument()
  })
})
