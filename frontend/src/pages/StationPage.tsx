import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'

interface StationFixe {
  id: string
  code: string
  nom: string
  pa_id: string
  pa_code: string
  pa_nom: string
  latitude: number | null
  longitude: number | null
  altitude: number | null
  actif: boolean
  created_at: string
}

function EtatBadge({ actif }: { actif: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-[9px] py-[3px] font-sans text-[10px] font-bold',
        actif
          ? 'bg-ifvm-green-bg text-ifvm-green-text border-ifvm-green-border'
          : 'bg-ifvm-brouillon-bg text-ifvm-brouillon-text border-ifvm-brouillon-border',
      )}
    >
      {actif ? 'Active' : 'Inactive'}
    </span>
  )
}

export function StationPage() {
  const [search, setSearch] = useState('')

  const { data: stationsData = [], isLoading, isError, error } = useQuery<StationFixe[]>({
    queryKey: ['stations'],
    queryFn: () => api.get('/stations').then((r) => r.data),
  })
  const stations = Array.isArray(stationsData) ? stationsData : []

  const filtered = stations.filter(
    (s) =>
      s.nom.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase()),
  )

  const errorStatus = (error as { response?: { status?: number } })?.response?.status
  const errorDetail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail

  const columns: DataTableColumn<StationFixe>[] = [
    {
      key: 'code',
      header: 'Code',
      mono: true,
      render: (s) => <span className="font-mono text-ifvm-green-text">{s.code}</span>,
    },
    { key: 'station', header: 'Station', render: (s) => s.nom },
    {
      key: 'coordonnees',
      header: 'Coordonnées',
      align: 'right',
      mono: true,
      render: (s) =>
        s.latitude != null && s.longitude != null ? `${s.latitude}, ${s.longitude}` : '—',
    },
    { key: 'etat', header: 'État', render: (s) => <EtatBadge actif={s.actif} /> },
  ]

  return (
    <div className="px-8 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-ifvm-text-tertiary">Stations</h1>
        <input
          type="text"
          placeholder="Rechercher une station…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 rounded-[8px] border border-ifvm-text-weak/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ifvm-green-text/40"
        />
      </div>

      <div className="mb-4 rounded-[9px] border border-ifvm-amber-border bg-ifvm-amber-bg px-4 py-3 text-sm text-ifvm-amber-text">
        Aire protégée et nombre de prospections par station ne sont pas exposés par l'API
        (<code className="mx-1 font-mono">StationFixeRead</code>
        ne porte pas ces champs) : ces deux colonnes restent vides tant que le backend n'est pas
        étendu. Les écritures (créer/modifier/supprimer une station) ne sont pas non plus
        disponibles côté API — cet écran est en lecture seule.
      </div>

      {isLoading ? (
        <p className="text-ifvm-text-weak">Chargement…</p>
      ) : isError ? (
        <Card>
          <CardContent className="p-4">
            <p className="font-medium text-destructive">
              {errorStatus ? `Erreur ${errorStatus}` : 'Erreur'}
            </p>
            <p className="text-sm text-muted-foreground">
              {errorDetail ?? 'Impossible de charger les stations.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <DataTable
              columns={columns}
              rows={filtered}
              getRowKey={(s) => s.id}
              emptyMessage="Aucune station trouvée."
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
