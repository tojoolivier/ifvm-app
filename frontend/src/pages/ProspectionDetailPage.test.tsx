import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { api } from '../api/client'
import { ProspectionDetailPage } from './ProspectionDetailPage'

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), patch: vi.fn() },
}))

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>

function baseProspection(statut: string) {
  return {
    id: 'p1',
    type_prospection: 'intensive',
    campagne_id: 'c1',
    prospecteur_id: 'u1',
    station_id: null,
    date_prospection: '2026-07-10',
    statut,
    statut_sync: 'synced',
    n_fiche: 'F-001',
    n_message: null as string | null,
    created_at: '2026-07-01T10:00:00Z',
    updated_at: '2026-07-02T08:00:00Z',
    latitude: -18.5,
    longitude: 47.2,
    altitude: null as number | null,
    region: null as string | null,
    district: null as string | null,
    commune: null as string | null,
    za: null as string | null,
    pa_code: null as string | null,
    station_libre: null as string | null,
    biotope: [] as string[],
    hauteur_herbe_cm: null as number | null,
    verdissement: null as number | null,
    verdissement_pourcent: null as number | null,
    degats_cultures_pourcent: null as number | null,
    derniere_pluie: null as string | null,
    intensite_pluie: null as string | null,
    ennemis_naturels: null as string | null,
    observations: null as string | null,
    surface_station: 100,
    surface_prospectee: 80,
    surface_infestee: 0,
    vegetation: null as Record<string, unknown> | null,
    sol: null as Record<string, unknown> | null,
    degats_cultures: null as string | null,
    avertissements: [] as string[],
    verified_by: null as string | null,
    verified_at: null as string | null,
    validated_by: null as string | null,
    validated_at: null as string | null,
    type_station: [] as string[],
    verdure_strate: null as string | null,
    signalement_source: null as string | null,
    signalement_date: null as string | null,
    signalement_description: null as string | null,
    conclusion_validation: null as string | null,
    mode_extensif: null as string | null,
    societe: null as string | null,
    immatricule_aeronef: null as string | null,
    pilote: null as string | null,
    mecanicien: null as string | null,
    chef_de_base: null as string | null,
    lieu_base_id: null as string | null,
    pesticides_embarques: null as boolean | null,
    pesticide_nom_commercial: null as string | null,
    pesticide_quantite_disponible: null as number | null,
    pesticide_quantite_recue: null as number | null,
    futs_disponible: null as number | null,
    futs_pleins: null as number | null,
    futs_vides: null as number | null,
    futs_recues: null as number | null,
    signature_visa_nom: null as string | null,
    signature_visa_horodatage: null as string | null,
    signature_consultant_fao_nom: null as string | null,
    signature_consultant_fao_horodatage: null as string | null,
    signature_pilote_nom: null as string | null,
    signature_pilote_horodatage: null as string | null,
    signature_chef_base_nom: null as string | null,
    signature_chef_base_horodatage: null as string | null,
    populations: [],
    captures: [],
    infestations: [],
    operations_aeriennes: [] as unknown[],
  }
}

function renderPage(
  statut: string,
  overrides: Partial<ReturnType<typeof baseProspection>> = {},
  role = 'validation_finale',
  referentiel: { utilisateurs?: { id: string; nom: string; role: string }[]; lieuxAeriens?: { id: string; nom: string }[] } = {},
) {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/prospections/p1')
      return Promise.resolve({ data: { ...baseProspection(statut), ...overrides } })
    if (url === '/prospections/p1/audit-log') return Promise.resolve({ data: [] })
    if (url === '/users/me') return Promise.resolve({ data: { id: 'u1', nom: 'Test', role } })
    if (url === '/campagnes') return Promise.resolve({ data: [] })
    if (url === '/users/') return Promise.resolve({ data: referentiel.utilisateurs ?? [] })
    if (url === '/referentiel/lieux-aeriens') return Promise.resolve({ data: referentiel.lieuxAeriens ?? [] })
    return Promise.resolve({ data: [] })
  })

  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/prospections/p1']}>
        <Routes>
          <Route path="/prospections/:id" element={<ProspectionDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ProspectionDetailPage — impression A4 (#19)', () => {
  beforeEach(() => {
    window.print = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("n'affiche pas le bouton d'export pour une fiche non validée", async () => {
    renderPage('en_attente')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'F-001' })).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /Imprimer A4/i })).not.toBeInTheDocument()
  })

  it('affiche le bouton d\'export pour une fiche validée et déclenche window.print au clic', async () => {
    renderPage('validee')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'F-001' })).toBeInTheDocument())

    const button = screen.getByRole('button', { name: /Imprimer A4/i })
    expect(button).toBeInTheDocument()

    expect(screen.queryByTestId('fiche-imprimable')).not.toBeInTheDocument()
    button.click()

    await waitFor(() => expect(screen.getByTestId('fiche-imprimable')).toBeInTheDocument())
    expect(window.print).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Fiche n° F-001')).toBeInTheDocument()
    expect(screen.getByText(/Validé ✓/)).toBeInTheDocument()
  })
})

