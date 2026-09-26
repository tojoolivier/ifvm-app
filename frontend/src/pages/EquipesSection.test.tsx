import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { api } from '../api/client'
import { EquipesSection } from './EquipesSection'

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}))

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>
const mockedPost = api.post as unknown as ReturnType<typeof vi.fn>
const mockedPut = api.put as unknown as ReturnType<typeof vi.fn>

type Membre = { user_id: string; fonction: string; nom: string | null; prenom: string | null }
type EquipeMock = {
  id: string
  nom: string
  type: 'terrestre' | 'aerien'
  aeronef?: { id: string; immatriculation: string; societe: string; volume_cuve_l: number } | null
  membres: Membre[]
  actif: boolean
}

const CHEF_TERRESTRE_TOKY = { id: 'chef-1', nom: 'Rabe', prenom: 'Toky' }
const CHEF_TERRESTRE_LALA = { id: 'chef-2', nom: 'Rasoa', prenom: 'Lala' }
const CHEF_BASE_ZO = { id: 'cb-1', nom: 'Rakoto', prenom: 'Zo' }
const CHEF_BASE_NIRINA = { id: 'cb-2', nom: 'Andry', prenom: 'Nirina' }

// Référentiel unifié (ADR-018) : le chef est un membre `fonction: 'chef'`, les autres membres
// portent leur propre fonction.
const EQUIPE_TERRESTRE: EquipeMock = {
  id: 'equipe-t1',
  nom: 'Équipe Terrestre Ihosy',
  type: 'terrestre',
  membres: [
    { user_id: 'chef-1', fonction: 'chef', nom: 'Rabe', prenom: 'Toky' },
    { user_id: 'u-1', fonction: 'membre', nom: 'Voahangy', prenom: '' },
  ],
  actif: true,
}
const EQUIPE_AERIENNE: EquipeMock = {
  id: 'equipe-a1',
  nom: 'Équipe Aérienne Toliara',
  type: 'aerien',
  aeronef: { id: 'aeronef-1', immatriculation: '5R-MJA', societe: 'Heli Madagascar', volume_cuve_l: 800 },
  membres: [
    { user_id: 'cb-1', fonction: 'chef', nom: 'Rakoto', prenom: 'Zo' },
    { user_id: 'u-p1', fonction: 'pilote', nom: 'Rakoto', prenom: 'Jean' },
    { user_id: 'u-m1', fonction: 'mecanicien', nom: 'Andria', prenom: 'Paul' },
  ],
  actif: true,
}
const EQUIPE_INACTIVE: EquipeMock = {
  id: 'equipe-t2',
  nom: 'Équipe Terrestre Éteinte',
  type: 'terrestre',
  membres: [{ user_id: 'chef-x', fonction: 'chef', nom: 'Ancien', prenom: 'Chef' }],
  actif: false,
}

function mockApi({
  equipes = [EQUIPE_TERRESTRE, EQUIPE_AERIENNE],
  chefsEquipe = [CHEF_TERRESTRE_TOKY, CHEF_TERRESTRE_LALA],
  chefsDeBase = [CHEF_BASE_ZO, CHEF_BASE_NIRINA],
}: {
  equipes?: EquipeMock[]
  chefsEquipe?: (typeof CHEF_TERRESTRE_TOKY)[]
  chefsDeBase?: (typeof CHEF_BASE_ZO)[]
} = {}) {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/equipes') return Promise.resolve({ data: equipes })
    if (url === '/users/chefs-equipe') return Promise.resolve({ data: chefsEquipe })
    if (url === '/users/chefs-de-base') return Promise.resolve({ data: chefsDeBase })
    return Promise.resolve({ data: [] })
  })
}

function renderSection(props: { equipeSelectionneeId?: string | null } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <EquipesSection {...props} />
    </QueryClientProvider>,
  )
}

function saisirHelicoptere() {
  fireEvent.change(screen.getByLabelText('Immatriculation *'), { target: { value: '5R-MJA' } })
  fireEvent.change(screen.getByLabelText('Société *'), { target: { value: 'Heli Madagascar' } })
  fireEvent.change(screen.getByLabelText('Volume de cuve (L) *'), { target: { value: '800' } })
}

