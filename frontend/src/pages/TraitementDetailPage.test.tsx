import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { api } from '../api/client'
import { TraitementDetailPage } from './TraitementDetailPage'

vi.mock('../api/client', () => ({
  api: { get: vi.fn() },
}))

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>

const pesticidePull = {
  data: {
    pesticides: {
      upserts: [
        { id: 'pest-1', code: 'PEST-FEN', nom: 'Fenitrothion', actif: true, updated_at: '2026-01-01T00:00:00Z' },
      ],
      server_time: '2026-01-01T00:00:00Z',
    },
  },
}

function traitementAerien(overrides: Record<string, unknown> = {}) {
  return {
    id: 't1',
    prospection_id: 'p1',
    numero_fiche: 'Jean-AERIEN-2026-08-12',
    type_traitement: 'AERIEN',
    mode_traitement: 'BARRIERE',
    date_traitement: '2026-08-12',
    date_validation: '2026-08-13',
    localite: 'Beroroha',
    region: 'Atsimo-Andrefana',
    district: 'Beroroha',
    commune: 'Beroroha',
    statut: 'validee',
    cible: {
      espece: 'LMC',
      repartition_population: 'GROUPEE',
      surface_infestee_ha: 3.2,
      petites_larves: 'non renseigné',
      grandes_larves: 'non renseigné',
      vols_clairs_essaims: 'non renseigné',
    },
    aerien: {
      pilote: 'Jean Rakoto',
      mecanicien: 'Paul Randria',
      chef_de_base_id: 'u-chef',
      consultant_international: 'Marc Dupuis',
      base_principale: 'Base Betioky',
      stand: null,
      base_secondaire: null,
      immatricule_aeronef: '5R-ABC',
      nb_rotations: 2,
      total_pesticide_l: 530,
      total_pesticide_kg: null,
      surface_traitee_ha: 320,
      reprise_traitement: false,
      traitement_origine_id: null,
      surface_cumulee_ha: 320,
      pesticide_recu_l: 600,
      pesticide_stock_restant_l: 70,
      rotations: [
        {
          id: 'r1',
          numero: 1,
          numero_cuve: 'CUVE-01',
          produit_id: 'pest-1',
          quantite: 265,
          unite: 'L',
          surface_ha: 40,
          temperature_debut_c: 29,
          temperature_fin_c: 31,
          vent_debut_ms: 2.5,
          vent_fin_ms: 3.1,
          heure_debut: '08:00:00',
          heure_fin: '08:20:00',
          heure_ouverture_vanne: '08:05:00',
          heure_fermeture_vanne: '08:18:00',
        },
        {
          id: 'r2',
          numero: 2,
          numero_cuve: 'CUVE-02',
          produit_id: 'pest-1',
          quantite: 265,
          unite: 'L',
          surface_ha: 40,
          temperature_debut_c: 30,
          temperature_fin_c: 32,
          vent_debut_ms: 2.5,
          vent_fin_ms: 3.1,
          heure_debut: '08:25:00',
          heure_fin: '08:45:00',
          heure_ouverture_vanne: '08:30:00',
          heure_fermeture_vanne: '08:43:00',
        },
      ],
    },
    terrestre: null,
    kit_combinaison: 4,
    kit_gants: 4,
    kit_lunettes: 4,
    kit_masques: 4,
    kit_botte: 0,
    empoisonnement: false,
    empoisonnement_type: null,
    empoisonnement_mode: null,
    empoisonnement_autre: null,
    evaluation_risque: null,
    comportement_anormal: false,
    comportement_non_cibles: null,
    mortalite: false,
    mortalite_familles: null,
    signatures: [
      { id: 's1', role: 'PILOTE', signataire_nom: 'Jean Rakoto', horodatage: '2026-08-13T08:00:00Z' },
      { id: 's2', role: 'MECANICIEN', signataire_nom: 'Paul Randria', horodatage: '2026-08-13T08:00:00Z' },
      { id: 's3', role: 'CHEF_DE_BASE', signataire_nom: 'Marie Rabe', horodatage: '2026-08-13T08:00:00Z' },
    ],
    ...overrides,
  }
}

