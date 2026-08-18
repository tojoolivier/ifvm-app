import { useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { cn } from '@/lib/utils'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { ErrorBanner } from '@/components/ui/error-banner'
import { NavTabs } from '@/components/ui/nav-tabs'
import { PILL_TONES, Pill } from '@/components/ui/pill'
import { MODE_LABELS, ROLE_LABELS, SIGNATURE_ROLES, STATUS_LABELS, TYPE_LABELS } from '@/lib/traitement-labels'
import {
  KITS_EPI,
  axesRisque,
  especesListees,
  formatHeure,
  formatHorodatage,
  formatSurface,
  libelleImpact,
  resumeEspeces,
  zonesExposeesLabels,
} from '@/lib/traitement-fiche'

interface Rotation {
  id: string
  numero: number
  numero_cuve: string
  produit_id: string
  quantite_l: number
  temperature_debut_c: number
  temperature_fin_c: number
  vent_debut_ms: number
  vent_fin_ms: number
}

interface ProduitUtilise {
  id: string
  numero: number
  produit_id: string
  quantite_l: number
}

interface Cible {
  espece: string | null
  repartition_population: string | null
  surface_infestee_ha: number | string | null
}

interface TraitementDetail {
  id: string
  prospection_id: string
  numero_fiche: string
  type_traitement: 'AERIEN' | 'TERRESTRE'
  mode_traitement: string | null
  date_traitement: string
  date_validation: string
  localite: string
  region: string | null
  district: string | null
  commune: string | null
  statut: string
  cible: Cible | null
  aerien: {
    pilote: string
    mecanicien: string
    nb_rotations: number
    total_pesticide_l: number | null
    rotations: Rotation[]
  } | null
  terrestre: {
    heure_debut: string
    heure_fin: string
    vitesse_vent_ms: number
    reprise_traitement: boolean
    traitement_origine_id: string | null
    surface_traitee_ha: number | null
    surface_cumulee_ha: number | null
    surface_restante_ha: number | null
    surface_restante_abandonnee: boolean | null
    motif_surface_restante_abandonnee: string | null
    produits: ProduitUtilise[]
  } | null
  kit_combinaison: boolean
  kit_gants: boolean
  kit_lunettes: boolean
  kit_masques: boolean
  kit_boite: boolean
  zones_exposees: Record<string, unknown> | null
  empoisonnement: boolean
  empoisonnement_type: string | null
  empoisonnement_mode: string | null
  empoisonnement_autre: string | null
  evaluation_risque: Record<string, unknown> | null
  comportement_anormal: boolean
  comportement_non_cibles: Record<string, unknown> | null
  mortalite: boolean
  mortalite_familles: Record<string, unknown> | null
  signatures: { id: string; role: string; signataire_nom: string; horodatage: string }[]
}

interface PesticideSync {
  id: string
  nom: string
}

interface ReferentielPullResponse {
  pesticides: { upserts: PesticideSync[] }
}

/** Carte blanche de la maquette : `#fff`, bordure `#e7e0cd`, rayon `11px`. */
function Carte({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-[11px] border border-[#e7e0cd] bg-card', className)}>
      {children}
    </section>
  )
}

/** Titre de section en capitales — `600 9.5px`, interlettrage `1px`. */
function TitreSection({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 font-sans text-[9.5px] font-semibold uppercase tracking-[1px] text-ifvm-text-weak">
      {children}
    </h2>
  )
}

/** Pastille EPI : `16px`, rayon `4px`, verte cochée / rouge décochée. */
function PastilleEpi({ actif }: { actif: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] font-sans text-[9px] font-bold text-white',
        actif ? 'bg-ifvm-green-text' : 'bg-[#c0412b]',
      )}
    >
      {actif ? '✓' : '✕'}
    </span>
  )
}

/** Ligne « libellé / valeur » du panneau Surfaces. */
function LigneSurface({
  label,
  valeur,
  alerte,
  detache,
}: {
  label: string
  valeur: string
  alerte?: boolean
  detache?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-3',
        detache && 'border-t border-ifvm-green-border pt-2',
      )}
    >
      <span
        className={cn(
          'font-sans text-[11.5px]',
          alerte ? 'font-semibold text-ifvm-amber-text' : 'font-medium text-[#3a5c43]',
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          'font-mono text-[15px] font-bold',
          alerte ? 'text-ifvm-amber-text' : 'text-[#16201a]',
        )}
      >
        {valeur}
      </span>
    </div>
  )
}