describe('EquipesSection — équipes unifiées (#602, #607)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('liste et filtre par type', () => {
    it('liste les équipes des deux types avec type, chef, membres (et leur fonction) et hélicoptère', async () => {
      mockApi()
      renderSection()

      await screen.findByText('Équipe Terrestre Ihosy')
      expect(screen.getByText('Équipe Aérienne Toliara')).toBeInTheDocument()
      // Chef de chaque équipe.
      expect(screen.getByText('Toky Rabe')).toBeInTheDocument()
      expect(screen.getByText('Zo Rakoto')).toBeInTheDocument()
      // Membres génériques, avec leur fonction.
      const ligneTerrestre = screen.getByText('Équipe Terrestre Ihosy').closest('tr')!
      expect(within(ligneTerrestre).getByText('Voahangy')).toBeInTheDocument()
      expect(within(ligneTerrestre).getByText('(Membre)')).toBeInTheDocument()
      const ligneAerienne = screen.getByText('Équipe Aérienne Toliara').closest('tr')!
      expect(within(ligneAerienne).getByText('Jean Rakoto')).toBeInTheDocument()
      expect(within(ligneAerienne).getByText('(Pilote)')).toBeInTheDocument()
      expect(within(ligneAerienne).getByText('Paul Andria')).toBeInTheDocument()
      expect(within(ligneAerienne).getByText('(Mécanicien)')).toBeInTheDocument()
      // Hélicoptère de l'équipe aérienne.
      expect(within(ligneAerienne).getByText('5R-MJA')).toBeInTheDocument()
      expect(within(ligneAerienne).getByText(/Heli Madagascar \(cuve 800 L\)/)).toBeInTheDocument()
      // Type de chaque équipe.
      expect(within(ligneTerrestre).getByText('Terrestre')).toBeInTheDocument()
      expect(within(ligneAerienne).getByText('Aérienne')).toBeInTheDocument()
    })

    it('demande au serveur les équipes de tous les types, actives ou non', async () => {
      mockApi()
      renderSection()

      await screen.findByText('Équipe Terrestre Ihosy')
      expect(mockedGet).toHaveBeenCalledWith('/equipes', { params: { inclure_inactifs: true } })
    })

    it('filtre par type : Terrestres puis Aériennes puis Toutes', async () => {
      mockApi()
      renderSection()
      await screen.findByText('Équipe Terrestre Ihosy')

      fireEvent.click(screen.getByRole('button', { name: 'Terrestres' }))
      expect(screen.getByText('Équipe Terrestre Ihosy')).toBeInTheDocument()
      expect(screen.queryByText('Équipe Aérienne Toliara')).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Aériennes' }))
      expect(screen.queryByText('Équipe Terrestre Ihosy')).not.toBeInTheDocument()
      expect(screen.getByText('Équipe Aérienne Toliara')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Toutes' }))
      expect(screen.getByText('Équipe Terrestre Ihosy')).toBeInTheDocument()
      expect(screen.getByText('Équipe Aérienne Toliara')).toBeInTheDocument()
    })

    it('affiche un message adapté quand le filtre ne trouve aucune équipe', async () => {
      mockApi({ equipes: [EQUIPE_TERRESTRE] })
      renderSection()
      await screen.findByText('Équipe Terrestre Ihosy')

      fireEvent.click(screen.getByRole('button', { name: 'Aériennes' }))
      expect(screen.getByText('Aucune équipe aérienne.')).toBeInTheDocument()
    })

    it('signale une équipe désactivée', async () => {
      mockApi({ equipes: [EQUIPE_TERRESTRE, EQUIPE_INACTIVE] })
      renderSection()

      await screen.findByText('Équipe Terrestre Éteinte')
      const ligne = screen.getByText('Équipe Terrestre Éteinte').closest('tr')!
      expect(within(ligne).getByText('Inactive')).toBeInTheDocument()
      const ligneActive = screen.getByText('Équipe Terrestre Ihosy').closest('tr')!
      expect(within(ligneActive).getByText('Active')).toBeInTheDocument()
    })

    it('les bases aériennes ne s’affichent pas sur le filtre Terrestres', async () => {
      mockApi()
      renderSection()
      await screen.findByText('Équipe Terrestre Ihosy')
      expect(screen.getByText('Bases aériennes principales')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Terrestres' }))
      expect(screen.queryByText('Bases aériennes principales')).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Aériennes' }))
      expect(screen.getByText('Bases aériennes principales')).toBeInTheDocument()
    })

    it('arrivée depuis une fiche : filtre sur le type de l’équipe visée et la met en évidence', async () => {
      mockApi()
      renderSection({ equipeSelectionneeId: 'equipe-a1' })

      await screen.findByText('Équipe Aérienne Toliara')
      // Filtré sur le type aérien.
      await waitFor(() => expect(screen.queryByText('Équipe Terrestre Ihosy')).not.toBeInTheDocument())
      expect(screen.getByRole('button', { name: 'Aériennes' })).toHaveAttribute('aria-pressed', 'true')
      // Ligne mise en évidence.
      expect(screen.getByText('Équipe Aérienne Toliara').closest('tr')).toHaveClass('ring-2')
    })
  })

  describe('création', () => {
    it('crée une équipe terrestre avec un chef d’équipe', async () => {
      // Chef-2 (Lala Rasoa) libre : seule Toky dirige déjà une équipe.
      mockApi({ equipes: [EQUIPE_TERRESTRE] })
      mockedPost.mockResolvedValue({ data: { id: 'equipe-3', nom: 'Équipe Terrestre Betroka', type: 'terrestre', actif: true } })
      renderSection()

      await screen.findByText('Équipe Terrestre Ihosy')
      fireEvent.click(screen.getByText('+ Nouvelle équipe'))

      fireEvent.change(screen.getByLabelText('Nom *'), { target: { value: 'Équipe Terrestre Betroka' } })
      fireEvent.change(screen.getByLabelText("Chef d'équipe *"), { target: { value: 'chef-2' } })
      fireEvent.click(screen.getByRole('button', { name: 'Créer' }))

      await waitFor(() =>
        expect(mockedPost).toHaveBeenCalledWith('/equipes', {
          nom: 'Équipe Terrestre Betroka',
          type: 'terrestre',
          membres: [{ user_id: 'chef-2', fonction: 'chef' }],
        }),
      )
    })

    it('crée une équipe aérienne avec chef de base, pilote, mécanicien et hélicoptère', async () => {
      mockApi({ equipes: [EQUIPE_TERRESTRE] })
      mockedPost.mockResolvedValue({ data: { id: 'equipe-4', nom: 'Équipe Aérienne Betroka', type: 'aerien', actif: true } })
      renderSection()

      await screen.findByText('Équipe Terrestre Ihosy')
      fireEvent.click(screen.getByText('+ Nouvelle équipe'))
      fireEvent.change(screen.getByLabelText("Type d'équipe *"), { target: { value: 'aerien' } })

      fireEvent.change(screen.getByLabelText('Nom *'), { target: { value: 'Équipe Aérienne Betroka' } })
      fireEvent.change(screen.getByLabelText('Chef de base *'), { target: { value: 'cb-1' } })
      fireEvent.change(screen.getByLabelText('Pilote *'), { target: { value: 'Jean Rakoto' } })
      fireEvent.change(screen.getByLabelText('Mécanicien *'), { target: { value: 'Paul Andria' } })
      saisirHelicoptere()
      fireEvent.click(screen.getByRole('button', { name: 'Créer' }))

      await waitFor(() =>
        expect(mockedPost).toHaveBeenCalledWith('/equipes', {
          nom: 'Équipe Aérienne Betroka',
          type: 'aerien',
          aeronef: { immatriculation: '5R-MJA', societe: 'Heli Madagascar', volume_cuve_l: 800 },
          membres: [
            { user_id: 'cb-1', fonction: 'chef' },
            { nom: 'Jean Rakoto', fonction: 'pilote' },
            { nom: 'Paul Andria', fonction: 'mecanicien' },
          ],
        }),
      )
    })

    it('le filtre actif présélectionne le type de la nouvelle équipe', async () => {
      mockApi()
      renderSection()
      await screen.findByText('Équipe Terrestre Ihosy')

      fireEvent.click(screen.getByRole('button', { name: 'Aériennes' }))
      fireEvent.click(screen.getByText('+ Nouvelle équipe'))
      expect(screen.getByLabelText("Type d'équipe *")).toHaveValue('aerien')
      expect(screen.getByLabelText('Chef de base *')).toBeInTheDocument()
    })

    it('les champs propres à l’aérien n’apparaissent que pour une équipe aérienne', async () => {
      mockApi()
      renderSection()
      await screen.findByText('Équipe Terrestre Ihosy')

      fireEvent.click(screen.getByText('+ Nouvelle équipe'))
      expect(screen.queryByLabelText('Pilote *')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Immatriculation *')).not.toBeInTheDocument()

      fireEvent.change(screen.getByLabelText("Type d'équipe *"), { target: { value: 'aerien' } })
      expect(screen.getByLabelText('Pilote *')).toBeInTheDocument()
      expect(screen.getByLabelText('Immatriculation *')).toBeInTheDocument()
    })

    it('ne propose comme chef d’équipe que les chefs sans équipe, et change de liste selon le type', async () => {
      // Toky dirige déjà l'équipe terrestre ; Zo dirige déjà l'équipe aérienne.
      mockApi()
      renderSection()
      await screen.findByText('Équipe Terrestre Ihosy')
      fireEvent.click(screen.getByText('+ Nouvelle équipe'))

      const chefTerrestre = screen.getByLabelText("Chef d'équipe *")
      expect(within(chefTerrestre).queryByText('Toky Rabe')).not.toBeInTheDocument()
      expect(within(chefTerrestre).getByText('Lala Rasoa')).toBeInTheDocument()

      fireEvent.change(screen.getByLabelText("Type d'équipe *"), { target: { value: 'aerien' } })
      const chefBase = screen.getByLabelText('Chef de base *')
      expect(within(chefBase).queryByText('Zo Rakoto')).not.toBeInTheDocument()
      expect(within(chefBase).getByText('Nirina Andry')).toBeInTheDocument()
      // Les chefs d'équipe terrestre ne sont pas proposés comme chefs de base.
      expect(within(chefBase).queryByText('Lala Rasoa')).not.toBeInTheDocument()
    })

    it('un chef d’une équipe désactivée redevient disponible', async () => {
      mockApi({ equipes: [EQUIPE_INACTIVE], chefsEquipe: [{ id: 'chef-x', nom: 'Ancien', prenom: 'Chef' }] })
      renderSection()
      await screen.findByText('Équipe Terrestre Éteinte')
      fireEvent.click(screen.getByText('+ Nouvelle équipe'))

      expect(within(screen.getByLabelText("Chef d'équipe *")).getByText('Chef Ancien')).toBeInTheDocument()
    })

    it('ajoute des membres avec leur fonction, et les retire, avant de créer', async () => {
      mockApi({ equipes: [EQUIPE_TERRESTRE] })
      mockedPost.mockResolvedValue({ data: {} })
      renderSection()

      await screen.findByText('Équipe Terrestre Ihosy')
      fireEvent.click(screen.getByText('+ Nouvelle équipe'))

      const champMembre = screen.getByLabelText('Autres membres (facultatif)')
      fireEvent.change(champMembre, { target: { value: 'Rasoa Voahangy' } })
      fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }))
      fireEvent.change(champMembre, { target: { value: 'John Smith' } })
      fireEvent.change(screen.getByLabelText('Fonction du membre'), { target: { value: 'consultant_international' } })
      fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }))

      expect(screen.getByText('Rasoa Voahangy')).toBeInTheDocument()
      expect(screen.getByText('John Smith')).toBeInTheDocument()
      expect(screen.getByText('(Consultant international)')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Retirer Rasoa Voahangy' }))
      expect(screen.queryByText('Rasoa Voahangy')).not.toBeInTheDocument()

      fireEvent.change(screen.getByLabelText('Nom *'), { target: { value: 'Équipe Terrestre Betroka' } })
      fireEvent.change(screen.getByLabelText("Chef d'équipe *"), { target: { value: 'chef-2' } })
      fireEvent.click(screen.getByRole('button', { name: 'Créer' }))

      await waitFor(() =>
        expect(mockedPost).toHaveBeenCalledWith(
          '/equipes',
          expect.objectContaining({
            membres: [
              { user_id: 'chef-2', fonction: 'chef' },
              { nom: 'John Smith', fonction: 'consultant_international' },
            ],
          }),
        ),
      )
    })

    it('affiche l’erreur du serveur quand la création échoue', async () => {
      mockApi({ equipes: [EQUIPE_TERRESTRE] })
      const err = new Error('409') as Error & { response: { status: number; data: { detail: string } } }
      err.response = { status: 409, data: { detail: 'Ce chef dirige déjà une équipe' } }
      mockedPost.mockRejectedValue(err)
      renderSection()

      await screen.findByText('Équipe Terrestre Ihosy')
      fireEvent.click(screen.getByText('+ Nouvelle équipe'))
      fireEvent.change(screen.getByLabelText('Nom *'), { target: { value: 'X' } })
      fireEvent.change(screen.getByLabelText("Chef d'équipe *"), { target: { value: 'chef-2' } })
      fireEvent.click(screen.getByRole('button', { name: 'Créer' }))

      expect(await screen.findByText('Ce chef dirige déjà une équipe')).toBeInTheDocument()
    })
  })

  describe('modification', () => {
    it('renomme une équipe et la désactive', async () => {
      mockApi()
      mockedPut.mockResolvedValue({ data: { ...EQUIPE_TERRESTRE, nom: 'Ihosy Nord', actif: false } })
      renderSection()

      await screen.findByText('Équipe Terrestre Ihosy')
      fireEvent.click(screen.getByRole('button', { name: "Modifier l'équipe Équipe Terrestre Ihosy" }))

      const nom = screen.getByLabelText('Nom *')
      expect(nom).toHaveValue('Équipe Terrestre Ihosy')
      fireEvent.change(nom, { target: { value: 'Ihosy Nord' } })
      fireEvent.click(screen.getByLabelText('Équipe active'))
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

      await waitFor(() =>
        expect(mockedPut).toHaveBeenCalledWith('/equipes/equipe-t1', { nom: 'Ihosy Nord', actif: false }),
      )
    })

    it('réactive une équipe désactivée', async () => {
      mockApi({ equipes: [EQUIPE_INACTIVE] })
      mockedPut.mockResolvedValue({ data: { ...EQUIPE_INACTIVE, actif: true } })
      renderSection()

      await screen.findByText('Équipe Terrestre Éteinte')
      fireEvent.click(screen.getByRole('button', { name: "Modifier l'équipe Équipe Terrestre Éteinte" }))
      expect(screen.getByLabelText('Équipe active')).not.toBeChecked()
      fireEvent.click(screen.getByLabelText('Équipe active'))
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

      await waitFor(() =>
        expect(mockedPut).toHaveBeenCalledWith('/equipes/equipe-t2', { nom: 'Équipe Terrestre Éteinte', actif: true }),
      )
    })

    it('montre les membres existants avec leur fonction et ajoute un membre avec sa fonction', async () => {
      mockApi()
      mockedPost.mockResolvedValue({
        data: { user_id: 'u-9', fonction: 'pilote', nom: 'Marc', prenom: 'Randria' },
      })
      renderSection()

      await screen.findByText('Équipe Aérienne Toliara')
      fireEvent.click(screen.getByRole('button', { name: "Modifier l'équipe Équipe Aérienne Toliara" }))

      const modale = screen.getByRole('heading', { name: /Modifier l'équipe/ }).closest('div')!.parentElement!
      expect(within(modale).getByText('Zo Rakoto')).toBeInTheDocument()
      expect(within(modale).getByText('(Chef)')).toBeInTheDocument()

      fireEvent.change(screen.getByLabelText('Ajouter un membre'), { target: { value: 'Randria Marc' } })
      fireEvent.change(screen.getByLabelText('Fonction du membre à ajouter'), { target: { value: 'pilote' } })
      fireEvent.click(screen.getByRole('button', { name: 'Ajouter le membre' }))

      await waitFor(() =>
        expect(mockedPost).toHaveBeenCalledWith('/equipes/equipe-a1/membres', {
          nom: 'Randria Marc',
          fonction: 'pilote',
        }),
      )
      // Le nouveau membre apparaît aussitôt dans la modale.
      await waitFor(() => expect(within(modale).getAllByText('(Pilote)').length).toBeGreaterThan(1))
    })

    it('ne permet pas d’ajouter un membre sans nom', async () => {
      mockApi()
      renderSection()

      await screen.findByText('Équipe Terrestre Ihosy')
      fireEvent.click(screen.getByRole('button', { name: "Modifier l'équipe Équipe Terrestre Ihosy" }))

      expect(screen.getByRole('button', { name: 'Ajouter le membre' })).toBeDisabled()
    })

    it('affiche l’erreur du serveur quand l’ajout d’un membre échoue', async () => {
      mockApi()
      const err = new Error('409') as Error & { response: { status: number; data: { detail: string } } }
      err.response = { status: 409, data: { detail: 'Membre déjà dans une équipe' } }
      mockedPost.mockRejectedValue(err)
      renderSection()

      await screen.findByText('Équipe Terrestre Ihosy')
      fireEvent.click(screen.getByRole('button', { name: "Modifier l'équipe Équipe Terrestre Ihosy" }))
      fireEvent.change(screen.getByLabelText('Ajouter un membre'), { target: { value: 'Voahangy' } })
      fireEvent.click(screen.getByRole('button', { name: 'Ajouter le membre' }))

      expect(await screen.findByText('Membre déjà dans une équipe')).toBeInTheDocument()
    })

    it('Annuler ferme la modale sans rien enregistrer', async () => {
      mockApi()
      renderSection()

      await screen.findByText('Équipe Terrestre Ihosy')
      fireEvent.click(screen.getByRole('button', { name: "Modifier l'équipe Équipe Terrestre Ihosy" }))
      fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))

      expect(screen.queryByLabelText('Équipe active')).not.toBeInTheDocument()
      expect(mockedPut).not.toHaveBeenCalled()
    })
  })

  describe('erreurs de chargement', () => {
    it('affiche une bannière d’erreur si les équipes ne peuvent pas être chargées', async () => {
      mockedGet.mockImplementation((url: string) => {
        if (url === '/equipes') {
          const err = new Error('500') as Error & { response: { status: number; data: { detail: string } } }
          err.response = { status: 500, data: { detail: 'panne serveur' } }
          return Promise.reject(err)
        }
        return Promise.resolve({ data: [] })
      })
      renderSection()

      await waitFor(() => expect(screen.getByText('panne serveur')).toBeInTheDocument())
    })

    it('affiche une bannière d’erreur si les chefs ne peuvent pas être chargés', async () => {
      mockedGet.mockImplementation((url: string) => {
        if (url === '/users/chefs-equipe') {
          const err = new Error('500') as Error & { response: { status: number; data: { detail: string } } }
          err.response = { status: 500, data: { detail: 'chefs indisponibles' } }
          return Promise.reject(err)
        }
        if (url === '/equipes') return Promise.resolve({ data: [EQUIPE_TERRESTRE] })
        return Promise.resolve({ data: [] })
      })
      renderSection()

      await waitFor(() => expect(screen.getByText('chefs indisponibles')).toBeInTheDocument())
    })
  })
})
