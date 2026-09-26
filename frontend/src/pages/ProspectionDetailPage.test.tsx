import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { api } from '../api/client'
import type { AuditBdd, ProspectionBdd } from '@/lib/prospection-fiche-bdd'
import { ficheComplete } from '@/test/prospection-fixtures'
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
  /** Réponse de `GET /equipes/eq-1` (équipe de la fiche). */
  equipe?: unknown
}

/** Rend la page pour une fiche donnée telle que l'API la renverrait. */
function renderFiche(fiche: ProspectionBdd, { role = 'validation_finale', audit = [], equipe }: Options = {}) {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/prospections/p1') return Promise.resolve({ data: fiche })
    if (url === '/prospections/p1/audit-log') return Promise.resolve({ data: audit })
    if (url === '/prospections/p1/fiche-html') return Promise.resolve({ data: FICHE_HTML })
    if (url === '/equipes/eq-1') return Promise.resolve({ data: equipe })
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

async function attendreFiche() {
  await waitFor(() => expect(screen.getByRole('heading', { name: 'F-001' })).toBeInTheDocument())
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
    expect(screen.getByText('Vérifiée')).toBeInTheDocument()
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

describe('ProspectionDetailPage — fiche de lecture en tableaux (comme le PDF)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('affiche directement le gabarit du PDF dans un iframe isolé, sans onglets', async () => {
    renderPage('verifiee')
    await attendreFiche()

    const cadre = await screen.findByTitle('Fiche de prospection F-001')
    expect(cadre).toHaveAttribute('srcdoc', FICHE_HTML)
    // Aucun script du document ne doit pouvoir s'exécuter.
    expect(cadre.getAttribute('sandbox')).not.toContain('allow-scripts')
    expect(mockedGet).toHaveBeenCalledWith('/prospections/p1/fiche-html', { responseType: 'text' })
    // Une seule vue : ni onglets, ni cartes « une par colonne de la base ».
    expect(screen.queryByRole('tab')).toBeNull()
    expect(document.querySelector('[data-colonne]')).toBeNull()
  })

  it('garde les actions du rôle et le journal à côté de la fiche', async () => {
    renderPage('verifiee')
    await attendreFiche()

    expect(screen.getByRole('button', { name: 'Valider la fiche' })).toBeInTheDocument()
    expect(screen.getByText('Journal de validation')).toBeInTheDocument()
  })

  it('annonce le code HTTP quand la fiche ne peut pas être chargée', async () => {
    renderPage('verifiee')
    mockedGet.mockImplementation((url: string) =>
      url === '/prospections/p1/fiche-html'
        ? Promise.reject({ response: { status: 404 } })
        : Promise.resolve({ data: url === '/prospections/p1' ? ficheComplete({ statut: 'verifiee' }) : [] }),
    )
    await attendreFiche()

    expect(await screen.findByText(/erreur 404/)).toBeInTheDocument()
    expect(screen.getByText(/le serveur est-il à jour/)).toBeInTheDocument()
  })

  it("reste explicite sans code HTTP (réseau coupé)", async () => {
    renderPage('verifiee')
    mockedGet.mockImplementation((url: string) =>
      url === '/prospections/p1/fiche-html'
        ? Promise.reject(new Error('Network Error'))
        : Promise.resolve({ data: url === '/prospections/p1' ? ficheComplete({ statut: 'verifiee' }) : [] }),
    )
    await attendreFiche()

    expect(await screen.findByText('Impossible de charger la fiche.')).toBeInTheDocument()
  })
})

// #602, #607 : l'équipe de la fiche est affichée, avec un lien vers l'équipe.
describe('ProspectionDetailPage — équipe de la fiche', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const EQUIPE = {
    id: 'eq-1',
    nom: 'Équipe Terrestre Ihosy',
    type: 'terrestre',
    membres: [{ user_id: 'chef-1', fonction: 'chef', nom: 'Rabe', prenom: 'Toky' }],
    actif: true,
  }

  it('affiche l’équipe avec un lien vers Administration > Équipes (profil chef)', async () => {
    renderFiche(ficheComplete({ statut: 'en_attente', equipe_id: 'eq-1' }), { role: 'chef', equipe: EQUIPE })
    await attendreFiche()

    const lien = await screen.findByRole('link', { name: 'Équipe Terrestre Ihosy' })
    expect(lien).toHaveAttribute('href', '/administration?section=equipes&equipe=eq-1')
    expect(screen.getByTestId('fiche-equipe')).toHaveTextContent('terrestre · chef Toky Rabe')
  })

  it('affiche seulement le nom, sans lien, pour un profil sans accès à l’Administration', async () => {
    renderFiche(ficheComplete({ statut: 'en_attente', equipe_id: 'eq-1' }), {
      role: 'verificateur',
      equipe: EQUIPE,
    })
    await attendreFiche()

    await waitFor(() => expect(screen.getByTestId('fiche-equipe')).toHaveTextContent('Équipe Terrestre Ihosy'))
    expect(screen.queryByRole('link', { name: 'Équipe Terrestre Ihosy' })).not.toBeInTheDocument()
  })

  it('indique « non renseignée » pour une fiche sans équipe', async () => {
    renderFiche(ficheComplete({ statut: 'en_attente', equipe_id: null }))
    await attendreFiche()

    expect(screen.getByTestId('fiche-equipe')).toHaveTextContent('Équipe : non renseignée')
  })
})