describe('ProspectionDetailPage — avertissements « à vérifier » (#106)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("n'affiche pas de bandeau quand la fiche n'a aucun avertissement", async () => {
    renderPage('en_attente', { avertissements: [] })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'F-001' })).toBeInTheDocument())

    expect(screen.queryByText(/Avertissements de la fiche/)).not.toBeInTheDocument()
  })

  it('affiche chaque avertissement déclenché à la saisie, visible en revue', async () => {
    renderPage('en_attente', {
      avertissements: [
        'Essaim/vol clair signalé de nuit : comportement forcé sur « posé ».',
        'Écart important par rapport à la dernière observation connue sur ce point de suivi.',
      ],
    })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'F-001' })).toBeInTheDocument())

    expect(screen.getByText('Avertissements de la fiche · 2')).toBeInTheDocument()
    expect(
      screen.getByText('Essaim/vol clair signalé de nuit : comportement forcé sur « posé ».')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Écart important par rapport à la dernière observation connue sur ce point de suivi.')
    ).toBeInTheDocument()
  })
})

describe('ProspectionDetailPage — maquette §5 du handoff', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("porte le n° de fiche et le contexte dans l'en-tête vert", async () => {
    renderPage('verifiee', { commune: 'Beroroha' })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'F-001' })).toBeInTheDocument())

    expect(screen.getByText(/Intensive · Beroroha · 2026-07-10/)).toBeInTheDocument()
    expect(screen.getByText('Vérifiée')).toBeInTheDocument()
  })

  it('rend les quatre blocs de lecture de la maquette', async () => {
    renderPage('verifiee')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'F-001' })).toBeInTheDocument())

    expect(screen.getByText('D · Infestation — spécialisation')).toBeInTheDocument()
    expect(screen.getByText('A · Référence & localisation')).toBeInTheDocument()
    expect(screen.getByText('B · Captures — synthèse par phase')).toBeInTheDocument()
    expect(screen.getByText('E · Végétation & sol')).toBeInTheDocument()
  })

  it('sépare les cartes larve et imago', async () => {
    renderPage('verifiee')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'F-001' })).toBeInTheDocument())

    expect(screen.getByText('Larve · bande larvaire')).toBeInTheDocument()
    expect(screen.getByText('Imago · vol clair')).toBeInTheDocument()
  })

  it('affiche la piste de validation avec une étape en attente', async () => {
    renderPage('verifiee')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'F-001' })).toBeInTheDocument())

    expect(screen.getByText('Piste de validation')).toBeInTheDocument()
    expect(screen.getByText('en attente')).toBeInTheDocument()
  })

  it("propose les actions du rôle et la création de traitement", async () => {
    // Le mock renvoie le rôle validation_finale ; la fiche vérifiée est statuable.
    renderPage('verifiee')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'F-001' })).toBeInTheDocument())

    expect(screen.getByRole('button', { name: 'Valider la fiche' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rejeter avec motif' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Créer une fiche de traitement' }),
    ).toBeInTheDocument()
  })

  it("masque les boutons de statut quand le rôle ne le permet pas", async () => {
    renderPage('brouillon')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'F-001' })).toBeInTheDocument())

    expect(screen.queryByRole('button', { name: 'Valider la fiche' })).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Créer une fiche de traitement' }),
    ).toBeInTheDocument()
  })
})

describe('ProspectionDetailPage — admin se substitue à verificateur/validation_finale', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('affiche « Vérifier la fiche » pour un compte admin sur une fiche en_attente', async () => {
    renderPage('en_attente', {}, 'admin')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'F-001' })).toBeInTheDocument())

    expect(screen.getByRole('button', { name: 'Vérifier la fiche' })).toBeInTheDocument()
  })

  it('affiche « Valider la fiche » et « Rejeter avec motif » pour un compte admin sur une fiche verifiee', async () => {
    renderPage('verifiee', {}, 'admin')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'F-001' })).toBeInTheDocument())

    expect(screen.getByRole('button', { name: 'Valider la fiche' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rejeter avec motif' })).toBeInTheDocument()
  })

  it("masque « Vérifier la fiche » pour un compte prospecteur, y compris en_attente", async () => {
    renderPage('en_attente', {}, 'prospecteur')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'F-001' })).toBeInTheDocument())

    expect(screen.queryByRole('button', { name: 'Vérifier la fiche' })).not.toBeInTheDocument()
  })
})

