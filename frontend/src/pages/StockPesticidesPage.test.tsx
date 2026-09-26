import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { api } from '../api/client'
import { StockPesticidesPage } from './StockPesticidesPage'

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}))

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>
const mockedPost = api.post as unknown as ReturnType<typeof vi.fn>

const SITES = [
  { id: 's1', numero: 'IHO01', localite: 'Ihosy', parent_site_id: null, equipe_id: 'e1', actif: true },
  { id: 's2', numero: 'IHO02', localite: 'Ihosy Sud', parent_site_id: 's1', equipe_id: null, actif: true },
  { id: 's3', numero: 'BET01', localite: 'Betroka', parent_site_id: null, equipe_id: 'e2', actif: true },
  { id: 's4', numero: 'OLD01', localite: 'Ancien', parent_site_id: null, equipe_id: null, actif: false },
]
const PESTICIDES = [
  { id: 'p1', code: 'FEN-01', nom: 'Fenitrothion', actif: true },
  { id: 'p2', code: 'DEL-02', nom: 'Deltamethrine', actif: true },
  { id: 'p3', code: 'OLD-03', nom: 'Ancien produit', actif: false },
]

// Fenitrothion à Ihosy : 90 L et 40 kg (deux lignes, jamais additionnées) ; Deltamethrine à Betroka : -5 L.
const SOLDES = [
  { site_id: 's1', pesticide_id: 'p1', unite: 'L', quantite: 90 },
  { site_id: 's1', pesticide_id: 'p1', unite: 'kg', quantite: 40 },
  { site_id: 's3', pesticide_id: 'p2', unite: 'L', quantite: -5 },
]

const MOUVEMENTS = [
  {
    id: 'm3',
    type: 'consommation',
    pesticide_id: 'p1',
    site_id: 's1',
    site_destination_id: null,
    quantite: 10,
    unite: 'L',
    date_mouvement: '2026-09-02',
    created_at: '2026-09-02T10:00:00Z',
    traitement_id: 't1',
  },
  {
    id: 'm2',
    type: 'transfert',
    pesticide_id: 'p1',
    site_id: 's1',
    site_destination_id: 's3',
    quantite: 30,
    unite: 'L',
    date_mouvement: '2026-08-15',
    created_at: '2026-08-15T10:00:00Z',
    traitement_id: null,
  },
  {
    id: 'm1',
    type: 'approvisionnement',
    pesticide_id: 'p1',
    site_id: 's1',
    site_destination_id: null,
    quantite: 130.5,
    unite: 'L',
    date_mouvement: '2026-08-01',
    created_at: '2026-08-01T10:00:00Z',
    traitement_id: null,
  },
]

function erreurHttp(status: number, detail: unknown) {
  const err = new Error(String(status)) as Error & { response: { status: number; data: { detail: unknown } } }
  err.response = { status, data: { detail } }
  return err
}

function mockApi({ role = 'admin', mouvements = MOUVEMENTS, soldes = SOLDES }: { role?: string; mouvements?: unknown[]; soldes?: unknown[] } = {}) {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/users/me') return Promise.resolve({ data: { id: 'u1', nom: 'Test', role } })
    if (url === '/sites-aeriens') return Promise.resolve({ data: SITES })
    if (url === '/pesticides') return Promise.resolve({ data: PESTICIDES })
    if (url === '/stock-pesticide/solde') return Promise.resolve({ data: soldes })
    if (url === '/mouvements-pesticide') return Promise.resolve({ data: mouvements })
    if (url === '/traitements') return Promise.resolve({ data: [{ id: 't1', numero_fiche: 'TRT-AER-2026-09-02-001' }] })
    return Promise.resolve({ data: [] })
  })
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <StockPesticidesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** Dernier appel de `api.get(url, …)` et ses paramètres. */
function derniersParametres(url: string) {
  const appels = mockedGet.mock.calls.filter(([u]) => u === url)
  return appels[appels.length - 1]?.[1]?.params
}

