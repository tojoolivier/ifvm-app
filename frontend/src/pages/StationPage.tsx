import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { cn } from '@/lib/utils'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { ErrorBanner } from '@/components/ui/error-banner'

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

/** Coordonnées au format du prototype : décimale française, séparateur « · ». */
function formatCoordonnees(latitude: number | null, longitude: number | null) {
  if (latitude == null || longitude == null) return '—'
  const decimale = (v: number) => v.toFixed(4).replace('.', ',')
  return `${decimale(latitude)} · ${decimale(longitude)}`
}

export function StationPage() {
  const { data: stationsData = [], isLoading, isError, error } = useQuery<StationFixe[]>({
    // Clé distincte de `['stations']` volontairement : les autres écrans
    // gardent en cache la liste filtrée sur l'actif, ils ne doivent pas hériter
    // de celle-ci.
    queryKey: ['stations', 'administration'],
    // L'écran d'administration porte un badge « État » : il lui faut les
    // stations inactives, que `GET /stations` masque par défaut (le sélecteur
    // de station d'une prospection, lui, ne doit voir que l'actif).
    queryFn: () => api.get('/stations', { params: { inclure_inactifs: true } }).then((r) => r.data),
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
    {
      key: 'station',
      header: 'Station',
      render: (s) => <span className="text-[12.5px] font-semibold">{s.nom}</span>,
    },
    {
      key: 'aire_protegee',
      header: 'Aire protégée',
      // `StationFixeRead` porte bien `pa_nom` (jointure poste acridien) —
      // la colonne était laissée vide sur une hypothèse périmée.
      render: (s) => <span className="text-ifvm-text-tertiary">{s.pa_nom || '—'}</span>,
    },
    {
      key: 'coordonnees',
      header: 'Coordonnées',
      mono: true,
      render: (s) => (
        <span className="text-[11.5px] font-medium text-[#3a3a30]">
          {formatCoordonnees(s.latitude, s.longitude)}
        </span>
      ),
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
      {isError ? (
        <ErrorBanner
          label={errorStatus ? `Erreur ${errorStatus}` : 'Erreur'}
          message={errorDetail ?? 'Impossible de charger les stations.'}
        />
      ) : (
        <div className="overflow-hidden rounded-[11px] border border-[#e7e0cd] bg-card">
          <DataTable
            columns={columns}
            rows={stations}
            getRowKey={(s) => s.id}
            emptyMessage={isLoading ? 'Chargement…' : 'Aucune station trouvée.'}
          />
        </div>
      )}
    </div>
  )
}
