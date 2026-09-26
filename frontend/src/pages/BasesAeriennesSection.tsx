import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { api } from '../api/client'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { ErrorBanner } from '@/components/ui/error-banner'
import type { components } from '@/lib/api-schema.generated'
import { chefDe, nomComplet, type Equipe } from '@/lib/equipes'

type SiteAerien = components['schemas']['SiteAerienneRead']

const inputClass =
  'w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500'
const labelClass = 'mb-1 block text-sm font-medium text-gray-700'

/**
 * Bases aériennes (principales et secondaires) rattachées aux équipes aériennes — même flux que
 * mobile (`mobile/src/app/(app)/equipes-aeriennes.tsx`). Cardinalité confirmée (migration 0066) :
 * 1 équipe = 1 chef de base = 1 base principale (`parent_site_id IS NULL`) ; une base secondaire
 * (base secondaire ou stand, ADR-018 / #604) hérite de l'équipe de sa principale via
 * `parent_site_id`.
 *
 * Le modèle ne porte pas de FK directe base_aerienne -> chef_de_base : le chef vient de l'équipe qui
 * porte la base. « Assigner un chef » revient donc à choisir quelle équipe porte la base
 * (`PUT /sites-aeriens/{id}`, `equipe_id`).
 *
 * `equipesSansBase`/`equipesDisponiblesPour` (migration 0066, UNIQUE des deux côtés) : même filtrage
 * côté client que mobile — une équipe déjà rattachée à une base principale disparaît des
 * sélecteurs de création plutôt que de laisser l'API renvoyer un 409.
 *
 * Reçoit la liste des équipes en prop : c'est `EquipesSection` qui la charge (une seule requête pour
 * les deux types d'équipe).
 */
export function BasesAeriennesSection({ equipes }: { equipes: Equipe[] }) {
  const queryClient = useQueryClient()

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
    data: bases = [],
    isLoading: basesLoading,
    isError: basesIsError,
    error: basesError,
  } = useQuery<SiteAerien[]>({
    queryKey: ['sites-aeriens'],
    queryFn: () => api.get('/sites-aeriens').then((r) => r.data),
  })

  const equipesAeriennes = equipes.filter((e) => e.type === 'aerien')
  const basesPrincipales = bases.filter((b) => b.parent_site_id === null)
  const basesSecondaires = bases.filter((b) => b.parent_site_id !== null)
  const basesPrincipalesById = new Map(basesPrincipales.map((b) => [b.id, b]))

  // Équipe -> base principale qui la porte déjà (au plus une, UNIQUE(equipe_id)).
  const baseIdParEquipe = new Map(
    basesPrincipales.filter((b) => b.equipe_id).map((b) => [b.equipe_id as string, b.id]),
  )

  function equipesDisponiblesPour(baseId: string) {
    return equipesAeriennes.filter((e) => e.actif && (baseIdParEquipe.get(e.id) ?? baseId) === baseId)
  }
  // Équipes sans base principale — seules proposées à la création d'une nouvelle base.
  const equipesSansBase = equipesAeriennes.filter((e) => e.actif && !baseIdParEquipe.has(e.id))

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
              {e.nom} — {nomComplet(chefDe(e))}
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

      {/* Modale : nouvelle base principale */}
      {showCreateBase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="border-b px-4 py-4 sm:px-6">
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
              className="space-y-4 px-4 py-4 sm:px-6"
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
                      {e.nom} — {nomComplet(chefDe(e))}
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
            <div className="border-b px-4 py-4 sm:px-6">
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
              className="space-y-4 px-4 py-4 sm:px-6"
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
