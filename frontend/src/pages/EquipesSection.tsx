import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { api } from '../api/client'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { ErrorBanner } from '@/components/ui/error-banner'
import { FilterChip } from '@/components/ui/filter-chip'
import { Pill } from '@/components/ui/pill'
import type { components } from '@/lib/api-schema.generated'
import {
  FONCTIONS_A_LA_VOLEE,
  LIBELLE_TYPE_EQUIPE,
  autresMembres,
  chefDe,
  libelleFonction,
  nomComplet,
  type Equipe,
  type FonctionALaVolee,
  type TypeEquipe,
} from '@/lib/equipes'
import { BasesAeriennesSection } from './BasesAeriennesSection'

type Chef = components['schemas']['UtilisateurAnnuaireRead']
type Filtre = 'toutes' | TypeEquipe

const inputClass =
  'w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500'
const labelClass = 'mb-1 block text-sm font-medium text-gray-700'

/** Membre saisi par son seul nom : le backend lui crée un compte à la volée. */
interface MembreSaisi {
  nom: string
  fonction: FonctionALaVolee
}

/** Vide une requête dont l'erreur peut porter un `detail` du backend. */
function detail(error: unknown, defaut: string): string {
  return (error as AxiosError<{ detail?: string }>)?.response?.data?.detail ?? defaut
}

/**
 * Section « Équipes » de l'Administration (#602, #607) : les équipes terrestres et aériennes dans
 * une seule liste filtrable par type. Le chef et les autres membres sont des membres génériques
 * porteurs de leur `fonction` (ADR-018) ; l'équipe aérienne y ajoute son hélicoptère et ses bases.
 *
 *  - Création : le type se choisit dans le formulaire ; pilote et mécanicien sont requis pour une
 *    équipe aérienne (leur compte est créé à la volée à partir du nom saisi).
 *  - Modification : nom, activation/désactivation, et ajout de membres avec leur fonction. Il
 *    n'existe pas de suppression de membre côté API.
 *  - `equipeSelectionneeId` (lien depuis une fiche) : filtre sur le type de cette équipe et la
 *    met en évidence dans la liste.
 *
 * `chefsLibres` : un chef ne peut diriger qu'une équipe (`uq_equipe_membre_chef_par_utilisateur`) —
 * un chef déjà à la tête d'une équipe active disparaît du sélecteur de création plutôt que de laisser
 * l'API renvoyer un 409. Le rattachement d'un poste acridien ou d'un lieu à une équipe se fait dans
 * les formulaires « Postes acridiens » et « Lieux aériens » de ReferentielsPage.
 */
