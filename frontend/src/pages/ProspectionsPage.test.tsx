import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { api } from '../api/client'
import { ProspectionsPage } from './ProspectionsPage'

vi.mock('../api/client', () => ({
  api: { get: vi.fn() },
}))

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>

const STATIONS = [
  { id: 's-014', code: 'ST-014', nom: 'Ankazoabo', pa_code: 'PA-01' },
  { id: 's-021', code: 'ST-021', nom: 'Betioky', pa_code: 'PA-02' },
  // Dédiée aux fixtures p-3/p-4 ci-dessous — s-014/s-021 restent réservées à
  // p-1/p-2 pour ne pas casser les assertions d'unicité déjà existantes
  // (« ST-014 Ankazoabo », recherche « betioky »).
  { id: 's-030', code: 'ST-030', nom: 'Sakaraha', pa_code: 'PA-03' },
]

const UTILISATEURS = [
  { id: 'u-1', nom: 'Randria Jean', role: 'prospecteur' },
  { id: 'u-2', nom: 'Andria Paul', role: 'prospecteur' },
]

const PROSPECTIONS = [
  {
    id: 'p-1',
    n_fiche: 'PR-2026-0148-INT',
    type_prospection: 'intensive',
    date_prospection: '2026-08-14',
    prospecteur_id: 'u-1',
    station_id: 's-014',
    surface_infestee: 1200,
    statut: 'verifiee',
  },
  {
    id: 'p-2',
    n_fiche: 'PR-2026-0146-EXT',
    type_prospection: 'extensive',
    date_prospection: '2026-08-13',
    prospecteur_id: 'u-2',
    station_id: 's-021',
    surface_infestee: null,
    statut: 'validee',
  },
  {
    id: 'p-3',
    n_fiche: 'MSG-2026-0042',
    type_prospection: 'validation',
    date_prospection: '2026-08-15',
    prospecteur_id: 'u-2',
    station_id: 's-030',
    surface_infestee: null,
    statut: 'validee',
  },
  // #revalidation-prospection : `revalide_de_id` non nul — reste `extensive`
  // en base (`type_prospection`), affichée comme un type à part dans cette
  // liste (cf. `ficheType`), pas comme une Extensive ordinaire.
  {
    id: 'p-4',
    n_fiche: 'PR-2026-0150-EXT',
    type_prospection: 'extensive',
    date_prospection: '2026-08-16',
    prospecteur_id: 'u-2',
    station_id: 's-030',
    surface_infestee: 3.5,
    statut: 'validee',
    revalide_de_id: 'p-2',
  },
]

/** Traitements liés : p-1 a une reprise au produit de choc (300 + 100 ha traités)
 * puis un passage au produit de barrière (250,5 ha protégés) ; p-4 un terrestre
 * (3 ha traités) ; p-2 et p-3 n'ont aucun traitement. */
const TRAITEMENTS = [
  {
    id: 't-1',
    prospection_id: 'p-1',
    mode_traitement: 'TOTAL',
    aerien: { surface_traitee_ha: 300 },
    terrestre: null,
  },
  {
    id: 't-2',
    prospection_id: 'p-1',
    mode_traitement: 'TOTAL',
    aerien: { surface_traitee_ha: 100 },
    terrestre: null,
  },
  {
    id: 't-3',
    prospection_id: 'p-1',
    mode_traitement: 'BARRIERE',
    aerien: { surface_traitee_ha: 250.5 },
    terrestre: null,
  },
  {
    id: 't-4',
    prospection_id: 'p-4',
    mode_traitement: 'TOTAL',
    aerien: null,
    terrestre: { surface_traitee_ha: 3 },
  },
]

/** Route les quatre requêtes de la page ; `/users/` peut échouer (403 non-admin). */
function mockApi({ usersFail = false } = {}) {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/prospections') return Promise.resolve({ data: PROSPECTIONS })
    if (url === '/traitements') return Promise.resolve({ data: TRAITEMENTS })
    if (url === '/stations') return Promise.resolve({ data: STATIONS })
    if (url === '/users/') {
      return usersFail
        ? Promise.reject(new Error('403'))
        : Promise.resolve({ data: UTILISATEURS })
    }
    return Promise.resolve({ data: [] })
  })
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/prospections']}>
        <ProspectionsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function rows() {
  return within(screen.getByRole('table')).getAllByRole('row').slice(1)
}

