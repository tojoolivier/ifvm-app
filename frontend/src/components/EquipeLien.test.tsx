import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { api } from '../api/client'
import { EquipeLien } from './EquipeLien'

vi.mock('../api/client', () => ({
  api: { get: vi.fn() },
}))

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>

const EQUIPE_AERIENNE = {
  id: 'eq-1',
  nom: 'Équipe Aérienne Toliara',
  type: 'aerien',
  membres: [{ user_id: 'cb-1', fonction: 'chef', nom: 'Rakoto', prenom: 'Zo' }],
  actif: true,
}

function mockApi({ role = 'admin', equipe = EQUIPE_AERIENNE as unknown }: { role?: string; equipe?: unknown } = {}) {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/users/me') return Promise.resolve({ data: { id: 'u1', nom: 'Test', role } })
    if (url === '/equipes/eq-1') {
      return equipe === 'erreur' ? Promise.reject(new Error('404')) : Promise.resolve({ data: equipe })
    }
    return Promise.resolve({ data: [] })
  })
}

function renderLien(equipeId: string | null | undefined) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <EquipeLien equipeId={equipeId} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

// #602, #607 : l'équipe est affichée sur les fiches de prospection et de traitement.
describe('EquipeLien', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('affiche le nom, le type et le chef de l’équipe, avec un lien vers Administration > Équipes (admin)', async () => {
    mockApi({ role: 'admin' })
    renderLien('eq-1')

    const lien = await screen.findByRole('link', { name: 'Équipe Aérienne Toliara' })
    expect(lien).toHaveAttribute('href', '/administration?section=equipes&equipe=eq-1')
    expect(screen.getByTestId('fiche-equipe')).toHaveTextContent('Équipe : Équipe Aérienne Toliara (aérienne · chef Zo Rakoto)')
  })

  it('le lien est aussi proposé au profil chef', async () => {
    mockApi({ role: 'chef' })
    renderLien('eq-1')

    expect(await screen.findByRole('link', { name: 'Équipe Aérienne Toliara' })).toBeInTheDocument()
  })

  it.each(['verificateur', 'prospecteur', 'validation_finale'])(
    'sans lien pour le profil %s (il n’a pas accès à l’Administration) : le nom seul',
    async (role) => {
      mockApi({ role })
      renderLien('eq-1')

      await waitFor(() => expect(screen.getByTestId('fiche-equipe')).toHaveTextContent('Équipe Aérienne Toliara'))
      expect(screen.queryByRole('link')).not.toBeInTheDocument()
    },
  )

  it('indique « non renseignée » pour une fiche sans équipe, sans interroger le serveur', async () => {
    mockApi()
    renderLien(null)

    expect(screen.getByTestId('fiche-equipe')).toHaveTextContent('Équipe : non renseignée')
    expect(mockedGet).not.toHaveBeenCalledWith(expect.stringContaining('/equipes/'))
  })

  it('indique « introuvable » quand l’équipe ne peut pas être chargée', async () => {
    mockApi({ equipe: 'erreur' })
    renderLien('eq-1')

    await waitFor(() => expect(screen.getByTestId('fiche-equipe')).toHaveTextContent('Équipe : introuvable'))
  })

  it('n’affiche pas de chef pour une équipe qui n’en a pas', async () => {
    mockApi({ equipe: { ...EQUIPE_AERIENNE, membres: [] } })
    renderLien('eq-1')

    await waitFor(() => expect(screen.getByTestId('fiche-equipe')).toHaveTextContent('(aérienne)'))
  })
})
