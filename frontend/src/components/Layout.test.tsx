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
const mockedPost = api.post as unknown as ReturnType<typeof vi.fn>

function renderLayout() {
  const queryClient = new QueryClient()
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <Layout />,
        children: [
          { index: true, element: <div>contenu</div>, handle: { title: 'Tableau de bord' } },
          { path: 'prospections/:id', element: <div>fiche</div>, handle: { title: 'Fiche' } },
        ],
      },
    ],
    { initialEntries: ['/'] },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

describe('Layout (#121)', () => {
  beforeEach(() => {
    localStorage.setItem('access_token', 'fake-token')
    localStorage.setItem('user_role', 'admin')
    mockedPost.mockResolvedValue({ data: null })
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
      if (url === '/prospections/notifications') {
        return Promise.resolve({
          data: {
            non_lues: 1,
            items: [
              {
                id: 'n1', action: 'rejet', fiche_id: 'p-rejetee', n_fiche: 'F-42', auteur_nom: 'Marie Admin',
                details: { commentaire: 'Coordonnées GPS manquantes' }, created_at: '2026-09-08T10:00:00Z', lu: false,
              },
            ],
          },
        })
      }
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

  it('affiche les actions et le motif de rejet dans les notifications web', async () => {
    renderLayout()
    const bouton = await screen.findByRole('button', { name: 'Notifications, 1 non lues' })
    bouton.click()
    expect(await screen.findByText('Fiche rejetée')).toBeInTheDocument()
    expect(screen.getByText('Motif : Coordonnées GPS manquantes')).toBeInTheDocument()
  })

  it('ne marque « vu » qu\'à la fermeture du panneau, pas à l\'ouverture', async () => {
    // Marquer vu dès l'ouverture ferait disparaître la mise en évidence des
    // non-lues avant même que l'utilisateur ait pu voir lesquelles sont
    // nouvelles.
    renderLayout()
    const bouton = await screen.findByRole('button', { name: 'Notifications, 1 non lues' })

    bouton.click()
    await screen.findByText('Fiche rejetée')
    expect(mockedPost).not.toHaveBeenCalled()

    bouton.click()
    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith('/prospections/notifications/vu'),
    )
  })

  it('cliquer une notification marque vu et navigue vers la fiche concernée', async () => {
    const router = renderLayout()
    const bouton = await screen.findByRole('button', { name: 'Notifications, 1 non lues' })
    bouton.click()

    const ligne = await screen.findByText('Fiche rejetée')
    ligne.closest('button')!.click()

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith('/prospections/notifications/vu'),
    )
    await waitFor(() => expect(router.state.location.pathname).toBe('/prospections/p-rejetee'))
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
})
