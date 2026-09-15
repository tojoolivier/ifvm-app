import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { api } from '../api/client'
import { UsersPage } from './UsersPage'

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}))

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>
const mockedPatch = api.patch as unknown as ReturnType<typeof vi.fn>

function utilisateur(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    nom: 'Rakoto',
    prenom: 'Jean',
    email: 'jean.rakoto@ifvm.mg',
    role: 'admin',
    actif: true,
    created_at: '2026-08-01T00:00:00Z',
    pa_id: 'pa1',
    pa_code: 'PA-04',
    pa_nom: 'Poste Beroroha',
    ...overrides,
  }
}

function mockApi({
  users = [utilisateur()],
  prospections = [],
  me = null,
}: {
  users?: ReturnType<typeof utilisateur>[]
  prospections?: { prospecteur_id: string | null }[]
  me?: ReturnType<typeof utilisateur> | null
} = {}) {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/users/') return Promise.resolve({ data: users })
    if (url === '/users/me') return Promise.resolve({ data: me })
    if (url === '/prospections') return Promise.resolve({ data: prospections })
    return Promise.resolve({ data: [] })
  })
}

function Wrapper() {
  const [showCreate, setShowCreate] = useState(false)
  return <UsersPage showCreate={showCreate} onShowCreateChange={setShowCreate} />
}

function renderPage() {
  // `retry: false` : sans ça, les tests d'erreur attendent les 3 tentatives par défaut.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/administration']}>
        <Wrapper />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('UsersPage — colonnes maquette (README §10, onglet Utilisateurs)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('affiche nom, email en mono, rôle en badge et un interrupteur actif', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(screen.getByText('Jean Rakoto')).toBeInTheDocument())

    const email = screen.getByText('jean.rakoto@ifvm.mg')
    expect(email.className).toMatch(/font-mono/)

    const role = screen.getByDisplayValue('Administrateur')
    expect(role.className).toMatch(/rounded-full/)

    const toggle = screen.getByRole('switch')
    expect(toggle).toHaveAttribute('data-checked')
  })

  it('affiche les 7 colonnes de la maquette, dont Sigle entre Email et Rôle', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(screen.getByText('Jean Rakoto')).toBeInTheDocument())

    for (const entete of ['Nom', 'Email', 'Sigle', 'Rôle', 'Station', 'Fiches', 'Actif']) {
      expect(screen.getByRole('columnheader', { name: entete })).toBeInTheDocument()
    }
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent)
    expect(headers.indexOf('Sigle')).toBeGreaterThan(headers.indexOf('Email'))
    expect(headers.indexOf('Sigle')).toBeLessThan(headers.indexOf('Rôle'))
    // Plus d'encart d'excuse : la donnée existe désormais côté API.
    expect(screen.queryByText(/ne sont pas exposés par l'API/i)).not.toBeInTheDocument()
  })

  it('remplit Station avec le poste acridien de rattachement, et « — » sans rattachement', async () => {
    mockApi({
      users: [
        utilisateur(),
        utilisateur({ id: 'u2', nom: 'Soa', prenom: 'Lalao', email: 'l.soa@ifvm.mg', pa_id: null, pa_code: null, pa_nom: null }),
      ],
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Jean Rakoto')).toBeInTheDocument())

    expect(screen.getByText('Jean Rakoto').closest('tr')).toHaveTextContent('PA-04 Poste Beroroha')
    expect(screen.getByText('Lalao Soa').closest('tr')).toHaveTextContent('—')
  })

  it('compte les fiches par prospecteur à partir de GET /prospections', async () => {
    mockApi({
      prospections: [
        { prospecteur_id: 'u1' },
        { prospecteur_id: 'u1' },
        { prospecteur_id: 'u1' },
        { prospecteur_id: 'autre' },
      ],
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Jean Rakoto')).toBeInTheDocument())

    const row = screen.getByText('Jean Rakoto').closest('tr')!
    expect(row).toHaveTextContent('3')
  })

  it('affiche un bandeau si GET /users/ échoue, au lieu d’un tableau vide muet', async () => {
    mockedGet.mockImplementation((url: string) =>
      url === '/users/'
        ? Promise.reject({ response: { status: 403, data: { detail: 'Accès réservé aux admins' } } })
        : Promise.resolve({ data: [] }),
    )
    renderPage()

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Erreur 403'))
    expect(screen.getByRole('alert')).toHaveTextContent('Accès réservé aux admins')
  })

  it('affiche « ? » et non 0 quand le comptage des fiches est indisponible', async () => {
    mockedGet.mockImplementation((url: string) =>
      url === '/users/'
        ? Promise.resolve({ data: [utilisateur()] })
        : Promise.reject({ response: { status: 500 } }),
    )
    renderPage()

    await waitFor(() => expect(screen.getByText('Jean Rakoto')).toBeInTheDocument())
    await waitFor(() =>
      expect(screen.getByText('Jean Rakoto').closest('tr')).toHaveTextContent('?'),
    )
  })

  it('verrouille le rôle et l’interrupteur actif sur sa propre ligne (issue #250)', async () => {
    mockApi({
      users: [
        utilisateur(),
        utilisateur({ id: 'u2', nom: 'Soa', prenom: 'Lalao', email: 'l.soa@ifvm.mg' }),
      ],
      me: utilisateur(),
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Jean Rakoto')).toBeInTheDocument())

    const maLigne = screen.getByText('Jean Rakoto').closest('tr')!
    const autreLigne = screen.getByText('Lalao Soa').closest('tr')!

    expect(maLigne.querySelector('select')).toBeDisabled()
    expect(maLigne.querySelector('input[type="checkbox"]')).toBeDisabled()
    expect(autreLigne.querySelector('select')).not.toBeDisabled()
    expect(autreLigne.querySelector('input[type="checkbox"]')).not.toBeDisabled()
  })

  it("l'interrupteur actif appelle PATCH /users/{id} avec le nouvel état", async () => {
    mockApi()
    mockedPatch.mockResolvedValue({ data: {} })
    const { container } = renderPage()

    await waitFor(() => expect(screen.getByRole('switch')).toBeInTheDocument())
    fireEvent.click(container.querySelector('input[type="checkbox"]')!)

    await waitFor(() => expect(mockedPatch).toHaveBeenCalledWith('/users/u1', { actif: false }))
  })

  it('le sigle éditable au blur appelle PATCH /users/{id} avec le nouveau sigle', async () => {
    mockApi({ users: [utilisateur({ sigle: null })] })
    mockedPatch.mockResolvedValue({ data: {} })
    renderPage()

    await waitFor(() => expect(screen.getByText('Jean Rakoto')).toBeInTheDocument())

    const champSigle = screen.getByLabelText('Sigle de Jean Rakoto')
    expect(champSigle).toHaveValue('')
    fireEvent.change(champSigle, { target: { value: 'ADM' } })
    fireEvent.blur(champSigle)

    await waitFor(() => expect(mockedPatch).toHaveBeenCalledWith('/users/u1', { sigle: 'ADM' }))
  })

  it("un blur sans changement de valeur n'appelle pas PATCH (pas de round-trip inutile)", async () => {
    mockApi({ users: [utilisateur({ sigle: 'ADM' })] })
    renderPage()

    await waitFor(() => expect(screen.getByText('Jean Rakoto')).toBeInTheDocument())

    const champSigle = screen.getByLabelText('Sigle de Jean Rakoto')
    expect(champSigle).toHaveValue('ADM')
    fireEvent.blur(champSigle)

    expect(mockedPatch).not.toHaveBeenCalled()
  })
})
