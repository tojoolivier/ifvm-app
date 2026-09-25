import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { StatusBadge, type Statut } from '@/components/ui/status-badge'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { ErrorBanner } from '@/components/ui/error-banner'
import { campagneActive, type CampagneDatee } from '@/lib/campagne-active'
import { useAnnuaire } from '@/lib/use-annuaire'
import {
  buildActiviteRecente,
  buildPipeline,
  buildTopStations,
  compteProspections,
  repartitionModes,
  repartitionProduits,
  repartitionVoies,
  sommeSurfaceInfestee,
  sommeSurfaceProtegee,
  sommeSurfaceTraitee,
  sommePesticides,
  type DashboardPesticide,
  type DashboardProspection,
  type DashboardStation,
  type DashboardTraitement,
  type LigneActivite,
} from '@/lib/dashboard-metrics'

/* ------------------------------------------------------------------ */
/*  Tokens visuels                                                     */
/* ------------------------------------------------------------------ */

const CARD =
  'rounded-[14px] border border-[#e7e0cd] bg-card shadow-[0_1px_2px_rgba(22,33,26,0.04),0_10px_28px_-14px_rgba(22,33,26,0.18)]'
const PAGE_BG = 'bg-[#f3f2ec]'

const PIPELINE_CLASSES: Record<Statut, string> = {
  brouillon: 'bg-ifvm-bar-brouillon',
  en_attente: 'bg-ifvm-amber',
  verifiee: 'bg-ifvm-bar-verifiee',
  validee: 'bg-ifvm-green-text',
  rejetee: 'bg-ifvm-danger',
}

const nombreFr = new Intl.NumberFormat('fr-FR')

/* ------------------------------------------------------------------ */
/*  Icônes                                                             */
/* ------------------------------------------------------------------ */

function Icon({ name, className = 'h-4 w-4' }: { name: string; className?: string }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
  }
  switch (name) {
    case 'search':
      return (
        <svg {...common}>
          <circle cx="10.5" cy="10.5" r="6.5" />
          <line x1="15.3" y1="15.3" x2="20.5" y2="20.5" />
        </svg>
      )
    case 'locust':
      return (
        <svg {...common}>
          <ellipse cx="12" cy="13.5" rx="3.6" ry="5.6" />
          <path d="M12 7.8V4.6M9.2 5.7L7.7 3.5M14.8 5.7L16.3 3.5M8.5 10.2l-3.7-1.7M8.5 15.2l-4.3 1M15.5 10.2l3.7-1.7M15.5 15.2l4.3 1" />
        </svg>
      )
    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 3.2 19 6v6c0 5-3 8.2-7 9.8-4-1.6-7-4.8-7-9.8V6l7-2.8Z" />
        </svg>
      )
    case 'target':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.2" />
          <circle cx="12" cy="12" r="4.2" />
          <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'drop':
      return (
        <svg {...common}>
          <path d="M12 3s-6.5 7.6-6.5 12A6.5 6.5 0 0 0 18.5 15C18.5 10.6 12 3 12 3Z" />
        </svg>
      )
    case 'flask':
      return (
        <svg {...common}>
          <path d="M9.5 2h5" />
          <path d="M10.3 2v6.2L4.7 18a2 2 0 0 0 1.7 3h11.2a2 2 0 0 0 1.7-3l-5.6-9.8V2" />
          <line x1="7.5" y1="14.5" x2="16.5" y2="14.5" />
        </svg>
      )
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="14" height="13" rx="2" />
          <path d="M3 8h14M7 2.5v3M13 2.5v3" />
        </svg>
      )
    case 'arrow-up':
      return (
        <svg
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-[11px] w-[11px]"
        >
          <path d="M2 8l3.5-4L8 7l2-2.5" />
        </svg>
      )
    case 'arrow-down':
      return (
        <svg
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-[11px] w-[11px]"
        >
          <path d="M2 4l3.5 4L8 5l2 2.5" />
        </svg>
      )
    default:
      return null
  }
}

