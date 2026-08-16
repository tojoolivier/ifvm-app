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
  const { data: stationsData = [], isLoading, isError, error } = useQuery<StationFixe[]>({
    queryKey: ['stations'],
    queryFn: () => api.get('/stations').then((r) => r.data),
  })
  const stations = Array.isArray(stationsData) ? stationsData : []

  // GET /prospections filtre par station_id mais n'expose pas de compteur agrégé :
  // un seul fetch de la liste complète, comptée côté client par station.
  const { data: prospectionsData = [] } = useQuery<{ station_id: string | null }[]>({
    queryKey: ['prospections', 'all'],
    queryFn: () => api.get('/prospections').then((r) => r.data),
  })
  const prospectionsParStation = new Map<string, number>()
  for (const p of prospectionsData) {
    if (!p.station_id) continue
    prospectionsParStation.set(p.station_id, (prospectionsParStation.get(p.station_id) ?? 0) + 1)
  }

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
      key: 'aire_protegee',
      header: 'Aire protégée',
      render: () => <span className="text-ifvm-text-weak">—</span>,
    },
    {
      key: 'coordonnees',
      header: 'Coordonnées',
      align: 'right',
      mono: true,
      render: (s) =>
        s.latitude != null && s.longitude != null
          ? `${s.latitude.toFixed(4)}, ${s.longitude.toFixed(4)}`
          : '—',
    },
    {
      key: 'prospections',
      header: 'Prospections',
      align: 'right',
      mono: true,
      render: (s) => prospectionsParStation.get(s.id) ?? 0,
    },
    { key: 'etat', header: 'État', render: (s) => <EtatBadge actif={s.actif} /> },
  ]

  return (
    <div>
      <div className="mb-4 rounded-[9px] border border-ifvm-amber-border bg-ifvm-amber-bg px-4 py-3 text-sm text-ifvm-amber-text">
        Aire protégée n'est pas exposée par l'API
        (<code className="mx-1 font-mono">StationFixeRead</code>
        ne porte pas ce champ) : cette colonne de la maquette reste vide tant que le backend n'est
        pas étendu. Les écritures (créer/modifier/supprimer une station) ne sont pas non plus
        disponibles côté API — le bouton « Nouvelle station » ne peut pas être fonctionnel.
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
              rows={stations}
              getRowKey={(s) => s.id}
              emptyMessage="Aucune station trouvée."
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
