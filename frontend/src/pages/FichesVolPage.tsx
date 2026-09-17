import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FilterChip } from '@/components/ui/filter-chip'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { StatusBadge, STATUT_LABELS, type Statut } from '@/components/ui/status-badge'
import { formatDureeMinutes } from '@/lib/fiche-vol'

interface FicheVol {
  id: string
  numero_fiche: string
  date_vol: string
  compagnie: string
  immatriculation: string
  base_numero: string | null
  base_localite: string | null
  pilote: string
  mecanicien: string
  statut: string
  duree_totale_minutes: number
}

// `FicheVol.statut` (backend `app/domain/fiche_vol.py`) n'a que deux valeurs —
// contrairement au workflow de validation des prospections/traitements (5
// statuts, cf. status-badge.tsx) : pas de vérification/rejet pour une fiche
// de vol, juste brouillon puis validée (signatures + rotations complètes).
const STATUTS_VOL = ['brouillon', 'validee'] as const

const PAGE_SIZE = 20

export function FichesVolPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const recherche = searchParams.get('q') ?? ''
  const filtreStatut = searchParams.get('statut') ?? ''
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1)

  function setFiltre(key: string, value: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        next.delete('page')
        return next
      },
      { replace: true },
    )
  }

  function setPage(next: number) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        if (next > 1) params.set('page', String(next))
        else params.delete('page')
        return params
      },
      { replace: true },
    )
  }

  const { data: fichesVol = [], isLoading } = useQuery<FicheVol[]>({
    queryKey: ['fiches-vol'],
    queryFn: () => api.get('/fiches-vol').then((r) => r.data),
  })

  const filtered = (() => {
    const q = recherche.trim().toLowerCase()
    return fichesVol.filter((f) => {
      if (filtreStatut && f.statut !== filtreStatut) return false
      if (!q) return true
      return [f.numero_fiche, f.immatriculation, f.compagnie, f.pilote, f.base_localite]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  })()

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const filterSummary = filtreStatut ? STATUT_LABELS[filtreStatut as Statut] : 'tous statuts'

  const columns: DataTableColumn<FicheVol>[] = useMemo(
    () => [
      {
        key: 'fiche',
        header: 'N° de fiche',
        render: (f) => (
          <span className="font-mono text-[11.5px] font-semibold text-ifvm-green-text">
            {f.numero_fiche}
          </span>
        ),
      },
      { key: 'date', header: 'Date', mono: true, render: (f) => f.date_vol },
      {
        key: 'immatriculation',
        header: 'Immatriculation',
        mono: true,
        render: (f) => f.immatriculation,
      },
      { key: 'pilote', header: 'Pilote', render: (f) => f.pilote },
      {
        key: 'base',
        header: 'Base',
        render: (f) => <span className="text-ifvm-text-tertiary">{f.base_localite ?? '—'}</span>,
      },
      {
        key: 'duree',
        header: 'Durée totale',
        align: 'right',
        mono: true,
        render: (f) => formatDureeMinutes(f.duree_totale_minutes),
      },
      { key: 'statut', header: 'Statut', render: (f) => <StatusBadge statut={f.statut} /> },
      {
        key: 'ouvrir',
        header: '',
        align: 'right',
        render: () => (
          <span className="font-sans text-[11px] font-semibold text-ifvm-green-text">Ouvrir ›</span>
        ),
      },
    ],
    [],
  )

  return (
    <div className="flex flex-col gap-4 px-7 pb-10 pt-[26px]">
      <div className="flex flex-wrap items-end gap-[14px] rounded-[11px] border border-[#e7e0cd] bg-card px-[18px] py-4">
        <div className="flex min-w-[180px] flex-col gap-[6px]">
          <Label
            htmlFor="fiches-vol-recherche"
            className="font-sans text-[9.5px] font-semibold uppercase tracking-[.8px] text-ifvm-text-weak"
          >
            Recherche
          </Label>
          <Input
            id="fiches-vol-recherche"
            type="search"
            value={recherche}
            onChange={(e) => setFiltre('q', e.target.value)}
            placeholder="N° de fiche, immatriculation, pilote…"
            className="h-9 rounded-[8px] border-[#e0d9c4] bg-[#fffdf8] text-[12px]"
          />
        </div>

        <fieldset className="flex flex-col gap-[6px]">
          <legend className="mb-[6px] font-sans text-[9.5px] font-semibold uppercase tracking-[.8px] text-ifvm-text-weak">
            Statut
          </legend>
          <div className="flex flex-wrap gap-[5px]">
            <FilterChip label="Tous" active={!filtreStatut} onClick={() => setFiltre('statut', '')} />
            {STATUTS_VOL.map((s) => (
              <FilterChip
                key={s}
                label={STATUT_LABELS[s]}
                active={filtreStatut === s}
                onClick={() => setFiltre('statut', s)}
              />
            ))}
          </div>
        </fieldset>

        <div className="flex-1" />
      </div>

      <div className="flex items-center gap-[10px]">
        <span className="font-sans text-[12px] font-semibold text-ifvm-text-tertiary">
          {filtered.length} {filtered.length > 1 ? 'fiches' : 'fiche'}
        </span>
        <span className="h-[14px] w-px bg-[#e0d9c4]" />
        <span className="font-sans text-[12px] font-medium text-ifvm-text-weak">
          Filtre : {filterSummary}
        </span>
      </div>

      <div className="overflow-hidden rounded-[11px] border border-[#e7e0cd] bg-card">
        <DataTable
          columns={columns}
          rows={paginated}
          getRowKey={(f) => f.id}
          onRowClick={(f) => navigate(`/fiches-vol/${f.id}`)}
          emptyMessage={
            isLoading
              ? 'Chargement…'
              : 'Aucune fiche de vol trouvée — le suivi des heures de vol est prêt côté serveur, mais aucune fiche n’a encore été saisie.'
          }
          rowClassName={(_, index) => (index % 2 ? 'bg-[#fffdf8]' : 'bg-card')}
        />
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="font-sans text-[11.5px] font-medium text-ifvm-text-weak">
            Page {currentPage} / {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="rounded-[8px] border border-[#e0d9c4] bg-card px-3 py-2 font-sans text-[11.5px] font-semibold text-ifvm-text-tertiary disabled:opacity-50"
            >
              ← Précédent
            </button>
            <button
              type="button"
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="rounded-[8px] border border-[#e0d9c4] bg-card px-3 py-2 font-sans text-[11.5px] font-semibold text-ifvm-text-tertiary disabled:opacity-50"
            >
              Suivant →
            </button>
          </div>
        </div>
      )}

      <Link
        to="/traitements"
        className="font-sans text-[11.5px] font-medium text-ifvm-text-weak underline"
      >
        ‹ Retour aux traitements
      </Link>
    </div>
  )
}