function renderPage(
  traitement: ReturnType<typeof traitementAerien>,
  reprenables: { id: string }[] = [],
  referentiel: { utilisateurs?: { id: string; nom: string; role: string }[] } = {},
) {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/traitements/t1') return Promise.resolve({ data: traitement })
    if (url === '/referentiel/pull') return Promise.resolve(pesticidePull)
    if (url === '/traitements') return Promise.resolve({ data: reprenables })
    if (url === '/users/') return Promise.resolve({ data: referentiel.utilisateurs ?? [] })
    return Promise.resolve({ data: [] })
  })

  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/traitements/t1']}>
        <Routes>
          <Route path="/traitements/:id" element={<TraitementDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('TraitementDetailPage — conformité maquette (README §7)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('affiche un en-tête vert avec le sous-titre type/mode/localité/validation et la pilule lecture seule', async () => {
    renderPage(traitementAerien())
    await waitFor(() => expect(screen.getByText('Jean-AERIEN-2026-08-12')).toBeInTheDocument())

    expect(screen.getByTestId('traitement-header')).toHaveClass('bg-ifvm-green-text')
    expect(screen.getByText(/Aérien · mode Barrière · Beroroha · validée le 2026-08-13/)).toBeInTheDocument()
    expect(screen.getByText('🔒 Lecture seule')).toBeInTheDocument()
  })

  it("n'affiche pas la pilule lecture seule pour une fiche en brouillon", async () => {
    renderPage(traitementAerien({ statut: 'brouillon' }))
    await waitFor(() => expect(screen.getByText('Jean-AERIEN-2026-08-12')).toBeInTheDocument())
    expect(screen.queryByText('🔒 Lecture seule')).not.toBeInTheDocument()
  })

  it('affiche le bandeau cible (snapshot figé) avec le lien vers la prospection', async () => {
    renderPage(traitementAerien())
    await waitFor(() => expect(screen.getByText('Jean-AERIEN-2026-08-12')).toBeInTheDocument())

    expect(screen.getByText(/3,2 ha/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /la fiche de prospection/ })).toHaveAttribute(
      'href',
      '/prospections/p1',
    )
  })

  it('affiche le numéro métier de la fiche de prospection liée (pas son UUID) — #numero-fiche-prospection-liee', async () => {
    renderPage(traitementAerien({ prospection_n_fiche: 'EXT-2026-00125' }))
    await waitFor(() => expect(screen.getByText('Jean-AERIEN-2026-08-12')).toBeInTheDocument())

    const lien = screen.getByRole('link', { name: 'EXT-2026-00125' })
    expect(lien).toHaveAttribute('href', '/prospections/p1')
  })

  it('retombe sur l’UUID technique si le backend ne renvoie pas encore le numéro métier', async () => {
    renderPage(traitementAerien({ prospection_n_fiche: null }))
    await waitFor(() => expect(screen.getByText('Jean-AERIEN-2026-08-12')).toBeInTheDocument())

    expect(screen.getByRole('link', { name: 'p1' })).toHaveAttribute('href', '/prospections/p1')
  })

  it('affiche le tableau des rotations avec le nom du produit résolu et le total', async () => {
    renderPage(traitementAerien())
    await waitFor(() => expect(screen.getByText('Jean-AERIEN-2026-08-12')).toBeInTheDocument())

    expect(screen.getByText('2 rotations · 530 l')).toBeInTheDocument()
    expect(screen.getByText('CUVE-01')).toBeInTheDocument()
    expect(screen.getAllByText('Fenitrothion')).toHaveLength(2)
    // Régression : `RotationRead` porte `quantite`+`unite` depuis la migration
    // 0047, pas `quantite_l` — le web lisait un champ qui n'existe plus.
    expect(screen.getAllByText('265 L')).toHaveLength(2)
  })

  it('affiche le tableau des produits utilisés pour une fiche terrestre', async () => {
    renderPage(
      traitementAerien({
        type_traitement: 'TERRESTRE',
        aerien: null,
        terrestre: {
          heure_debut: '06:00:00',
          heure_fin: '10:00:00',
          vitesse_vent_ms: 1.8,
          surface_traitee_ha: 5,
          surface_cumulee_ha: 5,
          surface_restante_ha: 3,
          surface_restante_abandonnee: true,
          motif_surface_restante_abandonnee: 'Panne matériel',
          reprise_traitement: false,
          traitement_origine_id: null,
          produits: [{ id: 'pu1', numero: 1, produit_id: 'pest-1', quantite_l: 180 }],
        },
      }),
    )
    await waitFor(() => expect(screen.getByText('Jean-AERIEN-2026-08-12')).toBeInTheDocument())

    expect(screen.getByText('Fenitrothion')).toBeInTheDocument()
    expect(screen.getByText('180')).toBeInTheDocument()
    expect(screen.getByText('Panne matériel')).toBeInTheDocument()
  })

  it('marque les EPI absents d’une pastille rouge et liste les zones exposées', async () => {
    renderPage(
      traitementAerien({
        zones_exposees: { habitations: true, ruchers: true, cultures: false },
      }),
    )
    await waitFor(() => expect(screen.getByText('Jean-AERIEN-2026-08-12')).toBeInTheDocument())

    // `kit_botte: 0` dans la fixture, les quatre autres à 4 : c'est l'état lu
    // par un lecteur d'écran qui compte, pas la teinte de la pastille — et le
    // nombre de personnes équipées est affiché à côté (migration 0040).
    expect(screen.getByText('Botte').parentElement).toHaveTextContent('absent')
    expect(screen.getByText('Combinaison').parentElement).toHaveTextContent('présent')
    expect(screen.getByText('Combinaison').parentElement).toHaveTextContent('4')
    expect(screen.getByText('Habitations, Ruchers')).toBeInTheDocument()
  })

  it('affiche les axes de risque avec un badge de niveau teinté', async () => {
    renderPage(
      traitementAerien({
        evaluation_risque: { sol: 'FAIBLE', abeilles: 'ELEVE' },
      }),
    )
    await waitFor(() => expect(screen.getByText('Jean-AERIEN-2026-08-12')).toBeInTheDocument())

    expect(screen.getByText('Sol')).toBeInTheDocument()
    expect(screen.getByText('Faible').className).toMatch(/ifvm-green-bg/)
    expect(screen.getByText('Élevé').className).toMatch(/ifvm-danger-bg/)
  })

  it('affiche le panneau Surfaces avec la restante détachée en ambre', async () => {
    renderPage(
      traitementAerien({
        type_traitement: 'TERRESTRE',
        aerien: null,
        terrestre: {
          heure_debut: '06:00:00',
          heure_fin: '10:00:00',
          vitesse_vent_ms: 1.8,
          surface_traitee_ha: 860,
          surface_cumulee_ha: 1040,
          surface_restante_ha: 160,
          surface_restante_abandonnee: false,
          motif_surface_restante_abandonnee: null,
          reprise_traitement: false,
          traitement_origine_id: null,
          produits: [],
        },
      }),
    )
    await waitFor(() => expect(screen.getByText('Jean-AERIEN-2026-08-12')).toBeInTheDocument())

    expect(screen.getByText('Surfaces (ha)')).toBeInTheDocument()
    // `toLocaleString('fr-FR')` sépare les milliers par une espace insécable
    // que la normalisation de Testing Library ne ramène pas à un espace simple.
    expect(screen.getByText('Cumulée (reprises)').parentElement?.textContent).toMatch(/1.040/)
    expect(screen.getByText('Restante').className).toMatch(/ifvm-amber-text/)
  })

  it('garde les panneaux Surfaces et Chaîne de reprise sur une fiche aérienne', async () => {
    // La fiche détaillée de la maquette est aérienne et porte pourtant les deux
    // panneaux : ils ne doivent pas être conditionnés au bloc terrestre.
    renderPage(traitementAerien())
    await waitFor(() => expect(screen.getByText('Jean-AERIEN-2026-08-12')).toBeInTheDocument())

    expect(screen.getByText('Surfaces (ha)')).toBeInTheDocument()
    expect(screen.getByText('Chaîne de reprise')).toBeInTheDocument()
    // Le snapshot de cible reste lisible même sans bloc terrestre.
    expect(screen.getByText('Infestée (snapshot)').parentElement?.textContent).toMatch(/3,2/)
  })

  it('formate l’horodatage de signature comme la maquette (sans secondes)', async () => {
    renderPage(
      traitementAerien({
        signatures: [
          { id: 's1', role: 'PILOTE', signataire_nom: 'Jean Rakoto', horodatage: '2026-08-12T17:04:33' },
        ],
      }),
    )
    await waitFor(() => expect(screen.getByText('Jean-AERIEN-2026-08-12')).toBeInTheDocument())

    expect(screen.getByText('2026-08-12 17:04')).toBeInTheDocument()
  })

  it('propose un onglet de retour vers la liste des fiches', async () => {
    renderPage(traitementAerien())
    await waitFor(() => expect(screen.getByText('Jean-AERIEN-2026-08-12')).toBeInTheDocument())

    expect(screen.getByRole('link', { name: 'Liste des fiches' })).toHaveAttribute(
      'href',
      '/traitements',
    )
    expect(
      screen.getByRole('link', { name: 'Détail · Jean-AERIEN-2026-08-12' }),
    ).toHaveAttribute('aria-current', 'page')
  })

  it('la matrice de signatures affiche « ne signe pas » pour les rôles non renseignés', async () => {
    renderPage(traitementAerien())
    await waitFor(() => expect(screen.getByText('Jean-AERIEN-2026-08-12')).toBeInTheDocument())

    expect(screen.getAllByText('ne signe pas')).toHaveLength(2)
  })

  it("affiche la reprise et le lien d'origine à partir de terrestre.reprise_traitement (pas d'un champ racine)", async () => {
    renderPage(
      traitementAerien({
        type_traitement: 'TERRESTRE',
        aerien: null,
        terrestre: {
          heure_debut: '06:00:00',
          heure_fin: '08:30:00',
          vitesse_vent_ms: 1.2,
          surface_traitee_ha: 3,
          surface_cumulee_ha: 8,
          surface_restante_ha: 0,
          surface_restante_abandonnee: null,
          motif_surface_restante_abandonnee: null,
          reprise_traitement: true,
          traitement_origine_id: 'origine-1',
          produits: [],
        },
      }),
    )
    await waitFor(() => expect(screen.getByText('Jean-AERIEN-2026-08-12')).toBeInTheDocument())

    // Maquette : « Origine : <lien> → cette fiche. Une seule reprise possible
    // par fiche d'origine. »
    expect(screen.getByText(/Une seule reprise possible par fiche d'origine/)).toHaveTextContent(
      'Origine :',
    )
    expect(screen.getByRole('link', { name: "fiche d'origine" })).toHaveAttribute(
      'href',
      '/traitements/origine-1',
    )
  })

  it("affiche la chaîne de reprise d'une fiche aérienne (migration 0050, pas seulement terrestre)", async () => {
    // Avant #toutes-les-donnees : la carte ne lisait que `terrestre.reprise_traitement`,
    // une fiche aérienne en reprise affichait donc toujours « n'est pas une reprise ».
    renderPage(
      traitementAerien({
        aerien: {
          pilote: 'Jean Rakoto',
          mecanicien: 'Paul Randria',
          chef_de_base_id: null,
          consultant_international: null,
          base_principale: null,
          stand: null,
          base_secondaire: null,
          immatricule_aeronef: null,
          nb_rotations: 1,
          total_pesticide_l: 200,
          total_pesticide_kg: null,
          surface_traitee_ha: 100,
          reprise_traitement: true,
          traitement_origine_id: 'origine-aerien-1',
          surface_cumulee_ha: 250,
          pesticide_recu_l: null,
          pesticide_stock_restant_l: null,
          rotations: [],
        },
      }),
    )
    await waitFor(() => expect(screen.getByText('Jean-AERIEN-2026-08-12')).toBeInTheDocument())

    expect(screen.getByRole('link', { name: "fiche d'origine" })).toHaveAttribute(
      'href',
      '/traitements/origine-aerien-1',
    )
  })

  it('affiche les informations complémentaires (position GPS, strates, observations, traçabilité)', async () => {
    renderPage(
      traitementAerien({
        latitude: -22.4021,
        longitude: 44.3167,
        altitude: 120,
        hauteur_strate_herbeuse_m: 0.4,
        hauteur_strate_arboree_m: 3,
        recouvrement_percent: 65,
        observations: 'RAS, conditions favorables.',
        statut_sync: 'synced',
        created_at: '2026-08-12T07:00:00Z',
        updated_at: '2026-08-13T09:00:00Z',
      }),
    )
    await waitFor(() => expect(screen.getByText('Jean-AERIEN-2026-08-12')).toBeInTheDocument())

    expect(screen.getByText('Informations complémentaires')).toBeInTheDocument()
    expect(screen.getByText('-22,4021 · 44,3167')).toBeInTheDocument()
    expect(screen.getByText('120 m')).toBeInTheDocument()
    expect(screen.getByText('65 %')).toBeInTheDocument()
    expect(screen.getByText(/RAS, conditions favorables/)).toBeInTheDocument()
  })

  it("affiche l'équipe et l'aéronef d'une fiche aérienne — chef de base résolu par nom, bases en texte libre (#traitement-aerien-base-texte-libre)", async () => {
    renderPage(
      traitementAerien({
        aerien: {
          ...traitementAerien().aerien,
          // Valeur volontairement absente de tout référentiel — aucun appel
          // /referentiel/lieux-aeriens n'est mocké dans ce test : la carte
          // doit l'afficher telle quelle, sans jointure.
          base_principale: 'Piste improvisée 12',
        },
      }),
      [],
      { utilisateurs: [{ id: 'u-chef', nom: 'Marie Rabe', role: 'chef_de_base' }] },
    )
    await waitFor(() => expect(screen.getByText('Jean-AERIEN-2026-08-12')).toBeInTheDocument())

    // `within` la carte : « Marie Rabe » apparaît aussi dans les Signatures
    // (rôle CHEF_DE_BASE) — deux endroits distincts pour la même personne.
    const carte = within(screen.getByText('Équipe & aéronef').closest('section')!)
    expect(await carte.findByText('Marie Rabe')).toBeInTheDocument()
    expect(await carte.findByText('Piste improvisée 12')).toBeInTheDocument()
    expect(carte.getByText('5R-ABC')).toBeInTheDocument()
    expect(carte.getByText('Marc Dupuis')).toBeInTheDocument()
  })

  it("affiche l'équipe et le matériel d'une fiche terrestre", async () => {
    renderPage(
      traitementAerien({
        type_traitement: 'TERRESTRE',
        aerien: null,
        terrestre: {
          chef_equipe_id: 'u-chef-equipe',
          agent_encadreur_id: null,
          consultant_international: 'Alain Petit',
          heure_debut: '06:00:00',
          heure_fin: '10:00:00',
          vitesse_vent_ms: 1.8,
          direction_vent: 'NE',
          reprise_traitement: false,
          traitement_origine_id: null,
          essence_litres: 12,
          nb_piles: 8,
          total_pesticide_l: 180,
          pesticide_recu_l: 200,
          pesticide_stock_restant_l: 20,
          produits: [],
        },
      }),
      [],
      { utilisateurs: [{ id: 'u-chef-equipe', nom: 'Soa Lalao', role: 'chef_equipe' }] },
    )
    await waitFor(() => expect(screen.getByText('Jean-AERIEN-2026-08-12')).toBeInTheDocument())

    expect(screen.getByText('Équipe & matériel')).toBeInTheDocument()
    expect(await screen.findByText('Soa Lalao')).toBeInTheDocument()
    expect(screen.getByText('Alain Petit')).toBeInTheDocument()
    expect(screen.getByText('NE')).toBeInTheDocument()
    expect(screen.getByText('12 l')).toBeInTheDocument()
    expect(screen.getByText('20 l')).toBeInTheDocument()
  })

  it("n'affiche pas « Demander une reprise » quand la fiche n'est pas reprenable", async () => {
    renderPage(traitementAerien())
    await waitFor(() => expect(screen.getByText('Jean-AERIEN-2026-08-12')).toBeInTheDocument())

    expect(screen.queryByRole('button', { name: 'Demander une reprise' })).not.toBeInTheDocument()
  })

  it('affiche « Demander une reprise » et une info purement lecture seule quand la fiche est reprenable', async () => {
    renderPage(
      traitementAerien({
        aerien: {
          pilote: 'Jean Rakoto',
          mecanicien: 'Paul Randria',
          nb_rotations: 2,
          total_pesticide_l: 530,
          surface_restante_ha: 12.5,
          rotations: [],
        },
      }),
      [{ id: 't1' }],
    )
    await waitFor(() => expect(screen.getByText('Jean-AERIEN-2026-08-12')).toBeInTheDocument())

    const bouton = await screen.findByRole('button', { name: 'Demander une reprise' })
    const appelsAvantClic = mockedGet.mock.calls.length
    fireEvent.click(bouton)

    const modale = within(await screen.findByRole('dialog', { name: 'Demander une reprise' }))
    expect(modale.getByText(/Surface restante à traiter/)).toHaveTextContent('12,5 ha')
    // Purement informatif (choix explicite) : ouvrir/fermer la modale n'appelle aucune API.
    expect(mockedGet.mock.calls.length).toBe(appelsAvantClic)

    fireEvent.click(modale.getByRole('button', { name: 'Fermer' }))
    expect(screen.queryByRole('dialog', { name: 'Demander une reprise' })).not.toBeInTheDocument()
  })
})
