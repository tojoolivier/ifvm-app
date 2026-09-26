import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { api } from '../api/client'
import { RattachementsProspection, RattachementsTraitement } from './RattachementsFiche'

vi.mock('../api/client', () => ({
  api: { get: vi.fn() },
}))

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>

const AERONEFS = [
  { id: 'a1', immatriculation: '5R-MJA', societe: 'Heli Madagascar', volume_cuve_l: 800, actif: true },
]
const SITES = [{ id: 's1', numero: 'IHO01', localite: 'Ihosy', parent_site_id: null, equipe_id: 'e1', actif: true }]

function vol(surcharges: Record<string, unknown> = {}) {
  return {
    id: 'v1',
    type: 'application',
    equipe_id: 'e1',
    aeronef_id: 'a1',
    site_principal_id: 's1',
    stand_id: 's2',
    base_secondaire_id: null,
    traitement_id: 't1',
    date_vol: '2026-08-12',
    heure_debut: '08:00:00',
    heure_fin: '09:30:00',
    motif: null,
    lieu_depart: null,
    lieu_arrivee: null,
    observations: null,
    ...surcharges,
  }
}

function mockApi({ volsDuTraitement = [vol()] as unknown[], volParId = vol({ type: 'prospection' }) as unknown, volErreur = false } = {}) {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/aeronefs') return Promise.resolve({ data: AERONEFS })
    if (url === '/sites-aeriens') return Promise.resolve({ data: SITES })
    if (url === '/vols') return volErreur ? Promise.reject(new Error('500')) : Promise.resolve({ data: volsDuTraitement })
    if (url === '/vols/v1') return volErreur ? Promise.reject(new Error('404')) : Promise.resolve({ data: volParId })
    return Promise.resolve({ data: [] })
  })
}

function rendre(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

const section = () => screen.getByTestId('rattachements-fiche')

// #647–#651 : site principal, aéronef et vol lié des détails prospection et traitement.
describe('RattachementsTraitement', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('traitement aérien rattaché : site, aéronef du vol et lien vers le vol', async () => {
    mockApi()
    rendre(
      <RattachementsTraitement
        traitementId="t1"
        aerien={{ site_principal_id: 's1', base_principale: 'Base texte', immatricule_aeronef: '5R-MJA' }}
      />,
    )

    expect(await within(section()).findByText('IHO01 — Ihosy')).toBeInTheDocument()
    expect(within(section()).getByText('5R-MJA — Heli Madagascar')).toBeInTheDocument()
    const lien = await within(section()).findByRole('link', { name: '12/08/2026 — Application · 08:00 – 09:30' })
    expect(lien).toHaveAttribute('href', '/vols/v1')
    // Rattaché au référentiel : rien n'est signalé « saisie libre ».
    expect(within(section()).queryByText('(saisie libre)')).not.toBeInTheDocument()
  })

  it('cherche le vol par traitement_id', async () => {
    mockApi()
    rendre(<RattachementsTraitement traitementId="t1" aerien={{ site_principal_id: 's1' }} />)

    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/vols', { params: { traitement_id: 't1' } }))
  })

  it('fiche antérieure : le texte libre (base, immatriculation) reste lisible, signalé « saisie libre »', async () => {
    mockApi({ volsDuTraitement: [] })
    rendre(
      <RattachementsTraitement
        traitementId="t1"
        aerien={{ site_principal_id: null, base_principale: 'Base Betioky', immatricule_aeronef: '5R-OLD' }}
      />,
    )

    expect(await within(section()).findByText('Base Betioky')).toBeInTheDocument()
    expect(within(section()).getByText('5R-OLD')).toBeInTheDocument()
    expect(within(section()).getAllByText('(saisie libre)')).toHaveLength(2)
    expect(await within(section()).findByText('aucun vol rattaché')).toBeInTheDocument()
  })

  it('fiche antérieure dont l’immatriculation existe au parc : l’appareil du parc est reconnu', async () => {
    mockApi({ volsDuTraitement: [] })
    rendre(
      <RattachementsTraitement
        traitementId="t1"
        aerien={{ site_principal_id: 's1', base_principale: null, immatricule_aeronef: ' 5r-mja ' }}
      />,
    )

    expect(await within(section()).findByText('5R-MJA — Heli Madagascar')).toBeInTheDocument()
  })

  it('sans aucun rattachement ni texte : « non renseigné », la fiche reste lisible', async () => {
    mockApi({ volsDuTraitement: [] })
    rendre(
      <RattachementsTraitement
        traitementId="t1"
        aerien={{ site_principal_id: null, base_principale: null, immatricule_aeronef: null }}
      />,
    )

    await within(section()).findByText('aucun vol rattaché')
    expect(within(section()).getAllByText('non renseigné')).toHaveLength(2) // site et aéronef
  })

  it('le site du vol sert quand la fiche n’a pas de site propre', async () => {
    mockApi()
    rendre(
      <RattachementsTraitement
        traitementId="t1"
        aerien={{ site_principal_id: null, base_principale: null, immatricule_aeronef: null }}
      />,
    )

    expect(await within(section()).findByText('IHO01 — Ihosy')).toBeInTheDocument()
  })

  it('erreur de chargement du vol : « vol introuvable », sans casser le reste', async () => {
    mockApi({ volErreur: true })
    rendre(<RattachementsTraitement traitementId="t1" aerien={{ site_principal_id: 's1', immatricule_aeronef: '5R-MJA' }} />)

    expect(await within(section()).findByText('vol introuvable')).toBeInTheDocument()
    expect(within(section()).getByText('IHO01 — Ihosy')).toBeInTheDocument()
  })

  it('traitement terrestre (pas de partie aérienne) : rien à afficher, aucune requête', async () => {
    mockApi()
    rendre(<RattachementsTraitement traitementId="t1" aerien={null} />)

    expect(screen.queryByTestId('rattachements-fiche')).not.toBeInTheDocument()
    expect(mockedGet).not.toHaveBeenCalled()
  })
})

