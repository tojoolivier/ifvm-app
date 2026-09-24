import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { api } from '../api/client'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { ErrorBanner } from '@/components/ui/error-banner'
import type { components } from '@/lib/api-schema.generated'

// Types tirés du contrat OpenAPI (généré par `npm run generate:api-types`,
// cf. package.json) — jamais recopiés à la main, même règle que côté mobile
// (CLAUDE.md, « Contrat API mobile ↔ backend »).
type ChefDeBase = components['schemas']['UtilisateurAnnuaireRead']
type EquipeAerienne = components['schemas']['EquipeRead']
type MembreEquipe = components['schemas']['MembreEquipeRead']

/** Chef de base, pilote, mécanicien et consultant ne sont plus des colonnes de
 *  l'équipe : ce sont des membres porteurs de leur `fonction` (ADR-018 / migration
 *  0082). Ces accesseurs gardent l'affichage du tableau inchangé. */
function membreParFonction(equipe: EquipeAerienne, fonction: string): MembreEquipe | undefined {
  return equipe.membres?.find((m) => m.fonction === fonction)
}

function nomComplet(membre: MembreEquipe | undefined): string {
  return membre ? [membre.prenom, membre.nom].filter(Boolean).join(' ') : '—'
}

type SiteAerien = components['schemas']['SiteAerienneRead']

const FONCTIONS_NOMMEES = ['chef', 'pilote', 'mecanicien', 'consultant_international']

const inputClass =
  'w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500'
const labelClass = 'mb-1 block text-sm font-medium text-gray-700'

/**
 * Assigner un chef de base à une base aérienne, depuis le portail web — même
 * flux que mobile (`mobile/src/app/(app)/equipes-aeriennes.tsx`) : Équipes /
 * Sites principaux / Sites secondaires (une base secondaire ou un stand est un site secondaire, ADR-018 / #604), cardinalité confirmée
 * (migration 0066) : 1 équipe = 1 chef de base = 1 base principale
 * (`parent_site_id IS NULL`) ; une base secondaire hérite de l'équipe de sa
 * principale via `parent_site_id`.
 *
 * Le modèle ne porte pas de FK directe base_aerienne -> chef_de_base : le
 * chef vient de l'équipe qui porte la base. « Assigner un chef » revient
 * donc à choisir quelle équipe porte la base (`PUT /sites-aeriens/{id}`,
 * `equipe_id`) — il n'existe pas de PUT sur /equipes-aeriennes pour changer
 * le chef d'une équipe déjà créée, seulement d'en créer une nouvelle.
 *
 * `chefsLibres`/`equipesLibres` (migration 0066, UNIQUE des deux côtés) :
 * même filtrage côté client que mobile — un chef déjà à la tête d'une
 * équipe, ou une équipe déjà rattachée à une base principale, disparaissent
 * des sélecteurs de création plutôt que de laisser l'API renvoyer un 409.
 */
