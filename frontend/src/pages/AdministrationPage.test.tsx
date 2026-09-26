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
    if (url === '/equipes') {
      return Promise.resolve({
        data: [
          { id: 'ea1', nom: 'Équipe Ihosy', type: 'aerien', membres: [], actif: true },
          { id: 'et1', nom: 'Équipe Terrestre Betroka', type: 'terrestre', membres: [], actif: true },
        ],
      })
    }
    return Promise.resolve({ data: [] })
  })
}

function nav() {
  return within(screen.getByRole('navigation', { name: 'Administration' }))
}

function renderPage(url = '/administration') {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[url]}>
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

  it('affiche les 3 sections (Utilisateurs, Stations, Équipes) avec un compteur chacune', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(nav().getByText('3 sections')).toBeInTheDocument())

    for (const [label, table] of [
      ['Utilisateurs', 'utilisateur'],
      ['Stations', 'station_fixe'],
      ['Équipes', 'equipe'],
    ]) {
      expect(nav().getByText(label)).toBeInTheDocument()
      expect(nav().getByText(table)).toBeInTheDocument()
    }

    const utilisateursItem = nav().getByText('Utilisateurs').closest('button')!
    const stationsItem = nav().getByText('Stations').closest('button')!
    const equipesItem = nav().getByText('Équipes').closest('button')!
    await waitFor(() => expect(within(utilisateursItem).getByText('2')).toBeInTheDocument())
    await waitFor(() => expect(within(stationsItem).getByText('1')).toBeInTheDocument())
    // Équipes terrestres ET aériennes dans un seul compteur.
    await waitFor(() => expect(within(equipesItem).getByText('2')).toBeInTheDocument())
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

  it('bascule sur Équipes : une seule section, avec les deux types et un filtre', async () => {
    mockApi()
    renderPage()

    fireEvent.click(await nav().findByText('Équipes'))

    await screen.findByText('Équipe Ihosy')
    expect(screen.getByText('Équipe Terrestre Betroka')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Nouvelle équipe' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Terrestres' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aériennes' })).toBeInTheDocument()
  })

  it('n’a plus d’entrées séparées « Équipes aériennes » et « Équipes terrestres »', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(nav().getByText('3 sections')).toBeInTheDocument())
    expect(nav().queryByText('Équipes aériennes')).not.toBeInTheDocument()
    expect(nav().queryByText('Équipes terrestres')).not.toBeInTheDocument()
  })

  // Lien depuis une fiche de prospection ou de traitement (#602, #607).
  it('un lien ?section=equipes&equipe=<id> ouvre directement la section Équipes, sur l’équipe visée', async () => {
    mockApi()
    renderPage('/administration?section=equipes&equipe=ea1')

    await screen.findByText('Équipe Ihosy')
    // Section Équipes active, filtrée sur le type de l'équipe (aérienne), équipe en évidence.
    expect(nav().getByText('Équipes').closest('button')).toHaveAttribute('aria-current', 'true')
    await waitFor(() => expect(screen.queryByText('Équipe Terrestre Betroka')).not.toBeInTheDocument())
    expect(screen.getByText('Équipe Ihosy').closest('tr')).toHaveClass('ring-2')
  })
})
