import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { Button } from '@/components/ui/button'
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
import { StatusBadge } from '@/components/ui/status-badge'

const TYPES_TRAITEMENT = ['AERIEN', 'TERRESTRE'] as const

const TYPE_LABELS: Record<string, string> = {
  AERIEN: 'Aérien',
  TERRESTRE: 'Terrestre',
}

interface Traitement {
  id: string
  numero_fiche: string
  type_traitement: string
  date_traitement: string
  localite: string
  statut: string
}

export function TraitementsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const filtreType = searchParams.get('type_traitement') ?? ''
  const filtreReprenable = searchParams.get('reprenable') ?? ''
  const filtreProspectionId = searchParams.get('prospection_id') ?? ''

  function setFiltre(key: string, value: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    }, { replace: true })
  }

  function resetFiltres() {
    setSearchParams({}, { replace: true })
  }

  const { data: traitements = [], isLoading } = useQuery<Traitement[]>({
    queryKey: ['traitements', filtreType, filtreReprenable, filtreProspectionId],
    queryFn: () =>
      api
        .get('/traitements', {
          params: {
            type_traitement: filtreType || undefined,
            reprenable: filtreReprenable || undefined,
            prospection_id: filtreProspectionId || undefined,
          },
        })
        .then((r) => r.data),
  })

  const hasFiltres = filtreType || filtreReprenable || filtreProspectionId

  const columns: DataTableColumn<Traitement>[] = useMemo(
    () => [
      { key: 'numero_fiche', header: 'N° fiche', mono: true, render: (t) => t.numero_fiche },
      { key: 'type', header: 'Type', render: (t) => TYPE_LABELS[t.type_traitement] ?? t.type_traitement },
      { key: 'date', header: 'Date', render: (t) => t.date_traitement },
      { key: 'localite', header: 'Localité', render: (t) => t.localite },
      { key: 'statut', header: 'Statut', render: (t) => <StatusBadge statut={t.statut} /> },
      {
        key: 'actions',
        header: 'Actions',
        align: 'right',
        render: (t) => (
          <Button
            variant="ghost"
            size="xs"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/traitements/${t.id}`)
            }}
          >
            Voir
          </Button>
        ),
      },
    ],
    [navigate],
  )

  return (
    <div className="px-8 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Traitements</h1>
      </div>

      <Card className="mb-4">
        <CardContent className="p-4 flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="filtre-type-traitement">Type</Label>
            <Select value={filtreType} onValueChange={(v) => setFiltre('type_traitement', v ?? '')}>
              <SelectTrigger id="filtre-type-traitement" className="w-40">
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tous</SelectItem>
                {TYPES_TRAITEMENT.map((t) => (
                  <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="filtre-reprenable">Reprenable</Label>
            <Select value={filtreReprenable} onValueChange={(v) => setFiltre('reprenable', v ?? '')}>
              <SelectTrigger id="filtre-reprenable" className="w-32">
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tous</SelectItem>
                <SelectItem value="true">Oui</SelectItem>
                <SelectItem value="false">Non</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filtreProspectionId && (
            <div className="flex flex-col gap-2">
              <Label>Prospection</Label>
              <span className="inline-flex items-center h-9 px-3 rounded-md bg-muted text-sm font-mono">
                {filtreProspectionId}
              </span>
            </div>
          )}

          {hasFiltres && (
            <Button variant="ghost" size="sm" className="self-end" onClick={resetFiltres}>
              Effacer les filtres
            </Button>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-muted-foreground">Chargement…</p>
      ) : traitements.length === 0 ? (
        <p className="text-muted-foreground">Aucun traitement trouvé.</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-3">
            {traitements.length} traitement{traitements.length > 1 ? 's' : ''}
          </p>

          <Card>
            <CardContent className="p-0">
              <DataTable
                columns={columns}
                rows={traitements}
                getRowKey={(t) => t.id}
                onRowClick={(t) => navigate(`/traitements/${t.id}`)}
                emptyMessage="Aucun traitement trouvé."
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
