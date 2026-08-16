import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
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
}

const ENTITES: { key: keyof ReferentielPullResponse; label: string }[] = [
  { key: 'postes_acridiens', label: 'Postes acridiens' },
  { key: 'stations_fixes', label: 'Stations fixes' },
  { key: 'utilisateurs_equipe', label: 'Utilisateurs équipe' },
  { key: 'pesticides', label: 'Pesticides' },
  { key: 'cultures', label: 'Cultures' },
  { key: 'codes_stades', label: 'Codes stades' },
]

function formatDate(value: unknown): string {
  if (typeof value !== 'string') return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('fr-FR')
}

function formatBoolean(value: unknown): string {
  return value ? 'Oui' : 'Non'
}

// PosteAcridienSyncRead (backend/app/presentation/referentiel_schemas.py) : id, code, nom, region, actif, updated_at.
const POSTES_ACRIDIENS_COLUMNS: DataTableColumn<Record<string, unknown>>[] = [
  { key: 'code', header: 'Code', mono: true, render: (row) => String(row.code ?? '—') },
  { key: 'nom', header: 'Nom', render: (row) => String(row.nom ?? '—') },
  { key: 'region', header: 'Région', render: (row) => (row.region ? String(row.region) : '—') },
  { key: 'actif', header: 'Actif', render: (row) => formatBoolean(row.actif) },
  { key: 'updated_at', header: 'Mis à jour le', render: (row) => formatDate(row.updated_at) },
]

// StationFixeSyncRead : id, code, nom, pa_id, latitude, longitude, altitude, actif, updated_at.
const STATIONS_FIXES_COLUMNS: DataTableColumn<Record<string, unknown>>[] = [
  { key: 'code', header: 'Code', mono: true, render: (row) => String(row.code ?? '—') },
  { key: 'nom', header: 'Nom', render: (row) => String(row.nom ?? '—') },
  {
    key: 'latitude',
    header: 'Latitude',
    mono: true,
    align: 'right',
    render: (row) => (typeof row.latitude === 'number' ? row.latitude.toFixed(5) : '—'),
  },
  {
    key: 'longitude',
    header: 'Longitude',
    mono: true,
    align: 'right',
    render: (row) => (typeof row.longitude === 'number' ? row.longitude.toFixed(5) : '—'),
  },
  {
    key: 'altitude',
    header: 'Altitude',
    mono: true,
    align: 'right',
    render: (row) => (typeof row.altitude === 'number' ? `${row.altitude} m` : '—'),
  },
  { key: 'actif', header: 'Actif', render: (row) => formatBoolean(row.actif) },
  { key: 'updated_at', header: 'Mis à jour le', render: (row) => formatDate(row.updated_at) },
]

// UtilisateurEquipeSyncRead : id, nom, prenom, email, role, pa_id, actif, updated_at.
// pa_id (poste de rattachement) volontairement omis : c'est un UUID brut, le payload de sync ne
// porte pas de code/nom de poste lisible (contrairement à StationFixeRead côté lecture non-sync) —
// l'afficher n'apporterait rien tant qu'aucune route ne le résout en libellé.
const UTILISATEURS_EQUIPE_COLUMNS: DataTableColumn<Record<string, unknown>>[] = [
  { key: 'prenom', header: 'Prénom', render: (row) => String(row.prenom ?? '—') },
  { key: 'nom', header: 'Nom', render: (row) => String(row.nom ?? '—') },
  { key: 'email', header: 'Email', render: (row) => String(row.email ?? '—') },
  { key: 'role', header: 'Rôle', render: (row) => String(row.role ?? '—') },
  { key: 'actif', header: 'Actif', render: (row) => formatBoolean(row.actif) },
  { key: 'updated_at', header: 'Mis à jour le', render: (row) => formatDate(row.updated_at) },
]

// PesticideSyncRead : id, code, nom, actif, updated_at (pas de matière active ni dose — voir ADR-010).
const PESTICIDES_COLUMNS: DataTableColumn<Record<string, unknown>>[] = [
  { key: 'code', header: 'Code', mono: true, render: (row) => String(row.code ?? '—') },
  { key: 'nom', header: 'Nom', render: (row) => String(row.nom ?? '—') },
  { key: 'actif', header: 'Actif', render: (row) => formatBoolean(row.actif) },
  { key: 'updated_at', header: 'Mis à jour le', render: (row) => formatDate(row.updated_at) },
]

// CultureSyncRead : id, code, nom, actif, updated_at.
const CULTURES_COLUMNS: DataTableColumn<Record<string, unknown>>[] = [
  { key: 'code', header: 'Code', mono: true, render: (row) => String(row.code ?? '—') },
  { key: 'nom', header: 'Nom', render: (row) => String(row.nom ?? '—') },
  { key: 'actif', header: 'Actif', render: (row) => formatBoolean(row.actif) },
  { key: 'updated_at', header: 'Mis à jour le', render: (row) => formatDate(row.updated_at) },
]

// CodeStadeSyncRead : id, code, espece, libelle, actif, updated_at.
const CODES_STADES_COLUMNS: DataTableColumn<Record<string, unknown>>[] = [
  { key: 'code', header: 'Code', mono: true, render: (row) => String(row.code ?? '—') },
  { key: 'espece', header: 'Espèce', render: (row) => String(row.espece ?? '—') },
  { key: 'libelle', header: 'Libellé', render: (row) => String(row.libelle ?? '—') },
  { key: 'actif', header: 'Actif', render: (row) => formatBoolean(row.actif) },
  { key: 'updated_at', header: 'Mis à jour le', render: (row) => formatDate(row.updated_at) },
]

const DEDICATED_COLUMNS: Partial<Record<keyof ReferentielPullResponse, DataTableColumn<Record<string, unknown>>[]>> = {
  postes_acridiens: POSTES_ACRIDIENS_COLUMNS,
  stations_fixes: STATIONS_FIXES_COLUMNS,
  utilisateurs_equipe: UTILISATEURS_EQUIPE_COLUMNS,
  pesticides: PESTICIDES_COLUMNS,
  cultures: CULTURES_COLUMNS,
  codes_stades: CODES_STADES_COLUMNS,
}

function buildColumns(
  entity: keyof ReferentielPullResponse,
  rows: Record<string, unknown>[],
): DataTableColumn<Record<string, unknown>>[] {
  const dedicated = DEDICATED_COLUMNS[entity]
  if (dedicated) return dedicated

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
  const columns = useMemo(() => buildColumns(selected, rows), [selected, rows])
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
