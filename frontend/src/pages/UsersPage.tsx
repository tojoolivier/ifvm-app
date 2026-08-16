import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { api } from '../api/client'
import { Utilisateur } from '../types'
import { DataTable, DataTableColumn } from '../components/ui/data-table'
import { Switch } from '../components/ui/switch'
import { Card, CardContent } from '../components/ui/card'

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
  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState(ROLES[0])
  const [createError, setCreateError] = useState('')

  const { data: usersData = [], isLoading } = useQuery<Utilisateur[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users/').then((r) => r.data),
  })
  const users = Array.isArray(usersData) ? usersData : []

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
      render: (u) => `${u.prenom} ${u.nom}`,
    },
    {
      key: 'email',
      header: 'Email',
      mono: true,
      render: (u) => <span className="font-mono text-ifvm-text-tertiary">{u.email}</span>,
    },
    {
      key: 'role',
      header: 'Rôle',
      render: (u) => (
        <select
          value={u.role}
          disabled={updateMutation.isPending}
          onChange={(e) => updateMutation.mutate({ id: u.id, role: e.target.value })}
          className="inline-flex items-center rounded-full border border-ifvm-green-border bg-ifvm-green-bg px-[9px] py-[3px] font-sans text-[10px] font-bold text-ifvm-green-text disabled:opacity-50"
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
      key: 'actif',
      header: 'Actif',
      align: 'right',
      render: (u) => (
        <Switch
          checked={u.actif}
          disabled={updateMutation.isPending}
          onCheckedChange={(checked) => updateMutation.mutate({ id: u.id, actif: checked })}
        />
      ),
    },
  ]

  return (
    <div>
      <div className="mb-4 rounded-[9px] border border-ifvm-amber-border bg-ifvm-amber-bg px-4 py-3 text-sm text-ifvm-amber-text">
        Station et nombre de fiches par utilisateur ne sont pas exposés par l'API (le schéma
        <code className="mx-1 font-mono">UtilisateurRead</code>
        ne porte pas ces champs) : ces deux colonnes de la maquette sont provisoirement masquées.
      </div>

      {isLoading ? (
        <p className="text-ifvm-text-weak">Chargement…</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <DataTable
              columns={columns}
              rows={users}
              getRowKey={(u) => u.id}
              emptyMessage="Aucun utilisateur enregistré."
            />
          </CardContent>
        </Card>
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