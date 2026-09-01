import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { api } from '../api/client'
import { Utilisateur } from '../types'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { DataTable, DataTableColumn } from '../components/ui/data-table'
import { Switch } from '../components/ui/switch'
import { ErrorBanner } from '@/components/ui/error-banner'
import { cn } from '@/lib/utils'

const ROLES = [
  'prospecteur',
  'verificateur',
  'validation_finale',
  'chef_equipe',
  'agent_encadreur',
  'pilote',
  'mecanicien',
  'chef_de_base',
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
  admin: 'Administrateur',
}

interface UsersPageProps {
  showCreate: boolean
  onShowCreateChange: (showCreate: boolean) => void
}

export function UsersPage({ showCreate, onShowCreateChange }: UsersPageProps) {
  const queryClient = useQueryClient()
  const { data: currentUser } = useCurrentUser()
  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState(ROLES[0])
  const [createError, setCreateError] = useState('')

  const { data: usersData = [], isLoading, isError, error } = useQuery<Utilisateur[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users/').then((r) => r.data),
  })
  const users = Array.isArray(usersData) ? usersData : []

  const errorStatus = (error as AxiosError)?.response?.status
  const errorDetail = (error as AxiosError<{ detail?: string }>)?.response?.data?.detail

  // Colonne « Fiches » de la maquette : `GET /prospections` n'expose pas de
  // compteur agrégé par prospecteur — on compte côté client, comme le fait déjà
  // StationPage pour ses prospections par station. Provisoire : la liste
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
    mutationFn: (data: { nom: string; prenom: string; email: string; password: string; role: string }) =>
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
    mutationFn: ({ id, ...data }: { id: string; role?: string; actif?: boolean }) =>
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
    setCreateError('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setCreateError('')
    createMutation.mutate({ nom, prenom, email, password, role })
  }

  const columns: DataTableColumn<Utilisateur>[] = [
    {
      key: 'nom',
      header: 'Nom',
      render: (u) => (
        <span className="text-[12.5px] font-semibold">{`${u.prenom} ${u.nom}`}</span>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      mono: true,
      render: (u) => (
        <span className="font-mono text-[11.5px] font-medium text-ifvm-text-tertiary">
          {u.email}
        </span>
      ),
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
            ROLE_TONES[u.role] ??
              'bg-ifvm-brouillon-bg text-ifvm-brouillon-text border-ifvm-brouillon-border',
          )}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: 'station',
      header: 'Station',
      render: (u) =>
        u.pa_nom ? (
          <span className="text-[#3a3a30]">
            {u.pa_code ? `${u.pa_code} ${u.pa_nom}` : u.pa_nom}
          </span>
        ) : (
          <span className="text-ifvm-text-weak">—</span>
        ),
    },
    {
      key: 'fiches',
      header: 'Fiches',
      align: 'right',
      mono: true,
      // Un « ? » plutôt qu'un 0 trompeur si le comptage n'a pas pu être chargé.
      render: (u) =>
        fichesIndisponibles ? (
          <span className="text-ifvm-text-weak">?</span>
        ) : (
          (fichesParProspecteur.get(u.id) ?? 0)
        ),
    },
    {
      key: 'actif',
      header: 'Actif',
      render: (u) => (
        <Switch
          checked={u.actif}
          disabled={updateMutation.isPending || u.id === currentUser?.id}
          onCheckedChange={(checked) => updateMutation.mutate({ id: u.id, actif: checked })}
        />
      ),
    },
  ]

  return (
    <div>
      {isError ? (
        <ErrorBanner
          label={errorStatus ? `Erreur ${errorStatus}` : 'Erreur'}
          message={errorDetail ?? 'Impossible de charger les utilisateurs.'}
        />
      ) : (
        <div className="overflow-hidden rounded-[11px] border border-[#e7e0cd] bg-card">
          <DataTable
            columns={columns}
            rows={users}
            getRowKey={(u) => u.id}
            emptyMessage={isLoading ? 'Chargement…' : 'Aucun utilisateur enregistré.'}
          />
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Nouvel utilisateur</h2>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
              {createError && (
                <div className="bg-red-50 text-red-700 p-3 rounded text-sm">{createError}</div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prénom *</label>
                  <input
                    type="text"
                    value={prenom}
                    onChange={(e) => setPrenom(e.target.value)}
                    required
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                  <input
                    type="text"
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    required
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe *</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rôle *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800 disabled:opacity-50 transition"
                >
                  {createMutation.isPending ? 'Création…' : 'Créer'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onShowCreateChange(false)
                    resetForm()
                  }}
                  className="border border-gray-300 px-4 py-2 rounded hover:bg-gray-50 transition"
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