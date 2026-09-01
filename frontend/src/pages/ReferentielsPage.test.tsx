import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { api } from '../api/client'
import { ReferentielsPage } from './ReferentielsPage'

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}))

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>
const mockedPost = api.post as unknown as ReturnType<typeof vi.fn>
const mockedPut = api.put as unknown as ReturnType<typeof vi.fn>

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

    // 2 entités sans écriture backend : pesticide, station_fixe.
    expect(nav().getAllByText('à créer')).toHaveLength(2)
    // 5 entités avec au moins une lecture/écriture exposée : culture (#130),
    // code_stade, poste_acridien, utilisateur, campagne.
    expect(nav().getAllByText('API')).toHaveLength(5)
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

    // En-tête de colonne + libellé du champ éditable dans le panneau Modifier.
    expect(screen.getAllByText('Espèce').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Libellé').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Larve stade 1').length).toBeGreaterThan(0)
  })


  it('affiche le panneau « fraîcheur terrain » sur le server_time du pull', async () => {
    mockedGet.mockResolvedValue(pull())
    renderPage()

    await waitFor(() => expect(screen.getByText(/Dernier pull terrain/)).toBeInTheDocument())
    expect(screen.getByText('Fraîcheur terrain')).toBeInTheDocument()
  })
})

describe('ReferentielsPage — écritures code_stade (#131)', () => {
  const LIGNE = {
    id: 'cs1',
    code: 'L1',
    categorie: 'larve',
    sexe: null,
    espece: null,
    libelle: 'Larve stade L1',
    ordre: 0,
    actif: true,
    updated_at: SERVER_TIME,
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function ouvrirCodesStades(ligne: Record<string, unknown> = LIGNE) {
    mockedGet.mockResolvedValue(
      pull({ codes_stades: { upserts: [ligne], server_time: SERVER_TIME } }),
    )
    renderPage()
    await waitFor(() => expect(nav().getByText('code_stade')).toBeInTheDocument())
    fireEvent.click(nav().getByText('code_stade'))
  }

  it('active le bouton d\'ajout, la route POST existant désormais', async () => {
    await ouvrirCodesStades()

    expect(screen.getByRole('button', { name: '+ Nouveau code stade' })).not.toHaveAttribute(
      'aria-disabled',
    )
  })

  it("affiche l'ordre d'affichage, colonne réellement présente en base", async () => {
    await ouvrirCodesStades({ ...LIGNE, ordre: 4 })

    expect(screen.getByRole('columnheader', { name: 'Ordre' })).toBeInTheDocument()
  })

  it('crée un code stade via POST /codes-stades', async () => {
    mockedPost.mockResolvedValue({ data: { ...LIGNE, id: 'cs2' } })
    await ouvrirCodesStades()

    fireEvent.click(screen.getByRole('button', { name: '+ Nouveau code stade' }))

    const modal = within(screen.getByRole('dialog', { name: 'Nouveau code stade' }))
    fireEvent.change(modal.getByLabelText('Code *'), { target: { value: 'L7' } })
    fireEvent.change(modal.getByLabelText('Catégorie *'), { target: { value: 'larve' } })
    fireEvent.change(modal.getByLabelText('Libellé *'), { target: { value: 'Larve stade L7' } })
    fireEvent.change(modal.getByLabelText('Ordre'), { target: { value: '6' } })
    fireEvent.change(modal.getByLabelText('Espèce'), { target: { value: 'NSE' } })
    fireEvent.click(modal.getByRole('button', { name: 'Créer' }))

    await waitFor(() => expect(mockedPost).toHaveBeenCalledTimes(1))
    expect(mockedPost).toHaveBeenCalledWith('/codes-stades', {
      code: 'L7',
      categorie: 'larve',
      sexe: null,
      espece: 'NSE',
      libelle: 'Larve stade L7',
      ordre: 6,
    })
  })

  it("remonte le motif du serveur quand le code est hors vocabulaire", async () => {
    mockedPost.mockRejectedValue({
      response: { data: { detail: 'Stade inconnu du vocabulaire : ZZ9' } },
    })
    await ouvrirCodesStades()

    fireEvent.click(screen.getByRole('button', { name: '+ Nouveau code stade' }))
    const modal = within(screen.getByRole('dialog', { name: 'Nouveau code stade' }))
    fireEvent.change(modal.getByLabelText('Code *'), { target: { value: 'ZZ9' } })
    fireEvent.change(modal.getByLabelText('Libellé *'), { target: { value: 'Inventé' } })
    fireEvent.click(modal.getByRole('button', { name: 'Créer' }))

    await waitFor(() =>
      expect(screen.getByText('Stade inconnu du vocabulaire : ZZ9')).toBeInTheDocument(),
    )
  })

  it('enregistre une modification via PUT /codes-stades/{id}', async () => {
    mockedPut.mockResolvedValue({ data: { ...LIGNE, libelle: 'Larve L1 (corrigé)' } })
    await ouvrirCodesStades()

    fireEvent.change(screen.getByLabelText('Libellé *'), {
      target: { value: 'Larve L1 (corrigé)' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(mockedPut).toHaveBeenCalledTimes(1))
    expect(mockedPut).toHaveBeenCalledWith('/codes-stades/cs1', {
      code: 'L1',
      categorie: 'larve',
      sexe: null,
      espece: null,
      libelle: 'Larve L1 (corrigé)',
      ordre: 0,
      actif: true,
    })
  })

  it('désactive logiquement plutôt que de supprimer', async () => {
    mockedPut.mockResolvedValue({ data: { ...LIGNE, actif: false } })
    await ouvrirCodesStades()

    // Le panneau Modifier porte le seul interrupteur pilotable de l'écran.
    fireEvent.click(screen.getByRole('switch', { name: 'Actif' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(mockedPut).toHaveBeenCalledTimes(1))
    expect(mockedPut.mock.calls[0][1]).toMatchObject({ actif: false })
    // Aucune affordance de suppression : le pull ne transporte que des upserts.
    expect(screen.queryByRole('button', { name: /supprimer/i })).not.toBeInTheDocument()
  })

  it('« Annuler » revient à la valeur du serveur', async () => {
    await ouvrirCodesStades()

    fireEvent.change(screen.getByLabelText('Libellé *'), { target: { value: 'Brouillon' } })
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(screen.getByLabelText('Libellé *')).toHaveValue('Larve stade L1')
  })

  it("laisse les autres référentiels en lecture seule", async () => {
    mockedGet.mockResolvedValue(pull())
    renderPage()

    await waitFor(() => expect(nav().getByText('7 référentiels')).toBeInTheDocument())

    // Pesticides sélectionné par défaut — toujours aucune écriture exposée.
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })
})

describe('ReferentielsPage — écritures poste_acridien (#132)', () => {
  const ZONE = { id: 'za1', code: 'ZA-ZOM', nom: 'Zombitse', created_at: SERVER_TIME }

  const POSTE = {
    id: 'pa1',
    code: 'PA-ZOM',
    nom: 'Zombitse-Vohibasia',
    za_id: 'za1',
    za_code: 'ZA-ZOM',
    za_nom: 'Zombitse',
    actif: true,
    nb_stations: 6,
    created_at: SERVER_TIME,
    updated_at: SERVER_TIME,
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /**
   * L'écran de poste acridien lit sa liste enrichie (`/postes-acridiens`) et non
   * le pull : `PosteAcridienSyncRead` (le pull) ne porte que `za_id` brut, ni la
   * jointure `za_nom` ni l'agrégat `nb_stations` que l'administration affiche.
   */
  function mockGetParUrl(postes: Record<string, unknown>[] = [POSTE]) {
    mockedGet.mockImplementation((url: string) => {
      if (url.startsWith('/postes-acridiens')) return Promise.resolve({ data: postes })
      if (url.startsWith('/zones-anti-acridiennes')) return Promise.resolve({ data: [ZONE] })
      return Promise.resolve(pull())
    })
  }

  async function ouvrirPostesAcridiens(postes: Record<string, unknown>[] = [POSTE]) {
    mockGetParUrl(postes)
    renderPage()
    await waitFor(() => expect(nav().getByText('poste_acridien')).toBeInTheDocument())
    fireEvent.click(nav().getByText('poste_acridien'))
    await screen.findByDisplayValue('PA-ZOM')
  }

  it('affiche la colonne dérivée « Stations » et le champ dérivé du panneau Modifier', async () => {
    await ouvrirPostesAcridiens()

    expect(screen.getByRole('columnheader', { name: 'Stations' })).toBeInTheDocument()
    expect(screen.getAllByText('6').length).toBeGreaterThan(0)
    // Champ dérivé du panneau Modifier : affiché, jamais saisissable.
    expect(screen.getByText('Stations rattachées')).toBeInTheDocument()
    expect(screen.getByText('dérivé')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('6')).not.toBeInTheDocument()
  })

  it('ouvre le panneau Modifier prérempli, zone anti-acridienne comprise', async () => {
    await ouvrirPostesAcridiens()

    expect(screen.getByDisplayValue('Zombitse-Vohibasia')).toBeInTheDocument()
    expect(screen.getByLabelText('Zone anti-acridienne *')).toHaveValue('za1')
    expect(screen.getByRole('button', { name: 'Enregistrer' })).not.toHaveAttribute('aria-disabled')
    expect(screen.getByRole('button', { name: '+ Nouveau poste acridien' })).not.toHaveAttribute(
      'aria-disabled',
    )
  })

  it('enregistre une modification en PUT, actif compris', async () => {
    mockedPut.mockResolvedValue({ data: POSTE })
    await ouvrirPostesAcridiens()

    fireEvent.change(screen.getByDisplayValue('Zombitse-Vohibasia'), {
      target: { value: 'Zombitse renommé' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() =>
      expect(mockedPut).toHaveBeenCalledWith('/postes-acridiens/pa1', {
        code: 'PA-ZOM',
        nom: 'Zombitse renommé',
        za_id: 'za1',
        actif: true,
      }),
    )
  })

  it('crée un poste acridien via POST /postes-acridiens', async () => {
    mockedPost.mockResolvedValue({ data: { ...POSTE, id: 'pa2', code: 'PA-ISA' } })
    await ouvrirPostesAcridiens()

    fireEvent.click(screen.getByRole('button', { name: '+ Nouveau poste acridien' }))

    const modal = within(screen.getByRole('dialog', { name: 'Nouveau poste acridien' }))
    fireEvent.change(modal.getByLabelText('Code *'), { target: { value: 'PA-ISA' } })
    fireEvent.change(modal.getByLabelText('Nom *'), { target: { value: 'Isalo' } })
    fireEvent.change(modal.getByLabelText('Zone anti-acridienne *'), { target: { value: 'za1' } })
    fireEvent.click(modal.getByRole('button', { name: 'Créer' }))

    await waitFor(() => expect(mockedPost).toHaveBeenCalledTimes(1))
    expect(mockedPost).toHaveBeenCalledWith('/postes-acridiens', {
      code: 'PA-ISA',
      nom: 'Isalo',
      za_id: 'za1',
    })
  })

  it('affiche le refus du backend quand des stations actives sont rattachées', async () => {
    mockedPut.mockRejectedValue({
      response: { data: { detail: '6 station(s) active(s) sont rattachées à ce poste' } },
    })
    await ouvrirPostesAcridiens()

    // Le panneau Modifier porte le seul interrupteur pilotable de l'écran — celui
    // du tableau est en lecture seule et nommé par ligne (`PA-ZOM — actif`).
    fireEvent.click(screen.getByRole('switch', { name: 'Actif' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '6 station(s) active(s) sont rattachées à ce poste',
    )
    expect(mockedPut).toHaveBeenCalledWith(
      '/postes-acridiens/pa1',
      expect.objectContaining({ actif: false }),
    )
  })

  it('« Annuler » revient à la valeur du serveur', async () => {
    await ouvrirPostesAcridiens()

    fireEvent.change(screen.getByDisplayValue('Zombitse-Vohibasia'), {
      target: { value: 'Brouillon' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(screen.getByDisplayValue('Zombitse-Vohibasia')).toBeInTheDocument()
  })

  it('aucune affordance de suppression : le pull ne transporte que des upserts', async () => {
    await ouvrirPostesAcridiens()

    expect(screen.queryByRole('button', { name: /supprimer/i })).not.toBeInTheDocument()
  })
})

describe('ReferentielsPage — écritures culture (#130)', () => {
  const CULTURE = {
    id: 'cu1',
    code: 'RIZ',
    nom: 'Riz',
    actif: true,
    created_at: SERVER_TIME,
    updated_at: SERVER_TIME,
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /**
   * L'administration lit `/cultures?inclure_inactifs=true` et non le pull : elle
   * affiche un badge « État », il lui faut donc aussi les cultures désactivées.
   */
  function mockGetParUrl(cultures: Record<string, unknown>[] = [CULTURE]) {
    mockedGet.mockImplementation((url: string) => {
      if (url.startsWith('/cultures')) return Promise.resolve({ data: cultures })
      return Promise.resolve(pull())
    })
  }

  async function ouvrirCultures(cultures: Record<string, unknown>[] = [CULTURE]) {
    mockGetParUrl(cultures)
    renderPage()
    await waitFor(() => expect(nav().getByText('culture')).toBeInTheDocument())
    fireEvent.click(nav().getByText('culture'))
    await screen.findByDisplayValue('RIZ')
  }

  it("expose la pastille « API » et active les affordances d'écriture", async () => {
    await ouvrirCultures()

    expect(screen.getByText('GET · POST · PUT /cultures')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Nouvelle culture' })).not.toHaveAttribute(
      'aria-disabled',
    )
    expect(screen.getByRole('button', { name: 'Enregistrer' })).not.toHaveAttribute('aria-disabled')
  })

  it('ouvre le panneau Modifier prérempli sur la culture sélectionnée', async () => {
    await ouvrirCultures()

    expect(screen.getByLabelText('Code *')).toHaveValue('RIZ')
    expect(screen.getByLabelText('Nom *')).toHaveValue('Riz')
  })

  it('enregistre une modification via PUT /cultures/{id}', async () => {
    mockedPut.mockResolvedValue({ data: { ...CULTURE, nom: 'Riz irrigué' } })
    await ouvrirCultures()

    fireEvent.change(screen.getByLabelText('Nom *'), { target: { value: 'Riz irrigué' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() =>
      expect(mockedPut).toHaveBeenCalledWith('/cultures/cu1', {
        code: 'RIZ',
        nom: 'Riz irrigué',
        actif: true,
      }),
    )
  })

  it('crée une culture via POST /cultures', async () => {
    mockedPost.mockResolvedValue({ data: { ...CULTURE, id: 'cu2', code: 'MAIS', nom: 'Maïs' } })
    await ouvrirCultures()

    fireEvent.click(screen.getByRole('button', { name: '+ Nouvelle culture' }))

    const modal = within(screen.getByRole('dialog', { name: 'Nouvelle culture' }))
    fireEvent.change(modal.getByLabelText('Code *'), { target: { value: 'MAIS' } })
    fireEvent.change(modal.getByLabelText('Nom *'), { target: { value: 'Maïs' } })
    fireEvent.click(modal.getByRole('button', { name: 'Créer' }))

    await waitFor(() => expect(mockedPost).toHaveBeenCalledTimes(1))
    expect(mockedPost).toHaveBeenCalledWith('/cultures', { code: 'MAIS', nom: 'Maïs' })
  })

  it('désactive logiquement plutôt que de supprimer', async () => {
    mockedPut.mockResolvedValue({ data: { ...CULTURE, actif: false } })
    await ouvrirCultures()

    fireEvent.click(screen.getByRole('switch', { name: 'Actif' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(mockedPut).toHaveBeenCalledTimes(1))
    expect(mockedPut.mock.calls[0][1]).toMatchObject({ actif: false })
    // Aucune affordance de suppression : le pull ne transporte que des upserts.
    expect(screen.queryByRole('button', { name: /supprimer/i })).not.toBeInTheDocument()
  })

  it('remonte le conflit du serveur quand le code est déjà pris', async () => {
    mockedPut.mockRejectedValue({
      response: { data: { detail: 'Le code « RIZ » est déjà utilisé par une autre culture' } },
    })
    await ouvrirCultures()

    fireEvent.change(screen.getByLabelText('Nom *'), { target: { value: 'Riz pluvial' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() =>
      expect(
        screen.getByText('Le code « RIZ » est déjà utilisé par une autre culture'),
      ).toBeInTheDocument(),
    )
  })

  it('affiche aussi les cultures désactivées, badge « État » oblige', async () => {
    await ouvrirCultures([
      CULTURE,
      { ...CULTURE, id: 'cu3', code: 'MAN', nom: 'Manioc', actif: false },
    ])

    expect(screen.getByText('MAN')).toBeInTheDocument()
  })
})
