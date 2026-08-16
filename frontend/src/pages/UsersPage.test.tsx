import { afterEach, describe, expect, it, vi } from 'vitest'
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

function utilisateur() {
  return {
    id: 'u1',
    nom: 'Rakoto',
    prenom: 'Jean',
    email: 'jean.rakoto@ifvm.mg',
    role: 'admin',
    actif: true,
    created_at: '2026-08-01T00:00:00Z',
  }
}

function renderPage() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/administration']}>
        <UsersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('UsersPage — colonnes maquette (README §10, onglet Utilisateurs)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('affiche nom, email en mono, rôle en badge et un interrupteur actif', async () => {
    mockedGet.mockResolvedValue({ data: [utilisateur()] })
    renderPage()

    await waitFor(() => expect(screen.getByText('Jean Rakoto')).toBeInTheDocument())

    const email = screen.getByText('jean.rakoto@ifvm.mg')
    expect(email.className).toMatch(/font-mono/)

    const role = screen.getByDisplayValue('Administrateur')
    expect(role.className).toMatch(/rounded-full/)

    const toggle = screen.getByRole('switch')
    expect(toggle).toHaveAttribute('data-checked')
  })

  it("n'affiche pas de colonne station ni fiches — absentes de l'API (UtilisateurRead) — et le signale", async () => {
    mockedGet.mockResolvedValue({ data: [utilisateur()] })
    renderPage()

    await waitFor(() => expect(screen.getByText('Jean Rakoto')).toBeInTheDocument())

    expect(screen.queryByText(/^Station$/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Fiches$/)).not.toBeInTheDocument()
    expect(screen.getByText(/station.*fiches.*API|API.*station.*fiches/is)).toBeInTheDocument()
  })

  it("l'interrupteur actif appelle PATCH /users/{id} avec le nouvel état", async () => {
    mockedGet.mockResolvedValue({ data: [utilisateur()] })
    mockedPatch.mockResolvedValue({ data: {} })
    const { container } = renderPage()

    await waitFor(() => expect(screen.getByRole('switch')).toBeInTheDocument())
    fireEvent.click(container.querySelector('input[type="checkbox"]')!)

    await waitFor(() => expect(mockedPatch).toHaveBeenCalledWith('/users/u1', { actif: false }))
  })
})
