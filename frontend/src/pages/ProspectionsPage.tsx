import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FilterChip } from '@/components/ui/filter-chip'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { STATUTS, STATUT_LABELS, StatusBadge, type Statut } from '@/components/ui/status-badge'
import { shortId, useAnnuaire } from '@/lib/use-annuaire'

interface Station {
  id: string
  code: string
  nom: string
  pa_code: string
}

interface Prospection {
  id: string
  type_prospection: string
  campagne_id?: string
  prospecteur_id: string
  station_id: string | null
  /** Localité saisie à la main — seule information de lieu d'une fiche
   * Extensive/Validation, qui n'a jamais de `station_id` (station du référentiel
   * réservée à l'Intensive). */
  station_libre?: string | null
  date_prospection: string
  statut: string
  n_fiche: string | null
  surface_infestee: number | null
  /** Fiche créée via « Prospections à revalider » (#revalidation-prospection) —
   * pointe vers la fiche périmée dont elle reprend les données. N'existe pas
   * sur les fiches plus anciennes (avant migration 0062) : optionnel. */
  revalide_de_id?: string | null
}

/**
 * Pastilles « Type » de la maquette (prototype, ligne 1337) — étendues à
 * `validation` (« Vérifier un signalement », déjà un `type_prospection`
 * réel côté backend — gardé sous son nom de type, « Validation », demande
 * explicite : pas de relibellé en « Signalement ») et `revalidation`, qui
 * n'en est PAS un : c'est une relation (`revalide_de_id` non nul, cf.
 * #revalidation-prospection), pas une valeur de `type_prospection` — la
 * fiche reste extensive/validation en base. Traitée ici comme un 5e type
 * dérivé (cf. `ficheType` ci-dessous) car c'est l'information la plus utile
 * à l'agent qui parcourt la liste : une fiche revalidée mérite d'être
 * reconnue au premier coup d'œil, plus que son type d'origine.
 */
const TYPES = ['intensive', 'extensive', 'validation', 'revalidation'] as const
const TYPE_LABELS: Record<string, string> = {
  intensive: 'Intensive',
  extensive: 'Extensive',
  validation: 'Validation',
  revalidation: 'Revalidation',
}

/** Type affiché/filtré dans cette page — cf. commentaire de `TYPES` ci-dessus. */
function ficheType(p: Prospection): string {
  return p.revalide_de_id ? 'revalidation' : p.type_prospection
}

const PAGE_SIZE = 20
const TOUS = 'Tous'

