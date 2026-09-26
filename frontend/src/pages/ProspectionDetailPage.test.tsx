import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { api } from '../api/client'
import type { AuditBdd, ProspectionBdd } from '@/lib/prospection-fiche-bdd'
import { ficheComplete, ficheVide } from '@/test/prospection-fixtures'
import { ProspectionDetailPage } from './ProspectionDetailPage'

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), patch: vi.fn() },
}))

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>

/** Gabarit HTML du PDF tel que le backend le sert sur `GET /prospections/{id}/fiche-html`. */
const FICHE_HTML = '<html><body><h1>FICHE DE PROSPECTION ANTIACRIDIENNE</h1><table><tr><th>Sexe</th></tr></table></body></html>'

const UTILISATEURS = [
  { id: 'u1', nom: 'Randria Jean', role: 'prospecteur' },
  { id: 'u2', nom: 'Andria Paul', role: 'verificateur' },
]

interface Options {
  role?: string
  audit?: AuditBdd[]
}

/** Rend la page pour une fiche donnée telle que l'API la renverrait. */
function renderFiche(fiche: ProspectionBdd, { role = 'validation_finale', audit = [] }: Options = {}) {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/prospections/p1') return Promise.resolve({ data: fiche })
    if (url === '/prospections/p1/audit-log') return Promise.resolve({ data: audit })
    if (url === '/prospections/p1/fiche-html') return Promise.resolve({ data: FICHE_HTML })
    if (url === '/users/me') return Promise.resolve({ data: { id: 'u1', nom: 'Test', role } })
    if (url === '/campagnes') return Promise.resolve({ data: [{ id: 'c1', name: 'Campagne 2026' }] })
    if (url === '/users/') return Promise.resolve({ data: UTILISATEURS })
    if (url === '/referentiel/stations/s1')
      return Promise.resolve({
        data: { id: 's1', code: 'ST-014', nom: 'Ankazoabo', pa_nom: 'PA-01', latitude: -18, longitude: 47, altitude: null },
      })
    return Promise.resolve({ data: [] })
  })

  // Pas de nouvel essai : une erreur de chargement doit s'afficher tout de suite dans les tests.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
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

function renderPage(statut: ProspectionBdd['statut'], overrides: Partial<ProspectionBdd> = {}, role = 'validation_finale') {
  return renderFiche(ficheComplete({ statut, ...overrides }), { role })
}

/**
 * Attend la fiche puis ouvre « Données BDD » : la fiche s'ouvre sur l'onglet « Fiche »
 * (tableaux du PDF), alors que ces tests vérifient les cartes, une par colonne de la base.
 */
async function attendreFiche() {
  await waitFor(() => expect(screen.getByRole('heading', { name: 'F-001' })).toBeInTheDocument())
  fireEvent.click(screen.getByRole('tab', { name: 'Données BDD' }))
}