describe('ProspectionDetailPage — toutes les données de la fiche', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('affiche les autres observations et la traçabilité de validation, résolues par nom', async () => {
    renderPage(
      'verifiee',
      {
        n_message: 'MSG-42',
        biotope: ['savane', 'culture_pluviale'],
        degats_cultures: 'moyens',
        degats_cultures_pourcent: 30,
        verdissement_pourcent: 55,
        derniere_pluie: '2026-07-05',
        intensite_pluie: 'forte',
        ennemis_naturels: 'Oiseaux, mantes religieuses.',
        observations: 'Zone difficile d’accès.',
        za: 'ZA-12',
        pa_code: 'PA-04',
        verified_by: 'u2',
        validated_by: 'u3',
      },
      'validation_finale',
      { utilisateurs: [
        { id: 'u2', nom: 'Rakoto Vero', role: 'verificateur' },
        { id: 'u3', nom: 'Rasoa Lala', role: 'validation_finale' },
      ] },
    )
    await waitFor(() => expect(screen.getByRole('heading', { name: 'F-001' })).toBeInTheDocument())

    expect(screen.getByText('Autres observations')).toBeInTheDocument()
    expect(screen.getByText('MSG-42')).toBeInTheDocument()
    expect(screen.getByText(/Savane, Culture pluviale/)).toBeInTheDocument()
    expect(screen.getByText(/Moyens · 30 %/)).toBeInTheDocument()
    expect(screen.getByText('55 %')).toBeInTheDocument()
    expect(screen.getByText(/Zone difficile d’accès/)).toBeInTheDocument()

    expect(screen.getByText('Signalement & traçabilité')).toBeInTheDocument()
    expect(await screen.findByText('Rakoto Vero')).toBeInTheDocument()
    expect(await screen.findByText('Rasoa Lala')).toBeInTheDocument()
  })

  it("n'affiche les cartes extensif (équipe aérienne, pesticides, signatures) que si la fiche en porte les données", async () => {
    renderPage('verifiee')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'F-001' })).toBeInTheDocument())

    expect(screen.queryByText('Extensif — équipe & aéronef')).not.toBeInTheDocument()
    expect(screen.queryByText('Extensif — pesticides embarqués')).not.toBeInTheDocument()
    expect(screen.queryByText('Extensif — signatures')).not.toBeInTheDocument()
    expect(screen.queryByText('Opérations aériennes')).not.toBeInTheDocument()
  })

  it("affiche l'équipe, l'aéronef (texte libre) et la base résolue par nom pour une fiche extensive aérienne", async () => {
    renderPage(
      'verifiee',
      {
        mode_extensif: 'aerien',
        societe: 'AirCoop',
        immatricule_aeronef: '5R-XYZ',
        pilote: 'Jean Rakoto',
        mecanicien: 'Paul Randria',
        chef_de_base: 'Marie Rabe',
        lieu_base_id: 'lieu-1',
      },
      'validation_finale',
      { lieuxAeriens: [{ id: 'lieu-1', nom: 'Base Betioky' }] },
    )
    await waitFor(() => expect(screen.getByRole('heading', { name: 'F-001' })).toBeInTheDocument())

    expect(screen.getByText('Extensif — équipe & aéronef')).toBeInTheDocument()
    expect(screen.getByText('5R-XYZ')).toBeInTheDocument()
    expect(screen.getByText('Jean Rakoto')).toBeInTheDocument()
    expect(await screen.findByText('Base Betioky')).toBeInTheDocument()
  })

  it('affiche les pesticides embarqués et les signatures extensif quand renseignés', async () => {
    renderPage('verifiee', {
      pesticides_embarques: true,
      pesticide_nom_commercial: 'Fenitrothion 96UL',
      futs_pleins: 3,
      futs_vides: 1,
      signature_pilote_nom: 'Jean Rakoto',
      signature_pilote_horodatage: '2026-07-10T09:00:00Z',
    })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'F-001' })).toBeInTheDocument())

    expect(screen.getByText('Extensif — pesticides embarqués')).toBeInTheDocument()
    expect(screen.getByText('Fenitrothion 96UL')).toBeInTheDocument()
    expect(screen.getByText('Extensif — signatures')).toBeInTheDocument()
    expect(screen.getByText('Jean Rakoto')).toBeInTheDocument()
  })

  it('affiche le tableau des opérations aériennes', async () => {
    renderPage('verifiee', {
      operations_aeriennes: [
        {
          id: 'op1',
          numero: 1,
          type_operation: 'traitement',
          motif_divers: null,
          debut_heure: '07:00',
          debut_temperature_c: 24,
          debut_vent_ms: 2,
          fin_heure: '07:40',
          fin_temperature_c: 27,
          fin_vent_ms: 3,
          duree_minutes: 40,
        },
      ],
    })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'F-001' })).toBeInTheDocument())

    expect(screen.getByText('Opérations aériennes')).toBeInTheDocument()
    expect(screen.getByText('Traitement')).toBeInTheDocument()
    expect(screen.getByText('40')).toBeInTheDocument()
  })
})
