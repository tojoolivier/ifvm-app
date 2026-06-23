import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { PosteAcridien } from '../types'

export function DashboardPage() {
  const { data: postes = [], isLoading } = useQuery<PosteAcridien[]>({
    queryKey: ['postes'],
    queryFn: () => api.get('/geo/postes').then((r) => r.data),
  })

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Tableau de bord</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Postes acridiennes', value: postes.length },
          { label: 'Prospections (bientôt)', value: '—' },
          { label: 'CRT (bientôt)', value: '—' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-3xl font-bold text-green-700 mt-1">
              {isLoading ? '…' : value}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="font-semibold text-gray-700 mb-3">Postes acridiennes</h2>
        {isLoading ? (
          <p className="text-sm text-gray-400">Chargement…</p>
        ) : postes.length === 0 ? (
          <p className="text-sm text-gray-400">Aucun poste enregistré.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2">Code</th>
                <th className="pb-2">Nom</th>
                <th className="pb-2">Région</th>
              </tr>
            </thead>
            <tbody>
              {postes.map((pa) => (
                <tr key={pa.id} className="border-b last:border-0">
                  <td className="py-2 font-mono">{pa.code}</td>
                  <td className="py-2">{pa.nom}</td>
                  <td className="py-2 text-gray-500">{pa.region}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
