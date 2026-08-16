import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { api } from '../api/client'
import { AdministrationPage } from './AdministrationPage'

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
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

describe('AdministrationPage — écran à deux onglets (README §10)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('affiche par défaut la liste des utilisateurs, puis bascule sur les stations', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(screen.getByRole('tab', { name: 'Stations · 1' })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('tab', { name: 'Stations · 1' }))

    await waitFor(() => expect(screen.getByText('Beroroha')).toBeInTheDocument())
  })

  it('affiche le nombre d\'utilisateurs et de stations sur les onglets (maquette : chip "Label · N")', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(screen.getByRole('tab', { name: 'Utilisateurs · 2' })).toBeInTheDocument())
    expect(screen.getByRole('tab', { name: 'Stations · 1' })).toBeInTheDocument()
  })

  it('affiche un bouton "+ Nouvel utilisateur" contextuel sur l\'onglet Utilisateurs qui ouvre le formulaire', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(screen.getByRole('button', { name: '+ Nouvel utilisateur' })).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: '+ Nouvelle station' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '+ Nouvel utilisateur' }))

    expect(screen.getByRole('heading', { name: 'Nouvel utilisateur' })).toBeInTheDocument()
  })

  it('affiche un bouton "+ Nouvelle station" désactivé sur l\'onglet Stations — écriture indisponible côté API', async () => {
    mockApi()
    renderPage()

    fireEvent.click(await screen.findByRole('tab', { name: 'Stations · 1' }))

    const button = await screen.findByRole('button', { name: '+ Nouvelle station' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', expect.stringMatching(/indisponible/i))
    expect(screen.queryByRole('button', { name: '+ Nouvel utilisateur' })).not.toBeInTheDocument()
  })
})
