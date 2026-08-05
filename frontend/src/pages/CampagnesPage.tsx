import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

interface Campagne {
  id: string
  name: string
  start_date: string
  end_date: string | null
  created_at: string
}

export function CampagnesPage() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState('')
  const [deleteError, setDeleteError] = useState('')

  const { data: campagnes = [], isLoading } = useQuery<Campagne[]>({
    queryKey: ['campagnes'],
    queryFn: () => api.get('/campagnes').then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: { name: string; start_date: string; end_date: string | null }) =>
      api.post('/campagnes', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campagnes'] })
      setShowModal(false)
      resetForm()
    },
    onError: () => setError('Erreur lors de la création'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/campagnes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campagnes'] })
      setDeleteId(null)
      setDeleteError('')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setDeleteError(
        msg ?? 'Impossible de supprimer cette campagne (des prospections y sont peut-être liées).'
      )
    },
  })

  function resetForm() {
    setName('')
    setStartDate('')
    setEndDate('')
    setError('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    createMutation.mutate({
      name,
      start_date: startDate,
      end_date: endDate || null,
    })
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Campagnes</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800"
        >
          Nouvelle campagne
        </button>
      </div>

      {isLoading ? (
        <p className="text-gray-400">Chargement…</p>
      ) : campagnes.length === 0 ? (
        <p className="text-gray-400">Aucune campagne enregistrée.</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b bg-gray-50">
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Date début</th>
                <th className="px-4 py-3">Date fin</th>
                <th className="px-4 py-3">Créé le</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {campagnes.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3">{c.start_date}</td>
                  <td className="px-4 py-3">{c.end_date || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(c.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => { setDeleteId(c.id); setDeleteError('') }}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Nouvelle campagne</h2>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
              {error && (
                <div className="bg-red-50 text-red-700 p-3 rounded text-sm">{error}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de début *</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
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
                  onClick={() => { setShowModal(false); resetForm() }}
                  className="border border-gray-300 px-4 py-2 rounded hover:bg-gray-50"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Confirmer la suppression</h2>
            </div>
            <div className="px-6 py-4">
              {deleteError && (
                <div className="bg-red-50 text-red-700 p-3 rounded text-sm mb-3">{deleteError}</div>
              )}
              <p className="text-gray-600">
                Voulez-vous vraiment supprimer cette campagne ?
              </p>
            </div>
            <div className="px-6 py-4 border-t flex gap-3 justify-end">
              <button
                onClick={() => { setDeleteId(null); setDeleteError('') }}
                className="border border-gray-300 px-4 py-2 rounded hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}