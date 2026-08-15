import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { api } from './api/client'
import { routes } from './routes'

vi.mock('./api/client', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}))

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>

function renderAt(initialPath: string) {
  const queryClient = new QueryClient()
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] })
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('routage (#120)', () => {
  beforeEach(() => {
    mockedGet.mockImplementation((url: string) => {
      if (url === '/users/me') {
        return Promise.resolve({
          data: { id: 'u1', role: 'validation_finale', nom: 'Test', email: 't@t.com' },
        })
      }
      if (url === '/prospections') return Promise.resolve({ data: [] })
      return Promise.resolve({ data: [] })
    })
    localStorage.setItem('access_token', 'fake-token')
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('affiche ValidationFinalePage sur /validation-finale au lieu de retomber sur LoginPage', async () => {
    renderAt('/validation-finale')

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Validation finale' })).toBeInTheDocument(),
    )
    expect(screen.queryByLabelText(/mot de passe/i)).not.toBeInTheDocument()
  })

  it('affiche une vraie page 404 pour une route inconnue, pas LoginPage', async () => {
    renderAt('/une-route-qui-nexiste-pas')

    await waitFor(() => expect(screen.getByText(/404/)).toBeInTheDocument())
    expect(screen.queryByLabelText(/mot de passe/i)).not.toBeInTheDocument()
  })
})