export function TraitementDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data: traitement, isLoading, isError, error } = useQuery<TraitementDetail>({
    queryKey: ['traitement', id],
    queryFn: () => api.get(`/traitements/${id}`).then((r) => r.data),
    enabled: !!id,
  })

  const { data: pesticidePull } = useQuery<ReferentielPullResponse>({
    queryKey: ['referentiel-pull', 'pesticides'],
    queryFn: () => api.get('/referentiel/pull').then((r) => r.data),
  })

  const pesticideNoms = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of pesticidePull?.pesticides.upserts ?? []) map.set(p.id, p.nom)
    return map
  }, [pesticidePull])

  // La maquette affiche « produit · matière active ». La colonne matière
  // active n'existe pas encore sur `pesticide` (issue #129, arbitrage produit
  // en attente) : on rend le nom seul plutôt qu'un séparateur orphelin.
  const rotationColumns: DataTableColumn<Rotation>[] = useMemo(
    () => [
      {
        key: 'numero_cuve',
        header: 'N° cuve',
        render: (r) => (
          <span className="font-mono text-[12px] font-semibold text-ifvm-green-text">
            {r.numero_cuve}
          </span>
        ),
      },
      { key: 'produit', header: 'Produit', render: (r) => pesticideNoms.get(r.produit_id) ?? '—' },
      {
        key: 'quantite',
        header: 'Quantité (l)',
        align: 'right',
        mono: true,
        render: (r) => r.quantite_l,
      },
      {
        key: 'temperature',
        header: 'T° début → fin',
        align: 'right',
        mono: true,
        render: (r) => `${r.temperature_debut_c} → ${r.temperature_fin_c} °C`,
      },
      {
        key: 'vent',
        header: 'Vent début → fin',
        align: 'right',
        mono: true,
        render: (r) => `${r.vent_debut_ms} → ${r.vent_fin_ms} m/s`,
      },
    ],
    [pesticideNoms],
  )

  const produitColumns: DataTableColumn<ProduitUtilise>[] = useMemo(
    () => [
      { key: 'produit', header: 'Produit', render: (p) => pesticideNoms.get(p.produit_id) ?? '—' },
      {
        key: 'quantite',
        header: 'Quantité (l)',
        align: 'right',
        mono: true,
        render: (p) => p.quantite_l,
      },
    ],
    [pesticideNoms],
  )

  if (isLoading) {
    return (
      <div className="px-7 pb-10 pt-[26px]">
        <p className="font-sans text-[12px] text-ifvm-text-tertiary">Chargement…</p>
      </div>
    )
  }

  if (isError || !traitement) {
    const status = (error as { response?: { status?: number } })?.response?.status
    const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
    const label = status ? STATUS_LABELS[status] ?? `Erreur ${status}` : 'Erreur'
    const message = detail ?? 'Impossible de charger ce traitement.'
    return (
      <div className="flex flex-col gap-4 px-7 pb-10 pt-[26px]">
        <NavTabs
          ariaLabel="Vues des traitements"
          items={[{ label: 'Liste des fiches', to: '/traitements', active: false }]}
        />
        <ErrorBanner label={label} message={message} />
      </div>
    )
  }

  const lectureSeule = traitement.statut === 'validee'
  const modeLabel = traitement.mode_traitement
    ? MODE_LABELS[traitement.mode_traitement] ?? traitement.mode_traitement
    : null
  const sousTitre = [
    TYPE_LABELS[traitement.type_traitement] ?? traitement.type_traitement,
    modeLabel ? `mode ${modeLabel}` : null,
    traitement.localite,
    lectureSeule ? `validée le ${traitement.date_validation}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const zones = zonesExposeesLabels(traitement.zones_exposees)
  const axes = axesRisque(traitement.evaluation_risque)
  const nonCibles = especesListees(traitement.comportement_non_cibles)
  const familles = especesListees(traitement.mortalite_familles)
  const comportementLabel = libelleImpact(
    traitement.comportement_anormal,
    resumeEspeces(nonCibles, 'espèce non cible', 'espèces non cibles'),
  )
  const mortaliteLabel = libelleImpact(
    traitement.mortalite,
    resumeEspeces(familles, 'famille', 'familles'),
  )
  // « Oui — Ingestion / Contact » : la maquette accroche le détail à la
  // réponse plutôt que d'ouvrir une ligne séparée.
  const empoisonnementDetail = [
    traitement.empoisonnement_type,
    traitement.empoisonnement_mode,
    traitement.empoisonnement_autre,
  ]
    .filter(Boolean)
    .join(' / ')
  const empoisonnementLabel = libelleImpact(traitement.empoisonnement, empoisonnementDetail)
  const surfaceInfestee = traitement.cible?.surface_infestee_ha
  const restante = traitement.terrestre?.surface_restante_ha
  const totalRotations = traitement.aerien
    ? [
        `${traitement.aerien.nb_rotations} rotation${traitement.aerien.nb_rotations > 1 ? 's' : ''}`,
        traitement.aerien.total_pesticide_l != null
          ? `${formatSurface(traitement.aerien.total_pesticide_l)} l`
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : null

  return (
    <div className="flex flex-col gap-4 px-7 pb-10 pt-[26px]">
      <NavTabs
        ariaLabel="Vues des traitements"
        items={[
          { label: 'Liste des fiches', to: '/traitements', active: false },
          {
            label: `Détail · ${traitement.numero_fiche}`,
            to: `/traitements/${traitement.id}`,
            active: true,
          },
        ]}
      />

      {/* En-tête vert de la maquette — `#235a36`, rayon 12px, padding 20/22 */}
      <header
        data-testid="traitement-header"
        className="flex items-center gap-[18px] rounded-[12px] bg-ifvm-green-text px-[22px] py-5 text-white"
      >
        <div className="min-w-0 flex-1">
          <h1 className="font-mono text-[17px] font-bold">{traitement.numero_fiche}</h1>
          <p className="mt-1 font-sans text-[12px] font-medium text-white/75">{sousTitre}</p>
        </div>
        {lectureSeule && (
          <span className="shrink-0 rounded-full bg-white/[.16] px-3 py-[6px] font-sans text-[11px] font-bold">
            🔒 Lecture seule
          </span>
        )}
      </header>

      {/* Bandeau ambre : le snapshot des cibles est figé à la création */}
      {traitement.cible && (
        <p className="rounded-[10px] border border-ifvm-amber-border bg-ifvm-amber-bg px-4 py-3 font-sans text-[12px] font-medium text-ifvm-amber-text">
          Cibles : snapshot figé à la création — issu de{' '}
          <Link to={`/prospections/${traitement.prospection_id}`} className="underline">
            la fiche de prospection
          </Link>
          . Surface infestée de référence : <b>{formatSurface(surfaceInfestee)} ha</b>.
        </p>
      )}

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          {traitement.aerien && (
            <Carte className="overflow-hidden">
              <div className="flex items-baseline gap-3 border-b border-[#f1ecdd] px-5 py-[15px]">
                <h2 className="font-sans text-[14px] font-bold">Rotations</h2>
                <p className="font-sans text-[11px] font-medium text-ifvm-text-weak">
                  rapprochement fiche de vol par n° de cuve
                </p>
                <div className="flex-1" />
                <p className="font-mono text-[12px] font-semibold text-ifvm-green-text">
                  {totalRotations}
                </p>
              </div>
              <DataTable
                columns={rotationColumns}
                rows={traitement.aerien.rotations}
                getRowKey={(r) => r.id}
                emptyMessage="Aucune rotation."
              />
            </Carte>
          )}

          {traitement.terrestre && (
            <Carte className="overflow-hidden">
              <div className="flex items-baseline gap-3 border-b border-[#f1ecdd] px-5 py-[15px]">
                <h2 className="font-sans text-[14px] font-bold">Produits utilisés</h2>
                <div className="flex-1" />
                <p className="font-mono text-[12px] font-semibold text-ifvm-green-text">
                  {formatHeure(traitement.terrestre.heure_debut)} –{' '}
                  {formatHeure(traitement.terrestre.heure_fin)} ·{' '}
                  {traitement.terrestre.vitesse_vent_ms} m/s
                </p>
              </div>
              <DataTable
                columns={produitColumns}
                rows={traitement.terrestre.produits}
                getRowKey={(p) => p.id}
                emptyMessage="Aucun produit utilisé."
              />
            </Carte>
          )}

          {/* Deux cartes côte à côte — grille `1fr 1fr` de la maquette */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Carte className="px-5 py-[18px]">
              <TitreSection>Moyens &amp; protection</TitreSection>
              <ul className="flex flex-col gap-2">
                {KITS_EPI.map((kit) => {
                  const actif = traitement[kit.key]
                  return (
                    <li key={kit.key} className="flex items-center gap-[9px]">
                      <PastilleEpi actif={actif} />
                      <span className="font-sans text-[12px] font-medium text-[#3a3a30]">
                        {kit.label}
                      </span>
                      <span className="sr-only">{actif ? 'présent' : 'absent'}</span>
                    </li>
                  )
                })}
              </ul>
              <p className="mt-3 border-t border-[#f1ecdd] pt-3 font-sans text-[11.5px] font-medium leading-[1.5] text-ifvm-text-tertiary">
                Zones exposées :{' '}
                <b className="text-[#16201a]">{zones.length > 0 ? zones.join(', ') : 'aucune'}</b>
              </p>
            </Carte>

            <Carte className="px-5 py-[18px]">
              <TitreSection>Impacts &amp; évaluation du risque</TitreSection>
              {axes.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {axes.map((axe) => (
                    <li key={axe.key} className="flex items-center gap-[9px]">
                      <span className="flex-1 font-sans text-[12px] font-medium text-[#3a3a30]">
                        {axe.label}
                      </span>
                      <Pill tone={axe.className}>{axe.niveau}</Pill>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="font-sans text-[11.5px] font-medium text-ifvm-text-weak">
                  Aucun axe de risque évalué.
                </p>
              )}
              <div className="mt-3 flex flex-col gap-[5px] border-t border-[#f1ecdd] pt-3 font-sans text-[11.5px] font-medium text-ifvm-text-tertiary">
                <p>
                  Empoisonnement :{' '}
                  <b className={traitement.empoisonnement ? 'text-ifvm-amber-text' : 'text-ifvm-green-text'}>
                    {empoisonnementLabel}
                  </b>
                </p>
                <p>
                  Comportement anormal :{' '}
                  <b
                    className={
                      traitement.comportement_anormal ? 'text-ifvm-amber-text' : 'text-ifvm-green-text'
                    }
                  >
                    {comportementLabel}
                  </b>
                </p>
                <p>
                  Mortalité :{' '}
                  <b className={traitement.mortalite ? 'text-ifvm-amber-text' : 'text-ifvm-green-text'}>
                    {mortaliteLabel}
                  </b>
                </p>
              </div>
            </Carte>
          </div>
        </div>

        {/* Colonne latérale 320px */}
        <div className="flex flex-col gap-[14px]">
          <section className="flex flex-col gap-[10px] rounded-[11px] border border-ifvm-green-border bg-ifvm-green-bg px-[18px] py-4">
            <h2 className="font-sans text-[12.5px] font-bold text-ifvm-green-text">Surfaces (ha)</h2>
            <LigneSurface label="Infestée (snapshot)" valeur={formatSurface(surfaceInfestee)} />
            <LigneSurface
              label="Traitée"
              valeur={formatSurface(traitement.terrestre?.surface_traitee_ha)}
            />
            <LigneSurface
              label="Cumulée (reprises)"
              valeur={formatSurface(traitement.terrestre?.surface_cumulee_ha)}
            />
            <LigneSurface
              label="Restante"
              valeur={formatSurface(restante)}
              alerte={restante != null && Number(restante) > 0}
              detache
            />
            {traitement.terrestre?.surface_restante_abandonnee && (
              <p className="rounded-[8px] border border-ifvm-amber-border bg-ifvm-amber-bg px-[10px] py-2 font-sans text-[10.5px] font-medium leading-[1.5] text-ifvm-amber-text">
                Surface restante <b>abandonnée</b> — motif :{' '}
                <span className="italic">
                  {traitement.terrestre.motif_surface_restante_abandonnee ?? 'non précisé'}
                </span>
              </p>
            )}
          </section>

          <Carte className="px-5 py-[18px]">
            <h2 className="mb-3 font-sans text-[13px] font-bold">Signatures</h2>
            <ul className="flex flex-col gap-[10px]">
              {SIGNATURE_ROLES.map((role) => {
                const signature = traitement.signatures.find((s) => s.role === role)
                return (
                  <li key={role} className="flex items-center gap-[10px]">
                    <div className="min-w-0 flex-1">
                      <p className="font-sans text-[11.5px] font-semibold text-[#16201a]">
                        {ROLE_LABELS[role] ?? role}
                      </p>
                      <p className="font-sans text-[11px] font-medium text-ifvm-text-tertiary">
                        {signature ? signature.signataire_nom : '—'}
                      </p>
                      {signature && (
                        <p className="font-mono text-[10px] font-medium text-ifvm-text-weak">
                          {formatHorodatage(signature.horodatage)}
                        </p>
                      )}
                    </div>
                    <Pill
                      tone={signature ? PILL_TONES.signe : PILL_TONES.neutre}
                      className="shrink-0"
                    >
                      {signature ? '✓ Signé' : 'ne signe pas'}
                    </Pill>
                  </li>
                )
              })}
            </ul>
          </Carte>

          <Carte className="px-[18px] py-4">
            <h2 className="mb-2 font-sans text-[12.5px] font-bold">Chaîne de reprise</h2>
            <p className="font-sans text-[11.5px] font-medium leading-[1.6] text-ifvm-text-tertiary">
              {traitement.terrestre?.reprise_traitement &&
              traitement.terrestre.traitement_origine_id ? (
                <>
                  Origine :{' '}
                  <Link
                    to={`/traitements/${traitement.terrestre.traitement_origine_id}`}
                    className="underline"
                  >
                    fiche d'origine
                  </Link>{' '}
                  → cette fiche.{' '}
                </>
              ) : (
                <>Cette fiche n'est pas une reprise. </>
              )}
              Une seule reprise possible par fiche d'origine.
            </p>
          </Carte>
        </div>
      </div>
    </div>
  )
}