export function ProspectionsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const recherche = searchParams.get('q') ?? ''
  const filtreType = searchParams.get('type') ?? ''
  const filtreStatut = searchParams.get('statut') ?? ''
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1)

  function setFiltre(key: string, value: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        // Tout changement de filtre ramène à la première page : sinon on
        // atterrit sur une page vide quand le filtre réduit la liste.
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

  const { data: prospections = [], isLoading } = useQuery<Prospection[]>({
    queryKey: ['prospections'],
    queryFn: () => api.get('/prospections').then((r) => r.data),
  })

  const { data: stations = [] } = useQuery<Station[]>({
    queryKey: ['stations'],
    queryFn: () => api.get('/stations').then((r) => r.data),
  })

  const { nomAgent } = useAnnuaire()

  const stationMap = useMemo(() => {
    const m: Record<string, Station> = {}
    for (const s of stations) m[s.id] = s
    return m
  }, [stations])

  const stationLabel = (p: Prospection) => {
    const station = p.station_id ? stationMap[p.station_id] : null
    if (station) return `${station.code} ${station.nom}`
    // Extensive/Validation : pas de station du référentiel — la localité saisie
    // à la fiche de prospection en tient lieu.
    return p.station_libre?.trim() || shortId(p.station_id)
  }

  const agentLabel = (p: Prospection) => nomAgent(p.prospecteur_id)

  const ficheLabel = (p: Prospection) => p.n_fiche ?? shortId(p.id)

  // Recalculé à chaque rendu : les libellés dépendent de trois requêtes et le
  // volume est déjà borné par la pagination.
  const filtered = (() => {
    const q = recherche.trim().toLowerCase()
    return prospections.filter((p) => {
      if (filtreType && ficheType(p) !== filtreType) return false
      if (filtreStatut && p.statut !== filtreStatut) return false
      if (!q) return true
      // La maquette n'expose qu'un champ « N° de fiche, agent… » : il couvre
      // aussi la station, qui remplace l'ancien filtre dédié.
      return [ficheLabel(p), agentLabel(p), stationLabel(p)]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  })()

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const filterSummary = `${filtreType ? TYPE_LABELS[filtreType] : 'tous types'} · ${
    filtreStatut ? STATUT_LABELS[filtreStatut as Statut] : 'tous statuts'
  }`

  const columns: DataTableColumn<Prospection>[] = [
    {
      key: 'fiche',
      header: 'N° de fiche',
      render: (p) => (
        <span className="font-mono text-[11.5px] font-semibold text-ifvm-green-text">
          {ficheLabel(p)}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (p) => TYPE_LABELS[ficheType(p)] ?? ficheType(p),
    },
    { key: 'date', header: 'Date', mono: true, render: (p) => p.date_prospection },
    { key: 'prospecteur', header: 'Prospecteur', render: (p) => agentLabel(p) },
    {
      key: 'station',
      header: 'Station',
      render: (p) => <span className="text-ifvm-text-tertiary">{stationLabel(p)}</span>,
    },
    {
      key: 'surface',
      header: 'Surf. inf. (ha)',
      align: 'right',
      mono: true,
      render: (p) =>
        p.surface_infestee == null ? (
          <span className="text-[#bdb6a2]">—</span>
        ) : (
          p.surface_infestee.toLocaleString('fr-FR')
        ),
    },
    { key: 'statut', header: 'Statut', render: (p) => <StatusBadge statut={p.statut} /> },
    {
      key: 'ouvrir',
      header: '',
      align: 'right',
      render: () => (
        <span className="font-sans text-[11px] font-semibold text-ifvm-green-text">Ouvrir ›</span>
      ),
    },
  ]

  return (
    // 28px latéraux : aligne le contenu sur le fil d'Ariane du header (Layout).
    <div className="flex flex-col gap-4 px-4 pb-10 pt-4 sm:px-7 sm:pt-[26px]">
      {/* Barre de filtres — maquette : carte blanche, items alignés en bas */}
      <div className="flex flex-wrap items-end gap-[14px] rounded-[11px] border border-[#e7e0cd] bg-card px-[18px] py-4">
        <div className="flex min-w-[180px] flex-col gap-[6px]">
          <Label
            htmlFor="prospections-recherche"
            className="font-sans text-[9.5px] font-semibold uppercase tracking-[.8px] text-ifvm-text-weak"
          >
            Recherche
          </Label>
          <Input
            id="prospections-recherche"
            type="search"
            value={recherche}
            onChange={(e) => setFiltre('q', e.target.value)}
            placeholder="N° de fiche, agent…"
            className="h-9 rounded-[8px] border-[#e0d9c4] bg-[#fffdf8] text-[12px]"
          />
        </div>

        <fieldset className="flex flex-col gap-[6px]">
          <legend className="mb-[6px] font-sans text-[9.5px] font-semibold uppercase tracking-[.8px] text-ifvm-text-weak">
            Type
          </legend>
          <div className="flex flex-wrap gap-[5px]">
            <FilterChip
              label={TOUS}
              active={!filtreType}
              onClick={() => setFiltre('type', '')}
            />
            {TYPES.map((t) => (
              <FilterChip
                key={t}
                label={TYPE_LABELS[t]}
                active={filtreType === t}
                onClick={() => setFiltre('type', t)}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-[6px]">
          <legend className="mb-[6px] font-sans text-[9.5px] font-semibold uppercase tracking-[.8px] text-ifvm-text-weak">
            Statut
          </legend>
          <div className="flex flex-wrap gap-[5px]">
            <FilterChip
              label={TOUS}
              active={!filtreStatut}
              onClick={() => setFiltre('statut', '')}
            />
            {STATUTS.map((s) => (
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

        <Link
          to="/prospections/new"
          className="rounded-[9px] bg-ifvm-green-text px-4 py-[10px] font-sans text-[12px] font-bold text-white"
        >
          + Nouvelle prospection
        </Link>
      </div>

      {/* Ligne de contexte — compteur + résumé du filtre actif */}
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
          getRowKey={(p) => p.id}
          onRowClick={(p) => navigate(`/prospections/${p.id}`)}
          emptyMessage={isLoading ? 'Chargement…' : 'Aucune fiche trouvée.'}
          // Zébrure de la maquette : `#fff` / `#fffdf8` une ligne sur deux.
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
    </div>
  )
}
