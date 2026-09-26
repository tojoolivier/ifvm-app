import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { api } from '../api/client'
import { Utilisateur } from '../types'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { DataTable, type DataTableColumn, type DataTableSort } from '../components/ui/data-table'
import { Switch } from '../components/ui/switch'
import { ErrorBanner } from '@/components/ui/error-banner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { PAGE_SIZE, compareSortValues, nextSort, normalize } from '@/lib/table-search-sort'

const ROLES = [
  'prospecteur',
  'verificateur',
  'validation_finale',
  'chef_equipe',
  'agent_encadreur',
  'pilote',
  'mecanicien',
  'chef_de_base',
  'consultant_international',
  'admin',
]

/**
 * Ton de badge par rôle — prototype ligne 1521 : la maquette colore le rôle
 * avec la palette des statuts (`map={Admin:'verifiee', Chef:'validee', …}`).
 * On garde la même logique : encadrement en vert, contrôle en ambre,
 * validation finale en rouge, terrain en gris, administration en bleu.
 */
const ROLE_TONES: Record<string, string> = {
  prospecteur: 'bg-ifvm-brouillon-bg text-ifvm-brouillon-text border-ifvm-brouillon-border',
  pilote: 'bg-ifvm-brouillon-bg text-ifvm-brouillon-text border-ifvm-brouillon-border',
  mecanicien: 'bg-ifvm-brouillon-bg text-ifvm-brouillon-text border-ifvm-brouillon-border',
  verificateur: 'bg-ifvm-amber-bg text-ifvm-amber-text border-ifvm-amber-border',
  validation_finale: 'bg-ifvm-danger-bg text-ifvm-danger-text border-ifvm-danger-border',
  chef_equipe: 'bg-ifvm-green-bg text-ifvm-green-text border-ifvm-green-border',
  chef_de_base: 'bg-ifvm-green-bg text-ifvm-green-text border-ifvm-green-border',
  agent_encadreur: 'bg-ifvm-green-bg text-ifvm-green-text border-ifvm-green-border',
  consultant_international: 'bg-ifvm-brouillon-bg text-ifvm-brouillon-text border-ifvm-brouillon-border',
  admin: 'bg-ifvm-blue-bg text-ifvm-blue-text border-ifvm-blue-border',
}

const ROLE_LABELS: Record<string, string> = {
  prospecteur: 'Prospecteur',
  verificateur: 'Vérificateur',
  validation_finale: 'Validation finale',
  chef_equipe: "Chef d'équipe",
  agent_encadreur: 'Agent encadreur',
  pilote: 'Pilote',
  mecanicien: 'Mécanicien',
  chef_de_base: 'Chef de base',
  consultant_international: 'Consultant international',
  admin: 'Administrateur',
}

const fieldLabelClass =
  'font-sans text-[9.5px] font-semibold uppercase tracking-[.8px] text-ifvm-text-weak'
const inputClass =
  'min-h-9 w-full rounded-lg border border-[#e0d9c4] bg-white px-[11px] text-[12.5px] font-semibold text-[#16201a] focus:outline-none focus:ring-2 focus:ring-[#235a36]'

interface UtilisateursSectionProps {
  showCreate: boolean
  onShowCreateChange: (showCreate: boolean) => void
}

/**
 * Section « Utilisateurs » de l'écran Administration — même présentation que
 * ReferentielsPage.tsx (carte d'en-tête, carte « Enregistrements » avec
 * recherche/tri/pagination, modale de création), portée ici avec la logique
 * métier propre à cet écran : rôle et interrupteur actif verrouillés sur son
 * propre compte (issue #250), sigle éditable en ligne, compteur de fiches
 * dérivé de `GET /prospections`.
 */
