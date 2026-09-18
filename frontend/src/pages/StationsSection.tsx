import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { api } from '../api/client'
import { cn } from '@/lib/utils'
import { DataTable, type DataTableColumn, type DataTableSort } from '@/components/ui/data-table'
import { ErrorBanner } from '@/components/ui/error-banner'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PAGE_SIZE, compareSortValues, nextSort, normalize } from '@/lib/table-search-sort'

interface StationFixe {
  id: string
  code: string
  nom: string
  pa_id: string
  pa_code: string
  pa_nom: string
  commune_id: string
  district: string
  region: string
  latitude: number | null
  longitude: number | null
  altitude: number | null
  actif: boolean
  created_at: string
}

interface PosteAcridien {
  id: string
  nom: string
}

interface Commune {
  id: string
  nom: string
}

const fieldLabelClass =
  'font-sans text-[9.5px] font-semibold uppercase tracking-[.8px] text-ifvm-text-weak'
const inputClass =
  'min-h-9 w-full rounded-lg border border-[#e0d9c4] bg-white px-[11px] text-[12.5px] font-semibold text-[#16201a] focus:outline-none focus:ring-2 focus:ring-[#235a36]'

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

interface FormValues {
  code: string
  nom: string
  pa_id: string
  commune_id: string
  latitude: string
  longitude: string
  altitude: string
}

const BLANK_FORM: FormValues = { code: '', nom: '', pa_id: '', commune_id: '', latitude: '', longitude: '', altitude: '' }

function toPayload(values: FormValues) {
  return {
    code: values.code.trim(),
    nom: values.nom.trim(),
    pa_id: values.pa_id,
    commune_id: values.commune_id,
    latitude: Number(values.latitude),
    longitude: Number(values.longitude),
    altitude: values.altitude === '' ? null : Number(values.altitude),
  }
}

/**
 * Section « Stations » de l'écran Administration — même présentation que
 * ReferentielsPage.tsx (carte d'en-tête, carte « Enregistrements » avec
 * recherche/tri/pagination, panneau Modifier en modale). `POST`/`PUT /stations`
 * existent côté backend depuis #133 : l'ancien écran affichait encore un
 * bouton « + Nouvelle station » désactivé sur une hypothèse périmée (#124) —
 * corrigé ici, mêmes champs que l'entrée `station_fixe` de ReferentielsPage
 * (poste acridien, commune, coordonnées ; district/région dérivés).
 */
