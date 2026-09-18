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
type ChefEquipe = components['schemas']['UtilisateurAnnuaireRead']
type EquipeTerrestre = components['schemas']['EquipeTerrestreRead']

const inputClass =
  'w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500'
const labelClass = 'mb-1 block text-sm font-medium text-gray-700'

/**
 * Équipe terrestre (migration 0072) : un chef d'équipe (rôle `chef_equipe`) + des
 * membres à nombre variable, même patron que `EquipesAeriennesSection`. Contrairement
 * à l'aérien, pas de base physique unique à gérer ici — le rattachement d'un poste
 * acridien à une équipe se fait dans le formulaire générique `poste_acridien`
 * (champ `equipe_terrestre_id`, ENTITES de ReferentielsPage.tsx), pas dans cette
 * section : plusieurs postes peuvent partager la même équipe (pas de UNIQUE), une
 * seule case à cocher ne suffirait pas à représenter cette relation ici.
 *
 * `chefsLibres` : même filtrage côté client que `EquipesAeriennesSection` — un chef
 * déjà à la tête d'une équipe (UNIQUE `equipe_terrestre.chef_equipe_id`) disparaît
 * du sélecteur de création plutôt que de laisser l'API renvoyer un 409.
 */
export function EquipesTerrestresSection() {
  const queryClient = useQueryClient()

  const [showCreateEquipe, setShowCreateEquipe] = useState(false)
  const [nomEquipe, setNomEquipe] = useState('')
  const [chefEquipeId, setChefEquipeId] = useState('')
  const [membres, setMembres] = useState<string[]>([])
  const [nouveauMembre, setNouveauMembre] = useState('')
  const [createEquipeError, setCreateEquipeError] = useState('')

  const {
    data: chefs = [],
    isError: chefsIsError,
    error: chefsError,
  } = useQuery<ChefEquipe[]>({
    queryKey: ['chefs-equipe'],
    queryFn: () => api.get('/users/chefs-equipe').then((r) => r.data),
  })

  const {
    data: equipes = [],
    isLoading: equipesLoading,
    isError: equipesIsError,
    error: equipesError,
  } = useQuery<EquipeTerrestre[]>({
    queryKey: ['equipes-terrestres'],
    queryFn: () => api.get('/equipes-terrestres').then((r) => r.data),
  })

  const chefsById = new Map(chefs.map((c) => [c.id, c]))

  function nomChef(chefId: string) {
    const chef = chefsById.get(chefId)
    return chef ? `${chef.prenom} ${chef.nom}` : '—'
  }

  // Chef -> équipe qu'il dirige déjà (au plus une, UNIQUE(chef_equipe_id)).
  const equipeIdParChef = new Map(equipes.filter((e) => e.actif).map((e) => [e.chef_equipe_id, e.id]))
  // Chefs sans équipe — seuls proposés à la création d'une nouvelle équipe.
  const chefsLibres = chefs.filter((c) => !equipeIdParChef.has(c.id))

  const createEquipeMutation = useMutation({
    mutationFn: (data: components['schemas']['EquipeTerrestreCreate']) =>
      api.post('/equipes-terrestres', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipes-terrestres'] })
      setShowCreateEquipe(false)
      setNomEquipe('')
      setChefEquipeId('')
      setMembres([])
      setNouveauMembre('')
      setCreateEquipeError('')
    },
    onError: (err: AxiosError<{ detail?: string }>) => {
      setCreateEquipeError(err.response?.data?.detail || 'Erreur lors de la création')
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

  const equipeColumns: DataTableColumn<EquipeTerrestre>[] = [
    { key: 'nom', header: 'Équipe', render: (e) => <span className="font-semibold">{e.nom}</span> },
    { key: 'chef', header: "Chef d'équipe", render: (e) => nomChef(e.chef_equipe_id) },
    {
      key: 'membres',
      header: 'Autres membres',
      render: (e) =>
        e.membres && e.membres.length > 0 ? (
          e.membres.map((m) => m.nom).join(', ')
        ) : (
          <span className="text-ifvm-text-weak">—</span>
        ),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-sans text-[14px] font-bold">Équipes terrestres</h2>
          <button
            onClick={() => setShowCreateEquipe(true)}
            className="rounded-[9px] bg-ifvm-green-text px-4 py-[8px] font-sans text-[12px] font-bold text-white transition hover:bg-[#1a4429]"
          >
            + Nouvelle équipe
          </button>
        </div>
        <p className="font-sans text-[11px] text-ifvm-text-weak">
          Le rattachement d'un poste acridien à une équipe se fait dans le formulaire « Postes
          acridiens » (champ « Équipe terrestre ») — plusieurs postes peuvent partager la même équipe.
        </p>

        {chefsIsError && (
          <ErrorBanner
            label="Erreur"
            message={
              (chefsError as AxiosError<{ detail?: string }>)?.response?.data?.detail ??
              "Impossible de charger les chefs d'équipe."
            }
          />
        )}
        {equipesIsError ? (
          <ErrorBanner
            label="Erreur"
            message={
              (equipesError as AxiosError<{ detail?: string }>)?.response?.data?.detail ??
              'Impossible de charger les équipes terrestres.'
            }
          />
        ) : (
          <div className="overflow-hidden rounded-[11px] border border-[#e7e0cd] bg-card">
            <DataTable
              columns={equipeColumns}
              rows={equipes}
              getRowKey={(e) => e.id}
              emptyMessage={equipesLoading ? 'Chargement…' : 'Aucune équipe terrestre.'}
            />
          </div>
        )}
      </section>

      {/* Modale : nouvelle équipe */}
      {showCreateEquipe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="border-b px-6 py-4">
              <h2 className="text-lg font-semibold">Nouvelle équipe terrestre</h2>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                setCreateEquipeError('')
                createEquipeMutation.mutate({
                  nom: nomEquipe.trim(),
                  chef_equipe_id: chefEquipeId,
                  membres: membres.map((nom) => ({ nom })),
                })
              }}
              className="space-y-4 px-6 py-4"
            >
              {createEquipeError && (
                <div className="rounded bg-red-50 p-3 text-sm text-red-700">{createEquipeError}</div>
              )}
              <div>
                <label htmlFor="equipe-terrestre-nom" className={labelClass}>
                  Nom *
                </label>
                <input
                  id="equipe-terrestre-nom"
                  type="text"
                  value={nomEquipe}
                  onChange={(e) => setNomEquipe(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="equipe-terrestre-chef" className={labelClass}>
                  Chef d'équipe *
                </label>
                <select
                  id="equipe-terrestre-chef"
                  value={chefEquipeId}
                  onChange={(e) => setChefEquipeId(e.target.value)}
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
                <label htmlFor="equipe-terrestre-nouveau-membre" className={labelClass}>
                  Autres membres (facultatif)
                </label>
                <div className="flex gap-2">
                  <input
                    id="equipe-terrestre-nouveau-membre"
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
                    setChefEquipeId('')
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
    </div>
  )
}