export function UtilisateursSection({ showCreate, onShowCreateChange }: UtilisateursSectionProps) {
  const queryClient = useQueryClient()
  const { data: currentUser } = useCurrentUser()
  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState(ROLES[0])
  const [sigle, setSigle] = useState('')
  const [createError, setCreateError] = useState('')

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<DataTableSort | null>(null)
  const [page, setPage] = useState(1)

  const { data: usersData = [], isLoading, isError, error } = useQuery<Utilisateur[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users/').then((r) => r.data),
  })
  const users = Array.isArray(usersData) ? usersData : []

  const errorStatus = (error as AxiosError)?.response?.status
  const errorDetail = (error as AxiosError<{ detail?: string }>)?.response?.data?.detail

  // Colonne « Fiches » de la maquette : `GET /prospections` n'expose pas de
  // compteur agrégé par prospecteur — on compte côté client, comme le fait déjà
  // StationsSection pour ses prospections par station. Provisoire : la liste
  // complète transite à chaque affichage, ce qui ne tiendra pas à l'échelle
  // d'une base de plusieurs milliers de fiches. Un agrégat côté API
  // (`GET /prospections?group_by=prospecteur_id`) est la vraie réponse.
  const { data: prospectionsData = [], isError: fichesIndisponibles } = useQuery<
    { prospecteur_id: string | null }[]
  >({
    queryKey: ['prospections', 'all'],
    queryFn: () => api.get('/prospections').then((r) => r.data),
  })
  const fichesParProspecteur = new Map<string, number>()
  for (const p of Array.isArray(prospectionsData) ? prospectionsData : []) {
    if (!p.prospecteur_id) continue
    fichesParProspecteur.set(p.prospecteur_id, (fichesParProspecteur.get(p.prospecteur_id) ?? 0) + 1)
  }

  const createMutation = useMutation({
    mutationFn: (data: { nom: string; prenom: string; email: string; password: string; role: string; sigle: string }) =>
      api.post('/users/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      onShowCreateChange(false)
      resetForm()
    },
    onError: (err: AxiosError<{ detail?: string }>) => {
      setCreateError(err.response?.data?.detail || 'Erreur lors de la création')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; role?: string; actif?: boolean; sigle?: string }) =>
      api.patch(`/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (err: AxiosError<{ detail?: string }>) => {
      alert(err.response?.data?.detail || 'Erreur lors de la mise à jour')
    },
  })

  function resetForm() {
    setNom('')
    setPrenom('')
    setEmail('')
    setPassword('')
    setRole(ROLES[0])
    setSigle('')
    setCreateError('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setCreateError('')
    createMutation.mutate({ nom, prenom, email, password, role, sigle: sigle.trim() })
  }

  const columns: DataTableColumn<Utilisateur>[] = [
    {
      key: 'nom',
      header: 'Nom',
      render: (u) => <span className="text-[12.5px] font-semibold">{`${u.prenom} ${u.nom}`}</span>,
      sortValue: (u) => `${u.nom} ${u.prenom}`,
    },
    {
      key: 'email',
      header: 'Email',
      mono: true,
      render: (u) => (
        <span className="font-mono text-[11.5px] font-medium text-ifvm-text-tertiary">{u.email}</span>
      ),
      sortValue: (u) => u.email,
    },
    {
      key: 'sigle',
      header: 'Sigle',
      render: (u) => (
        // Chaîne vide envoyée au blur = effacement explicite côté backend
        // (distinct de l'absence du champ, qui laisse le sigle inchangé) —
        // cf. `update_user` (routers/users.py). `key` force le remontage si la
        // valeur change ailleurs (refetch après succès), pour ne jamais
        // afficher une saisie non commise à côté d'une valeur serveur stale.
        <input
          key={u.sigle ?? ''}
          type="text"
          maxLength={10}
          defaultValue={u.sigle ?? ''}
          aria-label={`Sigle de ${u.prenom} ${u.nom}`}
          placeholder="—"
          disabled={updateMutation.isPending}
          onBlur={(e) => {
            const value = e.target.value.trim()
            if (value === (u.sigle ?? '')) return
            updateMutation.mutate({ id: u.id, sigle: value })
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          className="w-20 rounded border border-[#e7e0cd] bg-white px-2 py-1 font-mono text-[11.5px] font-medium uppercase text-ifvm-text-tertiary focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
        />
      ),
      sortValue: (u) => u.sigle ?? null,
    },
    {
      key: 'role',
      header: 'Rôle',
      render: (u) => (
        // La maquette dessine un badge ; le rôle reste modifiable, on garde donc
        // un `select` habillé aux couleurs du badge plutôt qu'un texte inerte.
        // Exception : un admin ne peut pas changer son propre rôle (il se
        // verrouillerait hors de l'administration) — le backend renvoie 403.
        <select
          value={u.role}
          aria-label={`Rôle de ${u.prenom} ${u.nom}`}
          disabled={updateMutation.isPending || u.id === currentUser?.id}
          onChange={(e) => updateMutation.mutate({ id: u.id, role: e.target.value })}
          className={cn(
            'inline-flex items-center rounded-full border px-[9px] py-[3px] font-sans text-[10px] font-bold disabled:opacity-50',
            ROLE_TONES[u.role] ?? 'bg-ifvm-brouillon-bg text-ifvm-brouillon-text border-ifvm-brouillon-border',
          )}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      ),
      sortValue: (u) => ROLE_LABELS[u.role] ?? u.role,
    },
    {
      key: 'station',
      header: 'Station',
      render: (u) =>
        u.pa_nom ? (
          <span className="text-[#3a3a30]">{u.pa_code ? `${u.pa_code} ${u.pa_nom}` : u.pa_nom}</span>
        ) : (
          <span className="text-ifvm-text-weak">—</span>
        ),
      sortValue: (u) => u.pa_nom ?? null,
    },
    {
      key: 'fiches',
      header: 'Fiches',
      align: 'right',
      mono: true,
      // Un « ? » plutôt qu'un 0 trompeur si le comptage n'a pas pu être chargé.
      render: (u) => (fichesIndisponibles ? <span className="text-ifvm-text-weak">?</span> : (fichesParProspecteur.get(u.id) ?? 0)),
      sortValue: (u) => (fichesIndisponibles ? null : (fichesParProspecteur.get(u.id) ?? 0)),
    },
    {
      key: 'actif',
      header: 'Actif',
      render: (u) => (
        <Switch
          checked={u.actif}
          disabled={updateMutation.isPending || u.id === currentUser?.id}
          onCheckedChange={(checked) => updateMutation.mutate({ id: u.id, actif: checked })}
          aria-label={`${u.prenom} ${u.nom} — ${u.actif ? 'actif' : 'inactif'}`}
        />
      ),
      sortValue: (u) => u.actif,
    },
  ]

  const searchQuery = normalize(search.trim())
  const searchedRows = searchQuery
    ? users.filter((u) =>
        columns.some((column) => {
          const value = column.sortValue?.(u)
          return value !== null && value !== undefined && normalize(String(value)).includes(searchQuery)
        }),
      )
    : users

  const sortColumn = sort ? columns.find((c) => c.key === sort.key) : undefined
  const sortedRows =
    sort && sortColumn?.sortValue
      ? [...searchedRows].sort((a, b) => {
          const cmp = compareSortValues(sortColumn.sortValue!(a), sortColumn.sortValue!(b))
          return sort.direction === 'asc' ? cmp : -cmp
        })
      : searchedRows

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginatedRows = sortedRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function updateSearch(value: string) {
    setSearch(value)
    setPage(1)
  }

  function toggleSort(key: string) {
    setSort((current) => nextSort(current, key))
    setPage(1)
  }

  return (
    <div className="flex min-w-0 flex-col gap-[14px]">
      {/* Carte d'en-tête */}
      <div className="flex flex-col gap-[9px] rounded-[11px] border border-[#e7e0cd] bg-white px-5 py-4">
        <div className="flex flex-wrap items-center gap-[10px]">
          <h2 className="flex-1 font-sans text-[17px] font-extrabold">Utilisateurs</h2>
          <span className="font-mono text-[11px] font-medium text-ifvm-text-weak">utilisateur</span>
          <span className="rounded-full border border-ifvm-green-border bg-ifvm-green-bg px-[10px] py-1 font-sans text-[10px] font-bold text-ifvm-green-text">
            GET /users/ · POST /users/ · PATCH /users/{'{id}'}
          </span>
        </div>
        <p className="font-sans text-[12.5px] font-medium leading-[1.55] text-[#3a3a30]">
          Agents et encadrants. Le rôle conditionne la navigation web et les rôles signataires des
          fiches de traitement.
        </p>
      </div>

      {/* Carte Enregistrements */}
      <div className="overflow-hidden rounded-[11px] border border-[#e7e0cd] bg-white">
        <div className="flex flex-wrap items-center gap-x-[10px] gap-y-2 border-b border-[#f1ecdd] px-4 py-[13px] sm:px-5">
          <h3 className="flex-1 font-sans text-[13px] font-bold">Enregistrements</h3>
          <Label htmlFor="utilisateurs-recherche" className="sr-only">
            Rechercher parmi les utilisateurs
          </Label>
          <Input
            id="utilisateurs-recherche"
            type="search"
            value={search}
            onChange={(event) => updateSearch(event.target.value)}
            placeholder="Rechercher…"
            className="order-last h-10 basis-full rounded-[8px] border-[#e0d9c4] bg-[#fffdf8] text-[12px] sm:order-none sm:h-9 sm:w-48 sm:basis-auto"
          />
          <button
            type="button"
            onClick={() => onShowCreateChange(true)}
            className="rounded-lg bg-[#235a36] px-[14px] py-2 font-sans text-[11.5px] font-bold text-white transition-colors duration-[120ms] hover:bg-[#1a4429]"
          >
            + Nouvel utilisateur
          </button>
        </div>

        {isError ? (
          <div className="p-5">
            <ErrorBanner
              label={errorStatus ? `Erreur ${errorStatus}` : 'Erreur'}
              message={errorDetail ?? 'Impossible de charger les utilisateurs.'}
            />
          </div>
        ) : isLoading ? (
          <div className="divide-y divide-[#f4efe2]">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-[43px] animate-pulse bg-[#faf7ef]" />
            ))}
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={paginatedRows}
            getRowKey={(u) => u.id}
            rowClassName={(_, index) => (index % 2 ? 'bg-[#fffdf8]' : 'bg-white')}
            emptyMessage={searchQuery ? `Aucun résultat pour « ${search.trim()} ».` : 'Aucun utilisateur enregistré.'}
            sort={sort ?? undefined}
            onSortChange={toggleSort}
          />
        )}

        {!isError && !isLoading && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#f1ecdd] px-5 py-3">
            <span className="font-sans text-[11.5px] font-medium text-ifvm-text-weak">
              Page {currentPage} / {totalPages} · {sortedRows.length} enregistrement
              {sortedRows.length > 1 ? 's' : ''}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="rounded-[8px] border border-[#e0d9c4] bg-white px-3 py-2 font-sans text-[11.5px] font-semibold text-ifvm-text-tertiary disabled:opacity-50"
              >
                ← Précédent
              </button>
              <button
                type="button"
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="rounded-[8px] border border-[#e0d9c4] bg-white px-3 py-2 font-sans text-[11.5px] font-semibold text-ifvm-text-tertiary disabled:opacity-50"
              >
                Suivant →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modale : nouvel utilisateur */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Nouvel utilisateur"
            className="mx-4 w-full max-w-md rounded-[11px] border border-[#e7e0cd] bg-white shadow-xl"
          >
            <div className="border-b border-[#f4efe2] px-4 py-4 sm:px-6">
              <h2 className="font-sans text-[15px] font-extrabold">Nouvel utilisateur</h2>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 py-4 sm:px-6">
              {createError && <ErrorBanner label="Création impossible" message={createError} />}
              <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="nu-prenom" className={fieldLabelClass}>
                    Prénom *
                  </label>
                  <input
                    id="nu-prenom"
                    type="text"
                    value={prenom}
                    onChange={(e) => setPrenom(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="nu-nom" className={fieldLabelClass}>
                    Nom *
                  </label>
                  <input
                    id="nu-nom"
                    type="text"
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="nu-email" className={fieldLabelClass}>
                  Email *
                </label>
                <input
                  id="nu-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="nu-password" className={fieldLabelClass}>
                  Mot de passe *
                </label>
                <input
                  id="nu-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="nu-role" className={fieldLabelClass}>
                  Rôle *
                </label>
                <select
                  id="nu-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  required
                  className={cn(inputClass, 'font-sans')}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="nu-sigle" className={fieldLabelClass}>
                  Sigle
                </label>
                <input
                  id="nu-sigle"
                  type="text"
                  value={sigle}
                  onChange={(e) => setSigle(e.target.value)}
                  maxLength={10}
                  placeholder="Ex. ADM"
                  className={cn(inputClass, 'uppercase')}
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="rounded-[9px] bg-[#235a36] px-4 py-[10px] font-sans text-[12px] font-bold text-white transition-colors duration-[120ms] hover:bg-[#1a4429] disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Création…' : 'Créer'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onShowCreateChange(false)
                    resetForm()
                  }}
                  className="rounded-[9px] border border-[#e7e0cd] px-4 py-[10px] font-sans text-[12px] font-bold text-ifvm-text-tertiary transition-colors duration-[120ms] hover:bg-[#faf7ef]"
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