describe('RattachementsProspection', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('prospection aérienne avec vol : site et aéronef du vol, lien vers le vol', async () => {
    mockApi()
    rendre(<RattachementsProspection prospection={{ vol_id: 'v1', base: null, immatricule_aeronef: null }} />)

    expect(await within(section()).findByText('IHO01 — Ihosy')).toBeInTheDocument()
    expect(within(section()).getByText('5R-MJA — Heli Madagascar')).toBeInTheDocument()
    const lien = await within(section()).findByRole('link', { name: /12\/08\/2026/ })
    expect(lien).toHaveAttribute('href', '/vols/v1')
    expect(mockedGet).toHaveBeenCalledWith('/vols/v1')
  })

  it('extensif aérien antérieur (sans vol) : base et immatriculation en texte libre, signalées', async () => {
    mockApi()
    rendre(
      <RattachementsProspection
        prospection={{ vol_id: null, base: 'Base Betioky', base_numero: 3, immatricule_aeronef: '5R-OLD' }}
      />,
    )

    expect(await within(section()).findByText('Base Betioky (n° 3)')).toBeInTheDocument()
    expect(within(section()).getByText('5R-OLD')).toBeInTheDocument()
    expect(within(section()).getAllByText('(saisie libre)')).toHaveLength(2)
    expect(within(section()).getByText('aucun vol rattaché')).toBeInTheDocument()
    expect(mockedGet).not.toHaveBeenCalledWith(expect.stringMatching(/^\/vols\//))
  })

  it('prospection terrestre (ni vol, ni base, ni immatriculation) : bloc absent', async () => {
    mockApi()
    rendre(<RattachementsProspection prospection={{ vol_id: null, base: null, immatricule_aeronef: null }} />)

    expect(screen.queryByTestId('rattachements-fiche')).not.toBeInTheDocument()
    expect(mockedGet).not.toHaveBeenCalled()
  })

  it('vol introuvable : le dit, et le texte libre historique reste affiché', async () => {
    mockApi({ volErreur: true })
    rendre(<RattachementsProspection prospection={{ vol_id: 'v1', base: 'Base Betioky', immatricule_aeronef: '5R-OLD' }} />)

    expect(await within(section()).findByText('vol introuvable')).toBeInTheDocument()
    expect(within(section()).getByText('Base Betioky')).toBeInTheDocument()
    expect(within(section()).getByText('5R-OLD')).toBeInTheDocument()
  })
})
