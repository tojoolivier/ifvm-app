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

  it('affiche le nombre d’utilisateurs et de stations dans la nav (compteur, comme ReferentielsPage)', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(nav().getByText('Utilisateurs')).toBeInTheDocument())

    const utilisateursItem = nav().getByText('Utilisateurs').closest('button')!
    const stationsItem = nav().getByText('Stations').closest('button')!
    await waitFor(() => expect(within(utilisateursItem).getByText('2')).toBeInTheDocument())
    await waitFor(() => expect(within(stationsItem).getByText('1')).toBeInTheDocument())
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
})
