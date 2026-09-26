import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { api } from '../api/client'
import { EquipesTerrestresSection } from './EquipesTerrestresSection'

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}))

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>
const mockedPost = api.post as unknown as ReturnType<typeof vi.fn>

const CHEF_TOKY = { id: 'chef-1', nom: 'Rabe', prenom: 'Toky' }
const CHEF_LALA = { id: 'chef-2', nom: 'Rasoa', prenom: 'Lala' }

// Référentiel unifié (ADR-018) : le chef est un membre `fonction: 'chef'`, les
// autres membres portent leur propre fonction — plus de colonne `chef_equipe_id`.
type Membre = { user_id: string; fonction: string; nom: string | null; prenom: string | null }

const EQUIPE_IHOSY = {
  id: 'equipe-1',
  nom: 'Équipe Terrestre Ihosy',
  type: 'terrestre',
  membres: [
    { user_id: 'chef-1', fonction: 'chef', nom: 'Rabe', prenom: 'Toky' },
  ] as Membre[],
  actif: true,
}
const EQUIPE_LIBRE = {
  id: 'equipe-2',
  nom: 'Équipe Terrestre Toliara',
  type: 'terrestre',
  membres: [
    { user_id: 'chef-2', fonction: 'chef', nom: 'Rasoa', prenom: 'Lala' },
    { user_id: 'u-1', fonction: 'membre', nom: 'Voahangy', prenom: '' },
  ] as Membre[],
  actif: true,
}

function mockApi({
  chefs = [CHEF_TOKY, CHEF_LALA],
  equipes = [EQUIPE_IHOSY, EQUIPE_LIBRE],
}: {
  chefs?: typeof CHEF_TOKY[]
  equipes?: typeof EQUIPE_IHOSY[]
} = {}) {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/users/chefs-equipe') return Promise.resolve({ data: chefs })
    if (url === '/equipes?type=terrestre') return Promise.resolve({ data: equipes })
    return Promise.resolve({ data: [] })
  })
}

function renderSection() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <EquipesTerrestresSection />
    </QueryClientProvider>,
  )
}

describe('EquipesTerrestresSection — équipes terrestres (migration 0072)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('liste les équipes terrestres avec chef et membres', async () => {
    mockApi()
    renderSection()

    await screen.findByText('Équipe Terrestre Ihosy')
    expect(screen.getByText('Toky Rabe')).toBeInTheDocument()
    expect(screen.getByText('Voahangy')).toBeInTheDocument()
    // Équipe Ihosy n'a pas de membres : affiché en repli, pas vide.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('crée une équipe terrestre avec un chef', async () => {
    // Chef-2 (Lala Rasoa) libre : équipe Toliara (qui le dirige) exclue du mock.
    mockApi({ equipes: [EQUIPE_IHOSY] })
    mockedPost.mockResolvedValue({
      data: { id: 'equipe-3', nom: 'Équipe Terrestre Betroka', type: 'terrestre', actif: true },
    })
    renderSection()

    await screen.findByText('Équipe Terrestre Ihosy')
    fireEvent.click(screen.getByText('+ Nouvelle équipe'))

    fireEvent.change(screen.getByLabelText('Nom *'), { target: { value: 'Équipe Terrestre Betroka' } })
    fireEvent.change(screen.getByLabelText("Chef d'équipe *"), { target: { value: 'chef-2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer' }))

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith('/equipes', {
        nom: 'Équipe Terrestre Betroka',
        type: 'terrestre',
        membres: [{ user_id: 'chef-2', fonction: 'chef' }],
      }),
    )
  })

  it("ne propose, pour le chef d'équipe, que les chefs sans équipe déjà assignée", async () => {
    mockApi()
    renderSection()

    await screen.findByText('Équipe Terrestre Ihosy')
    fireEvent.click(screen.getByText('+ Nouvelle équipe'))

    const select = screen.getByLabelText("Chef d'équipe *")
    // Toky Rabe (chef-1) dirige déjà Équipe Ihosy, Lala Rasoa (chef-2) dirige
    // déjà Équipe Toliara — aucun chef libre.
    expect(within(select).queryByText('Toky Rabe')).not.toBeInTheDocument()
    expect(within(select).queryByText('Lala Rasoa')).not.toBeInTheDocument()
  })

  it('ajoute et retire des membres avant de créer une équipe', async () => {
    mockApi({ equipes: [EQUIPE_IHOSY] })
    mockedPost.mockResolvedValue({ data: {} })
    renderSection()

    await screen.findByText('Équipe Terrestre Ihosy')
    fireEvent.click(screen.getByText('+ Nouvelle équipe'))

    const champMembre = screen.getByLabelText('Autres membres (facultatif)')
    fireEvent.change(champMembre, { target: { value: 'Rasoa Voahangy' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }))
    fireEvent.change(champMembre, { target: { value: 'Tovo Randria' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }))

    expect(screen.getByText('Rasoa Voahangy')).toBeInTheDocument()
    expect(screen.getByText('Tovo Randria')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retirer Rasoa Voahangy' }))
    expect(screen.queryByText('Rasoa Voahangy')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Nom *'), { target: { value: 'Équipe Terrestre Betroka' } })
    fireEvent.change(screen.getByLabelText("Chef d'équipe *"), { target: { value: 'chef-2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer' }))

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith(
        '/equipes',
        expect.objectContaining({
          membres: [
            { user_id: 'chef-2', fonction: 'chef' },
            { nom: 'Tovo Randria', fonction: 'membre' },
          ],
        }),
      ),
    )
  })

  it('affiche une bannière d’erreur si les équipes terrestres ne peuvent pas être chargées', async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === '/equipes?type=terrestre') {
        const err = new Error('500') as Error & { response: { status: number; data: { detail: string } } }
        err.response = { status: 500, data: { detail: 'panne serveur' } }
        return Promise.reject(err)
      }
      if (url === '/users/chefs-equipe') return Promise.resolve({ data: [CHEF_TOKY] })
      return Promise.resolve({ data: [] })
    })
    renderSection()

    await waitFor(() => expect(screen.getByText('panne serveur')).toBeInTheDocument())
  })
})
