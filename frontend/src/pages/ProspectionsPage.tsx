import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../api/client'

interface Campagne {
  id: string
  name: string
  start_date: string
  end_date: string | null
}

interface Prospection {
  id: string
  type_prospection: string
  campagne_id: string
  prospecteur_id: string
  station_id: string | null
  date_prospection: string
  statut: string
  n_fiche: string | null
  n_releve: string | null
  created_at: string
}

const STATUTS = ['brouillon', 'en_attente', 'verifiee', 'validee', 'rejetee'] as const

const STATUT_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  en_attente: 'En attente',
  verifiee: 'Vérifiée',
  validee: 'Validée',
  rejetee: 'Rejetée',
}

const STATUT_CLASSES: Record<string, string> = {
  brouillon: 'bg-gray-100 text-gray-700',
  en_attente: 'bg-orange-100 text-orange-700',
  verifiee: 'bg-blue-100 text-blue-700',
  validee: 'bg-green-100 text-green-700',
  rejetee: 'bg-red-100 text-red-700',
}

const PAGE_SIZE = 20

function StatutBadge({ statut }: { statut: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUT_CLASSES[statut] ?? 'bg-gray-100 text-gray-700'}`}>
      {STATUT_LABELS[statut] ?? statut}
    </span>
  )
}

function shortId(id: string | null): string {
  if (!id) return '—'
  return id.slice(0, 8) + '…'
}

export function ProspectionsPage() {
  const [filtreStatut, setFiltreStatut] = useState('')
  const [filtreCampagne, setFiltreCampagne] = useState('')
  const [filtreStation, setFiltreStation] = useState('')
  const [filtreDate, setFiltreDate] = useState('')
  const [page, setPage] = useState(1)

  const { data: prospections = [], isLoading } = useQuery<Prospection[]>({
    queryKey: ['prospections', 'intensive'],
    queryFn: () => api.get('/prospections', { params: { type: 'intensive' } }).then((r) => r.data),
  })

  const { data: campagnes = [] } = useQuery<Campagne[]>({
    queryKey: ['campagnes'],
    queryFn: () => api.get('/campagnes').then((r) => r.data),
  })

  const campagneMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const c of campagnes) m[c.id] = c.name
    return m
  }, [campagnes])

  const filtered = useMemo(() => {
    let result = prospections
    if (filtreStatut) result = result.filter((p) => p.statut === filtreStatut)
    if (filtreCampagne) result = result.filter((p) => p.campagne_id === filtreCampagne)
    if (filtreStation) result = result.filter((p) => p.station_id?.startsWith(filtreStation))
    if (filtreDate) result = result.filter((p) => p.date_prospection >= filtreDate)
    return result
  }, [prospections, filtreStatut, filtreCampagne, filtreStation, filtreDate])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function resetFiltres() {
    setFiltreStatut('')
    setFiltreCampagne('')
    setFiltreStation('')
    setFiltreDate('')
    setPage(1)
  }

  function handleFiltreChange(setter: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setter(e.target.value)
      setPage(1)
    }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Prospections intensives</h1>
        <Link
          to="/prospections/new"
          className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800 text-sm"
        >
          Nouvelle fiche
        </Link>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Statut</label>
          <select
            value={filtreStatut}
            onChange={handleFiltreChange(setFiltreStatut)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Tous</option>
            {STATUTS.map((s) => (
              <option key={s} value={s}>{STATUT_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Campagne</label>
          <select
            value={filtreCampagne}
            onChange={handleFiltreChange(setFiltreCampagne)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Toutes</option>
            {campagnes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Station (début d'ID)</label>
          <input
            type="text"
            value={filtreStation}
            onChange={handleFiltreChange(setFiltreStation)}
            placeholder="ex: a1b2c3…"
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 w-36"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Date (à partir du)</label>
          <input
            type="date"
            value={filtreDate}
            onChange={handleFiltreChange(setFiltreDate)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        {(filtreStatut || filtreCampagne || filtreStation || filtreDate) && (
          <button
            onClick={resetFiltres}
            className="text-sm text-gray-500 hover:text-gray-700 underline self-end pb-1.5"
          >
            Effacer les filtres
          </button>
        )}
      </div>

      {/* Tableau */}
      {isLoading ? (
        <p className="text-gray-400">Chargement…</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-400">Aucune fiche trouvée.</p>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b bg-gray-50">
                  <th className="px-4 py-3">Station</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Prospecteur</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Campagne</th>
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {shortId(p.station_id)}
                    </td>
                    <td className="px-4 py-3">{p.date_prospection}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {shortId(p.prospecteur_id)}
                    </td>
                    <td className="px-4 py-3">
                      <StatutBadge statut={p.statut} />
                    </td>
                    <td className="px-4 py-3">
                      {campagneMap[p.campagne_id] ?? shortId(p.campagne_id)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/prospections/${p.id}`}
                        className="text-green-700 hover:text-green-900 text-sm font-medium"
                      >
                        Voir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                {filtered.length} fiche{filtered.length > 1 ? 's' : ''} — page {page} / {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="border border-gray-300 px-3 py-1.5 rounded text-sm hover:bg-gray-50 disabled:opacity-40"
                >
                  ← Précédent
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="border border-gray-300 px-3 py-1.5 rounded text-sm hover:bg-gray-50 disabled:opacity-40"
                >
                  Suivant →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
