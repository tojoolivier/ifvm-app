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
  sommeSurfaceInfestee,
  sommeSurfaceTraitee,
  tauxValidation,
  type DashboardProspection,
  type DashboardStation,
  type DashboardTraitement,
  type LigneActivite,
} from '@/lib/dashboard-metrics'

/**
 * Couleurs des barres du pipeline — prototype ligne 1306. Elles vivent dans la
 * page, pas dans la couche de calcul : `dashboard-metrics.ts` ne doit changer
 * que pour une raison métier, jamais pour une raison graphique.
 */
const PIPELINE_CLASSES: Record<Statut, string> = {
  brouillon: 'bg-ifvm-bar-brouillon',
  en_attente: 'bg-ifvm-amber',
  verifiee: 'bg-ifvm-bar-verifiee',
  validee: 'bg-ifvm-green-text',
  rejetee: 'bg-ifvm-danger',
}

const nombreFr = new Intl.NumberFormat('fr-FR')

/** Carte de la maquette : `#fff`, bord `#e7e0cd`, rayon `11px`. */
const carteClass = 'rounded-[11px] border border-[#e7e0cd] bg-card'

interface TuileProps {
  label: string
  valeur: string
  /** Unité en petit à droite de la valeur (`ha`, `%`) — prototype ligne 94. */
  unite?: string
  legende: string
  /** La maquette met la surface traitée en vert et l'alerte de rejet en ambre. */
  tonValeur?: string
  tonLegende?: string
}

function Tuile({ label, valeur, unite, legende, tonValeur, tonLegende }: TuileProps) {
  return (
    <div className={`${carteClass} px-[18px] py-4`}>
      <div className="font-sans text-[10px] font-semibold uppercase tracking-[.8px] text-ifvm-text-weak">
        {label}
      </div>
      <div
        className={`mt-1.5 font-mono text-[30px] font-bold leading-[1.1] ${tonValeur ?? 'text-foreground'}`}
      >
        {valeur}
        {unite && <span className="text-[14px] text-ifvm-text-tertiary"> {unite}</span>}
      </div>
      <div
        className={`mt-1 font-sans text-[11px] font-medium ${tonLegende ?? 'text-ifvm-text-tertiary'}`}
      >
        {legende}
      </div>
    </div>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { nomAgent } = useAnnuaire()

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

  // Les indicateurs de la maquette portent sur « la campagne en cours ». Sans
  // campagne active (jeu de données vide, période creuse), on retombe sur
  // l'ensemble des fiches plutôt que sur un écran à zéro, et la légende le dit.
  const campagne = campagneActive(campagnes)
  const fiches = useMemo(
    () => (campagne ? prospections.filter((p) => p.campagne_id === campagne.id) : prospections),
    [prospections, campagne],
  )
  const perimetre = campagne ? 'campagne en cours' : 'toutes campagnes'
  const enChargement = fichesEnCours

  // `traitement` n'a pas de `campagne_id` : il est rattaché à une prospection,
  // qui porte la campagne. Sans ce filtre, la surface traitée de tout
  // l'historique était rapportée à la seule surface infestée de la campagne —
  // le rapport dépassait 100 %.
  const traitementsCampagne = useMemo(() => {
    if (!campagne) return traitements
    const idsFiches = new Set(fiches.map((p) => p.id))
    return traitements.filter((t) => idsFiches.has(t.prospection_id))
  }, [traitements, fiches, campagne])

  const surfaceInfestee = sommeSurfaceInfestee(fiches)
  const { total: surfaceTraitee, sansSurface } = sommeSurfaceTraitee(traitementsCampagne)
  const taux = tauxValidation(fiches)
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

  return (
    // 28px latéraux : aligne le contenu sur le fil d'Ariane du header (Layout).
    <div className="flex flex-col gap-[18px] px-7 pb-10 pt-[26px]">
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

      <div className="grid grid-cols-4 gap-[14px]">
        {/* La valeur porte sur toutes les fiches de la campagne, comme le
            pipeline juste dessous : dans la maquette, 12+7+19+97+13 = 148 = la
            valeur de cette tuile (prototype l.91 et l.1306). La part
            d'intensives passe en légende. */}
        <Tuile
          label="Prospections"
          valeur={enChargement ? '…' : nombreFr.format(fiches.length)}
          legende={`dont ${nombreFr.format(compteProspections(fiches, 'intensive'))} intensives · ${perimetre}`}
        />
        <Tuile
          label="Surface infestée"
          valeur={enChargement ? '…' : nombreFr.format(Math.round(surfaceInfestee))}
          unite="ha"
          legende="cumul déclaré"
        />
        <Tuile
          label="Surface traitée"
          valeur={enChargement ? '…' : nombreFr.format(Math.round(surfaceTraitee))}
          unite="ha"
          tonValeur="text-ifvm-green-text"
          legende={
            surfaceInfestee > 0
              ? `${nombreFr.format(Math.round((surfaceTraitee / surfaceInfestee) * 1000) / 10)} % de la surface infestée`
              : 'aucune surface infestée déclarée'
          }
        />
        <Tuile
          label="Taux de validation"
          valeur={enChargement ? '…' : taux ? String(taux.validation) : '—'}
          unite={taux ? '%' : undefined}
          legende={taux ? `${taux.rejet} % rejetées (motif renseigné)` : 'aucune fiche statuée'}
          tonLegende={taux && taux.rejet > 0 ? 'text-ifvm-amber-text' : undefined}
        />
      </div>

      {/* Hors maquette, mais nécessaire : l'aérien n'expose aucune surface
          traitée côté API et un terrestre peut avoir la sienne vide. Sans cette
          mention, la tuile « Surface traitée » se lirait comme un total. */}
      {sansSurface > 0 && (
        <p className="font-sans text-[11px] font-medium text-ifvm-text-tertiary">
          {sansSurface} fiche{sansSurface > 1 ? 's' : ''} de traitement sans surface traitée
          enregistrée — hors du cumul ci-dessus.
        </p>
      )}

      <div className="grid grid-cols-[1.35fr_1fr] gap-4">
        <section className={`${carteClass} px-5 py-[18px]`}>
          <div className="mb-3.5 flex items-baseline justify-between">
            <h2 className="font-sans text-[14px] font-bold">Pipeline de validation</h2>
            <Link
              to="/prospections"
              className="font-sans text-[11px] font-semibold text-ifvm-green-text"
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
                  <span className="flex-1 font-sans text-[12px] font-semibold">{etape.label}</span>
                  <span className="font-mono text-[13px] font-semibold">{etape.n}</span>
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

        <section className={`${carteClass} px-5 py-[18px]`}>
          <h2 className="mb-3.5 font-sans text-[14px] font-bold">Top stations</h2>
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
                  <span className="flex-1 truncate font-sans text-[12px] font-medium text-[#3a3a30]">
                    {station.nom}
                  </span>
                  <div className="h-1.5 w-24 overflow-hidden rounded-[4px] bg-ifvm-bar-fond">
                    <div
                      className="h-full bg-ifvm-green-text"
                      style={{ width: `${station.pct}%` }}
                    />
                  </div>
                  <span className="w-[22px] text-right font-mono text-[11px] font-semibold">
                    {station.n}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className={`${carteClass} overflow-hidden`}>
        <div className="flex items-baseline justify-between border-b border-[#f1ecdd] px-5 py-4">
          <h2 className="font-sans text-[14px] font-bold">Activité récente</h2>
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