/* ------------------------------------------------------------------ */
/*  Tuile KPI                                                          */
/* ------------------------------------------------------------------ */

interface KpiProps {
  label: string
  valeur: string
  unite?: string
  icon: string
  iconBg: string
  iconColor: string
  delta?: { sens: 'up' | 'down'; texte: string }
  meter?: { pct: number; legende: string; valeurAffichee: string; couleur?: string }
  segments?: { pct: number; couleur: string }[]
  sousTitre?: string
}

function KpiCard({
  label,
  valeur,
  unite,
  icon,
  iconBg,
  iconColor,
  delta,
  meter,
  segments,
  sousTitre,
}: KpiProps) {
  return (
    <div className={`${CARD} flex flex-col gap-[9px] px-4 py-[16px]`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-sans text-[12px] font-semibold leading-tight text-ifvm-text-tertiary">
            {label}
          </div>
          <div className="mt-0.5 font-mono text-[23px] font-extrabold leading-none tracking-tight text-foreground">
            {valeur}
            {unite && (
              <span className="ml-[3px] text-[13px] font-semibold text-ifvm-text-tertiary">
                {unite}
              </span>
            )}
          </div>
        </div>
        <div
          className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[8px]"
          style={{ background: iconBg, color: iconColor }}
        >
          <Icon name={icon} className="h-4 w-4" />
        </div>
      </div>

      {delta && (
        <span className="inline-flex w-fit items-center gap-1 font-sans text-[12px] font-bold text-ifvm-green-text">
          <Icon name={delta.sens === 'up' ? 'arrow-up' : 'arrow-down'} />
          {delta.texte}
        </span>
      )}

      {sousTitre && !meter && !segments && (
        <div className="font-sans text-[11.5px] text-ifvm-text-weak">{sousTitre}</div>
      )}

      {meter && (
        <div className="mt-0.5">
          <div className="h-[7px] overflow-hidden rounded-[6px] bg-ifvm-bar-fond">
            <div
              className="h-full rounded-[6px]"
              style={{
                width: `${Math.min(100, meter.pct)}%`,
                background: meter.couleur ?? 'var(--ifvm-green-text)',
              }}
            />
          </div>
          <div className="mt-[5px] flex justify-between font-sans text-[11px] text-ifvm-text-weak">
            <span>{meter.legende}</span>
            <span className="font-bold text-foreground">{meter.valeurAffichee}</span>
          </div>
        </div>
      )}

      {segments && (
        <div className="mt-0.5">
          <div className="flex h-[7px] overflow-hidden rounded-[6px] bg-ifvm-bar-fond">
            {segments.map((s, i) => (
              <div
                key={i}
                style={{ width: `${s.pct}%`, background: s.couleur, height: '100%' }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Barre horizontale                                                  */
/* ------------------------------------------------------------------ */

function BarRow({
  label,
  valeur,
  pct,
  couleur,
  sous,
}: {
  label: string
  valeur: string
  pct: number
  couleur: string
  sous?: string
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-[10px] gap-y-[2px]">
      <span className="col-start-1 font-sans text-[12.5px] font-semibold">{label}</span>
      <span className="col-start-2 font-mono text-[12.5px] font-bold tabular-nums">
        {valeur}
      </span>
      <div className="col-span-2 h-[14px] overflow-hidden rounded-[7px] bg-ifvm-bar-fond">
        <div
          className="h-full rounded-[7px]"
          style={{ width: `${pct}%`, background: couleur }}
        />
      </div>
      {sous && (
        <span className="col-span-2 -mt-0.5 font-sans text-[11px] text-ifvm-text-weak">
          {sous}
        </span>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Libellé de campagne                                                */
/* ------------------------------------------------------------------ */

/** Le backend fournit déjà un `name` lisible — on l'utilise tel quel. */
function libelleCampagne(c: CampagneDatee): string {
  return c.name
}

/* ------------------------------------------------------------------ */
/*  DashboardPage                                                      */
/* ------------------------------------------------------------------ */

export function DashboardPage() {
  const navigate = useNavigate()
  const { nomAgent } = useAnnuaire()

  /* ---------- Requêtes ---------- */
  const {
    data: prospectionsData = [],
    isLoading: fichesEnCours,
    isError: fichesIndisponibles,
    error: ficheError,
  } = useQuery<DashboardProspection[]>({
    queryKey: ['prospections', 'all'],
    queryFn: () => api.get('/prospections').then((r) => r.data),
  })
  const prospections = useMemo(
    () => (Array.isArray(prospectionsData) ? prospectionsData : []),
    [prospectionsData],
  )

  const { data: traitementsData = [] } = useQuery<DashboardTraitement[]>({
    queryKey: ['traitements', 'all'],
    queryFn: () => api.get('/traitements').then((r) => r.data),
  })
  const traitements = useMemo(
    () => (Array.isArray(traitementsData) ? traitementsData : []),
    [traitementsData],
  )

  const { data: pesticidesData = [] } = useQuery<DashboardPesticide[]>({
    queryKey: ['pesticides'],
    queryFn: () => api.get('/pesticides').then((r) => r.data),
  })

  const { data: campagnesData = [] } = useQuery<CampagneDatee[]>({
    queryKey: ['campagnes'],
    queryFn: () => api.get('/campagnes').then((r) => r.data),
  })
  const campagnes = useMemo(
    () => (Array.isArray(campagnesData) ? campagnesData : []),
    [campagnesData],
  )

  const { data: stationsData = [] } = useQuery<DashboardStation[]>({
    queryKey: ['stations'],
    queryFn: () => api.get('/stations').then((r) => r.data),
  })
  const stations = useMemo(
    () => (Array.isArray(stationsData) ? stationsData : []),
    [stationsData],
  )

  /* ---------- Dérivés ---------- */
  const campagne = campagneActive(campagnes)
  const fiches = useMemo(
    () => (campagne ? prospections.filter((p) => p.campagne_id === campagne.id) : prospections),
    [prospections, campagne],
  )
  const perimetre = campagne ? 'campagne en cours' : 'toutes campagnes'
  const enChargement = fichesEnCours

  const traitementsCampagne = useMemo(() => {
    if (!campagne) return traitements
    const idsFiches = new Set(fiches.map((p) => p.id))
    return traitements.filter((t) => idsFiches.has(t.prospection_id))
  }, [traitements, fiches, campagne])

  const surfaceInfestee = sommeSurfaceInfestee(fiches)
  const { total: surfaceTraitee, sansSurface } = sommeSurfaceTraitee(traitementsCampagne)
  const surfaceProtegee = sommeSurfaceProtegee(traitementsCampagne)
  const volumePesticides = sommePesticides(traitementsCampagne)
  const voies = repartitionVoies(traitementsCampagne)
  const modes = repartitionModes(traitementsCampagne)
  const produits = repartitionProduits(traitementsCampagne, pesticidesData)
  const pipeline = useMemo(() => buildPipeline(fiches), [fiches])
  const topStations = useMemo(() => buildTopStations(fiches, stations), [fiches, stations])

  const activite = useMemo(
    () =>
      buildActiviteRecente(fiches, traitementsCampagne, {
        maintenant: new Date(),
        stations,
        nomAgent,
      }),
    [fiches, traitementsCampagne, stations, nomAgent],
  )

  /* ---------- Dérivés KPI ---------- */
  const nbIntensives = compteProspections(fiches, 'intensive')
  const nbInterventions = traitementsCampagne.length
  const tauxCouverture =
    surfaceInfestee > 0 ? Math.round((surfaceTraitee / surfaceInfestee) * 1000) / 10 : 0
  const stationsActives = stations.length

  /* ---------- Colonnes tableau ---------- */
  const colonnesActivite: DataTableColumn<LigneActivite>[] = [
    {
      key: 'numero',
      header: 'N° de fiche',
      render: (l) => (
        <span className="font-mono text-[11.5px] font-semibold text-ifvm-green-text">
          {l.numero}
        </span>
      ),
    },
    { key: 'type', header: 'Type', render: (l) => l.type },
    { key: 'agent', header: 'Agent', render: (l) => l.agent },
    {
      key: 'lieu',
      header: 'Station',
      render: (l) => <span className="text-ifvm-text-tertiary">{l.lieu}</span>,
    },
    { key: 'statut', header: 'Statut', render: (l) => <StatusBadge statut={l.statut} /> },
    {
      key: 'reception',
      header: 'Reçue',
      align: 'right',
      render: (l) => (
        <time
          dateTime={l.recuLe}
          className="font-mono text-[11px] font-medium text-ifvm-text-weak"
        >
          {l.reception}
        </time>
      ),
    },
  ]

  /* ------------------------------------------------------------------ */
  /*  Rendu                                                              */
  /* ------------------------------------------------------------------ */
  return (
    <div className={`flex min-h-screen flex-col gap-[18px] ${PAGE_BG} px-7 pb-10 pt-[22px]`}>
      {fichesIndisponibles && (
        <ErrorBanner
          label={
            (ficheError as { response?: { status?: number } })?.response?.status
              ? `Erreur ${(ficheError as { response?: { status?: number } }).response?.status}`
              : 'Erreur'
          }
          message="Impossible de charger les fiches : les indicateurs ci-dessous sont incomplets."
        />
      )}

      {/* ============== Filtres ============== */}
      <section
        className={`${CARD} flex flex-wrap items-center gap-x-[22px] gap-y-3 bg-[#edece3] px-4 py-3`}
      >
        <div className="flex items-center gap-2">
          <label className="font-sans text-[11.5px] font-semibold uppercase tracking-[.05em] text-ifvm-text-weak">
            Campagne
          </label>
          <select className="h-8 rounded-[8px] border border-[#d8d4c1] bg-card px-2.5 font-sans text-[13px] font-semibold text-foreground">
            {campagnes.length === 0 && <option>{perimetre}</option>}
            {campagnes.map((c) => (
              <option key={c.id}>
                {libelleCampagne(c)}
                {c.id === campagne?.id ? ' (en cours)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="font-sans text-[11.5px] font-semibold uppercase tracking-[.05em] text-ifvm-text-weak">
            Période
          </label>
          <div className="flex flex-wrap gap-1 rounded-[9px] border border-[#e7e0cd] bg-card p-[3px]">
            {['Ce jour', 'Décade', 'Mois', 'Trimestre', 'Campagne', 'Perso.'].map((p, i) => (
              <button
                key={p}
                type="button"
                className={`rounded-[6px] px-[10px] py-[5px] font-sans text-[12px] font-semibold whitespace-nowrap ${
                  i === 4
                    ? 'bg-ifvm-green-text text-white'
                    : 'text-ifvm-text-tertiary hover:bg-[#edece3]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-[9px] border border-ifvm-green-text bg-ifvm-green-text px-3.5 py-2 font-sans text-[12.5px] font-bold text-white hover:brightness-95"
          >
            <Icon name="calendar" className="h-3.5 w-3.5" />
            Exporter
          </button>
        </div>
      </section>

      {/* ============== KPI ============== */}
      <section className="grid grid-cols-1 gap-[14px] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Prospections"
          valeur={enChargement ? '…' : nombreFr.format(fiches.length)}
          icon="search"
          iconBg="rgba(31,110,82,0.12)"
          iconColor="var(--ifvm-green-text)"
          sousTitre={`dont ${nombreFr.format(nbIntensives)} intensives · ${perimetre}`}
        />

        <KpiCard
            label="Surface infestée"
          valeur={enChargement ? '…' : nombreFr.format(Math.round(surfaceInfestee))}
          unite="ha"
          icon="locust"
          iconBg="rgba(209,102,60,0.15)"
          iconColor="#d1663c"
        />

        <KpiCard
          label="Surface traitée"
          valeur={enChargement ? '…' : nombreFr.format(Math.round(surfaceTraitee))}
          unite="ha"
          icon="drop"
          iconBg="rgba(31,110,82,0.12)"
          iconColor="var(--ifvm-green-text)"
          meter={{
            pct: tauxCouverture,
            legende: `${tauxCouverture.toLocaleString('fr-FR')} % de la surface infestée`,
            valeurAffichee: `${nombreFr.format(Math.round(surfaceTraitee))} ha`,
            couleur: 'var(--ifvm-green-text)',
          }}
        />

        <KpiCard
          label="Surface protégée"
            valeur={enChargement ? '…' : nombreFr.format(Math.round(surfaceProtegee))}
          unite="ha"
          icon="shield"
          iconBg="rgba(42,120,214,0.12)"
          iconColor="#2a78d6"
            sousTitre="Surface couverte par un traitement de barrière"
        />

        <KpiCard
          label="Pesticides utilisés"
            valeur={enChargement ? '…' : nombreFr.format(Math.round(volumePesticides))}
          unite="L"
          icon="flask"
          iconBg="rgba(74,58,167,0.13)"
          iconColor="#4a3aa7"
            segments={produits.map((produit, index) => ({
              pct: produit.pct,
              couleur: ['#4a3aa7', '#e34948', '#7d8578'][index],
            }))}
        />

        <KpiCard
          label="Interventions réalisées"
          valeur={enChargement ? '…' : nombreFr.format(nbInterventions)}
          icon="target"
          iconBg="rgba(181,101,45,0.14)"
          iconColor="#b5652d"
          sousTitre={
            nbInterventions > 0
              ? `≈ ${nombreFr.format(Math.round(surfaceTraitee / nbInterventions))} ha / intervention`
              : 'aucune intervention enregistrée'
          }
        />
      </section>

      {sansSurface > 0 && (
        <p className="font-sans text-[11px] font-medium text-ifvm-text-tertiary">
          {sansSurface} fiche{sansSurface > 1 ? 's' : ''} de traitement sans surface traitée
          enregistrée — hors du cumul ci-dessus.
        </p>
      )}

      {/* ============== Grille principale ============== */}
      <section className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.65fr_1fr]">
        {/* --------- Colonne gauche --------- */}
        <div className="flex min-w-0 flex-col gap-[18px]">
          {/* Pipeline */}
          <section className={`${CARD} px-5 py-[18px]`}>
            <div className="mb-3.5 flex items-baseline justify-between gap-2.5">
              <div>
                <h2 className="font-sans text-[14.5px] font-bold">Pipeline de validation</h2>
                <p className="mt-0.5 font-sans text-[12px] text-ifvm-text-weak">
                  Répartition des fiches — {perimetre}
                </p>
              </div>
              <Link
                to="/prospections"
                className="rounded-[7px] border border-[#d8d4c1] px-2.5 py-[5px] font-sans text-[11.5px] font-semibold text-ifvm-text-tertiary hover:bg-[#edece3]"
              >
                Voir les fiches ›
              </Link>
            </div>
            <div className="flex flex-col gap-[11px]">
              {pipeline.map((etape) => (
                <div key={etape.statut} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-[3px] ${PIPELINE_CLASSES[etape.statut]}`}
                      aria-hidden
                    />
                    <span className="flex-1 font-sans text-[12px] font-semibold">
                      {etape.label}
                    </span>
                    <span className="font-mono text-[13px] font-semibold tabular-nums">
                      {etape.n}
                    </span>
                    <span className="w-[42px] text-right font-mono text-[11px] font-medium text-ifvm-text-weak">
                      {etape.pct}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-[4px] bg-ifvm-bar-fond">
                    <div
                      className={`h-full rounded-[4px] ${PIPELINE_CLASSES[etape.statut]}`}
                      style={{ width: `${etape.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Évolution */}
          <section className={`${CARD} px-5 py-[18px]`}>
            <div className="mb-3.5 flex items-baseline justify-between gap-2.5">
              <div>
                <h2 className="font-sans text-[14.5px] font-bold">Évolution de la campagne</h2>
                <p className="mt-0.5 font-sans text-[12px] text-ifvm-text-weak">
                  Superficies infestées, traitées et protégées — {perimetre}
                </p>
              </div>
              <button
                type="button"
                className="rounded-[7px] border border-[#d8d4c1] px-2.5 py-[5px] font-sans text-[11.5px] font-semibold text-ifvm-text-tertiary hover:bg-[#edece3]"
              >
                Voir en tableau
              </button>
            </div>
            <div className="flex flex-wrap gap-x-[14px] gap-y-2 pb-2">
              <span className="inline-flex items-center gap-1.5 font-sans text-[12px] font-semibold text-ifvm-text-tertiary">
                <span className="h-[3px] w-[14px] rounded-[2px] bg-[#eb6834]" />
                Infestée
              </span>
              <span className="inline-flex items-center gap-1.5 font-sans text-[12px] font-semibold text-ifvm-text-tertiary">
                <span className="h-[3px] w-[14px] rounded-[2px] bg-[#1baf7a]" />
                Traitée
              </span>
              <span className="inline-flex items-center gap-1.5 font-sans text-[12px] font-semibold text-ifvm-text-tertiary">
                <span className="h-[3px] w-[14px] rounded-[2px] bg-[#2a78d6]" />
                Protégée
              </span>
            </div>
            <div className="relative h-[220px] w-full rounded-[10px] border border-dashed border-[#e7e0cd] bg-[#fafaf5]">
              <div className="absolute inset-0 flex items-center justify-center font-sans text-[12px] text-ifvm-text-weak">
                Graphique d’évolution — à brancher
              </div>
            </div>
          </section>

          {/* Carte */}
          <section className={`${CARD} px-5 py-[18px]`}>
            <div className="mb-3.5 flex items-baseline justify-between gap-2.5">
              <div>
                <h2 className="font-sans text-[14.5px] font-bold">Zones suivies par région</h2>
                <p className="mt-0.5 font-sans text-[12px] text-ifvm-text-weak">
                  Taille = nombre de fiches rattachées — {perimetre}
                </p>
              </div>
              <div className="flex gap-1 rounded-[9px] border border-[#e7e0cd] bg-[#edece3] p-[3px]">
                {['Infestation', 'Traitement'].map((t, i) => (
                  <button
                    key={t}
                    type="button"
                    className={`rounded-[6px] px-[10px] py-[5px] font-sans text-[12px] font-semibold ${
                      i === 0 ? 'bg-ifvm-green-text text-white' : 'text-ifvm-text-tertiary'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-center">
              <div className="flex aspect-[300/565] w-full max-w-[320px] items-center justify-center rounded-[10px] border border-dashed border-[#e7e0cd] bg-[#fafaf5] font-sans text-[12px] text-ifvm-text-weak">
                Carte de Madagascar — à brancher
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-[#e7e0cd] pt-3">
              <span className="inline-flex items-center gap-1.5 font-sans text-[11.5px] font-semibold text-ifvm-text-tertiary">
                <span className="h-2 w-2 rounded-full bg-ifvm-danger" />
                Infesté
              </span>
              <span className="inline-flex items-center gap-1.5 font-sans text-[11.5px] font-semibold text-ifvm-text-tertiary">
                <span className="h-2 w-2 rounded-full bg-[#aab1a3]" />
                Hors aire grégarigène
              </span>
            </div>
          </section>
        </div>

        {/* --------- Colonne droite --------- */}
        <div className="flex min-w-0 flex-col gap-[18px]">
          <section className={`${CARD} px-5 py-[18px]`}>
            <div className="mb-3.5">
              <h2 className="font-sans text-[14.5px] font-bold">Traitements — voie et mode</h2>
              <p className="mt-0.5 font-sans text-[12px] text-ifvm-text-weak">
                Répartition des {nombreFr.format(Math.round(surfaceTraitee))} ha traités
              </p>
            </div>
            <div className="mb-2 font-sans text-[11px] font-bold uppercase tracking-[.05em] text-ifvm-text-tertiary">
              Par voie
            </div>
            <div className="flex flex-col gap-3">
              {voies.map((voie, index) => (
                <BarRow
                  key={voie.label}
                  label={voie.label}
                  valeur={`${voie.pct.toLocaleString('fr-FR')} %`}
                  pct={voie.pct}
                  couleur={index === 0 ? '#2a78d6' : '#eb6834'}
                  sous={`${voie.pct.toLocaleString('fr-FR')} % de la surface couverte`}
                />
              ))}
            </div>
            <div className="mb-2 mt-4 font-sans text-[11px] font-bold uppercase tracking-[.05em] text-ifvm-text-tertiary">
              Par mode
            </div>
            <div className="flex flex-col gap-3">
              {modes.map((mode, index) => (
                <BarRow
                  key={mode.label}
                  label={mode.label}
                  valeur={`${mode.pct.toLocaleString('fr-FR')} %`}
                  pct={mode.pct}
                  couleur={index === 0 ? '#4a3aa7' : '#e34948'}
                  sous={`${mode.pct.toLocaleString('fr-FR')} % de la surface couverte`}
                />
              ))}
            </div>
          </section>

          <section className={`${CARD} px-5 py-[18px]`}>
            <div className="mb-3.5">
              <h2 className="font-sans text-[14.5px] font-bold">
                Pesticides utilisés par catégorie
              </h2>
              <p className="mt-0.5 font-sans text-[12px] text-ifvm-text-weak">
                Volume appliqué (L)
              </p>
            </div>
            <div className="flex flex-col gap-3">
              {produits.map((produit, index) => (
                <BarRow
                  key={produit.label}
                  label={produit.label}
                  valeur={`${produit.pct.toLocaleString('fr-FR')} %`}
                  pct={produit.pct}
                  couleur={['#4a3aa7', '#e34948', '#7d8578'][index]}
                  sous={`${nombreFr.format(Math.round(produit.valeur))} L`}
                />
              ))}
            </div>
          </section>

          <section className={`${CARD} px-5 py-[18px]`}>
            <h2 className="mb-3.5 font-sans text-[14.5px] font-bold">Top stations</h2>
            {topStations.length === 0 ? (
              <p className="font-sans text-[12px] font-medium text-ifvm-text-tertiary">
                {enChargement ? 'Chargement…' : 'Aucune fiche rattachée à une station.'}
              </p>
            ) : (
              <div className="flex flex-col gap-[9px]">
                {topStations.map((station) => (
                  <div key={station.id} className="flex items-center gap-2.5">
                    <span className="w-[52px] font-mono text-[10.5px] font-semibold text-ifvm-text-weak">
                      {station.code}
                    </span>
                    <span className="flex-1 truncate font-sans text-[12px] font-medium text-foreground">
                      {station.nom}
                    </span>
                    <div className="h-1.5 w-24 overflow-hidden rounded-[4px] bg-ifvm-bar-fond">
                      <div
                        className="h-full bg-ifvm-green-text"
                        style={{ width: `${station.pct}%` }}
                      />
                    </div>
                    <span className="w-[22px] text-right font-mono text-[11px] font-semibold tabular-nums">
                      {station.n}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex items-center justify-between border-t border-[#e7e0cd] pt-3 font-sans text-[11.5px] text-ifvm-text-weak">
              <span>Stations actives</span>
              <span className="font-mono font-bold text-foreground">
                {nombreFr.format(stationsActives)}
              </span>
            </div>
          </section>
        </div>
      </section>

      {/* ============== Tableau d'activité ============== */}
      <section className={`${CARD} overflow-hidden`}>
        <div className="flex items-baseline justify-between border-b border-[#f1ecdd] px-5 py-4">
          <h2 className="font-sans text-[14.5px] font-bold">Activité récente</h2>
          <span className="font-sans text-[11px] font-medium text-ifvm-text-weak">
            Dernières 24 h
          </span>
        </div>
        <DataTable
          columns={colonnesActivite}
          rows={activite}
          getRowKey={(l) => l.id}
          onRowClick={(l) => navigate(l.lien)}
          emptyMessage={
            enChargement ? 'Chargement…' : 'Aucune fiche reçue dans les dernières 24 h.'
          }
        />
      </section>
    </div>
  )
}