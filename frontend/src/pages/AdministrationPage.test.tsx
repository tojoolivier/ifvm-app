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
    mockedGet.mockImplementation((url: string) => {
      if (url === '/users/') return Promise.resolve({ data: [] })
      if (url === '/stations') return Promise.resolve({ data: [] })
      return Promise.resolve({ data: [] })
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Gestion des utilisateurs')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('tab', { name: 'Stations' }))

    await waitFor(() => expect(screen.getByText('Aucune station trouvée.')).toBeInTheDocument())
  })
})
