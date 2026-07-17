import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ProspectionListItem {
  id: string
  n_fiche: string | null
  date_prospection: string
  statut: string
  station_id: string | null
  prospecteur_id: string
}

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

function StatutBadge({ statut }: { statut: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        STATUT_CLASSES[statut] ?? 'bg-gray-100 text-gray-700',
      )}
    >
      {STATUT_LABELS[statut] ?? statut}
    </span>
  )
}

function shortId(id: string | null | undefined): string {
  if (!id) return '—'
  return id.slice(0, 8) + '…'
}

export function ValidationFinalePage() {
  const { data: fiches = [], isLoading, isError } = useQuery<ProspectionListItem[]>({
    queryKey: ['prospections', 'verifiee'],
    queryFn: () =>
      api.get('/prospections', { params: { statut: 'verifiee' } }).then((r) => r.data),
  })

  return (
    <div className="px-8 py-6 max-w-4xl mx-auto">
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
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">N° fiche</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Prospecteur</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Statut</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody>
                {fiches.map((fiche) => (
                  <tr key={fiche.id} className="border-b last:border-0">
                    <td className="px-4 py-2 font-medium">
                      {fiche.n_fiche ?? shortId(fiche.id)}
                    </td>
                    <td className="px-4 py-2">{fiche.date_prospection}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {shortId(fiche.prospecteur_id)}
                    </td>
                    <td className="px-4 py-2">
                      <StatutBadge statut={fiche.statut} />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        to={`/prospections/${fiche.id}`}
                        className="text-primary hover:underline text-xs font-medium"
                      >
                        Examiner →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}