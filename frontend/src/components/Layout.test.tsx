import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { api } from '../api/client'
import { Layout } from './Layout'

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}))

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>

function renderLayout() {
  const queryClient = new QueryClient()
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <Layout />,
        children: [{ index: true, element: <div>contenu</div>, handle: { title: 'Tableau de bord' } }],
      },
    ],
    { initialEntries: ['/'] },
  )
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('Layout (#121)', () => {
  beforeEach(() => {
    localStorage.setItem('access_token', 'fake-token')
    localStorage.setItem('user_role', 'admin')
    mockedGet.mockImplementation((url: string, config?: { params?: Record<string, string> }) => {
      if (url === '/users/me') {
        return Promise.resolve({
          data: { id: 'u1', role: 'admin', nom: 'Rasoa', prenom: 'Hery', email: 'h@t.com' },
        })
      }
      if (url === '/campagnes') {
        return Promise.resolve({
          data: [
            { id: 'c1', name: 'Campagne 2026', start_date: '2020-01-01', end_date: null },
            { id: 'c2', name: 'Campagne close', start_date: '2019-01-01', end_date: '2019-06-01' },
          ],
        })
      }
      if (url === '/prospections') {
        if (config?.params?.statut === 'en_attente') {
          return Promise.resolve({ data: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }] })
        }
        if (config?.params?.statut === 'verifiee') {
          return Promise.resolve({ data: [] })
        }
        return Promise.resolve({ data: Array.from({ length: 5 }, (_, i) => ({ id: `p${i}` })) })
      }
      if (url === '/traitements') return Promise.resolve({ data: [{ id: 't1' }] })
      if (url === '/users/') return Promise.resolve({ data: [{ id: 'u1' }, { id: 'u2' }] })
      return Promise.resolve({ data: [] })
    })
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('affiche le logo IFVM en image plutôt qu\'en texte brut', async () => {
    renderLayout()
    const logo = await screen.findByRole('img', { name: 'IFVM' })
    expect(logo).toHaveAttribute('src', '/logo.png')
  })

  it('affiche le compteur de campagnes dans la sidebar', async () => {
    renderLayout()
    await waitFor(() => {
      const item = screen.getByText('Campagnes').closest('a')
      expect(item).toHaveTextContent('2')
    })
  })

  it('affiche la pilule de campagne active dans le header', async () => {
    renderLayout()
    await waitFor(() => expect(screen.getByText('Campagne 2026')).toBeInTheDocument())
  })

  it('affiche la pilule "N fiches en attente" dans le header', async () => {
    renderLayout()
    await waitFor(() => expect(screen.getByText('3 fiches en attente')).toBeInTheDocument())
  })

  it('affiche l\'entrée de nav "Utilisateurs & stations" (README §10) et pas "Administration"', async () => {
    renderLayout()
    await waitFor(() => {
      const item = screen.getByText('Utilisateurs & stations').closest('a')
      expect(item).toHaveAttribute('href', '/administration')
      expect(item).toHaveTextContent('2')
    })
    expect(screen.queryByText('Administration')).not.toBeInTheDocument()
  })

  /** #suivi-heures-de-vol : même lectorat que Traitements (aérien). */
  it('affiche l’entrée de nav "Heures de vol", à côté de Traitements', async () => {
    renderLayout()
    await waitFor(() => {
      const item = screen.getByText('Heures de vol').closest('a')
      expect(item).toHaveAttribute('href', '/fiches-vol')
    })
  })
})
