import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { StatusBadge } from '@/components/ui/status-badge'

interface ProspectionListItem {
  id: string
  n_fiche: string | null
  date_prospection: string
  statut: string
  station_id: string | null
  prospecteur_id: string
}

function shortId(id: string | null | undefined): string {
  if (!id) return '—'
  return id.slice(0, 8) + '…'
}

const columns: DataTableColumn<ProspectionListItem>[] = [
  {
    key: 'n_fiche',
    header: 'N° fiche',
    render: (fiche) => fiche.n_fiche ?? shortId(fiche.id),
  },
  {
    key: 'date',
    header: 'Date',
    render: (fiche) => fiche.date_prospection,
  },
  {
    key: 'prospecteur',
    header: 'Prospecteur',
    mono: true,
    render: (fiche) => shortId(fiche.prospecteur_id),
  },
  {
    key: 'statut',
    header: 'Statut',
    render: (fiche) => <StatusBadge statut={fiche.statut} />,
  },
  {
    key: 'actions',
    header: '',
    align: 'right',
    render: (fiche) => (
      <Link
        to={`/prospections/${fiche.id}`}
        className="text-primary hover:underline text-xs font-medium"
        onClick={(e) => e.stopPropagation()}
      >
        Examiner →
      </Link>
    ),
  },
]

export function ValidationFinalePage() {
  const navigate = useNavigate()
  const { data: fiches = [], isLoading, isError } = useQuery<ProspectionListItem[]>({
    queryKey: ['prospections', 'verifiee'],
    queryFn: () =>
      api.get('/prospections', { params: { statut: 'verifiee' } }).then((r) => r.data),
  })

  return (
    <div className="px-4 py-4 sm:px-8 sm:py-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Validation finale</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fiches vérifiées en attente de validation ou de rejet
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Fiches à traiter ({fiches.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Chargement…</p>
          ) : isError ? (
            <p className="px-4 py-6 text-sm text-destructive">
              Erreur lors du chargement des fiches.
            </p>
          ) : fiches.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              Aucune fiche en attente de validation finale.
            </p>
          ) : (
            <DataTable
              columns={columns}
              rows={fiches}
              getRowKey={(fiche) => fiche.id}
              onRowClick={(fiche) => navigate(`/prospections/${fiche.id}`)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}