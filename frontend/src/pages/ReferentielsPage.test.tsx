import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { api } from '../api/client'
import { ReferentielsPage } from './ReferentielsPage'

vi.mock('../api/client', () => ({
  api: { get: vi.fn() },
}))

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>

const SERVER_TIME = '2026-08-14T12:10:00Z'

function pull(overrides: Record<string, unknown> = {}) {
  const empty = { upserts: [], server_time: SERVER_TIME }
  return {
    data: {
      postes_acridiens: empty,
      stations_fixes: empty,
      utilisateurs_equipe: empty,
      pesticides: empty,
      cultures: empty,
      codes_stades: empty,
      campagnes: empty,
      ...overrides,
    },
  }
}

function nav() {
  return within(screen.getByRole('navigation', { name: 'Référentiels' }))
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/referentiels']}>
        <ReferentielsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ReferentielsPage — maquette §11 du handoff', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('liste les 7 référentiels de la maquette dans la colonne de navigation', async () => {
    mockedGet.mockResolvedValue(pull())
    renderPage()

    await waitFor(() => expect(nav().getByText('7 référentiels')).toBeInTheDocument())

    for (const table of [
      'pesticide',
      'culture',
      'code_stade',
      'poste_acridien',
      'station_fixe',
      'utilisateur',
      'campagne',
    ]) {
      expect(nav().getByText(table)).toBeInTheDocument()
    }
  })

  it("affiche l'état API réel par entité (pastille « API » ou « à créer »)", async () => {
    mockedGet.mockResolvedValue(pull())
    renderPage()

    await waitFor(() => expect(nav().getByText('7 référentiels')).toBeInTheDocument())

    // 4 entités sans écriture backend : pesticide, culture, code_stade, station_fixe.
    expect(nav().getAllByText('à créer')).toHaveLength(4)
    // 3 entités avec au moins une lecture/écriture exposée : poste_acridien, utilisateur, campagne.
    expect(nav().getAllByText('API')).toHaveLength(3)
  })

  it("signale l'écart matière active / dose de référence sur les pesticides", async () => {
    mockedGet.mockResolvedValue(
      pull({
        pesticides: {
          upserts: [
            { id: 'p1', code: 'PST-ADO4', nom: 'Adonis 4 UL', actif: true, updated_at: SERVER_TIME },
          ],
          server_time: SERVER_TIME,
        },
      }),
    )
    renderPage()

    // Le code apparaît dans la ligne du tableau et dans le panneau Modifier.
    await waitFor(() => expect(screen.getAllByText('PST-ADO4').length).toBeGreaterThan(0))

    // En-tête de colonne + libellé du champ dans le panneau Modifier.
    expect(screen.getAllByText('Matière active').length).toBeGreaterThan(0)
    expect(screen.getByRole('columnheader', { name: 'Dose de référence' })).toBeInTheDocument()
    expect(
      screen.getByText(/la table pesticide ne porte que code, nom et actif/),
    ).toBeInTheDocument()
    expect(screen.getAllByText('colonne absente en base')).toHaveLength(2)
  })

  it("désactive l'ajout quand aucune route d'écriture n'existe côté backend", async () => {
    mockedGet.mockResolvedValue(pull())
    renderPage()

    await waitFor(() => expect(nav().getByText('7 référentiels')).toBeInTheDocument())

    // Pesticides est sélectionné par défaut — aucune écriture exposée.
    // `aria-disabled` plutôt que `disabled` : couleurs pleines de la maquette
    // conservées, état tout de même annoncé et bouton atteignable au clavier.
    expect(screen.getByRole('button', { name: '+ Nouveau pesticide' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  it('renvoie vers le CRUD existant pour les entités déjà administrables', async () => {
    mockedGet.mockResolvedValue(pull())
    renderPage()

    await waitFor(() => expect(nav().getByText('campagne')).toBeInTheDocument())
    fireEvent.click(nav().getByText('campagne'))

    expect(screen.getByRole('button', { name: '+ Nouvelle campagne' })).not.toHaveAttribute(
      'aria-disabled',
    )
  })

  it('change de référentiel et affiche ses colonnes dédiées', async () => {
    mockedGet.mockResolvedValue(
      pull({
        codes_stades: {
          upserts: [
            {
              id: 'cs1',
              code: 'LM-L1',
              espece: 'Locusta migratoria',
              libelle: 'Larve stade 1',
              actif: true,
              updated_at: SERVER_TIME,
            },
          ],
          server_time: SERVER_TIME,
        },
      }),
    )
    renderPage()

    await waitFor(() => expect(nav().getByText('code_stade')).toBeInTheDocument())
    fireEvent.click(nav().getByText('code_stade'))

    expect(screen.getByText('Espèce')).toBeInTheDocument()
    expect(screen.getByText('Libellé')).toBeInTheDocument()
    expect(screen.getAllByText('Larve stade 1').length).toBeGreaterThan(0)
  })

  it('affiche le panneau « fraîcheur terrain » sur le server_time du pull', async () => {
    mockedGet.mockResolvedValue(pull())
    renderPage()

    await waitFor(() => expect(screen.getByText(/Dernier pull terrain/)).toBeInTheDocument())
    expect(screen.getByText('Fraîcheur terrain')).toBeInTheDocument()
  })
})
