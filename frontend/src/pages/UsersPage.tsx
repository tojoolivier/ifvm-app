import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { api } from '../api/client'
import { Utilisateur } from '../types'

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
  chef_equipe: 'Chef d\'équipe',
  agent_encadreur: 'Agent encadreur',
  pilote: 'Pilote',
  mecanicien: 'Mécanicien',
  chef_de_base: 'Chef de base',
  admin: 'Administrateur',
}

export function UsersPage() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState(ROLES[0])
  const [createError, setCreateError] = useState('')

  const { data: users = [], isLoading } = useQuery<Utilisateur[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: { nom: string; prenom: string; email: string; password: string; role: string }) =>
      api.post('/users', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setShowCreate(false)
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

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Gestion des utilisateurs</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800"
        >
          Nouvel utilisateur
        </button>
      </div>

      {isLoading ? (
        <p className="text-gray-400">Chargement…</p>
      ) : users.length === 0 ? (
        <p className="text-gray-400">Aucun utilisateur enregistré.</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b bg-gray-50">
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Rôle</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Créé le</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    {u.prenom} {u.nom}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={(e) => updateMutation.mutate({ id: u.id, role: e.target.value })}
                      className="border border-gray-200 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => updateMutation.mutate({ id: u.id, actif: !u.actif })}
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        u.actif
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-red-100 text-red-800 hover:bg-red-200'
                      }`}
                    >
                      {u.actif ? 'Actif' : 'Inactif'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(u.created_at).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
                  className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800 disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Création…' : 'Créer'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); resetForm() }}
                  className="border border-gray-300 px-4 py-2 rounded hover:bg-gray-50"
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
