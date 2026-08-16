import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { cn } from '@/lib/utils'
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
import { MODE_LABELS, SIGNATURE_ROLES, STATUS_LABELS, TYPE_LABELS } from '@/lib/traitement-labels'

const TYPES_TRAITEMENT = ['AERIEN', 'TERRESTRE'] as const

interface Traitement {
  id: string
  numero_fiche: string
  type_traitement: string
  mode_traitement: string | null
  date_traitement: string
  localite: string
  statut: string
  aerien: { pilote: string } | null
  terrestre: { surface_traitee_ha: number | null; surface_restante_ha: number | null } | null
  signatures: { role: string; signataire_nom: string }[]
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-[9px] py-[3px] font-sans text-[10px] font-bold',
        type === 'AERIEN'
          ? 'bg-ifvm-green-bg text-ifvm-green-text border-ifvm-green-border'
          : 'bg-ifvm-blue-bg text-ifvm-blue-text border-ifvm-blue-border',
      )}
    >
      {TYPE_LABELS[type] ?? type}
    </span>
  )
}

function responsable(t: Traitement): string {
  if (t.aerien) return t.aerien.pilote
  const chefEquipe = t.signatures.find((s) => s.role === 'CHEF_EQUIPE')
  return chefEquipe ? chefEquipe.signataire_nom : '—'
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

  const { data: traitements = [], isLoading, isError, error } = useQuery<Traitement[]>({
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

  const errorStatus = (error as { response?: { status?: number } })?.response?.status
  const errorDetail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
  const errorLabel = errorStatus ? STATUS_LABELS[errorStatus] ?? `Erreur ${errorStatus}` : 'Erreur'
  const errorMessage = errorDetail ?? 'Impossible de charger les traitements.'

  const columns: DataTableColumn<Traitement>[] = useMemo(
    () => [
      {
        key: 'numero_fiche',
        header: 'N° fiche',
        mono: true,
        render: (t) => <span className="text-ifvm-green-text">{t.numero_fiche}</span>,
      },
      { key: 'type', header: 'Type', render: (t) => <TypeBadge type={t.type_traitement} /> },
      { key: 'mode', header: 'Mode', render: (t) => (t.mode_traitement ? MODE_LABELS[t.mode_traitement] ?? t.mode_traitement : '—') },
      { key: 'date', header: 'Date', mono: true, render: (t) => t.date_traitement },
      { key: 'responsable', header: 'Responsable', render: responsable },
      {
        key: 'traitee',
        header: 'Traitée (ha)',
        align: 'right',
        mono: true,
        render: (t) => (t.terrestre?.surface_traitee_ha != null ? `${t.terrestre.surface_traitee_ha} ha` : '—'),
      },
      {
        key: 'restante',
        header: 'Restante (ha)',
        align: 'right',
        mono: true,
        render: (t) => {
          const restante = t.terrestre?.surface_restante_ha
          if (restante == null) return '—'
          return <span className={restante > 0 ? 'text-ifvm-amber-text font-semibold' : undefined}>{restante} ha</span>
        },
      },
      {
        key: 'signatures',
        header: 'Signatures',
        align: 'right',
        mono: true,
        render: (t) => `${t.signatures.length}/${SIGNATURE_ROLES.length}`,
      },
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
            Ouvrir ›
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
        <p className="text-sm text-ifvm-text-tertiary">
          Chaque fiche est rattachée à une prospection validée.
        </p>
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
      ) : isError ? (
        <Card>
          <CardContent className="p-4">
            <p className="font-medium text-destructive">{errorLabel}</p>
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
          </CardContent>
        </Card>
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
