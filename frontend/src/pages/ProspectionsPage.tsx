import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { STATUTS, STATUT_LABELS, StatusBadge } from '@/components/ui/status-badge'

interface Campagne {
  id: string
  name: string
  start_date: string
  end_date: string | null
}

interface Station {
  id: string
  code: string
  nom: string
  pa_code: string
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

const PAGE_SIZE = 20

function shortId(id: string | null): string {
  if (!id) return '—'
  return id.slice(0, 8) + '…'
}

export function ProspectionsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [stationSearch, setStationSearch] = useState('')
  const [page, setPage] = useState(1)
  const navigate = useNavigate()

  const filtreStatut = searchParams.get('statut') ?? ''
  const filtreCampagne = searchParams.get('campagne') ?? ''
  const filtreStationId = searchParams.get('station') ?? ''
  const filtreDate = searchParams.get('date') ?? ''

  function setFiltre(key: string, value: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    }, { replace: true })
    setPage(1)
  }

  function resetFiltres() {
    setSearchParams({}, { replace: true })
    setStationSearch('')
    setPage(1)
  }

  const { data: prospections = [], isLoading } = useQuery<Prospection[]>({
    queryKey: ['prospections', 'intensive'],
    queryFn: () => api.get('/prospections', { params: { type: 'intensive' } }).then((r) => r.data),
  })

  const { data: campagnes = [] } = useQuery<Campagne[]>({
    queryKey: ['campagnes'],
    queryFn: () => api.get('/campagnes').then((r) => r.data),
  })

  const { data: stations = [] } = useQuery<Station[]>({
    queryKey: ['stations'],
    queryFn: () => api.get('/stations').then((r) => r.data),
  })

  const campagneMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const c of campagnes) m[c.id] = c.name
    return m
  }, [campagnes])

  const stationMap = useMemo(() => {
    const m: Record<string, Station> = {}
    for (const s of stations) m[s.id] = s
    return m
  }, [stations])

  const filteredStations = useMemo(() => {
    if (!stationSearch) return stations
    const q = stationSearch.toLowerCase()
    return stations.filter(
      (s) => s.code.toLowerCase().includes(q) || s.nom.toLowerCase().includes(q)
    )
  }, [stations, stationSearch])

  const filtered = useMemo(() => {
    let result = prospections
    if (filtreStatut) result = result.filter((p) => p.statut === filtreStatut)
    if (filtreCampagne) result = result.filter((p) => p.campagne_id === filtreCampagne)
    if (filtreStationId) result = result.filter((p) => p.station_id === filtreStationId)
    if (filtreDate) result = result.filter((p) => p.date_prospection >= filtreDate)
    return result
  }, [prospections, filtreStatut, filtreCampagne, filtreStationId, filtreDate])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const hasFiltres = filtreStatut || filtreCampagne || filtreStationId || filtreDate

  const columns: DataTableColumn<Prospection>[] = [
    {
      key: 'station',
      header: 'Station',
      render: (p) => {
        const station = p.station_id ? stationMap[p.station_id] : null
        return station ? `${station.code} — ${station.nom}` : shortId(p.station_id)
      },
    },
    { key: 'date', header: 'Date', render: (p) => p.date_prospection },
    { key: 'prospecteur', header: 'Prospecteur', mono: true, render: (p) => shortId(p.prospecteur_id) },
    { key: 'statut', header: 'Statut', render: (p) => <StatusBadge statut={p.statut} /> },
    { key: 'campagne', header: 'Campagne', render: (p) => campagneMap[p.campagne_id] ?? shortId(p.campagne_id) },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (p) => (
        <Button
          variant="ghost"
          size="xs"
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/prospections/${p.id}`)
          }}
        >
          Voir
        </Button>
      ),
    },
  ]

  return (
    <div className="px-8 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Prospections intensives</h1>
        <Link to="/prospections/new" className={buttonVariants()}>
          Nouvelle fiche
        </Link>
      </div>

      {/* Filtres */}
      <Card className="mb-4">
        <CardContent className="p-4 flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="filtre-statut">Statut</Label>
            <Select value={filtreStatut} onValueChange={(v) => setFiltre('statut', v ?? '')}>
              <SelectTrigger id="filtre-statut" className="w-40">
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tous</SelectItem>
                {STATUTS.map((s) => (
                  <SelectItem key={s} value={s}>{STATUT_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="filtre-campagne">Campagne</Label>
            <Select value={filtreCampagne} onValueChange={(v) => setFiltre('campagne', v ?? '')}>
              <SelectTrigger id="filtre-campagne" className="w-48">
                <SelectValue placeholder="Toutes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Toutes</SelectItem>
                {campagnes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="filtre-station-search">Station</Label>
            <Input
              id="filtre-station-search"
              type="text"
              value={stationSearch}
              onChange={(e) => setStationSearch(e.target.value)}
              placeholder="Rechercher par nom ou code…"
              className="w-48"
            />
            <select
              id="filtre-station"
              value={filtreStationId}
              onChange={(e) => setFiltre('station', e.target.value)}
              className="flex h-8 w-48 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Toutes les stations</option>
              {filteredStations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.nom}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="filtre-date">À partir du</Label>
            <Input
              id="filtre-date"
              type="date"
              value={filtreDate}
              onChange={(e) => setFiltre('date', e.target.value)}
              className="w-40"
            />
          </div>

          {hasFiltres && (
            <Button variant="ghost" size="sm" className="self-end" onClick={resetFiltres}>
              Effacer les filtres
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Contenu */}
      {isLoading ? (
        <p className="text-muted-foreground">Chargement…</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">Aucune fiche trouvée.</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-3">
            {filtered.length} prospection{filtered.length > 1 ? 's' : ''}
          </p>

          <Card>
            <CardContent className="p-0">
              <DataTable
                columns={columns}
                rows={paginated}
                getRowKey={(p) => p.id}
                onRowClick={(p) => navigate(`/prospections/${p.id}`)}
                emptyMessage="Aucune fiche trouvée."
              />
            </CardContent>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {page} / {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  ← Précédent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Suivant →
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
