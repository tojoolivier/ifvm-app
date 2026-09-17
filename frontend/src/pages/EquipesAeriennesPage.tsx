import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { api } from '../api/client'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { ErrorBanner } from '@/components/ui/error-banner'

interface ChefDeBase {
  id: string
  nom: string
  prenom: string
}

interface EquipeAerienne {
  id: string
  nom: string
  chef_de_base_id: string
  actif: boolean
}

interface BaseAerienne {
  id: string
  parent_base_id: string | null
  equipe_id: string | null
  numero: string
  localite: string
  actif: boolean
}

/**
 * Assignation d'un chef de base à une base aérienne, depuis le portail web
 * (jusqu'ici possible uniquement sur mobile, `(fiche-vol)/referentiels.tsx`).
 *
 * Le modèle ne porte pas de FK directe base_aerienne -> chef_de_base : le
 * chef vient de l'équipe aérienne qui porte la base (`base_aerienne.equipe_id
 * -> equipe_aerienne.chef_de_base_id`, migration 0066). « Assigner un chef »
 * revient donc à choisir quelle équipe porte la base, via `PUT
 * /bases-aeriennes/{id}` (`equipe_id`) — l'API ne permet pas de changer le
 * chef d'une équipe existante (pas de PUT sur /equipes-aeriennes), seulement
 * d'en créer une nouvelle avec le chef voulu.
 *
 * Une équipe = au plus une base principale (UNIQUE(equipe_id)) : le sélecteur
 * de réaffectation n'propose que les équipes encore libres, plus celle déjà
 * portée par la base affichée.
 */
export function EquipesAeriennesPage() {
  const queryClient = useQueryClient()

  const [showCreateEquipe, setShowCreateEquipe] = useState(false)
  const [nomEquipe, setNomEquipe] = useState('')
  const [chefDeBaseId, setChefDeBaseId] = useState('')
  const [createEquipeError, setCreateEquipeError] = useState('')

  const [showCreateBase, setShowCreateBase] = useState(false)
  const [numeroBase, setNumeroBase] = useState('')
  const [localiteBase, setLocaliteBase] = useState('')
  const [equipeIdBase, setEquipeIdBase] = useState('')
  const [createBaseError, setCreateBaseError] = useState('')

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
    queryFn: () => api.get('/equipes-aeriennes').then((r) => r.data),
  })

  const {
    data: bases = [],
    isLoading: basesLoading,
    isError: basesIsError,
    error: basesError,
  } = useQuery<BaseAerienne[]>({
    queryKey: ['bases-aeriennes'],
    queryFn: () => api.get('/bases-aeriennes').then((r) => r.data),
  })

  const chefsById = new Map(chefs.map((c) => [c.id, c]))
  const basesPrincipales = bases.filter((b) => b.parent_base_id === null)
  // Équipe -> base principale qui la porte déjà (au plus une, UNIQUE(equipe_id)).
  const baseIdParEquipe = new Map(
    basesPrincipales.filter((b) => b.equipe_id).map((b) => [b.equipe_id as string, b.id]),
  )

  function nomChef(chefId: string) {
    const chef = chefsById.get(chefId)
    return chef ? `${chef.prenom} ${chef.nom}` : '—'
  }

  function equipesDisponiblesPour(baseId: string) {
    return equipes.filter((e) => e.actif && (baseIdParEquipe.get(e.id) ?? baseId) === baseId)
  }

  const createEquipeMutation = useMutation({
    mutationFn: (data: { nom: string; chef_de_base_id: string }) => api.post('/equipes-aeriennes', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipes-aeriennes'] })
      setShowCreateEquipe(false)
      setNomEquipe('')
      setChefDeBaseId('')
      setCreateEquipeError('')
    },
    onError: (err: AxiosError<{ detail?: string }>) => {
      setCreateEquipeError(err.response?.data?.detail || 'Erreur lors de la création')
    },
  })

  const createBaseMutation = useMutation({
    mutationFn: (data: { numero: string; localite: string; equipe_id: string }) =>
      api.post('/bases-aeriennes', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bases-aeriennes'] })
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

  const reassignMutation = useMutation({
    mutationFn: ({ id, equipe_id }: { id: string; equipe_id: string }) =>
      api.put(`/bases-aeriennes/${id}`, { equipe_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bases-aeriennes'] })
    },
    onError: (err: AxiosError<{ detail?: string }>) => {
      alert(err.response?.data?.detail || 'Erreur lors de la réaffectation')
    },
  })

  const equipesSansBase = equipes.filter((e) => e.actif && !baseIdParEquipe.has(e.id))

  const equipeColumns: DataTableColumn<EquipeAerienne>[] = [
    { key: 'nom', header: 'Équipe', render: (e) => <span className="font-semibold">{e.nom}</span> },
    { key: 'chef', header: 'Chef de base', render: (e) => nomChef(e.chef_de_base_id) },
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

  const baseColumns: DataTableColumn<BaseAerienne>[] = [
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
              {e.nom} — {nomChef(e.chef_de_base_id)}
            </option>
          ))}
        </select>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
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

      {showCreateEquipe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="border-b px-6 py-4">
              <h2 className="text-lg font-semibold">Nouvelle équipe aérienne</h2>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                setCreateEquipeError('')
                createEquipeMutation.mutate({ nom: nomEquipe.trim(), chef_de_base_id: chefDeBaseId })
              }}
              className="space-y-4 px-6 py-4"
            >
              {createEquipeError && (
                <div className="rounded bg-red-50 p-3 text-sm text-red-700">{createEquipeError}</div>
              )}
              <div>
                <label htmlFor="equipe-nom" className="mb-1 block text-sm font-medium text-gray-700">
                  Nom *
                </label>
                <input
                  id="equipe-nom"
                  type="text"
                  value={nomEquipe}
                  onChange={(e) => setNomEquipe(e.target.value)}
                  required
                  className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label htmlFor="equipe-chef" className="mb-1 block text-sm font-medium text-gray-700">
                  Chef de base *
                </label>
                <select
                  id="equipe-chef"
                  value={chefDeBaseId}
                  onChange={(e) => setChefDeBaseId(e.target.value)}
                  required
                  className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="" disabled>
                    — choisir —
                  </option>
                  {chefs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.prenom} {c.nom}
                    </option>
                  ))}
                </select>
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
                <label htmlFor="base-numero" className="mb-1 block text-sm font-medium text-gray-700">
                  Numéro *
                </label>
                <input
                  id="base-numero"
                  type="text"
                  value={numeroBase}
                  onChange={(e) => setNumeroBase(e.target.value)}
                  placeholder="Ex. IHO01"
                  required
                  className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label htmlFor="base-localite" className="mb-1 block text-sm font-medium text-gray-700">
                  Localité *
                </label>
                <input
                  id="base-localite"
                  type="text"
                  value={localiteBase}
                  onChange={(e) => setLocaliteBase(e.target.value)}
                  required
                  className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label htmlFor="base-equipe" className="mb-1 block text-sm font-medium text-gray-700">
                  Équipe (chef de base) *
                </label>
                <select
                  id="base-equipe"
                  value={equipeIdBase}
                  onChange={(e) => setEquipeIdBase(e.target.value)}
                  required
                  className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="" disabled>
                    — choisir —
                  </option>
                  {equipesSansBase.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nom} — {nomChef(e.chef_de_base_id)}
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
    </div>
  )
}
