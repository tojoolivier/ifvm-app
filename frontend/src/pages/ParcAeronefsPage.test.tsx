import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { api } from '../api/client'
import { ParcAeronefsPage } from './ParcAeronefsPage'

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}))

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>
const mockedPost = api.post as unknown as ReturnType<typeof vi.fn>
const mockedPut = api.put as unknown as ReturnType<typeof vi.fn>

const AERONEF_A = { id: 'a1', immatriculation: '5R-MJA', societe: 'Heli Madagascar', volume_cuve_l: 800, actif: true }
const AERONEF_B = { id: 'a2', immatriculation: '5R-MJB', societe: 'Heli Madagascar', volume_cuve_l: 950, actif: true }
const AERONEF_INACTIF = { id: 'a3', immatriculation: '5R-MJC', societe: 'Vieux Heli', volume_cuve_l: 600, actif: false }

const EQUIPE_IHOSY = { id: 'e1', nom: 'Équipe Ihosy', type: 'aerien', actif: true, membres: [], aeronef: AERONEF_A }
const EQUIPE_BETROKA = { id: 'e2', nom: 'Équipe Betroka', type: 'aerien', actif: true, membres: [], aeronef: null }
const EQUIPE_ETEINTE = { id: 'e3', nom: 'Équipe éteinte', type: 'aerien', actif: false, membres: [], aeronef: null }

// Historique de A : en cours dans Ihosy depuis juillet, avant chez Betroka en juin.
const AFFECTATIONS_A = [
  { id: 'aff-2', equipe_id: 'e1', aeronef_id: 'a1', date_debut: '2026-07-01', date_fin: null, aeronef: AERONEF_A },
  { id: 'aff-1', equipe_id: 'e2', aeronef_id: 'a1', date_debut: '2026-06-01', date_fin: '2026-07-01', aeronef: AERONEF_A },
]
// Historique d'Ihosy : A en cours, B avant.
const AFFECTATIONS_IHOSY = [
  { id: 'aff-2', equipe_id: 'e1', aeronef_id: 'a1', date_debut: '2026-07-01', date_fin: null, aeronef: AERONEF_A },
  { id: 'aff-3', equipe_id: 'e1', aeronef_id: 'a2', date_debut: '2026-05-01', date_fin: '2026-07-01', aeronef: AERONEF_B },
]

function erreurHttp(status: number, detail: string) {
  const err = new Error(String(status)) as Error & { response: { status: number; data: { detail: string } } }
  err.response = { status, data: { detail } }
  return err
}

function mockApi({
  role = 'admin',
  aeronefs = [AERONEF_A, AERONEF_B, AERONEF_INACTIF],
  equipes = [EQUIPE_IHOSY, EQUIPE_BETROKA, EQUIPE_ETEINTE],
}: { role?: string; aeronefs?: unknown[]; equipes?: unknown[] } = {}) {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/users/me') return Promise.resolve({ data: { id: 'u1', nom: 'Test', role } })
    if (url === '/aeronefs') return Promise.resolve({ data: aeronefs })
    if (url === '/equipes') return Promise.resolve({ data: equipes })
    if (url === '/aeronefs/a1/affectations') return Promise.resolve({ data: AFFECTATIONS_A })
    if (url === '/equipes/e1/aeronefs') return Promise.resolve({ data: AFFECTATIONS_IHOSY })
    return Promise.resolve({ data: [] })
  })
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ParcAeronefsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function ouvrirHistoriqueAppareil(immatriculation = '5R-MJA') {
  await screen.findByText(immatriculation)
  fireEvent.click(screen.getByRole('button', { name: `Historique de l'appareil ${immatriculation}` }))
}

