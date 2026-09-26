import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
        children: [
          { index: true, element: <div>contenu</div>, handle: { title: 'Tableau de bord' } },
          { path: 'campagnes', element: <div>page campagnes</div>, handle: { title: 'Campagnes' } },
        ],
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

  /** L'onglet de la carte s'appelle « Cartographie » (et non plus « Carte des infestations »). */
  it('affiche l’entrée de nav "Cartographie" vers la carte, et plus "Carte des infestations"', async () => {
    renderLayout()
    await waitFor(() => {
      const item = screen.getByText('Cartographie').closest('a')
      expect(item).toHaveAttribute('href', '/carte')
    })
    expect(screen.queryByText('Carte des infestations')).not.toBeInTheDocument()
  })

  /** #suivi-heures-de-vol : même lectorat que Traitements (aérien). */
  it('affiche l’entrée de nav "Heures de vol", à côté de Traitements', async () => {
    renderLayout()
    await waitFor(() => {
      const item = screen.getByText('Heures de vol').closest('a')
      expect(item).toHaveAttribute('href', '/fiches-vol')
    })
  })

  /** Sous 1024 px le menu est un tiroir (jsdom n'applique pas les media queries : on teste l'état). */
  describe('menu tiroir (écrans étroits)', () => {
    const bouton = () => screen.getByRole('button', { name: 'Ouvrir le menu' })
    const menu = () => document.getElementById('menu-principal') as HTMLElement

    it('est fermé au départ, et le bouton de l’en-tête l’ouvre', async () => {
      renderLayout()
      await screen.findByRole('button', { name: 'Ouvrir le menu' })

      expect(bouton()).toHaveAttribute('aria-expanded', 'false')
      expect(bouton()).toHaveAttribute('aria-controls', 'menu-principal')
      expect(menu()).toHaveClass('-translate-x-full')

      fireEvent.click(bouton())

      expect(bouton()).toHaveAttribute('aria-expanded', 'true')
      expect(menu()).toHaveClass('translate-x-0')
      expect(menu()).not.toHaveClass('-translate-x-full')
    })

    it('se referme avec le bouton ✕, la touche Échap ou un clic sur le fond', async () => {
      renderLayout()
      await screen.findByRole('button', { name: 'Ouvrir le menu' })

      fireEvent.click(bouton())
      fireEvent.click(screen.getByRole('button', { name: 'Fermer le menu' }))
      expect(bouton()).toHaveAttribute('aria-expanded', 'false')

      fireEvent.click(bouton())
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(bouton()).toHaveAttribute('aria-expanded', 'false')

      fireEvent.click(bouton())
      // Le fond est le seul élément masqué aux lecteurs d'écran qui couvre la page.
      const fond = document.querySelector('div.fixed.inset-0') as HTMLElement
      fireEvent.click(fond)
      expect(bouton()).toHaveAttribute('aria-expanded', 'false')
      expect(document.querySelector('div.fixed.inset-0')).toBeNull()
    })

    it('se referme dès qu’on navigue vers une autre page', async () => {
      renderLayout()
      await screen.findByRole('button', { name: 'Ouvrir le menu' })

      fireEvent.click(bouton())
      fireEvent.click(await screen.findByRole('link', { name: /Campagnes/ }))

      await screen.findByText('page campagnes')
      expect(bouton()).toHaveAttribute('aria-expanded', 'false')
    })
  })
})