export function StationsSection() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<DataTableSort | null>(null)
  const [page, setPage] = useState(1)

  const [creating, setCreating] = useState(false)
  const [createValues, setCreateValues] = useState<FormValues>(BLANK_FORM)
  const [createError, setCreateError] = useState('')

  const [editingRow, setEditingRow] = useState<StationFixe | null>(null)
  const [editValues, setEditValues] = useState<FormValues>(BLANK_FORM)
  const [editActif, setEditActif] = useState(true)
  const [editError, setEditError] = useState('')

  const {
    data: stationsData = [],
    isLoading,
    isError,
    error,
  } = useQuery<StationFixe[]>({
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

  const { data: postesData = [] } = useQuery<PosteAcridien[]>({
    queryKey: ['postes-acridiens', 'options'],
    queryFn: () => api.get('/postes-acridiens').then((r) => r.data),
  })
  const postes = Array.isArray(postesData) ? postesData : []

  const { data: communesData = [] } = useQuery<Commune[]>({
    queryKey: ['communes', 'options'],
    queryFn: () => api.get('/communes').then((r) => r.data),
  })
  const communes = Array.isArray(communesData) ? communesData : []

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

  const errorStatus = (error as AxiosError)?.response?.status
  const errorDetail = (error as AxiosError<{ detail?: string }>)?.response?.data?.detail

  const createMutation = useMutation({
    mutationFn: (data: ReturnType<typeof toPayload>) => api.post('/stations', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stations'] })
      setCreating(false)
      setCreateValues(BLANK_FORM)
      setCreateError('')
    },
    onError: (err: AxiosError<{ detail?: string }>) => {
      setCreateError(err.response?.data?.detail || 'Erreur lors de la création')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; actif: boolean } & ReturnType<typeof toPayload>) =>
      api.put(`/stations/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stations'] })
      setEditingRow(null)
    },
    onError: (err: AxiosError<{ detail?: string }>) => {
      setEditError(err.response?.data?.detail || 'Erreur lors de la mise à jour')
    },
  })

  function openCreate() {
    setCreateValues(BLANK_FORM)
    setCreateError('')
    setCreating(true)
  }

  function openEdit(row: StationFixe) {
    setEditingRow(row)
    setEditValues({
      code: row.code,
      nom: row.nom,
      pa_id: row.pa_id,
      commune_id: row.commune_id,
      latitude: row.latitude != null ? String(row.latitude) : '',
      longitude: row.longitude != null ? String(row.longitude) : '',
      altitude: row.altitude != null ? String(row.altitude) : '',
    })
    setEditActif(row.actif)
    setEditError('')
  }

  function submitCreate(event: React.FormEvent) {
    event.preventDefault()
    setCreateError('')
    createMutation.mutate(toPayload(createValues))
  }

  function submitEdit(event: React.FormEvent) {
    event.preventDefault()
    if (!editingRow) return
    setEditError('')
    updateMutation.mutate({ id: editingRow.id, ...toPayload(editValues), actif: editActif })
  }

  const columns: DataTableColumn<StationFixe>[] = [
    {
      key: 'code',
      header: 'Code',
      mono: true,
      render: (s) => <span className="font-mono text-ifvm-green-text">{s.code}</span>,
      sortValue: (s) => s.code,
    },
    {
      key: 'station',
      header: 'Station',
      render: (s) => <span className="text-[12.5px] font-semibold">{s.nom}</span>,
      sortValue: (s) => s.nom,
    },
    {
      key: 'aire_protegee',
      header: 'Aire protégée',
      render: (s) => <span className="text-ifvm-text-tertiary">{s.pa_nom || '—'}</span>,
      sortValue: (s) => s.pa_nom ?? null,
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
      sortValue: (s) => s.latitude,
    },
    {
      key: 'prospections',
      header: 'Prospections',
      align: 'right',
      mono: true,
      render: (s) => prospectionsParStation.get(s.id) ?? 0,
      sortValue: (s) => prospectionsParStation.get(s.id) ?? 0,
    },
    {
      key: 'etat',
      header: 'État',
      render: (s) => <EtatBadge actif={s.actif} />,
      sortValue: (s) => s.actif,
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'right',
      render: (s) => (
        <button
          type="button"
          onClick={() => openEdit(s)}
          aria-label={`Modifier ${s.code}`}
          className="rounded-md border border-[#e0d9c4] bg-white px-2 py-1 font-sans text-[11px] font-semibold text-ifvm-text-tertiary transition-colors duration-[120ms] hover:bg-[#faf7ef]"
        >
          ✎ Modifier
        </button>
      ),
    },
  ]

  const searchQuery = normalize(search.trim())
  const searchedRows = searchQuery
    ? stations.filter((s) =>
        columns.some((column) => {
          const value = column.sortValue?.(s)
          return value !== null && value !== undefined && normalize(String(value)).includes(searchQuery)
        }),
      )
    : stations

  const sortColumn = sort ? columns.find((c) => c.key === sort.key) : undefined
  const sortedRows =
    sort && sortColumn?.sortValue
      ? [...searchedRows].sort((a, b) => {
          const cmp = compareSortValues(sortColumn.sortValue!(a), sortColumn.sortValue!(b))
          return sort.direction === 'asc' ? cmp : -cmp
        })
      : searchedRows

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginatedRows = sortedRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function updateSearch(value: string) {
    setSearch(value)
    setPage(1)
  }

  function toggleSort(key: string) {
    setSort((current) => nextSort(current, key))
    setPage(1)
  }

  function StationFields({
    values,
    onChange,
    idPrefix,
  }: {
    values: FormValues
    onChange: (values: FormValues) => void
    idPrefix: string
  }) {
    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-code`} className={fieldLabelClass}>
            Code *
          </label>
          <input
            id={`${idPrefix}-code`}
            type="text"
            value={values.code}
            onChange={(e) => onChange({ ...values, code: e.target.value })}
            required
            className={cn(inputClass, 'font-mono')}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-nom`} className={fieldLabelClass}>
            Nom *
          </label>
          <input
            id={`${idPrefix}-nom`}
            type="text"
            value={values.nom}
            onChange={(e) => onChange({ ...values, nom: e.target.value })}
            required
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-poste`} className={fieldLabelClass}>
            Poste acridien *
          </label>
          <select
            id={`${idPrefix}-poste`}
            value={values.pa_id}
            onChange={(e) => onChange({ ...values, pa_id: e.target.value })}
            required
            className={cn(inputClass, 'font-sans')}
          >
            <option value="" disabled>
              — Choisir —
            </option>
            {postes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-commune`} className={fieldLabelClass}>
            Commune *
          </label>
          <select
            id={`${idPrefix}-commune`}
            value={values.commune_id}
            onChange={(e) => onChange({ ...values, commune_id: e.target.value })}
            required
            className={cn(inputClass, 'font-sans')}
          >
            <option value="" disabled>
              — Choisir —
            </option>
            {communes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-latitude`} className={fieldLabelClass}>
            Latitude *
          </label>
          <input
            id={`${idPrefix}-latitude`}
            type="number"
            step="any"
            value={values.latitude}
            onChange={(e) => onChange({ ...values, latitude: e.target.value })}
            required
            className={cn(inputClass, 'font-mono')}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-longitude`} className={fieldLabelClass}>
            Longitude *
          </label>
          <input
            id={`${idPrefix}-longitude`}
            type="number"
            step="any"
            value={values.longitude}
            onChange={(e) => onChange({ ...values, longitude: e.target.value })}
            required
            className={cn(inputClass, 'font-mono')}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-altitude`} className={fieldLabelClass}>
            Altitude (m)
          </label>
          <input
            id={`${idPrefix}-altitude`}
            type="number"
            step="any"
            value={values.altitude}
            onChange={(e) => onChange({ ...values, altitude: e.target.value })}
            className={cn(inputClass, 'font-mono')}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-[14px]">
      {/* Carte d'en-tête */}
      <div className="flex flex-col gap-[9px] rounded-[11px] border border-[#e7e0cd] bg-white px-5 py-4">
        <div className="flex items-center gap-[10px]">
          <h2 className="flex-1 font-sans text-[17px] font-extrabold">Stations</h2>
          <span className="font-mono text-[11px] font-medium text-ifvm-text-weak">station_fixe</span>
          <span className="rounded-full border border-ifvm-green-border bg-ifvm-green-bg px-[10px] py-1 font-sans text-[10px] font-bold text-ifvm-green-text">
            GET · POST · PUT /stations
          </span>
        </div>
        <p className="font-sans text-[12.5px] font-medium leading-[1.55] text-[#3a3a30]">
          Point de référence des prospections : code, nom, poste acridien de rattachement et
          coordonnées.
        </p>
        <p className="rounded-[9px] border border-ifvm-amber-border bg-ifvm-amber-bg px-[13px] py-[11px] font-sans text-[11.5px] font-medium leading-[1.55] text-ifvm-amber-text">
          Une station est référencée par des prospections et le pull hors-ligne ne transporte que
          des upserts : aucune route DELETE n'est exposée, la sortie de service passe par
          l'interrupteur « Actif ».
        </p>
      </div>

      {/* Carte Enregistrements */}
      <div className="overflow-hidden rounded-[11px] border border-[#e7e0cd] bg-white">
        <div className="flex items-center gap-[10px] border-b border-[#f1ecdd] px-5 py-[13px]">
          <h3 className="flex-1 font-sans text-[13px] font-bold">Enregistrements</h3>
          <Label htmlFor="stations-recherche" className="sr-only">
            Rechercher parmi les stations
          </Label>
          <Input
            id="stations-recherche"
            type="search"
            value={search}
            onChange={(event) => updateSearch(event.target.value)}
            placeholder="Rechercher…"
            className="h-9 w-48 rounded-[8px] border-[#e0d9c4] bg-[#fffdf8] text-[12px]"
          />
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-[#235a36] px-[14px] py-2 font-sans text-[11.5px] font-bold text-white transition-colors duration-[120ms] hover:bg-[#1a4429]"
          >
            + Nouvelle station
          </button>
        </div>

        {isError ? (
          <div className="p-5">
            <ErrorBanner
              label={errorStatus ? `Erreur ${errorStatus}` : 'Erreur'}
              message={errorDetail ?? 'Impossible de charger les stations.'}
            />
          </div>
        ) : isLoading ? (
          <div className="divide-y divide-[#f4efe2]">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-[43px] animate-pulse bg-[#faf7ef]" />
            ))}
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={paginatedRows}
            getRowKey={(s) => s.id}
            rowClassName={(_, index) => (index % 2 ? 'bg-[#fffdf8]' : 'bg-white')}
            emptyMessage={searchQuery ? `Aucun résultat pour « ${search.trim()} ».` : 'Aucune station trouvée.'}
            sort={sort ?? undefined}
            onSortChange={toggleSort}
          />
        )}

        {!isError && !isLoading && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#f1ecdd] px-5 py-3">
            <span className="font-sans text-[11.5px] font-medium text-ifvm-text-weak">
              Page {currentPage} / {totalPages} · {sortedRows.length} enregistrement
              {sortedRows.length > 1 ? 's' : ''}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="rounded-[8px] border border-[#e0d9c4] bg-white px-3 py-2 font-sans text-[11.5px] font-semibold text-ifvm-text-tertiary disabled:opacity-50"
              >
                ← Précédent
              </button>
              <button
                type="button"
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="rounded-[8px] border border-[#e0d9c4] bg-white px-3 py-2 font-sans text-[11.5px] font-semibold text-ifvm-text-tertiary disabled:opacity-50"
              >
                Suivant →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modale : nouvelle station */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Nouvelle station"
            className="mx-4 w-full max-w-md rounded-[11px] border border-[#e7e0cd] bg-white shadow-xl"
          >
            <div className="border-b border-[#f4efe2] px-6 py-4">
              <h2 className="font-sans text-[15px] font-extrabold">Nouvelle station</h2>
            </div>
            <form onSubmit={submitCreate} className="flex flex-col gap-4 px-6 py-4">
              {createError && <ErrorBanner label="Création impossible" message={createError} />}
              <StationFields values={createValues} onChange={setCreateValues} idPrefix="ns" />
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="rounded-[9px] bg-[#235a36] px-4 py-[10px] font-sans text-[12px] font-bold text-white transition-colors duration-[120ms] hover:bg-[#1a4429] disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Création…' : 'Créer'}
                </button>
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="rounded-[9px] border border-[#e7e0cd] px-4 py-[10px] font-sans text-[12px] font-bold text-ifvm-text-tertiary transition-colors duration-[120ms] hover:bg-[#faf7ef]"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale : modifier une station */}
      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Modifier ${editingRow.code}`}
            className="mx-4 w-full max-w-md rounded-[11px] border border-[#e7e0cd] bg-white shadow-xl"
          >
            <div className="border-b border-[#f4efe2] px-6 py-4">
              <h2 className="font-sans text-[15px] font-extrabold">Modifier</h2>
              <p className="mt-0.5 font-mono text-[11px] font-medium text-ifvm-text-weak">
                {editingRow.code}
              </p>
            </div>
            <form onSubmit={submitEdit} className="flex flex-col gap-4 px-6 py-4">
              {editError && <ErrorBanner label="Enregistrement impossible" message={editError} />}
              <StationFields values={editValues} onChange={setEditValues} idPrefix="es" />
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="flex flex-col gap-1.5">
                  <span className={fieldLabelClass}>District</span>
                  <div className="flex min-h-9 items-center rounded-lg border border-[#e0d9c4] bg-[#f7f4ea] px-[11px] font-sans text-[12.5px] font-semibold text-ifvm-text-tertiary">
                    {editingRow.district || '—'}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className={fieldLabelClass}>Région</span>
                  <div className="flex min-h-9 items-center rounded-lg border border-[#e0d9c4] bg-[#f7f4ea] px-[11px] font-sans text-[12.5px] font-semibold text-ifvm-text-tertiary">
                    {editingRow.region || '—'}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-0.5">
                <span className="font-sans text-[11.5px] font-semibold text-[#3a3a30]">Actif</span>
                <Switch checked={editActif} onCheckedChange={setEditActif} aria-label="Actif" />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="rounded-[9px] bg-[#235a36] px-4 py-[10px] font-sans text-[12px] font-bold text-white transition-colors duration-[120ms] hover:bg-[#1a4429] disabled:opacity-50"
                >
                  {updateMutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingRow(null)}
                  className="rounded-[9px] border border-[#e7e0cd] px-4 py-[10px] font-sans text-[12px] font-bold text-ifvm-text-tertiary transition-colors duration-[120ms] hover:bg-[#faf7ef]"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
