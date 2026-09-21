import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
  libelleSurfaceTraitee,
  resumeEspeces,
  surfaceTraiteeOuProtegee,
  zonesExposeesLabels,
} from '@/lib/traitement-fiche'
import { useAnnuaire } from '@/lib/use-annuaire'

interface Rotation {
  id: string
  numero: number
  numero_cuve: string
  produit_id: string
  quantite: number
  unite: 'L' | 'kg'
  surface_ha: number | null
  temperature_debut_c: number
  temperature_fin_c: number
  vent_debut_ms: number
  vent_fin_ms: number
  heure_debut: string | null
  heure_fin: string | null
  heure_ouverture_vanne: string | null
  heure_fermeture_vanne: string | null
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

interface TraitementAerien {
  pilote: string
  mecanicien: string
  chef_de_base_id: string | null
  consultant_international: string | null
  base_principale: string | null
  stand: string | null
  // Date d'installation (migration backend 0056,
  // #stand-base-secondaire-date-installation) — facultative et indépendante
  // du texte libre lui-même. Rien d'équivalent pour base_principale : hors
  // périmètre.
  stand_date_installation: string | null
  base_secondaire: string | null
  base_secondaire_date_installation: string | null
  immatricule_aeronef: string | null
  nb_rotations: number
  total_pesticide_l: number | null
  total_pesticide_kg: number | null
  // Jamais renseignées ensemble (migration 0081) : choc → traitée, barrière → protégée.
  surface_traitee_ha: number | null
  surface_protegee_ha: number | null
  reprise_traitement: boolean
  traitement_origine_id: string | null
  surface_cumulee_ha: number | null
  surface_restante_ha: number | null
  pesticide_recu_l: number | null
  pesticide_stock_restant_l: number | null
  rotations: Rotation[]
}

interface TraitementTerrestre {
  chef_equipe_id: string | null
  agent_encadreur_id: string | null
  consultant_international: string | null
  heure_debut: string
  heure_fin: string
  vitesse_vent_ms: number
  direction_vent: string | null
  temperature_c: number | null
  reprise_traitement: boolean
  traitement_origine_id: string | null
  surface_atomiseur_ha: number | null
  surface_disque_rotatif_ha: number | null
  surface_ulvamast_ha: number | null
  surface_traitee_ha: number | null
  surface_cumulee_ha: number | null
  surface_restante_ha: number | null
  surface_restante_abandonnee: boolean | null
  motif_surface_restante_abandonnee: string | null
  essence_litres: number | null
  nb_piles: number | null
  total_pesticide_l: number | null
  pesticide_recu_l: number | null
  pesticide_stock_restant_l: number | null
  produits: ProduitUtilise[]
}

interface TraitementDetail {
  id: string
  prospection_id: string
  // Dérivé côté backend (#numero-fiche-prospection-liee) à partir de
  // prospection_id — jamais une seconde relation, jamais saisi ici.
  prospection_n_fiche: string | null
  numero_fiche: string
  type_traitement: 'AERIEN' | 'TERRESTRE'
  mode_traitement: string | null
  date_traitement: string
  date_validation: string
  localite: string
  region: string | null
  district: string | null
  commune: string | null
  latitude: number | null
  longitude: number | null
  altitude: number | null
  statut: string
  statut_sync: string
  created_at: string
  updated_at: string
  cible: Cible | null
  aerien: TraitementAerien | null
  terrestre: TraitementTerrestre | null
  kit_combinaison: number
  kit_gants: number
  kit_lunettes: number
  kit_masques: number
  kit_botte: number
  zones_exposees: Record<string, unknown> | null
  hauteur_strate_herbeuse_m: number | null
  hauteur_strate_arboree_m: number | null
  recouvrement_percent: number | null
  empoisonnement: boolean
  empoisonnement_type: string | null
  empoisonnement_mode: string | null
  empoisonnement_autre: string | null
  evaluation_risque: Record<string, unknown> | null
  comportement_anormal: boolean
  comportement_non_cibles: Record<string, unknown> | null
  mortalite: boolean
  mortalite_familles: Record<string, unknown> | null
  observations: string | null
  signatures: { id: string; role: string; signataire_nom: string; horodatage: string }[]
  // « Impact et risque → Évaluation du risque pour la population »
  // (#evaluation-risque-population, migration backend 0055) — liste
  // dynamique, commune à Aérien et Terrestre, déjà triée par `ordre`.
  evaluations_risque_population: {
    id: string
    ordre: number
    habitat_proche: string | null
    distance_km: number | null
    sensibilisation: boolean | null
  }[]
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

/** `-22,4021 · 44,3167` — même notation que la fiche de prospection. */
function formatCoordonnees(t: { latitude: number | null; longitude: number | null }): string | null {
  if (t.latitude == null || t.longitude == null) return null
  const fr = (v: number) => v.toFixed(4).replace('.', ',')
  return `${fr(t.latitude)} · ${fr(t.longitude)}`
}

/** Date ISO ("AAAA-MM-JJ") -> "JJ/MM/AAAA", même convention que le DateField mobile. */
function formatDateJour(iso: string | null): string | null {
  if (!iso) return null
  const [year, month, day] = iso.split('T')[0].split('-')
  return year && month && day ? `${day}/${month}/${year}` : iso
}

/** Ligne clé/valeur des cartes « Informations complémentaires ». */
function Champ({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="font-sans text-[11.5px] font-medium text-ifvm-text-tertiary">{label}</span>
      <span className="font-mono text-[12px] font-semibold text-[#16201a]">{value ?? '—'}</span>
    </div>
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

  // « Demander une reprise » (Lot C) : purement informatif — on réutilise le
  // filtre `reprenable` déjà servi par GET /traitements (surface_restante_ha
  // > 0, fiche non déjà utilisée comme origine) plutôt que de dupliquer cette
  // règle côté front. Une fiche déjà « reprenable » l'est automatiquement
  // pour l'app mobile (écran « Zones à reprendre ») ; ce bouton n'écrit rien.
  const { data: reprenables } = useQuery<{ id: string }[]>({
    queryKey: ['traitements-reprenables', traitement?.prospection_id, traitement?.type_traitement],
    queryFn: () =>
      api
        .get('/traitements', {
          params: {
            prospection_id: traitement?.prospection_id,
            type_traitement: traitement?.type_traitement,
            reprenable: true,
          },
        })
        .then((r) => r.data),
    enabled: !!traitement,
  })
  const [reprisePromptOuvert, setReprisePromptOuvert] = useState(false)
  const [telechargementPdfEnCours, setTelechargementPdfEnCours] = useState(false)
  const [erreurPdf, setErreurPdf] = useState<string | null>(null)

  const { nomAgent } = useAnnuaire()

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
        header: 'Quantité',
        align: 'right',
        mono: true,
        render: (r) => `${r.quantite} ${r.unite}`,
      },
      {
        key: 'surface',
        header: 'Surface (ha)',
        align: 'right',
        mono: true,
        render: (r) => (r.surface_ha == null ? '—' : r.surface_ha),
      },
      {
        key: 'heures',
        header: 'Heures (rotation · vanne)',
        align: 'right',
        mono: true,
        render: (r) =>
          `${formatHeure(r.heure_debut)} → ${formatHeure(r.heure_fin)} · ${formatHeure(r.heure_ouverture_vanne)} → ${formatHeure(r.heure_fermeture_vanne)}`,
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
  // Surfaces portées par aerien ET terrestre (mêmes noms de champs, migration
  // 0050 a généralisé le chaînage de reprise à l'Aérien) : le panneau
  // « Surfaces » ne doit pas rester muet sur les trois lignes du bas pour une
  // fiche aérienne, comme c'était le cas en ne lisant que `terrestre`.
  // Traitée (choc, terrestre) ou protégée (barrière aérienne) — cf. `libelleSurfaceTraitee`.
  const surfaceTraitee = surfaceTraiteeOuProtegee(traitement)
  const surfaceCumulee = traitement.terrestre?.surface_cumulee_ha ?? traitement.aerien?.surface_cumulee_ha
  const restanteGenerique = traitement.terrestre?.surface_restante_ha ?? traitement.aerien?.surface_restante_ha
  const repriseFiche = traitement.terrestre?.reprise_traitement
    ? traitement.terrestre
    : traitement.aerien?.reprise_traitement
    ? traitement.aerien
    : null
  const estReprenable = (reprenables ?? []).some((t) => t.id === traitement.id)
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

  const traitementId = traitement.id
  const numeroFiche = traitement.numero_fiche

  async function telechargerPdf() {
    setErreurPdf(null)
    setTelechargementPdfEnCours(true)
    try {
      const response = await api.get(`/traitements/${traitementId}/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(response.data as Blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `fiche-crt-${numeroFiche}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setErreurPdf('Impossible de télécharger le PDF.')
    } finally {
      setTelechargementPdfEnCours(false)
    }
  }

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
          <>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
              onClick={telechargerPdf}
              disabled={telechargementPdfEnCours}
            >
              {telechargementPdfEnCours ? 'Génération…' : 'Télécharger le PDF'}
            </Button>
            <span className="shrink-0 rounded-full bg-white/[.16] px-3 py-[6px] font-sans text-[11px] font-bold">
              🔒 Lecture seule
            </span>
          </>
        )}
      </header>
      {erreurPdf && <ErrorBanner label="PDF" message={erreurPdf} />}

      {/* N° fiche prospection liée (#numero-fiche-prospection-liee) — dérivé de
          prospection_id côté backend, jamais saisi ici, toujours visible (pas
          seulement quand un snapshot de cible existe, cf. bandeau ambre plus bas). */}
      <p className="font-sans text-[12px] text-ifvm-text-tertiary">
        N° fiche prospection liée :{' '}
        <Link
          to={`/prospections/${traitement.prospection_id}`}
          className="font-mono font-semibold underline"
        >
          {traitement.prospection_n_fiche ?? traitement.prospection_id}
        </Link>
      </p>

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
                  // Migration backend 0040 : les 5 colonnes sont passées de
                  // booléen à un nombre de personnes équipées — la pastille
                  // reste dérivée de « > 0 » mais le compte réel s'affiche.
                  const nombre = traitement[kit.key] ?? 0
                  const actif = nombre > 0
                  return (
                    <li key={kit.key} className="flex items-center gap-[9px]">
                      <PastilleEpi actif={actif} />
                      <span className="font-sans text-[12px] font-medium text-[#3a3a30]">
                        {kit.label}
                      </span>
                      <span className="ml-auto font-mono text-[11px] font-semibold text-ifvm-text-tertiary">
                        {nombre}
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

              {(traitement.evaluations_risque_population ?? []).length > 0 && (
                <div className="mt-3 border-t border-[#f1ecdd] pt-3">
                  <p className="mb-2 font-sans text-[11px] font-bold uppercase tracking-wide text-ifvm-text-tertiary">
                    Évaluation du risque pour la population
                  </p>
                  <ul className="flex flex-col gap-2">
                    {traitement.evaluations_risque_population.map((evaluation, index) => (
                      <li
                        key={evaluation.id}
                        className="rounded-[8px] border border-[#f1ecdd] px-3 py-2 font-sans text-[11.5px] font-medium text-[#3a3a30]"
                      >
                        <p className="font-bold text-ifvm-text-tertiary">{`Évaluation ${index + 1}`}</p>
                        <p>Habitats les plus proches : {evaluation.habitat_proche || 'non renseigné'}</p>
                        <p>
                          Distance :{' '}
                          {evaluation.distance_km == null ? 'non renseignée' : `${evaluation.distance_km} km`}
                        </p>
                        <p>
                          Sensibilisation :{' '}
                          {evaluation.sensibilisation == null
                            ? 'non renseignée'
                            : evaluation.sensibilisation
                              ? 'Oui'
                              : 'Non'}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Carte>
          </div>

          {/* Informations complémentaires — champs jusqu'ici absents de la fiche
              de lecture web (position GPS, strates, observations, traçabilité). */}
          <Carte className="px-5 py-[18px]">
            <TitreSection>Informations complémentaires</TitreSection>
            <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
              <Champ label="Position GPS" value={formatCoordonnees(traitement)} />
              <Champ
                label="Altitude"
                value={traitement.altitude == null ? null : `${formatSurface(traitement.altitude)} m`}
              />
              <Champ
                label="Strate herbeuse"
                value={
                  traitement.hauteur_strate_herbeuse_m == null
                    ? null
                    : `${formatSurface(traitement.hauteur_strate_herbeuse_m)} m`
                }
              />
              <Champ
                label="Strate arborée"
                value={
                  traitement.hauteur_strate_arboree_m == null
                    ? null
                    : `${formatSurface(traitement.hauteur_strate_arboree_m)} m`
                }
              />
              <Champ
                label="Recouvrement"
                value={
                  traitement.recouvrement_percent == null
                    ? null
                    : `${traitement.recouvrement_percent} %`
                }
              />
              <Champ label="Statut de synchronisation" value={traitement.statut_sync} />
              <Champ label="Créée le" value={formatHorodatage(traitement.created_at)} />
              <Champ label="Mise à jour le" value={formatHorodatage(traitement.updated_at)} />
            </div>
            {traitement.observations && (
              <p className="mt-3 border-t border-[#f1ecdd] pt-3 font-sans text-[11.5px] font-medium leading-[1.5] text-ifvm-text-tertiary">
                Observations : <span className="text-[#3a3a30]">{traitement.observations}</span>
              </p>
            )}
          </Carte>

          {traitement.aerien && (
            <Carte className="px-5 py-[18px]">
              <TitreSection>Équipe &amp; aéronef</TitreSection>
              <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
                <Champ label="Pilote" value={traitement.aerien.pilote} />
                <Champ label="Mécanicien" value={traitement.aerien.mecanicien} />
                <Champ label="Chef de base" value={nomAgent(traitement.aerien.chef_de_base_id)} />
                <Champ
                  label="Consultant international"
                  value={traitement.aerien.consultant_international}
                />
                <Champ label="Immatriculation aéronef" value={traitement.aerien.immatricule_aeronef} />
                <Champ label="Base principale" value={traitement.aerien.base_principale} />
                <Champ label="Stand" value={traitement.aerien.stand} />
                <Champ
                  label="Date d'installation (Stand)"
                  value={formatDateJour(traitement.aerien.stand_date_installation)}
                />
                <Champ label="Base secondaire" value={traitement.aerien.base_secondaire} />
                <Champ
                  label="Date d'installation (Base secondaire)"
                  value={formatDateJour(traitement.aerien.base_secondaire_date_installation)}
                />
                <Champ
                  label="Total pesticide"
                  value={
                    traitement.aerien.total_pesticide_kg == null
                      ? null
                      : `${formatSurface(traitement.aerien.total_pesticide_kg)} kg`
                  }
                />
                <Champ
                  label="Pesticide reçu"
                  value={
                    traitement.aerien.pesticide_recu_l == null
                      ? null
                      : `${formatSurface(traitement.aerien.pesticide_recu_l)} l`
                  }
                />
                <Champ
                  label="Stock restant"
                  value={
                    traitement.aerien.pesticide_stock_restant_l == null
                      ? null
                      : `${formatSurface(traitement.aerien.pesticide_stock_restant_l)} l`
                  }
                />
              </div>
            </Carte>
          )}

          {traitement.terrestre && (
            <Carte className="px-5 py-[18px]">
              <TitreSection>Équipe &amp; matériel</TitreSection>
              <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
                <Champ label="Chef d'équipe" value={nomAgent(traitement.terrestre.chef_equipe_id)} />
                <Champ
                  label="Agent encadreur"
                  value={
                    traitement.terrestre.agent_encadreur_id
                      ? nomAgent(traitement.terrestre.agent_encadreur_id)
                      : null
                  }
                />
                <Champ
                  label="Consultant international"
                  value={traitement.terrestre.consultant_international}
                />
                <Champ label="Direction du vent" value={traitement.terrestre.direction_vent} />
                <Champ
                  label="Essence"
                  value={
                    traitement.terrestre.essence_litres == null
                      ? null
                      : `${formatSurface(traitement.terrestre.essence_litres)} l`
                  }
                />
                <Champ label="Piles" value={traitement.terrestre.nb_piles} />
                <Champ
                  label="Total pesticide"
                  value={
                    traitement.terrestre.total_pesticide_l == null
                      ? null
                      : `${formatSurface(traitement.terrestre.total_pesticide_l)} l`
                  }
                />
                <Champ
                  label="Pesticide reçu"
                  value={
                    traitement.terrestre.pesticide_recu_l == null
                      ? null
                      : `${formatSurface(traitement.terrestre.pesticide_recu_l)} l`
                  }
                />
                <Champ
                  label="Stock restant"
                  value={
                    traitement.terrestre.pesticide_stock_restant_l == null
                      ? null
                      : `${formatSurface(traitement.terrestre.pesticide_stock_restant_l)} l`
                  }
                />
              </div>
            </Carte>
          )}
        </div>

        {/* Colonne latérale 320px */}
        <div className="flex flex-col gap-[14px]">
          <section className="flex flex-col gap-[10px] rounded-[11px] border border-ifvm-green-border bg-ifvm-green-bg px-[18px] py-4">
            <h2 className="font-sans text-[12.5px] font-bold text-ifvm-green-text">Surfaces (ha)</h2>
            <LigneSurface label="Infestée (snapshot)" valeur={formatSurface(surfaceInfestee)} />
            <LigneSurface
              label={libelleSurfaceTraitee(traitement)}
              valeur={formatSurface(surfaceTraitee)}
            />
            <LigneSurface label="Cumulée (reprises)" valeur={formatSurface(surfaceCumulee)} />
            <LigneSurface
              label="Restante"
              valeur={formatSurface(restanteGenerique)}
              alerte={restanteGenerique != null && Number(restanteGenerique) > 0}
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
              {repriseFiche?.traitement_origine_id ? (
                <>
                  Origine :{' '}
                  <Link to={`/traitements/${repriseFiche.traitement_origine_id}`} className="underline">
                    fiche d'origine
                  </Link>{' '}
                  → cette fiche.{' '}
                </>
              ) : (
                <>Cette fiche n'est pas une reprise. </>
              )}
              Une seule reprise possible par fiche d'origine.
            </p>
            {estReprenable && (
              <button
                type="button"
                onClick={() => setReprisePromptOuvert(true)}
                className="mt-3 w-full rounded-[8px] border border-ifvm-amber-border bg-ifvm-amber-bg px-3 py-2 font-sans text-[11.5px] font-semibold text-ifvm-amber-text"
              >
                Demander une reprise
              </button>
            )}
          </Carte>
        </div>
      </div>

      {reprisePromptOuvert && (
        <Dialog
          open
          onOpenChange={(open: boolean) => {
            if (!open) setReprisePromptOuvert(false)
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Demander une reprise</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Surface restante à traiter : <b>{formatSurface(restanteGenerique)} ha</b>. Cette
              fiche apparaît déjà automatiquement dans « Zones à reprendre » sur l'application
              mobile des agents de terrain — aucune action supplémentaire n'est nécessaire ici :
              un agent peut lancer la reprise directement depuis le terrain.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReprisePromptOuvert(false)}>
                Fermer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