describe('StockPesticidesPage — stock de pesticides (#606, #609)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('soldes', () => {
    it('une ligne par site, produit et unité : le litre et le kilo ne sont pas additionnés', async () => {
      mockApi()
      renderPage()

      const section = await screen.findByRole('region', { name: 'Soldes' })
      await within(section).findByText('90 L')
      const lignes = within(section).getAllByRole('row').slice(1)
      expect(lignes).toHaveLength(3)
      // Tri par site : BET01 avant IHO01 ; puis kg avant L sur IHO01 / Fenitrothion.
      expect(within(lignes[0]).getByText('BET01 — Betroka')).toBeInTheDocument()
      expect(within(lignes[1]).getByText('40 kg')).toBeInTheDocument()
      expect(within(lignes[2]).getByText('90 L')).toBeInTheDocument()
      expect(within(section).queryByText('130 L')).not.toBeInTheDocument()
      expect(within(section).queryByText('130 kg')).not.toBeInTheDocument()
    })

    it('affiche le produit (code et nom) et le site (numéro et localité)', async () => {
      mockApi()
      renderPage()

      const section = await screen.findByRole('region', { name: 'Soldes' })
      const ligne = (await within(section).findByText('90 L')).closest('tr')!
      expect(within(ligne).getByText('IHO01 — Ihosy')).toBeInTheDocument()
      expect(within(ligne).getByText('FEN-01 — Fenitrothion')).toBeInTheDocument()
    })

    it('signale un solde négatif', async () => {
      mockApi()
      renderPage()

      const section = await screen.findByRole('region', { name: 'Soldes' })
      const ligne = (await within(section).findByText('DEL-02 — Deltamethrine')).closest('tr')!
      expect(within(ligne).getByText('-5 L')).toBeInTheDocument()
      expect(within(ligne).getByText('négatif')).toBeInTheDocument()
      const ligneOk = within(section).getByText('90 L').closest('tr')!
      expect(within(ligneOk).queryByText('négatif')).not.toBeInTheDocument()
    })

    it('un état vide explicite quand aucun stock n’est enregistré', async () => {
      mockApi({ soldes: [] })
      renderPage()

      expect(await screen.findByText('Aucun stock enregistré.')).toBeInTheDocument()
    })

    it('affiche une bannière d’erreur si les soldes ne peuvent pas être chargés', async () => {
      mockedGet.mockImplementation((url: string) => {
        if (url === '/stock-pesticide/solde') return Promise.reject(erreurHttp(500, 'panne serveur'))
        return Promise.resolve({ data: [] })
      })
      renderPage()

      expect(await screen.findByText('panne serveur')).toBeInTheDocument()
    })
  })

  describe('journal des mouvements', () => {
    it('liste les mouvements : date, type, produit, site, quantité et origine', async () => {
      mockApi()
      renderPage()

      const section = await screen.findByRole('region', { name: 'Journal des mouvements' })
      await within(section).findByText('2026-09-02')
      const lignes = within(section).getAllByRole('row').slice(1)
      expect(lignes).toHaveLength(3)

      const transfert = lignes[1]
      expect(within(transfert).getByText('Transfert')).toBeInTheDocument()
      expect(within(transfert).getByText('IHO01 — Ihosy → BET01 — Betroka')).toBeInTheDocument()
      expect(within(transfert).getByText('30 L')).toBeInTheDocument()
      expect(within(transfert).getByText('Saisie manuelle')).toBeInTheDocument()

      const appro = lignes[2]
      expect(within(appro).getByText('Approvisionnement')).toBeInTheDocument()
      expect(within(appro).getByText('130,5 L')).toBeInTheDocument()
    })

    it('une consommation renvoie vers la fiche de traitement qui l’a générée', async () => {
      mockApi()
      renderPage()

      const lien = await screen.findByRole('link', { name: 'TRT-AER-2026-09-02-001' })
      expect(lien).toHaveAttribute('href', '/traitements/t1')
      const ligne = lien.closest('tr')!
      expect(within(ligne).getByText('Consommation')).toBeInTheDocument()
    })

    it('affiche le nombre de mouvements', async () => {
      mockApi()
      renderPage()

      await screen.findByText('2026-09-02')
      expect(screen.getByTestId('nb-mouvements')).toHaveTextContent('3 mouvements')
    })

    it('ne charge pas la liste des traitements tant qu’aucune consommation ne l’exige', async () => {
      mockApi({ mouvements: [MOUVEMENTS[2]] })
      renderPage()

      await screen.findByText('2026-08-01')
      expect(mockedGet).not.toHaveBeenCalledWith('/traitements')
    })

    it('états vides : aucun mouvement, puis aucun mouvement pour ces filtres', async () => {
      mockApi({ mouvements: [] })
      renderPage()

      expect(await screen.findByText('Aucun mouvement enregistré.')).toBeInTheDocument()
      fireEvent.change(screen.getByLabelText('Type de mouvement'), { target: { value: 'transfert' } })
      expect(await screen.findByText('Aucun mouvement ne correspond à ces filtres.')).toBeInTheDocument()
    })

    it('affiche une bannière d’erreur si le journal ne peut pas être chargé', async () => {
      mockedGet.mockImplementation((url: string) => {
        if (url === '/mouvements-pesticide') return Promise.reject(erreurHttp(500, 'journal indisponible'))
        return Promise.resolve({ data: [] })
      })
      renderPage()

      expect(await screen.findByText('journal indisponible')).toBeInTheDocument()
    })
  })

  describe('filtres', () => {
    it('le type filtre le journal, pas les soldes', async () => {
      mockApi()
      renderPage()
      await screen.findByText('2026-09-02')

      fireEvent.change(screen.getByLabelText('Type de mouvement'), { target: { value: 'consommation' } })

      await waitFor(() => expect(derniersParametres('/mouvements-pesticide')).toEqual({ type: 'consommation' }))
      expect(derniersParametres('/stock-pesticide/solde')).toEqual({})
    })

    it('le site et le produit filtrent les soldes ET le journal', async () => {
      mockApi()
      renderPage()
      await screen.findByText('2026-09-02')

      fireEvent.change(screen.getByLabelText('Site'), { target: { value: 's1' } })
      fireEvent.change(screen.getByLabelText('Produit'), { target: { value: 'p1' } })

      await waitFor(() =>
        expect(derniersParametres('/mouvements-pesticide')).toEqual({ site_id: 's1', pesticide_id: 'p1' }),
      )
      expect(derniersParametres('/stock-pesticide/solde')).toEqual({ site_id: 's1', pesticide_id: 'p1' })
    })

    it('la période filtre le journal (bornes Du / Au)', async () => {
      mockApi()
      renderPage()
      await screen.findByText('2026-09-02')

      fireEvent.change(screen.getByLabelText('Du'), { target: { value: '2026-08-10' } })
      fireEvent.change(screen.getByLabelText('Au'), { target: { value: '2026-08-31' } })

      await waitFor(() =>
        expect(derniersParametres('/mouvements-pesticide')).toEqual({ date_debut: '2026-08-10', date_fin: '2026-08-31' }),
      )
    })

    it('le filtre de site ne propose que les sites principaux', async () => {
      mockApi()
      renderPage()
      await screen.findByText('2026-09-02')

      const select = screen.getByLabelText('Site')
      expect(within(select).getByText('IHO01 — Ihosy')).toBeInTheDocument()
      expect(within(select).getByText('BET01 — Betroka')).toBeInTheDocument()
      expect(within(select).queryByText('IHO02 — Ihosy Sud')).not.toBeInTheDocument() // stand
    })

    it('« Réinitialiser » n’apparaît qu’avec un filtre actif et remet tous les paramètres à vide', async () => {
      mockApi()
      renderPage()
      await screen.findByText('2026-09-02')
      expect(screen.queryByRole('button', { name: 'Réinitialiser' })).not.toBeInTheDocument()

      fireEvent.change(screen.getByLabelText('Type de mouvement'), { target: { value: 'transfert' } })
      fireEvent.click(await screen.findByRole('button', { name: 'Réinitialiser' }))

      await waitFor(() => expect(derniersParametres('/mouvements-pesticide')).toEqual({}))
      expect(screen.queryByRole('button', { name: 'Réinitialiser' })).not.toBeInTheDocument()
    })
  })

  describe('saisie d’un approvisionnement / transfert', () => {
    it('le bouton n’est proposé qu’aux profils autorisés par le backend (admin, chef de base)', async () => {
      mockApi({ role: 'admin' })
      const { unmount } = renderPage()
      expect(await screen.findByRole('button', { name: '+ Nouveau mouvement' })).toBeInTheDocument()
      unmount()

      mockApi({ role: 'chef_de_base' })
      const second = renderPage()
      expect(await screen.findByRole('button', { name: '+ Nouveau mouvement' })).toBeInTheDocument()
      second.unmount()

      mockApi({ role: 'chef' })
      renderPage()
      await screen.findByText('2026-09-02')
      expect(screen.queryByRole('button', { name: '+ Nouveau mouvement' })).not.toBeInTheDocument()
    })

    async function ouvrirFormulaire() {
      fireEvent.click(await screen.findByRole('button', { name: '+ Nouveau mouvement' }))
      await screen.findByRole('heading', { name: 'Nouveau mouvement de stock' })
    }

    it('enregistre un approvisionnement et relit les soldes et le journal', async () => {
      mockApi()
      mockedPost.mockResolvedValue({ data: { id: 'm9' } })
      renderPage()
      await screen.findByText('2026-09-02')
      const appelsSoldeAvant = mockedGet.mock.calls.filter(([u]) => u === '/stock-pesticide/solde').length

      await ouvrirFormulaire()
      fireEvent.change(screen.getByLabelText('Produit *'), { target: { value: 'p1' } })
      fireEvent.change(screen.getByLabelText('Site *'), { target: { value: 's1' } })
      fireEvent.change(screen.getByLabelText('Quantité *'), { target: { value: '250,5' } })
      fireEvent.change(screen.getByLabelText('Unité *'), { target: { value: 'kg' } })
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

      await waitFor(() =>
        expect(mockedPost).toHaveBeenCalledWith('/mouvements-pesticide', {
          type: 'approvisionnement',
          pesticide_id: 'p1',
          site_id: 's1',
          quantite: 250.5,
          unite: 'kg',
        }),
      )
      // La modale se referme et les soldes sont relus.
      await waitFor(() => expect(screen.queryByRole('heading', { name: 'Nouveau mouvement de stock' })).not.toBeInTheDocument())
      await waitFor(() =>
        expect(mockedGet.mock.calls.filter(([u]) => u === '/stock-pesticide/solde').length).toBeGreaterThan(appelsSoldeAvant),
      )
    })

    it('enregistre un transfert avec sa destination et une date', async () => {
      mockApi()
      mockedPost.mockResolvedValue({ data: { id: 'm9' } })
      renderPage()
      await ouvrirFormulaire()

      fireEvent.change(screen.getByLabelText('Type *'), { target: { value: 'transfert' } })
      fireEvent.change(screen.getByLabelText('Produit *'), { target: { value: 'p2' } })
      fireEvent.change(screen.getByLabelText('Site source *'), { target: { value: 's1' } })
      fireEvent.change(screen.getByLabelText('Site de destination *'), { target: { value: 's3' } })
      fireEvent.change(screen.getByLabelText('Quantité *'), { target: { value: '30' } })
      fireEvent.change(screen.getByLabelText('Date (facultatif)'), { target: { value: '2026-09-10' } })
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

      await waitFor(() =>
        expect(mockedPost).toHaveBeenCalledWith('/mouvements-pesticide', {
          type: 'transfert',
          pesticide_id: 'p2',
          site_id: 's1',
          site_destination_id: 's3',
          quantite: 30,
          unite: 'L',
          date_mouvement: '2026-09-10',
        }),
      )
    })

    it('le site de destination n’apparaît que pour un transfert, et ne propose ni la source ni un stand', async () => {
      mockApi()
      renderPage()
      await ouvrirFormulaire()
      expect(screen.queryByLabelText('Site de destination *')).not.toBeInTheDocument()

      fireEvent.change(screen.getByLabelText('Type *'), { target: { value: 'transfert' } })
      fireEvent.change(screen.getByLabelText('Site source *'), { target: { value: 's1' } })
      const destination = screen.getByLabelText('Site de destination *')
      expect(within(destination).getByText('BET01 — Betroka')).toBeInTheDocument()
      expect(within(destination).queryByText('IHO01 — Ihosy')).not.toBeInTheDocument() // la source
      expect(within(destination).queryByText('IHO02 — Ihosy Sud')).not.toBeInTheDocument() // un stand
      expect(within(destination).queryByText('OLD01 — Ancien')).not.toBeInTheDocument() // inactif
    })

    it('ne propose que des produits actifs et des sites principaux actifs', async () => {
      mockApi()
      renderPage()
      await ouvrirFormulaire()

      const produit = screen.getByLabelText('Produit *')
      expect(within(produit).getByText('FEN-01 — Fenitrothion')).toBeInTheDocument()
      expect(within(produit).queryByText('OLD-03 — Ancien produit')).not.toBeInTheDocument()
      const site = screen.getByLabelText('Site *')
      expect(within(site).getByText('BET01 — Betroka')).toBeInTheDocument()
      expect(within(site).queryByText('IHO02 — Ihosy Sud')).not.toBeInTheDocument()
      expect(within(site).queryByText('OLD01 — Ancien')).not.toBeInTheDocument()
    })

    it('erreurs de saisie lisibles, sans appel au serveur', async () => {
      mockApi()
      renderPage()
      await ouvrirFormulaire()

      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

      const alerte = await screen.findByRole('alert')
      expect(within(alerte).getByText('Choisissez le produit.')).toBeInTheDocument()
      expect(within(alerte).getByText('Choisissez le site.')).toBeInTheDocument()
      expect(within(alerte).getByText('La quantité doit être un nombre supérieur à 0.')).toBeInTheDocument()
      expect(mockedPost).not.toHaveBeenCalled()
    })

    it('un transfert sans destination est refusé avant l’envoi', async () => {
      mockApi()
      renderPage()
      await ouvrirFormulaire()

      fireEvent.change(screen.getByLabelText('Type *'), { target: { value: 'transfert' } })
      fireEvent.change(screen.getByLabelText('Produit *'), { target: { value: 'p1' } })
      fireEvent.change(screen.getByLabelText('Site source *'), { target: { value: 's1' } })
      fireEvent.change(screen.getByLabelText('Quantité *'), { target: { value: '10' } })
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

      expect(await screen.findByText('Choisissez le site de destination.')).toBeInTheDocument()
      expect(mockedPost).not.toHaveBeenCalled()
    })

    it('un refus du serveur (site non principal) s’affiche lisiblement, la modale reste ouverte', async () => {
      mockApi()
      mockedPost.mockRejectedValue(
        erreurHttp(422, "le stock de pesticides est rattaché au site aérien principal : s2 n'en est pas un"),
      )
      renderPage()
      await ouvrirFormulaire()

      fireEvent.change(screen.getByLabelText('Produit *'), { target: { value: 'p1' } })
      fireEvent.change(screen.getByLabelText('Site *'), { target: { value: 's1' } })
      fireEvent.change(screen.getByLabelText('Quantité *'), { target: { value: '10' } })
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

      expect(
        await screen.findByText('Le stock est tenu au niveau des sites principaux : ce site est un stand ou une base secondaire.'),
      ).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Nouveau mouvement de stock' })).toBeInTheDocument()
    })

    it('un refus de droits (403) s’affiche lisiblement', async () => {
      mockApi()
      mockedPost.mockRejectedValue(erreurHttp(403, 'Réservé aux chefs de base et aux administrateurs'))
      renderPage()
      await ouvrirFormulaire()

      fireEvent.change(screen.getByLabelText('Produit *'), { target: { value: 'p1' } })
      fireEvent.change(screen.getByLabelText('Site *'), { target: { value: 's1' } })
      fireEvent.change(screen.getByLabelText('Quantité *'), { target: { value: '10' } })
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

      expect(
        await screen.findByText('Seuls les chefs de base et les administrateurs peuvent enregistrer un mouvement de stock.'),
      ).toBeInTheDocument()
    })

    it('Annuler ferme la modale sans rien envoyer', async () => {
      mockApi()
      renderPage()
      await ouvrirFormulaire()

      fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))

      expect(screen.queryByRole('heading', { name: 'Nouveau mouvement de stock' })).not.toBeInTheDocument()
      expect(mockedPost).not.toHaveBeenCalled()
    })

    it('la consommation n’est pas saisissable : elle vient des rotations d’une fiche', async () => {
      mockApi()
      renderPage()
      await ouvrirFormulaire()

      const type = screen.getByLabelText('Type *')
      expect(within(type).getByText('Approvisionnement')).toBeInTheDocument()
      expect(within(type).getByText('Transfert')).toBeInTheDocument()
      expect(within(type).queryByText('Consommation')).not.toBeInTheDocument()
    })
  })
})