export function EquipesAeriennesSection() {
  const queryClient = useQueryClient()

  // --- Équipe aérienne ---------------------------------------------------
  const [showCreateEquipe, setShowCreateEquipe] = useState(false)
  const [nomEquipe, setNomEquipe] = useState('')
  const [chefDeBaseId, setChefDeBaseId] = useState('')
  const [piloteEquipe, setPiloteEquipe] = useState('')
  const [mecanicienEquipe, setMecanicienEquipe] = useState('')
  const [consultantEquipe, setConsultantEquipe] = useState('')
  const [immatriculationEquipe, setImmatriculationEquipe] = useState('')
  const [societeEquipe, setSocieteEquipe] = useState('')
  const [volumeCuveEquipe, setVolumeCuveEquipe] = useState('')
  const [membres, setMembres] = useState<string[]>([])
  const [nouveauMembre, setNouveauMembre] = useState('')
  const [createEquipeError, setCreateEquipeError] = useState('')

  // --- Base aérienne principale -------------------------------------------
  const [showCreateBase, setShowCreateBase] = useState(false)
  const [numeroBase, setNumeroBase] = useState('')
  const [localiteBase, setLocaliteBase] = useState('')
  const [equipeIdBase, setEquipeIdBase] = useState('')
  const [createBaseError, setCreateBaseError] = useState('')

  // --- Base aérienne secondaire --------------------------------------------
  const [showCreateBaseSecondaire, setShowCreateBaseSecondaire] = useState(false)
  const [numeroBaseSecondaire, setNumeroBaseSecondaire] = useState('')
  const [localiteBaseSecondaire, setLocaliteBaseSecondaire] = useState('')
  const [parentBaseId, setParentBaseId] = useState('')
  const [createBaseSecondaireError, setCreateBaseSecondaireError] = useState('')

  const {
    data: chefs = [],
    isError: chefsIsError,
    error: chefsError,
  } = useQuery<ChefDeBase[]>({
    queryKey: ['chefs-de-base'],
    queryFn: () => api.get('/users/chefs-de-base').then((r) => r.data),
  })

  const {
    data: equipes = [],
    isLoading: equipesLoading,
    isError: equipesIsError,
    error: equipesError,
  } = useQuery<EquipeAerienne[]>({
    queryKey: ['equipes-aeriennes'],
    queryFn: () => api.get('/equipes?type=aerien').then((r) => r.data),
  })

  const {
    data: bases = [],
    isLoading: basesLoading,
    isError: basesIsError,
    error: basesError,
  } = useQuery<SiteAerien[]>({
    queryKey: ['sites-aeriens'],
    queryFn: () => api.get('/sites-aeriens').then((r) => r.data),
  })

  const chefsById = new Map(chefs.map((c) => [c.id, c]))
  const basesPrincipales = bases.filter((b) => b.parent_site_id === null)
  const basesSecondaires = bases.filter((b) => b.parent_site_id !== null)
  const basesPrincipalesById = new Map(basesPrincipales.map((b) => [b.id, b]))

  // Équipe -> base principale qui la porte déjà (au plus une, UNIQUE(equipe_id)).
  const baseIdParEquipe = new Map(
    basesPrincipales.filter((b) => b.equipe_id).map((b) => [b.equipe_id as string, b.id]),
  )
  // Chef -> équipe qu'il dirige déjà (au plus une, `uq_equipe_membre_chef_par_utilisateur`).
  const equipeIdParChef = new Map(
    equipes.filter((e) => e.actif).flatMap((e) => {
      const chef = membreParFonction(e, 'chef')
      return chef ? [[chef.user_id, e.id] as const] : []
    })
  )

  function nomChef(chefId: string) {
    const chef = chefsById.get(chefId)
    return chef ? `${chef.prenom} ${chef.nom}` : '—'
  }

  // Chefs sans équipe — seuls proposés à la création d'une nouvelle équipe.
  const chefsLibres = chefs.filter((c) => !equipeIdParChef.has(c.id))

  function equipesDisponiblesPour(baseId: string) {
    return equipes.filter((e) => e.actif && (baseIdParEquipe.get(e.id) ?? baseId) === baseId)
  }
  // Équipes sans base principale — seules proposées à la création d'une nouvelle base.
  const equipesSansBase = equipes.filter((e) => e.actif && !baseIdParEquipe.has(e.id))

  const createEquipeMutation = useMutation({
    mutationFn: (data: components['schemas']['EquipeCreate']) => api.post('/equipes', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipes-aeriennes'] })
      setShowCreateEquipe(false)
      setNomEquipe('')
      setChefDeBaseId('')
      setPiloteEquipe('')
      setMecanicienEquipe('')
      setConsultantEquipe('')
      setImmatriculationEquipe('')
      setSocieteEquipe('')
      setVolumeCuveEquipe('')
      setMembres([])
      setNouveauMembre('')
      setCreateEquipeError('')
    },
    onError: (err: AxiosError<{ detail?: string }>) => {
      setCreateEquipeError(err.response?.data?.detail || 'Erreur lors de la création')
    },
  })

  const createBaseMutation = useMutation({
    mutationFn: (data: components['schemas']['SiteAerienneCreate']) => api.post('/sites-aeriens', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites-aeriens'] })
      setShowCreateBase(false)
      setNumeroBase('')
      setLocaliteBase('')
      setEquipeIdBase('')
      setCreateBaseError('')
    },
    onError: (err: AxiosError<{ detail?: string }>) => {
      setCreateBaseError(err.response?.data?.detail || 'Erreur lors de la création')
    },
  })

  const createBaseSecondaireMutation = useMutation({
    mutationFn: (data: components['schemas']['SiteAerienneCreate']) => api.post('/sites-aeriens', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites-aeriens'] })
      setShowCreateBaseSecondaire(false)
      setNumeroBaseSecondaire('')
      setLocaliteBaseSecondaire('')
      setParentBaseId('')
      setCreateBaseSecondaireError('')
    },
    onError: (err: AxiosError<{ detail?: string }>) => {
      setCreateBaseSecondaireError(err.response?.data?.detail || 'Erreur lors de la création')
    },
  })

  const reassignMutation = useMutation({
    mutationFn: ({ id, equipe_id }: { id: string; equipe_id: string }) =>
      api.put(`/sites-aeriens/${id}`, { equipe_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites-aeriens'] })
    },
    onError: (err: AxiosError<{ detail?: string }>) => {
      alert(err.response?.data?.detail || 'Erreur lors de la réaffectation')
    },
  })

  function ajouterMembre() {
    const nom = nouveauMembre.trim()
    if (!nom) return
    setMembres((prev) => [...prev, nom])
    setNouveauMembre('')
  }

  function retirerMembre(index: number) {
    setMembres((prev) => prev.filter((_, i) => i !== index))
  }

  const equipeColumns: DataTableColumn<EquipeAerienne>[] = [
    { key: 'nom', header: 'Équipe', render: (e) => <span className="font-semibold">{e.nom}</span> },
    {
      key: 'chef',
      header: 'Chef de base',
      render: (e) => nomChef(membreParFonction(e, 'chef')?.user_id ?? ''),
    },
    { key: 'pilote', header: 'Pilote', render: (e) => nomComplet(membreParFonction(e, 'pilote')) },
    {
      key: 'mecanicien',
      header: 'Mécanicien',
      render: (e) => nomComplet(membreParFonction(e, 'mecanicien')),
    },
    {
      key: 'consultant',
      header: 'Consultant international',
      render: (e) => nomComplet(membreParFonction(e, 'consultant_international')),
    },
    {
      key: 'aeronef',
      header: 'Hélicoptère',
      render: (e) =>
        e.aeronef ? (
          <span>
            <span className="font-mono text-[11.5px]">{e.aeronef.immatriculation}</span> —{' '}
            {e.aeronef.societe} (cuve {e.aeronef.volume_cuve_l} L)
          </span>
        ) : (
          <span className="text-ifvm-text-weak">—</span>
        ),
    },
    {
      key: 'membres',
      header: 'Autres membres',
      render: (e) => {
        const autres = (e.membres ?? []).filter((m) => !FONCTIONS_NOMMEES.includes(m.fonction))
        return autres.length > 0 ? (
          autres.map((m) => nomComplet(m)).join(', ')
        ) : (
          <span className="text-ifvm-text-weak">—</span>
        )
      },
    },
    {
      key: 'base',
      header: 'Base principale',
      render: (e) => {
        const baseId = baseIdParEquipe.get(e.id)
        const base = basesPrincipales.find((b) => b.id === baseId)
        return base ? (
          <span className="font-mono text-[11.5px]">{base.numero}</span>
        ) : (
          <span className="text-ifvm-text-weak">Aucune — créez une base pour cette équipe</span>
        )
      },
    },
  ]

  const baseColumns: DataTableColumn<SiteAerien>[] = [
    { key: 'numero', header: 'N°', mono: true, render: (b) => b.numero },
    { key: 'localite', header: 'Localité', render: (b) => b.localite },
    {
      key: 'chef',
      header: 'Équipe / Chef de base assigné',
      render: (b) => (
        <select
          value={b.equipe_id ?? ''}
          disabled={reassignMutation.isPending}
          aria-label={`Équipe assignée à la base ${b.numero}`}
          onChange={(e) => {
            if (!e.target.value) return
            reassignMutation.mutate({ id: b.id, equipe_id: e.target.value })
          }}
          className="w-full rounded border border-[#e0d9c4] bg-white px-2 py-1 font-sans text-[12px] disabled:opacity-50"
        >
          {!b.equipe_id && <option value="">— aucune —</option>}
          {equipesDisponiblesPour(b.id).map((e) => (
            <option key={e.id} value={e.id}>
              {e.nom} — {nomChef(membreParFonction(e, 'chef')?.user_id ?? '')}
            </option>
          ))}
        </select>
      ),
    },
  ]

  const baseSecondaireColumns: DataTableColumn<SiteAerien>[] = [
    { key: 'numero', header: 'N°', mono: true, render: (b) => b.numero },
    { key: 'localite', header: 'Localité', render: (b) => b.localite },
    {
      key: 'principale',
      header: 'Base principale',
      render: (b) => {
        const principale = b.parent_site_id ? basesPrincipalesById.get(b.parent_site_id) : undefined
        return principale ? (
          <span className="font-mono text-[11.5px]">{principale.numero}</span>
        ) : (
          '—'
        )
      },
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Équipes aériennes */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-sans text-[14px] font-bold">Équipes aériennes</h2>
          <button
            onClick={() => setShowCreateEquipe(true)}
            className="rounded-[9px] bg-ifvm-green-text px-4 py-[8px] font-sans text-[12px] font-bold text-white transition hover:bg-[#1a4429]"
          >
            + Nouvelle équipe
          </button>
        </div>

        {chefsIsError && (
          <ErrorBanner
            label="Erreur"
            message={
              (chefsError as AxiosError<{ detail?: string }>)?.response?.data?.detail ??
              'Impossible de charger les chefs de base.'
            }
          />
        )}
        {equipesIsError ? (
          <ErrorBanner
            label="Erreur"
            message={
              (equipesError as AxiosError<{ detail?: string }>)?.response?.data?.detail ??
              'Impossible de charger les équipes aériennes.'
            }
          />
        ) : (
          <div className="overflow-hidden rounded-[11px] border border-[#e7e0cd] bg-card">
            <DataTable
              columns={equipeColumns}
              rows={equipes}
              getRowKey={(e) => e.id}
              emptyMessage={equipesLoading ? 'Chargement…' : 'Aucune équipe aérienne.'}
            />
          </div>
        )}
      </section>

      {/* Bases aériennes principales */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-sans text-[14px] font-bold">Bases aériennes principales</h2>
          <button
            onClick={() => setShowCreateBase(true)}
            disabled={equipesSansBase.length === 0}
            title={
              equipesSansBase.length === 0
                ? 'Créez d’abord une équipe aérienne sans base — chaque équipe ne peut porter qu’une seule base principale.'
                : undefined
            }
            className="rounded-[9px] bg-ifvm-green-text px-4 py-[8px] font-sans text-[12px] font-bold text-white transition hover:bg-[#1a4429] disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Nouvelle base
          </button>
        </div>
        <p className="font-sans text-[11px] text-ifvm-text-weak">
          Le chef de base d'une base s'obtient via l'équipe qui la porte — changez l'équipe dans la
          colonne ci-dessous pour réaffecter le chef de base.
        </p>

        {basesIsError ? (
          <ErrorBanner
            label="Erreur"
            message={
              (basesError as AxiosError<{ detail?: string }>)?.response?.data?.detail ??
              'Impossible de charger les bases aériennes.'
            }
          />
        ) : (
          <div className="overflow-hidden rounded-[11px] border border-[#e7e0cd] bg-card">
            <DataTable
              columns={baseColumns}
              rows={basesPrincipales}
              getRowKey={(b) => b.id}
              emptyMessage={basesLoading ? 'Chargement…' : 'Aucune base aérienne principale.'}
            />
          </div>
        )}
      </section>

      {/* Bases aériennes secondaires */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-sans text-[14px] font-bold">Bases aériennes secondaires</h2>
          <button
            onClick={() => setShowCreateBaseSecondaire(true)}
            disabled={basesPrincipales.length === 0}
            title={
              basesPrincipales.length === 0 ? 'Créez d’abord une base aérienne principale.' : undefined
            }
            className="rounded-[9px] bg-ifvm-green-text px-4 py-[8px] font-sans text-[12px] font-bold text-white transition hover:bg-[#1a4429] disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Nouvelle base secondaire
          </button>
        </div>

        <div className="overflow-hidden rounded-[11px] border border-[#e7e0cd] bg-card">
          <DataTable
            columns={baseSecondaireColumns}
            rows={basesSecondaires}
            getRowKey={(b) => b.id}
            emptyMessage={basesLoading ? 'Chargement…' : 'Aucune base aérienne secondaire.'}
          />
        </div>
      </section>

      {/* Modale : nouvelle équipe */}
      {showCreateEquipe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="border-b px-6 py-4">
              <h2 className="text-lg font-semibold">Nouvelle équipe aérienne</h2>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                setCreateEquipeError('')
                createEquipeMutation.mutate({
                  nom: nomEquipe.trim(),
                  type: 'aerien',
                  aeronef: {
                    immatriculation: immatriculationEquipe.trim(),
                    societe: societeEquipe.trim(),
                    volume_cuve_l: Number(volumeCuveEquipe.replace(',', '.')),
                  },
                  // Pilote, mécanicien et consultant n'ont pas de compte : le backend
                  // en crée un à la volée à partir du seul nom saisi.
                  membres: [
                    { user_id: chefDeBaseId, fonction: 'chef' as const },
                    { nom: piloteEquipe.trim(), fonction: 'pilote' as const },
                    { nom: mecanicienEquipe.trim(), fonction: 'mecanicien' as const },
                    ...(consultantEquipe.trim()
                      ? [
                          {
                            nom: consultantEquipe.trim(),
                            fonction: 'consultant_international' as const,
                          },
                        ]
                      : []),
                    ...membres.map((nom) => ({ nom, fonction: 'membre' as const })),
                  ],
                })
              }}
              className="space-y-4 px-6 py-4"
            >
              {createEquipeError && (
                <div className="rounded bg-red-50 p-3 text-sm text-red-700">{createEquipeError}</div>
              )}
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
                  Chef de base *
                </label>
                <select
                  id="equipe-chef"
                  value={chefDeBaseId}
                  onChange={(e) => setChefDeBaseId(e.target.value)}
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
              <div>
                <label htmlFor="equipe-pilote" className={labelClass}>
                  Pilote *
                </label>
                <input
                  id="equipe-pilote"
                  type="text"
                  value={piloteEquipe}
                  onChange={(e) => setPiloteEquipe(e.target.value)}
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
                  value={mecanicienEquipe}
                  onChange={(e) => setMecanicienEquipe(e.target.value)}
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
                  value={consultantEquipe}
                  onChange={(e) => setConsultantEquipe(e.target.value)}
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
                    value={immatriculationEquipe}
                    onChange={(e) => setImmatriculationEquipe(e.target.value)}
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
                    value={societeEquipe}
                    onChange={(e) => setSocieteEquipe(e.target.value)}
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
                    value={volumeCuveEquipe}
                    onChange={(e) => setVolumeCuveEquipe(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
              </fieldset>
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
                    {membres.map((nom, index) => (
                      <li
                        key={`${nom}-${index}`}
                        className="flex items-center justify-between rounded border border-gray-200 px-2 py-1 text-sm"
                      >
                        {nom}
                        <button
                          type="button"
                          onClick={() => retirerMembre(index)}
                          aria-label={`Retirer ${nom}`}
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
                  disabled={createEquipeMutation.isPending}
                  className="rounded bg-green-700 px-4 py-2 text-white transition hover:bg-green-800 disabled:opacity-50"
                >
                  {createEquipeMutation.isPending ? 'Création…' : 'Créer'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateEquipe(false)
                    setNomEquipe('')
                    setChefDeBaseId('')
                    setPiloteEquipe('')
                    setMecanicienEquipe('')
                    setConsultantEquipe('')
                    setImmatriculationEquipe('')
                    setSocieteEquipe('')
                    setVolumeCuveEquipe('')
                    setMembres([])
                    setNouveauMembre('')
                    setCreateEquipeError('')
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

      {/* Modale : nouvelle base principale */}
      {showCreateBase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="border-b px-6 py-4">
              <h2 className="text-lg font-semibold">Nouvelle base aérienne principale</h2>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                setCreateBaseError('')
                createBaseMutation.mutate({
                  numero: numeroBase.trim(),
                  localite: localiteBase.trim(),
                  equipe_id: equipeIdBase,
                })
              }}
              className="space-y-4 px-6 py-4"
            >
              {createBaseError && (
                <div className="rounded bg-red-50 p-3 text-sm text-red-700">{createBaseError}</div>
              )}
              <div>
                <label htmlFor="base-numero" className={labelClass}>
                  Numéro *
                </label>
                <input
                  id="base-numero"
                  type="text"
                  value={numeroBase}
                  onChange={(e) => setNumeroBase(e.target.value)}
                  placeholder="Ex. IHO01"
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="base-localite" className={labelClass}>
                  Localité *
                </label>
                <input
                  id="base-localite"
                  type="text"
                  value={localiteBase}
                  onChange={(e) => setLocaliteBase(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="base-equipe" className={labelClass}>
                  Équipe (chef de base) *
                </label>
                <select
                  id="base-equipe"
                  value={equipeIdBase}
                  onChange={(e) => setEquipeIdBase(e.target.value)}
                  required
                  className={inputClass}
                >
                  <option value="" disabled>
                    — choisir —
                  </option>
                  {equipesSansBase.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nom} — {nomChef(membreParFonction(e, 'chef')?.user_id ?? '')}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={createBaseMutation.isPending}
                  className="rounded bg-green-700 px-4 py-2 text-white transition hover:bg-green-800 disabled:opacity-50"
                >
                  {createBaseMutation.isPending ? 'Création…' : 'Créer'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateBase(false)
                    setNumeroBase('')
                    setLocaliteBase('')
                    setEquipeIdBase('')
                    setCreateBaseError('')
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

      {/* Modale : nouvelle base secondaire */}
      {showCreateBaseSecondaire && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="border-b px-6 py-4">
              <h2 className="text-lg font-semibold">Nouvelle base aérienne secondaire</h2>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                setCreateBaseSecondaireError('')
                createBaseSecondaireMutation.mutate({
                  numero: numeroBaseSecondaire.trim(),
                  localite: localiteBaseSecondaire.trim(),
                  parent_site_id: parentBaseId,
                })
              }}
              className="space-y-4 px-6 py-4"
            >
              {createBaseSecondaireError && (
                <div className="rounded bg-red-50 p-3 text-sm text-red-700">
                  {createBaseSecondaireError}
                </div>
              )}
              <div>
                <label htmlFor="base-secondaire-numero" className={labelClass}>
                  Numéro *
                </label>
                <input
                  id="base-secondaire-numero"
                  type="text"
                  value={numeroBaseSecondaire}
                  onChange={(e) => setNumeroBaseSecondaire(e.target.value)}
                  placeholder="Ex. IHO02"
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="base-secondaire-localite" className={labelClass}>
                  Localité *
                </label>
                <input
                  id="base-secondaire-localite"
                  type="text"
                  value={localiteBaseSecondaire}
                  onChange={(e) => setLocaliteBaseSecondaire(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="base-secondaire-parent" className={labelClass}>
                  Base principale *
                </label>
                <select
                  id="base-secondaire-parent"
                  value={parentBaseId}
                  onChange={(e) => setParentBaseId(e.target.value)}
                  required
                  className={inputClass}
                >
                  <option value="" disabled>
                    — choisir —
                  </option>
                  {basesPrincipales.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.numero} — {b.localite}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={createBaseSecondaireMutation.isPending}
                  className="rounded bg-green-700 px-4 py-2 text-white transition hover:bg-green-800 disabled:opacity-50"
                >
                  {createBaseSecondaireMutation.isPending ? 'Création…' : 'Créer'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateBaseSecondaire(false)
                    setNumeroBaseSecondaire('')
                    setLocaliteBaseSecondaire('')
                    setParentBaseId('')
                    setCreateBaseSecondaireError('')
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