export function EquipesSection({ equipeSelectionneeId = null }: { equipeSelectionneeId?: string | null }) {
  const queryClient = useQueryClient()

  const [filtre, setFiltre] = useState<Filtre>('toutes')

  // --- Création ------------------------------------------------------------
  const [showCreate, setShowCreate] = useState(false)
  const [typeCreation, setTypeCreation] = useState<TypeEquipe>('terrestre')
  const [nomEquipe, setNomEquipe] = useState('')
  const [chefId, setChefId] = useState('')
  const [pilote, setPilote] = useState('')
  const [mecanicien, setMecanicien] = useState('')
  const [consultant, setConsultant] = useState('')
  const [immatriculation, setImmatriculation] = useState('')
  const [societe, setSociete] = useState('')
  const [volumeCuve, setVolumeCuve] = useState('')
  const [membres, setMembres] = useState<MembreSaisi[]>([])
  const [nouveauMembre, setNouveauMembre] = useState('')
  const [fonctionNouveauMembre, setFonctionNouveauMembre] = useState<FonctionALaVolee>('membre')
  const [createError, setCreateError] = useState('')

  // --- Modification --------------------------------------------------------
  const [equipeEditee, setEquipeEditee] = useState<Equipe | null>(null)
  const [nomEdite, setNomEdite] = useState('')
  const [actifEdite, setActifEdite] = useState(true)
  const [membreAjoute, setMembreAjoute] = useState('')
  const [fonctionMembreAjoute, setFonctionMembreAjoute] = useState<FonctionALaVolee>('membre')
  const [editError, setEditError] = useState('')

  const {
    data: equipes = [],
    isLoading: equipesLoading,
    isError: equipesIsError,
    error: equipesError,
  } = useQuery<Equipe[]>({
    queryKey: ['equipes'],
    queryFn: () => api.get('/equipes', { params: { inclure_inactifs: true } }).then((r) => r.data),
  })

  const {
    data: chefsEquipe = [],
    isError: chefsEquipeIsError,
    error: chefsEquipeError,
  } = useQuery<Chef[]>({
    queryKey: ['chefs-equipe'],
    queryFn: () => api.get('/users/chefs-equipe').then((r) => r.data),
  })

  const {
    data: chefsDeBase = [],
    isError: chefsDeBaseIsError,
    error: chefsDeBaseError,
  } = useQuery<Chef[]>({
    queryKey: ['chefs-de-base'],
    queryFn: () => api.get('/users/chefs-de-base').then((r) => r.data),
  })

  // Arrivée depuis une fiche : on se place sur le type de l'équipe visée.
  useEffect(() => {
    const cible = equipes.find((e) => e.id === equipeSelectionneeId)
    if (cible) setFiltre(cible.type)
  }, [equipes, equipeSelectionneeId])

  const equipesVisibles = filtre === 'toutes' ? equipes : equipes.filter((e) => e.type === filtre)

  // Chef -> équipe qu'il dirige déjà (au plus une, tous types confondus).
  const chefsOccupes = new Set(
    equipes.flatMap((e) => {
      const chef = e.actif ? chefDe(e) : undefined
      return chef ? [chef.user_id] : []
    }),
  )
  const chefsDuType = typeCreation === 'aerien' ? chefsDeBase : chefsEquipe
  const chefsLibres = chefsDuType.filter((c) => !chefsOccupes.has(c.id))

  function rafraichirEquipes() {
    // Toutes les listes d'équipes (celle-ci, compteurs de l'Administration, filtres de ReferentielsPage).
    queryClient.invalidateQueries({
      predicate: (q) => typeof q.queryKey[0] === 'string' && q.queryKey[0].startsWith('equipes'),
    })
  }

  function reinitialiserCreation() {
    setShowCreate(false)
    setTypeCreation('terrestre')
    setNomEquipe('')
    setChefId('')
    setPilote('')
    setMecanicien('')
    setConsultant('')
    setImmatriculation('')
    setSociete('')
    setVolumeCuve('')
    setMembres([])
    setNouveauMembre('')
    setFonctionNouveauMembre('membre')
    setCreateError('')
  }

  const createMutation = useMutation({
    mutationFn: (data: components['schemas']['EquipeCreate']) => api.post('/equipes', data),
    onSuccess: () => {
      rafraichirEquipes()
      reinitialiserCreation()
    },
    onError: (err: AxiosError<{ detail?: string }>) => {
      setCreateError(err.response?.data?.detail || 'Erreur lors de la création')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, nom, actif }: { id: string; nom: string; actif: boolean }) =>
      api.put(`/equipes/${id}`, { nom, actif }),
    onSuccess: () => {
      rafraichirEquipes()
      setEquipeEditee(null)
      setEditError('')
    },
    onError: (err: AxiosError<{ detail?: string }>) => {
      setEditError(err.response?.data?.detail || 'Erreur lors de la modification')
    },
  })

  const ajouterMembreMutation = useMutation({
    mutationFn: ({ id, nom, fonction }: { id: string; nom: string; fonction: FonctionALaVolee }) =>
      api.post(`/equipes/${id}/membres`, { nom, fonction }).then((r) => r.data),
    onSuccess: (membre, variables) => {
      rafraichirEquipes()
      // La modale garde la liste à jour sans attendre le rechargement de la liste.
      setEquipeEditee((courante) =>
        courante && courante.id === variables.id
          ? { ...courante, membres: [...(courante.membres ?? []), membre] }
          : courante,
      )
      setMembreAjoute('')
      setFonctionMembreAjoute('membre')
      setEditError('')
    },
    onError: (err: AxiosError<{ detail?: string }>) => {
      setEditError(err.response?.data?.detail || "Erreur lors de l'ajout du membre")
    },
  })

  function ajouterMembre() {
    const nom = nouveauMembre.trim()
    if (!nom) return
    setMembres((prev) => [...prev, { nom, fonction: fonctionNouveauMembre }])
    setNouveauMembre('')
    setFonctionNouveauMembre('membre')
  }

  function retirerMembre(index: number) {
    setMembres((prev) => prev.filter((_, i) => i !== index))
  }

  function ouvrirModification(equipe: Equipe) {
    setEquipeEditee(equipe)
    setNomEdite(equipe.nom)
    setActifEdite(equipe.actif)
    setMembreAjoute('')
    setFonctionMembreAjoute('membre')
    setEditError('')
  }

  function soumettreCreation() {
    setCreateError('')
    const aerien = typeCreation === 'aerien'
    createMutation.mutate({
      nom: nomEquipe.trim(),
      type: typeCreation,
      ...(aerien
        ? {
            aeronef: {
              immatriculation: immatriculation.trim(),
              societe: societe.trim(),
              volume_cuve_l: Number(volumeCuve.replace(',', '.')),
            },
          }
        : {}),
      // Sans compte (tous sauf le chef) : le backend en crée un à la volée à partir du seul nom.
      membres: [
        { user_id: chefId, fonction: 'chef' as const },
        ...(aerien
          ? [
              { nom: pilote.trim(), fonction: 'pilote' as const },
              { nom: mecanicien.trim(), fonction: 'mecanicien' as const },
              ...(consultant.trim()
                ? [{ nom: consultant.trim(), fonction: 'consultant_international' as const }]
                : []),
            ]
          : []),
        ...membres.map((m) => ({ nom: m.nom, fonction: m.fonction })),
      ],
    })
  }

  const equipeColumns: DataTableColumn<Equipe>[] = [
    { key: 'nom', header: 'Équipe', render: (e) => <span className="font-semibold">{e.nom}</span> },
    {
      key: 'type',
      header: 'Type',
      render: (e) => (
        <Pill tone="border-[#e0d9c4] bg-background text-ifvm-text-tertiary">{LIBELLE_TYPE_EQUIPE[e.type]}</Pill>
      ),
    },
    { key: 'chef', header: 'Chef', render: (e) => nomComplet(chefDe(e)) },
    {
      key: 'membres',
      header: 'Membres',
      render: (e) => {
        const autres = autresMembres(e)
        return autres.length > 0 ? (
          <ul className="flex flex-col gap-0.5">
            {autres.map((m) => (
              <li key={`${m.user_id}-${m.fonction}`}>
                {nomComplet(m)} <span className="text-ifvm-text-weak">({libelleFonction(m.fonction)})</span>
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-ifvm-text-weak">—</span>
        )
      },
    },
    {
      key: 'aeronef',
      header: 'Hélicoptère',
      render: (e) =>
        e.aeronef ? (
          <span>
            <span className="font-mono text-[11.5px]">{e.aeronef.immatriculation}</span> — {e.aeronef.societe}{' '}
            (cuve {e.aeronef.volume_cuve_l} L)
          </span>
        ) : (
          <span className="text-ifvm-text-weak">—</span>
        ),
    },
    {
      key: 'statut',
      header: 'Statut',
      render: (e) => (
        <Pill
          tone={
            e.actif
              ? 'border-ifvm-green-border bg-ifvm-green-bg text-ifvm-green-text'
              : 'border-[#e0d9c4] bg-ifvm-brouillon-bg text-ifvm-text-tertiary'
          }
        >
          {e.actif ? 'Active' : 'Inactive'}
        </Pill>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (e) => (
        <button
          type="button"
          onClick={() => ouvrirModification(e)}
          aria-label={`Modifier l'équipe ${e.nom}`}
          className="font-sans text-[12px] font-semibold text-ifvm-green-text underline"
        >
          Modifier
        </button>
      ),
    },
  ]

  const messageVide = equipesLoading
    ? 'Chargement…'
    : filtre === 'terrestre'
      ? 'Aucune équipe terrestre.'
      : filtre === 'aerien'
        ? 'Aucune équipe aérienne.'
        : 'Aucune équipe.'

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-sans text-[14px] font-bold">Équipes</h2>
          <button
            onClick={() => {
              // Le filtre actif présélectionne le type de la nouvelle équipe.
              setTypeCreation(filtre === 'aerien' ? 'aerien' : 'terrestre')
              setShowCreate(true)
            }}
            className="rounded-[9px] bg-ifvm-green-text px-4 py-[8px] font-sans text-[12px] font-bold text-white transition hover:bg-[#1a4429]"
          >
            + Nouvelle équipe
          </button>
        </div>

        <div role="group" aria-label="Filtrer par type d'équipe" className="flex flex-wrap gap-2">
          <FilterChip label="Toutes" active={filtre === 'toutes'} onClick={() => setFiltre('toutes')} />
          <FilterChip
            label="Terrestres"
            active={filtre === 'terrestre'}
            onClick={() => setFiltre('terrestre')}
          />
          <FilterChip label="Aériennes" active={filtre === 'aerien'} onClick={() => setFiltre('aerien')} />
        </div>

        <p className="font-sans text-[11px] text-ifvm-text-weak">
          Le rattachement d'un poste acridien ou d'un lieu aérien à une équipe se fait dans le formulaire
          « Postes acridiens » ou « Lieux aériens » des Référentiels.
        </p>

        {(chefsEquipeIsError || chefsDeBaseIsError) && (
          <ErrorBanner
            label="Erreur"
            message={
              chefsEquipeIsError
                ? detail(chefsEquipeError, "Impossible de charger les chefs d'équipe.")
                : detail(chefsDeBaseError, 'Impossible de charger les chefs de base.')
            }
          />
        )}
        {equipesIsError ? (
          <ErrorBanner label="Erreur" message={detail(equipesError, 'Impossible de charger les équipes.')} />
        ) : (
          <div className="overflow-hidden rounded-[11px] border border-[#e7e0cd] bg-card">
            <DataTable
              columns={equipeColumns}
              rows={equipesVisibles}
              getRowKey={(e) => e.id}
              emptyMessage={messageVide}
              rowClassName={(e) =>
                e.id === equipeSelectionneeId ? 'bg-ifvm-green-bg ring-2 ring-inset ring-ifvm-green-text' : undefined
              }
            />
          </div>
        )}
      </section>

      {filtre !== 'terrestre' && <BasesAeriennesSection equipes={equipes} />}

      {/* Modale : nouvelle équipe */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="border-b px-4 py-4 sm:px-6">
              <h2 className="text-lg font-semibold">Nouvelle équipe</h2>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                soumettreCreation()
              }}
              className="space-y-4 px-4 py-4 sm:px-6"
            >
              {createError && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{createError}</div>}
              <div>
                <label htmlFor="equipe-type" className={labelClass}>
                  Type d'équipe *
                </label>
                <select
                  id="equipe-type"
                  value={typeCreation}
                  onChange={(e) => {
                    setTypeCreation(e.target.value as TypeEquipe)
                    // Le chef d'une équipe terrestre n'est pas celui d'une équipe aérienne.
                    setChefId('')
                  }}
                  className={inputClass}
                >
                  <option value="terrestre">Terrestre</option>
                  <option value="aerien">Aérienne</option>
                </select>
              </div>
              <div>
                <label htmlFor="equipe-nom" className={labelClass}>
                  Nom *
                </label>
                <input
                  id="equipe-nom"
                  type="text"
                  value={nomEquipe}
                  onChange={(e) => setNomEquipe(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="equipe-chef" className={labelClass}>
                  {typeCreation === 'aerien' ? 'Chef de base *' : "Chef d'équipe *"}
                </label>
                <select
                  id="equipe-chef"
                  value={chefId}
                  onChange={(e) => setChefId(e.target.value)}
                  required
                  className={inputClass}
                >
                  <option value="" disabled>
                    — choisir —
                  </option>
                  {chefsLibres.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.prenom} {c.nom}
                    </option>
                  ))}
                </select>
              </div>

              {typeCreation === 'aerien' && (
                <>
                  <div>
                    <label htmlFor="equipe-pilote" className={labelClass}>
                      Pilote *
                    </label>
                    <input
                      id="equipe-pilote"
                      type="text"
                      value={pilote}
                      onChange={(e) => setPilote(e.target.value)}
                      placeholder="Nom du pilote"
                      required
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="equipe-mecanicien" className={labelClass}>
                      Mécanicien *
                    </label>
                    <input
                      id="equipe-mecanicien"
                      type="text"
                      value={mecanicien}
                      onChange={(e) => setMecanicien(e.target.value)}
                      placeholder="Nom du mécanicien"
                      required
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="equipe-consultant" className={labelClass}>
                      Consultant international (facultatif)
                    </label>
                    <input
                      id="equipe-consultant"
                      type="text"
                      value={consultant}
                      onChange={(e) => setConsultant(e.target.value)}
                      placeholder="Nom, si présent"
                      className={inputClass}
                    />
                  </div>
                  <fieldset className="space-y-3 rounded border border-gray-200 p-3">
                    <legend className="px-1 text-sm font-medium text-gray-700">Hélicoptère de l'équipe</legend>
                    <div>
                      <label htmlFor="equipe-immatriculation" className={labelClass}>
                        Immatriculation *
                      </label>
                      <input
                        id="equipe-immatriculation"
                        type="text"
                        value={immatriculation}
                        onChange={(e) => setImmatriculation(e.target.value)}
                        placeholder="Ex. 5R-MXY"
                        maxLength={20}
                        required
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label htmlFor="equipe-societe" className={labelClass}>
                        Société *
                      </label>
                      <input
                        id="equipe-societe"
                        type="text"
                        value={societe}
                        onChange={(e) => setSociete(e.target.value)}
                        required
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label htmlFor="equipe-volume-cuve" className={labelClass}>
                        Volume de cuve (L) *
                      </label>
                      <input
                        id="equipe-volume-cuve"
                        type="number"
                        min="1"
                        step="any"
                        value={volumeCuve}
                        onChange={(e) => setVolumeCuve(e.target.value)}
                        required
                        className={inputClass}
                      />
                    </div>
                  </fieldset>
                </>
              )}

              <div>
                <label htmlFor="equipe-nouveau-membre" className={labelClass}>
                  Autres membres (facultatif)
                </label>
                <div className="flex gap-2">
                  <input
                    id="equipe-nouveau-membre"
                    type="text"
                    value={nouveauMembre}
                    onChange={(e) => setNouveauMembre(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        ajouterMembre()
                      }
                    }}
                    placeholder="Nom d'un membre"
                    className={inputClass}
                  />
                  <select
                    aria-label="Fonction du membre"
                    value={fonctionNouveauMembre}
                    onChange={(e) => setFonctionNouveauMembre(e.target.value as FonctionALaVolee)}
                    className="shrink-0 rounded border border-gray-300 px-2 py-2 text-sm"
                  >
                    {FONCTIONS_A_LA_VOLEE.map((f) => (
                      <option key={f} value={f}>
                        {libelleFonction(f)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={ajouterMembre}
                    className="shrink-0 rounded border border-gray-300 px-3 py-2 text-sm font-medium transition hover:bg-gray-50"
                  >
                    Ajouter
                  </button>
                </div>
                {membres.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1">
                    {membres.map((m, index) => (
                      <li
                        key={`${m.nom}-${index}`}
                        className="flex items-center justify-between rounded border border-gray-200 px-2 py-1 text-sm"
                      >
                        <span>
                          {m.nom} <span className="text-gray-500">({libelleFonction(m.fonction)})</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => retirerMembre(index)}
                          aria-label={`Retirer ${m.nom}`}
                          className="text-red-600 hover:underline"
                        >
                          Retirer
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="rounded bg-green-700 px-4 py-2 text-white transition hover:bg-green-800 disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Création…' : 'Créer'}
                </button>
                <button
                  type="button"
                  onClick={reinitialiserCreation}
                  className="rounded border border-gray-300 px-4 py-2 transition hover:bg-gray-50"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale : modifier une équipe */}
      {equipeEditee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="border-b px-4 py-4 sm:px-6">
              <h2 className="text-lg font-semibold">
                Modifier l'équipe · {LIBELLE_TYPE_EQUIPE[equipeEditee.type].toLowerCase()}
              </h2>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                setEditError('')
                updateMutation.mutate({ id: equipeEditee.id, nom: nomEdite.trim(), actif: actifEdite })
              }}
              className="space-y-4 px-4 py-4 sm:px-6"
            >
              {editError && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{editError}</div>}
              <div>
                <label htmlFor="equipe-edit-nom" className={labelClass}>
                  Nom *
                </label>
                <input
                  id="equipe-edit-nom"
                  type="text"
                  value={nomEdite}
                  onChange={(e) => setNomEdite(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={actifEdite}
                  onChange={(e) => setActifEdite(e.target.checked)}
                  className="h-4 w-4"
                />
                Équipe active
              </label>

              <div>
                <p className={labelClass}>Membres</p>
                {(equipeEditee.membres ?? []).length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {(equipeEditee.membres ?? []).map((m) => (
                      <li
                        key={`${m.user_id}-${m.fonction}`}
                        className="rounded border border-gray-200 px-2 py-1 text-sm"
                      >
                        {nomComplet(m)} <span className="text-gray-500">({libelleFonction(m.fonction)})</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">Aucun membre.</p>
                )}
              </div>

              <div>
                <label htmlFor="equipe-edit-nouveau-membre" className={labelClass}>
                  Ajouter un membre
                </label>
                <div className="flex gap-2">
                  <input
                    id="equipe-edit-nouveau-membre"
                    type="text"
                    value={membreAjoute}
                    onChange={(e) => setMembreAjoute(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.preventDefault()
                    }}
                    placeholder="Nom du membre"
                    className={inputClass}
                  />
                  <select
                    aria-label="Fonction du membre à ajouter"
                    value={fonctionMembreAjoute}
                    onChange={(e) => setFonctionMembreAjoute(e.target.value as FonctionALaVolee)}
                    className="shrink-0 rounded border border-gray-300 px-2 py-2 text-sm"
                  >
                    {FONCTIONS_A_LA_VOLEE.map((f) => (
                      <option key={f} value={f}>
                        {libelleFonction(f)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!membreAjoute.trim() || ajouterMembreMutation.isPending}
                    onClick={() =>
                      ajouterMembreMutation.mutate({
                        id: equipeEditee.id,
                        nom: membreAjoute.trim(),
                        fonction: fonctionMembreAjoute,
                      })
                    }
                    className="shrink-0 rounded border border-gray-300 px-3 py-2 text-sm font-medium transition hover:bg-gray-50 disabled:opacity-50"
                  >
                    Ajouter le membre
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="rounded bg-green-700 px-4 py-2 text-white transition hover:bg-green-800 disabled:opacity-50"
                >
                  {updateMutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEquipeEditee(null)
                    setEditError('')
                  }}
                  className="rounded border border-gray-300 px-4 py-2 transition hover:bg-gray-50"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