describe('ProspectionsPage — maquette §3 du handoff', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('affiche les colonnes de la maquette dans l’ordre', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())

    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent)
    expect(headers).toEqual([
      'N° de fiche',
      'Type',
      'Date',
      'Prospecteur',
      'Station',
      'Surf. inf. (ha)',
      'Surf. traitée (ha)',
      'Surf. prot. (ha)',
      'Statut',
      '',
    ])
  })

  it('liste tous les types de prospection, pas seulement les intensives', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(rows()).toHaveLength(4))
    expect(screen.getByText('PR-2026-0148-INT')).toBeInTheDocument()
    expect(screen.getByText('PR-2026-0146-EXT')).toBeInTheDocument()
    expect(screen.getByText('MSG-2026-0042')).toBeInTheDocument()
    expect(screen.getByText('PR-2026-0150-EXT')).toBeInTheDocument()
  })

  /** #revalidation-prospection : `validation` (« Vérifier un signalement ») est
   * un vrai `type_prospection` déjà accepté par le backend, mais absent de
   * cette liste — gardé sous son nom de type, « Validation » (demande
   * explicite : pas de relibellé en « Signalement ») — et une fiche
   * revalidée (`revalide_de_id` non nul) doit se distinguer d'une Extensive
   * ordinaire, pas se fondre dedans. */
  it('affiche « Validation » et « Revalidation » dans la colonne Type, pas la valeur brute ni le type d’origine', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(rows()).toHaveLength(4))
    const ligneValidation = screen.getByText('MSG-2026-0042').closest('tr')!
    expect(within(ligneValidation).getByText('Validation')).toBeInTheDocument()

    const ligneRevalidation = screen.getByText('PR-2026-0150-EXT').closest('tr')!
    expect(within(ligneRevalidation).getByText('Revalidation')).toBeInTheDocument()
    // Pas « Extensive » alors que `type_prospection` vaut bien `extensive` en base.
    expect(within(ligneRevalidation).queryByText('Extensive')).not.toBeInTheDocument()
  })

  it('filtre sur « Validation » via les pastilles', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(rows()).toHaveLength(4))
    fireEvent.click(screen.getByRole('button', { name: 'Validation' }))

    await waitFor(() => expect(rows()).toHaveLength(1))
    expect(screen.getByText('MSG-2026-0042')).toBeInTheDocument()
  })

  it('filtre sur « Revalidation » via les pastilles — une fiche extensive revalidée n’apparaît plus sous « Extensive »', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(rows()).toHaveLength(4))
    fireEvent.click(screen.getByRole('button', { name: 'Revalidation' }))

    await waitFor(() => expect(rows()).toHaveLength(1))
    expect(screen.getByText('PR-2026-0150-EXT')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Extensive' }))
    await waitFor(() => expect(rows()).toHaveLength(1))
    expect(screen.getByText('PR-2026-0146-EXT')).toBeInTheDocument()
  })

  it('résout le prospecteur et la station en libellés lisibles', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(screen.getByText('Randria Jean')).toBeInTheDocument())
    expect(screen.getByText('ST-014 Ankazoabo')).toBeInTheDocument()
  })

  /** Seule l'Intensive porte une station du référentiel : pour l'Extensive et la
   * Validation, la localité saisie à la fiche (`station_libre`) en tient lieu. */
  it('affiche la localité saisie comme station pour une fiche Extensive/Validation sans station_id', async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === '/prospections')
        return Promise.resolve({
          data: [
            { ...PROSPECTIONS[1], station_id: null, station_libre: 'Andasibe-Village' },
            { ...PROSPECTIONS[2], station_id: null, station_libre: 'Betioky Centre' },
          ],
        })
      if (url === '/stations') return Promise.resolve({ data: STATIONS })
      return Promise.resolve({ data: url === '/users/' ? UTILISATEURS : [] })
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Andasibe-Village')).toBeInTheDocument())
    expect(screen.getByText('Betioky Centre')).toBeInTheDocument()
  })

  it('retrouve une fiche Extensive par sa localité dans la recherche', async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === '/prospections')
        return Promise.resolve({
          data: [
            { ...PROSPECTIONS[1], station_id: null, station_libre: 'Andasibe-Village' },
            { ...PROSPECTIONS[2], station_id: null, station_libre: 'Betioky Centre' },
          ],
        })
      if (url === '/stations') return Promise.resolve({ data: STATIONS })
      return Promise.resolve({ data: url === '/users/' ? UTILISATEURS : [] })
    })
    renderPage()

    await waitFor(() => expect(rows()).toHaveLength(2))
    fireEvent.change(screen.getByLabelText('Recherche'), { target: { value: 'andasibe' } })

    await waitFor(() => expect(rows()).toHaveLength(1))
    expect(screen.getByText('Andasibe-Village')).toBeInTheDocument()
  })

  it('reste affichable quand /users/ est refusé (rôle non admin)', async () => {
    mockApi({ usersFail: true })
    renderPage()

    await waitFor(() => expect(rows()).toHaveLength(4))
    expect(screen.getByText('PR-2026-0148-INT')).toBeInTheDocument()
  })

  it('filtre par type via les pastilles de la maquette', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(rows()).toHaveLength(4))
    fireEvent.click(screen.getByRole('button', { name: 'Extensive' }))

    await waitFor(() => expect(rows()).toHaveLength(1))
    expect(screen.getByText('PR-2026-0146-EXT')).toBeInTheDocument()
  })

  it('filtre par statut via les pastilles de la maquette', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(rows()).toHaveLength(4))
    fireEvent.click(screen.getByRole('button', { name: 'Vérifiée' }))

    await waitFor(() => expect(rows()).toHaveLength(1))
    expect(screen.getByText('PR-2026-0148-INT')).toBeInTheDocument()
  })

  it('recherche sur le n° de fiche, l’agent et la station', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(rows()).toHaveLength(4))
    fireEvent.change(screen.getByLabelText('Recherche'), { target: { value: 'betioky' } })

    await waitFor(() => expect(rows()).toHaveLength(1))
    expect(screen.getByText('PR-2026-0146-EXT')).toBeInTheDocument()
  })

  it('affiche le compteur de fiches et le résumé de filtre', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(screen.getByText('4 fiches')).toBeInTheDocument())
    expect(screen.getByText('Filtre : tous types · tous statuts')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Intensive' }))
    await waitFor(() =>
      expect(screen.getByText('Filtre : Intensive · tous statuts')).toBeInTheDocument(),
    )
  })

  it('affiche la surface infestée en mono à droite, tiret si absente', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(screen.getByText('1 200')).toBeInTheDocument())
    // Cellule « Surf. inf. » (index 5) : la ligne p-2 porte aussi des tirets dans les colonnes de surface traitée et protégée.
    expect(within(rows()[1]).getAllByRole('cell')[5]).toHaveTextContent('—')
  })

  /** Produit de choc → surface traitée ; produit de barrière → surface protégée. */
  it('sépare la surface traitée (choc) de la surface protégée (barrière), cumulées par fiche, tiret sinon', async () => {
    mockApi()
    renderPage()

    // p-1 : traitée 300 + 100 = 400 (t-1, t-2 en TOTAL), protégée 250,5 (t-3 en BARRIERE).
    await waitFor(() => expect(screen.getByText('400')).toBeInTheDocument())
    const cellulesP1 = within(screen.getByText('PR-2026-0148-INT').closest('tr')!).getAllByRole('cell')
    expect(cellulesP1[6]).toHaveTextContent('400')
    expect(cellulesP1[7]).toHaveTextContent('250,5')

    // p-4 : un terrestre est toujours « traité », jamais « protégé ».
    const cellulesP4 = within(screen.getByText('PR-2026-0150-EXT').closest('tr')!).getAllByRole('cell')
    expect(cellulesP4[6]).toHaveTextContent('3')
    expect(cellulesP4[7]).toHaveTextContent('—')

    // p-2 : aucun traitement, tirets dans les deux colonnes.
    const cellulesP2 = within(screen.getByText('PR-2026-0146-EXT').closest('tr')!).getAllByRole('cell')
    expect(cellulesP2[6]).toHaveTextContent('—')
    expect(cellulesP2[7]).toHaveTextContent('—')
  })

  it('reste affichable quand /traitements échoue : tirets dans les colonnes de surface traitée et protégée', async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === '/prospections') return Promise.resolve({ data: PROSPECTIONS })
      if (url === '/traitements') return Promise.reject(new Error('403'))
      if (url === '/stations') return Promise.resolve({ data: STATIONS })
      return Promise.resolve({ data: url === '/users/' ? UTILISATEURS : [] })
    })
    renderPage()

    await waitFor(() => expect(rows()).toHaveLength(4))
    const ligne = screen.getByText('PR-2026-0148-INT').closest('tr')!
    const cellules = within(ligne).getAllByRole('cell')
    expect(cellules[6]).toHaveTextContent('—')
    expect(cellules[7]).toHaveTextContent('—')
  })

  it('propose « Ouvrir › » sur chaque ligne', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(screen.getAllByText('Ouvrir ›')).toHaveLength(4))
  })

  it('mémorise les filtres dans l’URL', async () => {
    mockApi()
    renderPage()

    await waitFor(() => expect(rows()).toHaveLength(4))
    fireEvent.click(screen.getByRole('button', { name: 'Rejetée' }))

    await waitFor(() => expect(screen.getByText('0 fiche')).toBeInTheDocument())
    expect(screen.getByText('Aucune fiche trouvée.')).toBeInTheDocument()
  })
})