/** Ligne d'une colonne de la base, repérée par son nom de colonne. */
function colonne(nom: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-colonne="${nom}"]`)
  if (!el) throw new Error(`Colonne « ${nom} » absente de la page`)
  return el
}

function audit(id: string, action: AuditBdd['action'], created_at: string, auteur_id = 'u1', details: AuditBdd['details'] = null): AuditBdd {
  return { id, fiche_type: 'extensive', fiche_id: 'p1', auteur_id, action, details, created_at }
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
    await attendreFiche()
    expect(screen.queryByRole('button', { name: /Imprimer A4/i })).not.toBeInTheDocument()
  })

  it("affiche le bouton d'export pour une fiche validée et déclenche window.print au clic", async () => {
    renderPage('validee')
    await attendreFiche()

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
    await attendreFiche()

    expect(screen.queryByText(/Avertissements de la fiche/)).not.toBeInTheDocument()
  })

  it('affiche chaque avertissement déclenché à la saisie, visible en revue', async () => {
    renderPage('en_attente', {
      avertissements: [
        'Essaim/vol clair signalé de nuit : comportement forcé sur « posé ».',
        'Écart important par rapport à la dernière observation connue sur ce point de suivi.',
      ],
    })
    await attendreFiche()

    expect(screen.getByText('Avertissements de la fiche · 2')).toBeInTheDocument()
    expect(
      screen.getByText('Essaim/vol clair signalé de nuit : comportement forcé sur « posé ».'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Écart important par rapport à la dernière observation connue sur ce point de suivi.'),
    ).toBeInTheDocument()
  })
})

describe('ProspectionDetailPage — en-tête et actions', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("porte le n° de fiche et le contexte dans l'en-tête vert", async () => {
    renderPage('verifiee', {
      type_prospection: 'intensive',
      station_id: null,
      station_libre: null,
      commune: 'Beroroha',
    })
    await attendreFiche()

    expect(screen.getByText(/Intensive · Beroroha · 2026-07-10/)).toBeInTheDocument()
    // Le statut figure dans la pastille d'en-tête ET dans la colonne `prospection.statut`.
    expect(screen.getAllByText('Vérifiée')).toHaveLength(2)
  })

  it('propose les actions du rôle et la création de traitement', async () => {
    renderPage('verifiee')
    await attendreFiche()

    expect(screen.getByRole('button', { name: 'Valider la fiche' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rejeter avec motif' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Créer une fiche de traitement' })).toBeInTheDocument()
  })

  it('masque les boutons de statut quand le rôle ne le permet pas', async () => {
    renderPage('brouillon')
    await attendreFiche()

    expect(screen.queryByRole('button', { name: 'Valider la fiche' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Créer une fiche de traitement' })).toBeInTheDocument()
  })

  it('affiche « Vérifier la fiche » pour un compte admin sur une fiche en_attente', async () => {
    renderFiche(ficheComplete({ statut: 'en_attente' }), { role: 'admin' })
    await attendreFiche()

    expect(screen.getByRole('button', { name: 'Vérifier la fiche' })).toBeInTheDocument()
  })

  it('affiche « Valider la fiche » et « Rejeter avec motif » pour un compte admin sur une fiche verifiee', async () => {
    renderFiche(ficheComplete({ statut: 'verifiee' }), { role: 'admin' })
    await attendreFiche()

    expect(screen.getByRole('button', { name: 'Valider la fiche' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rejeter avec motif' })).toBeInTheDocument()
  })

  it('masque « Vérifier la fiche » pour un compte prospecteur, y compris en_attente', async () => {
    renderFiche(ficheComplete({ statut: 'en_attente' }), { role: 'prospecteur' })
    await attendreFiche()

    expect(screen.queryByRole('button', { name: 'Vérifier la fiche' })).not.toBeInTheDocument()
  })

  /**
   * #revalidation-web-informe : une revalidation suit désormais la même
   * chaîne de vérification qu'une fiche neuve (au lieu d'être validée
   * immédiatement) — l'administrateur qui l'examine doit donc pouvoir voir,
   * sur la fiche elle-même, qu'il s'agit d'une revalidation (déjà visible
   * sur la liste, ProspectionsPage, via une pastille dédiée).
   */
  it('affiche une pastille « Revalidation » quand la fiche revalide une autre fiche', async () => {
    renderPage('en_attente', { revalide_de_id: 'p0' })
    await attendreFiche()

    expect(screen.getByText('Revalidation')).toBeInTheDocument()
  })

  it("n'affiche pas de pastille « Revalidation » pour une fiche neuve", async () => {
    renderPage('en_attente', { revalide_de_id: null })
    await attendreFiche()

    expect(screen.queryByText('Revalidation')).not.toBeInTheDocument()
  })
})

describe('ProspectionDetailPage — chaque colonne de la base est affichée', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  /** Colonnes reprises par un autre élément (bandeau, tableaux, cartes enfants, jointures). */
  const AILLEURS = new Set([
    'populations',
    'captures',
    'infestations',
    'operations_aeriennes',
    'avertissements',
    'prospecteur_nom',
    'verified_by_nom',
    'validated_by_nom',
  ])

  it('rend une ligne pour chacune des colonnes de la table prospection', async () => {
    const fiche = ficheComplete()
    renderFiche(fiche)
    await attendreFiche()

    const manquantes = Object.keys(fiche).filter(
      (cle) => !AILLEURS.has(cle) && !document.querySelector(`[data-colonne="${cle}"]`),
    )
    expect(manquantes).toEqual([])
  })

  it('indique la table et la colonne d’origine en infobulle', async () => {
    renderFiche(ficheComplete())
    await attendreFiche()

    expect(colonne('surface_infestee')).toHaveAttribute('title', 'prospection.surface_infestee')
  })

  it('montre les valeurs stockées, sans conversion : hauteur d’herbe en cm, verdissement et verdissement %', async () => {
    renderFiche(ficheComplete())
    await attendreFiche()

    expect(colonne('hauteur_herbe_cm')).toHaveTextContent('35 cm')
    expect(colonne('verdissement')).toHaveTextContent('30')
    expect(colonne('verdissement_pourcent')).toHaveTextContent('40 %')
    expect(colonne('surface_infestee')).toHaveTextContent('12,5 ha')
    expect(colonne('altitude')).toHaveTextContent('812 m')
  })

  it('résout les références par leur nom : campagne, station, prospecteur, vérificateur, validateur', async () => {
    renderFiche(ficheComplete())
    await attendreFiche()

    await waitFor(() => expect(colonne('station_id')).toHaveTextContent('ST-014 Ankazoabo (PA-01)'))
    expect(colonne('campagne_id')).toHaveTextContent('Campagne 2026')
    expect(colonne('prospecteur_id')).toHaveTextContent('Randria Jean')
    expect(colonne('verified_by')).toHaveTextContent('Andria Paul')
    expect(colonne('validated_by')).toHaveTextContent('Rakoto Marie')
  })

  it('affiche la base principale et secondaire par leurs colonnes (et non un identifiant de lieu inexistant)', async () => {
    renderFiche(ficheComplete())
    await attendreFiche()

    expect(colonne('base')).toHaveTextContent('Base Betioky')
    expect(colonne('base_numero')).toHaveTextContent('3')
    expect(colonne('base_date_installation')).toHaveTextContent('2026-06-01')
    expect(colonne('base_latitude')).toHaveTextContent('-23,7')
    expect(colonne('base_secondaire')).toHaveTextContent('Base Ampanihy')
    expect(colonne('base_secondaire_longitude')).toHaveTextContent('44,7')
  })

  it('développe les JSONB `vegetation` et `sol` en entier', async () => {
    renderFiche(ficheComplete())
    await attendreFiche()

    const lignesVeg = Array.from(document.querySelectorAll('[data-colonne="vegetation"]')).map(
      (el) => el.textContent,
    )
    expect(lignesVeg.join(' | ')).toContain('Végétation › strates › herbacee › recouvrement')
    expect(lignesVeg.join(' | ')).toContain('40')
    expect(lignesVeg.join(' | ')).toContain('Végétation › sol nu')
    const lignesSol = Array.from(document.querySelectorAll('[data-colonne="sol"]')).map((el) => el.textContent)
    expect(lignesSol.join(' | ')).toContain('sableux, argileux')
    expect(lignesSol.join(' | ')).toContain('Sol › humidite')
  })

  it('atteste les tracés de signature enregistrés sans afficher le SVG brut', async () => {
    renderFiche(ficheComplete())
    await attendreFiche()

    expect(colonne('signature_pilote_image')).toHaveTextContent('Tracé enregistré (')
    expect(screen.queryByText('M0 0 L20 20')).not.toBeInTheDocument()
  })

  it('n’affiche aucun élément calculé ni aucun libellé de maquette absent de la base', async () => {
    renderFiche(ficheComplete())
    await attendreFiche()

    for (const invente of [
      /synthèse par phase/i,
      /Durée de comptage/i,
      /tables imago \/ larve distinctes/i,
      /Niveau d.alerte/i,
      'Répartition',
      'Vols clairs',
      'Essaims',
      'Localité',
      'Recouvrement',
      'Strate herbeuse',
      'Strate arborée',
    ]) {
      expect(screen.queryByText(invente), String(invente)).not.toBeInTheDocument()
    }
  })

  it('pour une fiche intensive, annonce les groupes propres à un autre type sans les afficher', async () => {
    renderFiche(ficheVide({ type_prospection: 'intensive', n_fiche: 'F-001' }))
    await attendreFiche()

    expect(screen.queryByText('Extensif aérien — équipe & aéronef')).not.toBeInTheDocument()
    expect(screen.getByText(/Colonnes sans valeur et propres à un autre type de fiche/)).toHaveTextContent(
      'Extensif aérien — équipe & aéronef',
    )
  })

  it('n’écarte jamais une donnée : une base renseignée sur une fiche intensive reste visible', async () => {
    renderFiche(ficheVide({ type_prospection: 'intensive', n_fiche: 'F-001', base: 'Base orpheline' }))
    await attendreFiche()

    expect(screen.getByText('Extensif aérien — base principale')).toBeInTheDocument()
    expect(colonne('base')).toHaveTextContent('Base orpheline')
  })
})

describe('ProspectionDetailPage — tables enfants', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('populations : une carte par ligne de prospection_population, avec toutes ses colonnes', async () => {
    renderFiche(ficheComplete())
    await attendreFiche()

    expect(screen.getByText('prospection_population · 2 lignes')).toBeInTheDocument()
    expect(screen.getByText('LMC · Imago')).toBeInTheDocument()
    expect(screen.getByText('NSE · Larve')).toBeInTheDocument()

    // Les colonnes de l'autre catégorie, toutes NULL, n'apparaissent pas ; celles de la catégorie oui.
    expect(screen.getAllByText('Imagos')).toHaveLength(1)
    expect(screen.getAllByText('Larves')).toHaveLength(1)

    const lignesStades = Array.from(document.querySelectorAll('[data-colonne="stades_imago"]')).map(
      (el) => el.textContent ?? '',
    )
    // Les stades à 0 sont des valeurs stockées : ils restent affichés.
    expect(lignesStades.some((t) => t.includes('femelleA1') && t.includes('3'))).toBe(true)
    expect(lignesStades.some((t) => t.includes('maleA1') && t.includes('0'))).toBe(true)
    expect(document.querySelectorAll('[data-colonne="temps_capture"]')).toHaveLength(2)
    expect(document.querySelectorAll('[data-colonne="essaim_observe"]')).toHaveLength(1)
  })

  it('infestations : toutes les lignes, chacune avec son sous-type', async () => {
    renderFiche(ficheComplete())
    await attendreFiche()

    expect(screen.getByText('prospection_infestation · 2 lignes')).toBeInTheDocument()
    expect(screen.getByText('Tache larvaire · LMC')).toBeInTheDocument()
    expect(screen.getByText('Vol clair · NSE')).toBeInTheDocument()
    expect(screen.getAllByText('Larve (tache / bande larvaire)')).toHaveLength(1)
    expect(screen.getAllByText('Imago (vol clair / essaim)')).toHaveLength(1)
    // Colonnes du socle commun + des deux sous-tables, présentes une fois par infestation concernée.
    expect(document.querySelectorAll('[data-colonne="vent_vitesse"]')).toHaveLength(2)
    expect(document.querySelectorAll('[data-colonne="front_longueur_m"]')).toHaveLength(1)
    expect(document.querySelectorAll('[data-colonne="densite_en_vol"]')).toHaveLength(1)
  })

  it('captures : les lignes brutes de prospection_capture, y compris un sexe NULL', async () => {
    renderFiche(ficheComplete())
    await attendreFiche()

    const section = screen.getByText('prospection_capture · 3 lignes').closest('section')!
    const lignes = within(section).getAllByRole('row')
    expect(lignes).toHaveLength(4) // en-tête + 3 lignes
    expect(within(section).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Identifiant',
      'Espèce',
      'Catégorie',
      'Sexe',
      'Phase',
      'Stade',
      'Effectif',
    ])
    // La ligne « larve » n'a pas de sexe : elle doit rester visible avec un tiret.
    const larve = within(section).getByText('cap-3').closest('tr')!
    expect(within(larve).getAllByRole('cell')[3]).toHaveTextContent('—')
    expect(within(larve).getAllByRole('cell')[6]).toHaveTextContent('9')
  })

  it('opérations aériennes : une colonne par colonne de la table', async () => {
    renderFiche(ficheComplete())
    await attendreFiche()

    const section = screen.getByText('prospection_operation_aerienne · 1 ligne').closest('section')!
    const entetes = within(section).getAllByRole('columnheader').map((h) => h.textContent)
    expect(entetes).toContain('Début — température')
    expect(entetes).toContain('Fin — vent')
    expect(entetes).toContain('Durée')
    const ligne = within(section).getAllByRole('row')[1]
    expect(ligne).toHaveTextContent('Convoyage vers la base')
    expect(ligne).toHaveTextContent('21,5 °C')
    expect(ligne).toHaveTextContent('45 min')
  })

  it('annonce une table sans ligne au lieu de la masquer', async () => {
    renderFiche(ficheVide({ n_fiche: 'F-001' }))
    await attendreFiche()

    expect(screen.getByText('prospection_population · 0 ligne')).toBeInTheDocument()
    expect(screen.getByText('prospection_infestation · 0 ligne')).toBeInTheDocument()
    expect(screen.getByText('prospection_capture · 0 ligne')).toBeInTheDocument()
    expect(screen.getByText('prospection_operation_aerienne · 0 ligne')).toBeInTheDocument()
  })
})

describe('ProspectionDetailPage — journal d’audit (table audit_log)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('affiche les entrées réelles, du plus ancien au plus récent, avec le contenu de `details`', async () => {
    renderFiche(ficheComplete({ statut: 'rejetee' }), {
      audit: [
        audit('b', 'rejet', '2026-07-05T10:00:00Z', 'u2', { commentaire: 'Photos manquantes' }),
        audit('a', 'creation', '2026-07-01T10:00:00Z', 'u1'),
      ],
    })
    await attendreFiche()

    expect(screen.getByText('Journal de validation')).toBeInTheDocument()
    expect(screen.getByText('audit_log')).toBeInTheDocument()
    const etapes = screen.getAllByRole('listitem').filter((li) => li.textContent?.match(/Création|Rejet/))
    expect(etapes[0]).toHaveTextContent('Création')
    expect(etapes[1]).toHaveTextContent('Rejet')
    expect(etapes[1]).toHaveTextContent('Andria Paul')
    expect(etapes[1]).toHaveTextContent('commentaire : Photos manquantes')
  })

  it('n’ajoute aucune étape « en attente » qui n’existe pas en base', async () => {
    renderFiche(ficheComplete({ statut: 'verifiee' }), {
      audit: [audit('a', 'creation', '2026-07-01T10:00:00Z')],
    })
    await attendreFiche()

    expect(screen.queryByText('Validation finale')).not.toBeInTheDocument()
    expect(screen.queryByText('en attente')).not.toBeInTheDocument()
    expect(screen.queryByText('Piste de validation')).not.toBeInTheDocument()
  })

  it('journal vide : le dit explicitement', async () => {
    renderFiche(ficheComplete())
    await attendreFiche()

    expect(screen.getByText("Aucune entrée dans le journal d'audit.")).toBeInTheDocument()
  })
})

describe('ProspectionDetailPage — onglets « Fiche » / « Données BDD »', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('ouvre sur « Fiche » : le gabarit du PDF est affiché dans un iframe isolé', async () => {
    renderPage('verifiee')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'F-001' })).toBeInTheDocument())

    expect(screen.getByRole('tab', { name: 'Fiche' })).toHaveAttribute('aria-selected', 'true')
    const cadre = await screen.findByTitle('Fiche de prospection F-001')
    expect(cadre).toHaveAttribute('srcdoc', FICHE_HTML)
    // Aucun script du document ne doit pouvoir s'exécuter.
    expect(cadre.getAttribute('sandbox')).not.toContain('allow-scripts')
    expect(mockedGet).toHaveBeenCalledWith('/prospections/p1/fiche-html', { responseType: 'text' })
    // Les cartes de la base ne sont pas affichées par défaut.
    expect(document.querySelector('[data-colonne="statut"]')).toBeNull()
  })

  it('« Données BDD » affiche les cartes de la base, « Fiche » ramène au tableau', async () => {
    renderPage('verifiee')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'F-001' })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('tab', { name: 'Données BDD' }))
    expect(screen.queryByTitle('Fiche de prospection F-001')).toBeNull()
    expect(colonne('statut')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Fiche' }))
    expect(await screen.findByTitle('Fiche de prospection F-001')).toBeInTheDocument()
  })

  it('garde les actions et le journal visibles sous les deux onglets', async () => {
    renderPage('verifiee')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'F-001' })).toBeInTheDocument())

    expect(screen.getByRole('button', { name: 'Valider la fiche' })).toBeInTheDocument()
    expect(screen.getByText('Journal de validation')).toBeInTheDocument()
  })

  it("signale une erreur claire quand la fiche ne peut pas être chargée", async () => {
    renderPage('verifiee')
    mockedGet.mockImplementation((url: string) =>
      url === '/prospections/p1/fiche-html'
        ? Promise.reject(new Error('500'))
        : Promise.resolve({ data: url === '/prospections/p1' ? ficheComplete({ statut: 'verifiee' }) : [] }),
    )
    await waitFor(() => expect(screen.getByRole('heading', { name: 'F-001' })).toBeInTheDocument())

    expect(await screen.findByText('Impossible de charger la fiche.')).toBeInTheDocument()
  })
})
