import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { Card, CardContent } from '@/components/ui/card'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'

interface EntityPull {
  upserts: Record<string, unknown>[]
  server_time: string
}

interface ReferentielPullResponse {
  postes_acridiens: EntityPull
  stations_fixes: EntityPull
  utilisateurs_equipe: EntityPull
  pesticides: EntityPull
  cultures: EntityPull
  codes_stades: EntityPull
  campagnes: EntityPull
}

const ENTITES: { key: keyof ReferentielPullResponse; label: string }[] = [
  { key: 'postes_acridiens', label: 'Postes acridiens' },
  { key: 'stations_fixes', label: 'Stations fixes' },
  { key: 'utilisateurs_equipe', label: 'Utilisateurs équipe' },
  { key: 'pesticides', label: 'Pesticides' },
  { key: 'cultures', label: 'Cultures' },
  { key: 'codes_stades', label: 'Codes stades' },
  { key: 'campagnes', label: 'Campagnes' },
]

function buildColumns(rows: Record<string, unknown>[]): DataTableColumn<Record<string, unknown>>[] {
  const keys = rows.length > 0 ? Object.keys(rows[0]) : []
  return keys.map((key) => ({
    key,
    header: key,
    mono: typeof rows[0]?.[key] === 'number',
    align: typeof rows[0]?.[key] === 'number' ? 'right' : 'left',
    render: (row) => {
      const value = row[key]
      if (value === null || value === undefined) return '—'
      if (typeof value === 'boolean') return value ? 'Oui' : 'Non'
      return String(value)
    },
  }))
}

export function ReferentielsPage() {
  const [selected, setSelected] = useState<keyof ReferentielPullResponse>('postes_acridiens')

  const { data, isLoading, refetch, isFetching } = useQuery<ReferentielPullResponse>({
    queryKey: ['referentiel-pull'],
    queryFn: () => api.get('/referentiel/pull').then((r) => r.data),
  })

  const rows = useMemo(() => data?.[selected]?.upserts ?? [], [data, selected])
  const columns = useMemo(() => buildColumns(rows), [rows])
  const serverTime = data?.[selected]?.server_time

  return (
    <div className="px-8 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Référentiels</h1>
      </div>

      <Card className="mb-4">
        <CardContent className="p-4 flex items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            {isLoading
              ? 'Chargement…'
              : serverTime
                ? `Fraîcheur terrain : données au ${new Date(serverTime).toLocaleString('fr-FR')} (serveur)`
                : 'Fraîcheur terrain : indisponible'}
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? 'Actualisation…' : 'Actualiser'}
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-muted-foreground">Chargement…</p>
      ) : (
        <Tabs
          orientation="vertical"
          value={selected}
          onValueChange={(v) => setSelected(v as keyof ReferentielPullResponse)}
          className="flex-row items-start"
        >
          <TabsList variant="line" className="mr-6 shrink-0">
            {ENTITES.map(({ key, label }) => {
              const count = data?.[key]?.upserts.length ?? 0
              return (
                <TabsTrigger key={key} value={key} className="gap-2">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${count > 0 ? 'bg-[#235a36]' : 'bg-muted-foreground/40'}`}
                  />
                  {label}
                  <span className="ml-auto text-xs text-muted-foreground">{count}</span>
                </TabsTrigger>
              )
            })}
          </TabsList>

          {ENTITES.map(({ key, label }) => (
            <TabsContent key={key} value={key} className="min-w-0 flex-1">
              {key === 'campagnes' && (
                <p className="text-sm text-muted-foreground mb-3">
                  Gestion complète (création/suppression) sur la page{' '}
                  <Link to="/campagnes" className="underline">
                    Campagnes
                  </Link>
                  . Lecture seule ici.
                </p>
              )}
              <Card>
                <CardContent className="p-0">
                  <DataTable
                    columns={columns}
                    rows={rows}
                    getRowKey={(row) => String(row.id)}
                    emptyMessage={`Aucun enregistrement pour ${label.toLowerCase()}.`}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}