describe('ParcAeronefsPage — parc aéronefs (#621, #603)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('liste', () => {
    it('liste les appareils avec société, cuve, équipe du jour et état', async () => {
      mockApi()
      renderPage()

      await screen.findByText('5R-MJA')
      const ligneA = screen.getByText('5R-MJA').closest('tr')!
      expect(within(ligneA).getByText('Heli Madagascar')).toBeInTheDocument()
      expect(within(ligneA).getByText('800')).toBeInTheDocument()
      expect(within(ligneA).getByText('Équipe Ihosy')).toBeInTheDocument()
      expect(within(ligneA).getByText('En service')).toBeInTheDocument()

      const ligneB = screen.getByText('5R-MJB').closest('tr')!
      expect(within(ligneB).getByText('Libre')).toBeInTheDocument()

      const ligneC = screen.getByText('5R-MJC').closest('tr')!
      expect(within(ligneC).getByText('Inactif')).toBeInTheDocument()
    })

    it('demande au serveur les appareils actifs et inactifs', async () => {
      mockApi()
      renderPage()

      await screen.findByText('5R-MJA')
      expect(mockedGet).toHaveBeenCalledWith('/aeronefs', { params: { inclure_inactifs: true } })
    })

    it('affiche un état vide quand le parc est vide', async () => {
      mockApi({ aeronefs: [] })
      renderPage()

      expect(await screen.findByText('Aucun appareil au parc.')).toBeInTheDocument()
    })

    it('affiche une bannière d’erreur quand le parc ne peut pas être chargé', async () => {
      mockedGet.mockImplementation((url: string) => {
        if (url === '/aeronefs') return Promise.reject(erreurHttp(500, 'panne serveur'))
        return Promise.resolve({ data: [] })
      })
      renderPage()

      expect(await screen.findByText('panne serveur')).toBeInTheDocument()
    })
  })

  describe('droits : appareils réservés à l’administrateur', () => {
    it('l’administrateur voit « + Nouvel appareil », « Modifier » et « Désactiver »', async () => {
      mockApi({ role: 'admin' })
      renderPage()

      await ouvrirHistoriqueAppareil()
      expect(await screen.findByRole('button', { name: '+ Nouvel appareil' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Modifier' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Désactiver' })).toBeInTheDocument()
    })

    it('le profil chef consulte et affecte, mais ne peut ni créer, ni modifier, ni désactiver', async () => {
      mockApi({ role: 'chef' })
      renderPage()

      await ouvrirHistoriqueAppareil()
      await screen.findByText('Historique des affectations')
      expect(screen.queryByRole('button', { name: '+ Nouvel appareil' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Modifier' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Désactiver' })).not.toBeInTheDocument()
      // L'affectation reste ouverte à ce profil.
      expect(screen.getByRole('button', { name: 'Affecter' })).toBeInTheDocument()
    })
  })

  describe('création, modification, désactivation (admin)', () => {
    it('crée un appareil', async () => {
      mockApi()
      mockedPost.mockResolvedValue({ data: { ...AERONEF_B, id: 'a9', immatriculation: '5R-NEW' } })
      renderPage()

      await screen.findByText('5R-MJA')
      fireEvent.click(await screen.findByRole('button', { name: '+ Nouvel appareil' }))
      fireEvent.change(screen.getByLabelText('Immatriculation *'), { target: { value: '  5R-NEW ' } })
      fireEvent.change(screen.getByLabelText('Société *'), { target: { value: 'Heli Sud' } })
      fireEvent.change(screen.getByLabelText('Volume de cuve (L) *'), { target: { value: '1 000'.replace(' ', '') } })
      fireEvent.click(screen.getByRole('button', { name: 'Créer' }))

      await waitFor(() =>
        expect(mockedPost).toHaveBeenCalledWith('/aeronefs', {
          immatriculation: '5R-NEW',
          societe: 'Heli Sud',
          volume_cuve_l: 1000,
        }),
      )
      // La modale se referme.
      await waitFor(() => expect(screen.queryByLabelText('Immatriculation *')).not.toBeInTheDocument())
    })

    it('immatriculation en double : un message lisible, la modale reste ouverte', async () => {
      mockApi()
      mockedPost.mockRejectedValue(erreurHttp(409, 'immatriculation déjà utilisée par un autre aéronef : 5R-MJA'))
      renderPage()

      await screen.findByText('5R-MJA')
      fireEvent.click(await screen.findByRole('button', { name: '+ Nouvel appareil' }))
      fireEvent.change(screen.getByLabelText('Immatriculation *'), { target: { value: '5R-MJA' } })
      fireEvent.change(screen.getByLabelText('Société *'), { target: { value: 'Heli Sud' } })
      fireEvent.change(screen.getByLabelText('Volume de cuve (L) *'), { target: { value: '800' } })
      fireEvent.click(screen.getByRole('button', { name: 'Créer' }))

      expect(
        await screen.findByText("L'immatriculation « 5R-MJA » est déjà utilisée par un autre appareil du parc."),
      ).toBeInTheDocument()
      expect(screen.getByLabelText('Immatriculation *')).toHaveValue('5R-MJA')
    })

    it('modifie un appareil : le formulaire est prérempli', async () => {
      mockApi()
      mockedPut.mockResolvedValue({ data: { ...AERONEF_A, volume_cuve_l: 900 } })
      renderPage()

      await ouvrirHistoriqueAppareil()
      fireEvent.click(await screen.findByRole('button', { name: 'Modifier' }))

      expect(screen.getByLabelText('Immatriculation *')).toHaveValue('5R-MJA')
      expect(screen.getByLabelText('Société *')).toHaveValue('Heli Madagascar')
      expect(screen.getByLabelText('Volume de cuve (L) *')).toHaveValue(800)
      fireEvent.change(screen.getByLabelText('Volume de cuve (L) *'), { target: { value: '900' } })
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

      await waitFor(() =>
        expect(mockedPut).toHaveBeenCalledWith('/aeronefs/a1', {
          immatriculation: '5R-MJA',
          societe: 'Heli Madagascar',
          volume_cuve_l: 900,
        }),
      )
    })

    it('renommer vers une immatriculation déjà prise affiche le message de doublon', async () => {
      mockApi()
      mockedPut.mockRejectedValue(erreurHttp(409, 'immatriculation déjà utilisée par un autre aéronef : 5R-MJB'))
      renderPage()

      await ouvrirHistoriqueAppareil()
      fireEvent.click(await screen.findByRole('button', { name: 'Modifier' }))
      fireEvent.change(screen.getByLabelText('Immatriculation *'), { target: { value: '5R-MJB' } })
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

      expect(
        await screen.findByText("L'immatriculation « 5R-MJB » est déjà utilisée par un autre appareil du parc."),
      ).toBeInTheDocument()
    })

    it('désactive un appareil (actif = false), sans le supprimer', async () => {
      mockApi()
      mockedPut.mockResolvedValue({ data: { ...AERONEF_A, actif: false } })
      renderPage()

      await ouvrirHistoriqueAppareil()
      fireEvent.click(await screen.findByRole('button', { name: 'Désactiver' }))

      await waitFor(() => expect(mockedPut).toHaveBeenCalledWith('/aeronefs/a1', { actif: false }))
    })

    it('réactive un appareil inactif, et bloque son affectation tant qu’il est inactif', async () => {
      mockApi()
      mockedPut.mockResolvedValue({ data: { ...AERONEF_INACTIF, actif: true } })
      renderPage()

      await ouvrirHistoriqueAppareil('5R-MJC')
      expect(await screen.findByText(/Cet appareil est inactif/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Affecter' })).toBeDisabled()

      fireEvent.click(screen.getByRole('button', { name: 'Réactiver' }))
      await waitFor(() => expect(mockedPut).toHaveBeenCalledWith('/aeronefs/a3', { actif: true }))
    })
  })

  describe('historique côté appareil', () => {
    it('affiche la frise des équipes qui ont utilisé l’appareil, avec l’affectation en cours', async () => {
      mockApi()
      renderPage()

      await ouvrirHistoriqueAppareil()

      const liste = await screen.findByRole('list', { name: "Historique des affectations de l'appareil" })
      const lignes = within(liste).getAllByTestId('frise-ligne')
      expect(lignes).toHaveLength(2)
      expect(within(lignes[0]).getByText('Équipe Ihosy')).toBeInTheDocument()
      expect(within(lignes[0]).getByText('En cours')).toBeInTheDocument()
      expect(within(lignes[1]).getByText('Équipe Betroka')).toBeInTheDocument()
      expect(within(lignes[1]).getByText('Du 01/06/2026 au 01/07/2026')).toBeInTheDocument()
      expect(mockedGet).toHaveBeenCalledWith('/aeronefs/a1/affectations')
    })

    it('un appareil jamais affecté le dit', async () => {
      mockApi()
      renderPage()

      await ouvrirHistoriqueAppareil('5R-MJB')

      expect(await screen.findByText("Cet appareil n'a encore été affecté à aucune équipe.")).toBeInTheDocument()
    })
  })

  describe('affecter et clore', () => {
    it('affecte l’appareil à une équipe, sans date de fin', async () => {
      mockApi()
      mockedPost.mockResolvedValue({ data: {} })
      renderPage()

      await ouvrirHistoriqueAppareil('5R-MJB')
      await screen.findByText("Cet appareil n'a encore été affecté à aucune équipe.")

      fireEvent.change(screen.getByLabelText('Équipe *'), { target: { value: 'e2' } })
      fireEvent.change(screen.getByLabelText('Date de début *'), { target: { value: '2026-08-01' } })
      fireEvent.click(screen.getByRole('button', { name: 'Affecter' }))

      await waitFor(() =>
        expect(mockedPost).toHaveBeenCalledWith('/equipes/e2/aeronefs', {
          aeronef_id: 'a2',
          date_debut: '2026-08-01',
        }),
      )
    })

    it('affecte l’appareil sur une période bornée (date de fin)', async () => {
      mockApi()
      mockedPost.mockResolvedValue({ data: {} })
      renderPage()

      await ouvrirHistoriqueAppareil('5R-MJB')
      await screen.findByText("Cet appareil n'a encore été affecté à aucune équipe.")

      fireEvent.change(screen.getByLabelText('Équipe *'), { target: { value: 'e2' } })
      fireEvent.change(screen.getByLabelText('Date de début *'), { target: { value: '2026-08-01' } })
      fireEvent.change(screen.getByLabelText('Date de fin (facultatif)'), { target: { value: '2026-08-31' } })
      fireEvent.click(screen.getByRole('button', { name: 'Affecter' }))

      await waitFor(() =>
        expect(mockedPost).toHaveBeenCalledWith('/equipes/e2/aeronefs', {
          aeronef_id: 'a2',
          date_debut: '2026-08-01',
          date_fin: '2026-08-31',
        }),
      )
    })

    it('ne propose que des équipes actives', async () => {
      mockApi()
      renderPage()

      await ouvrirHistoriqueAppareil('5R-MJB')
      const select = await screen.findByLabelText('Équipe *')

      expect(within(select).getByText('Équipe Ihosy')).toBeInTheDocument()
      expect(within(select).getByText('Équipe Betroka')).toBeInTheDocument()
      expect(within(select).queryByText('Équipe éteinte')).not.toBeInTheDocument()
    })

    it('chevauchement de périodes : un message lisible', async () => {
      mockApi()
      mockedPost.mockRejectedValue(
        erreurHttp(422, 'aéronef déjà affecté sur une période qui se chevauche : 5R-MJA'),
      )
      renderPage()

      await ouvrirHistoriqueAppareil()
      await screen.findByRole('list', { name: "Historique des affectations de l'appareil" })
      fireEvent.change(screen.getByLabelText('Équipe *'), { target: { value: 'e2' } })
      fireEvent.click(screen.getByRole('button', { name: 'Affecter' }))

      expect(
        await screen.findByText('Cet appareil est déjà affecté à une équipe sur une période qui chevauche celle-ci.'),
      ).toBeInTheDocument()
    })

    it('clôt l’affectation en cours à la date choisie', async () => {
      mockApi()
      mockedPut.mockResolvedValue({ data: {} })
      renderPage()

      await ouvrirHistoriqueAppareil()
      const liste = await screen.findByRole('list', { name: "Historique des affectations de l'appareil" })
      const [enCours, close] = within(liste).getAllByTestId('frise-ligne')
      // Seule l'affectation en cours peut être close.
      expect(within(close).queryByRole('button', { name: 'Clore' })).not.toBeInTheDocument()

      fireEvent.click(within(enCours).getByRole('button', { name: 'Clore' }))
      fireEvent.change(screen.getByLabelText("Date de fin de l'affectation"), { target: { value: '2026-09-15' } })
      fireEvent.click(screen.getByRole('button', { name: 'Confirmer la clôture' }))

      await waitFor(() =>
        expect(mockedPut).toHaveBeenCalledWith('/equipes/e1/aeronefs/aff-2', { date_fin: '2026-09-15' }),
      )
    })

    it('annuler la clôture ne fait aucun appel', async () => {
      mockApi()
      renderPage()

      await ouvrirHistoriqueAppareil()
      const liste = await screen.findByRole('list', { name: "Historique des affectations de l'appareil" })
      fireEvent.click(within(liste).getByRole('button', { name: 'Clore' }))
      fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))

      expect(screen.queryByLabelText("Date de fin de l'affectation")).not.toBeInTheDocument()
      expect(mockedPut).not.toHaveBeenCalled()
    })

    it('clôture avant le début : un message lisible', async () => {
      mockApi()
      mockedPut.mockRejectedValue(erreurHttp(422, "période d'affectation invalide : fin avant début"))
      renderPage()

      await ouvrirHistoriqueAppareil()
      const liste = await screen.findByRole('list', { name: "Historique des affectations de l'appareil" })
      fireEvent.click(within(liste).getByRole('button', { name: 'Clore' }))
      fireEvent.click(screen.getByRole('button', { name: 'Confirmer la clôture' }))

      expect(
        await screen.findByText(
          'Les dates ne sont pas valides : la date de fin doit être postérieure ou égale à la date de début.',
        ),
      ).toBeInTheDocument()
    })
  })

  describe('historique côté équipe', () => {
    async function ouvrirHistoriqueEquipe(nom = 'Équipe Ihosy') {
      await screen.findByText('5R-MJA')
      fireEvent.click(screen.getByRole('button', { name: 'Équipes' }))
      await screen.findByText(nom)
      fireEvent.click(screen.getByRole('button', { name: `Historique de l'équipe ${nom}` }))
    }

    it('bascule sur la vue Équipes : chaque équipe aérienne avec son appareil du jour', async () => {
      mockApi()
      renderPage()

      await screen.findByText('5R-MJA')
      fireEvent.click(screen.getByRole('button', { name: 'Équipes' }))

      const ligneIhosy = (await screen.findByText('Équipe Ihosy')).closest('tr')!
      expect(within(ligneIhosy).getByText('5R-MJA')).toBeInTheDocument()
      const ligneBetroka = screen.getByText('Équipe Betroka').closest('tr')!
      expect(within(ligneBetroka).getByText('Aucun')).toBeInTheDocument()
    })

    it('affiche la frise des appareils utilisés par l’équipe', async () => {
      mockApi()
      renderPage()

      await ouvrirHistoriqueEquipe()

      const liste = await screen.findByRole('list', { name: "Historique des appareils de l'équipe" })
      const lignes = within(liste).getAllByTestId('frise-ligne')
      expect(lignes).toHaveLength(2)
      expect(within(lignes[0]).getByText('5R-MJA')).toBeInTheDocument()
      expect(within(lignes[0]).getByText('En cours')).toBeInTheDocument()
      expect(within(lignes[1]).getByText('5R-MJB')).toBeInTheDocument()
      expect(within(lignes[1]).getByText('Du 01/05/2026 au 01/07/2026')).toBeInTheDocument()
      expect(mockedGet).toHaveBeenCalledWith('/equipes/e1/aeronefs')
    })

    it('affecte un appareil à l’équipe, parmi les appareils actifs', async () => {
      mockApi()
      mockedPost.mockResolvedValue({ data: {} })
      renderPage()

      await ouvrirHistoriqueEquipe()
      await screen.findByRole('list', { name: "Historique des appareils de l'équipe" })

      const select = screen.getByLabelText('Appareil *')
      expect(within(select).getByText('5R-MJB — Heli Madagascar')).toBeInTheDocument()
      expect(within(select).queryByText(/5R-MJC/)).not.toBeInTheDocument() // inactif
      fireEvent.change(select, { target: { value: 'a2' } })
      fireEvent.change(screen.getByLabelText('Date de début *'), { target: { value: '2026-09-01' } })
      fireEvent.click(screen.getByRole('button', { name: 'Affecter' }))

      await waitFor(() =>
        expect(mockedPost).toHaveBeenCalledWith('/equipes/e1/aeronefs', {
          aeronef_id: 'a2',
          date_debut: '2026-09-01',
        }),
      )
    })

    it('clôt l’affectation en cours depuis la vue équipe', async () => {
      mockApi()
      mockedPut.mockResolvedValue({ data: {} })
      renderPage()

      await ouvrirHistoriqueEquipe()
      const liste = await screen.findByRole('list', { name: "Historique des appareils de l'équipe" })
      fireEvent.click(within(liste).getByRole('button', { name: 'Clore' }))
      fireEvent.change(screen.getByLabelText("Date de fin de l'affectation"), { target: { value: '2026-09-20' } })
      fireEvent.click(screen.getByRole('button', { name: 'Confirmer la clôture' }))

      await waitFor(() =>
        expect(mockedPut).toHaveBeenCalledWith('/equipes/e1/aeronefs/aff-2', { date_fin: '2026-09-20' }),
      )
    })

    it('une équipe sans appareil le dit', async () => {
      mockApi()
      renderPage()

      await ouvrirHistoriqueEquipe('Équipe Betroka')

      expect(await screen.findByText("Cette équipe n'a encore utilisé aucun appareil.")).toBeInTheDocument()
    })
  })
})
