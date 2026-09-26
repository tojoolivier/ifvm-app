import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ErrorBanner } from '@/components/ui/error-banner'
import { FicheTableau } from '@/components/FicheTableau'
import { NavTabs } from '@/components/ui/nav-tabs'
import { PILL_TONES, Pill } from '@/components/ui/pill'
import { MODE_LABELS, ROLE_LABELS, SIGNATURE_ROLES, STATUS_LABELS, TYPE_LABELS } from '@/lib/traitement-labels'
import {
  formatHorodatage,
  formatSurface,
  libelleSurfaceTraitee,
  surfaceTraiteeOuProtegee,
} from '@/lib/traitement-fiche'

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
  // Jamais renseignées ensemble (migration 0083, généralise l'Aérien 0081) :
  // choc → traitée, barrière → protégée.
  surface_traitee_ha: number | null
  surface_protegee_ha: number | null
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

/** Carte blanche de la maquette : `#fff`, bordure `#e7e0cd`, rayon `11px`. */
function Carte({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-[11px] border border-[#e7e0cd] bg-card', className)}>
      {children}
    </section>
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

  if (isLoading) {
    return (
      <div className="px-4 pb-10 pt-4 sm:px-7 sm:pt-[26px]">
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
      <div className="flex flex-col gap-4 px-4 pb-10 pt-4 sm:px-7 sm:pt-[26px]">
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

  const surfaceInfestee = traitement.cible?.surface_infestee_ha
  // Surfaces portées par aerien ET terrestre (mêmes noms de champs, migration
  // 0050 a généralisé le chaînage de reprise à l'Aérien) : le panneau
  // « Surfaces » ne doit pas rester muet sur les trois lignes du bas pour une
  // fiche aérienne, comme c'était le cas en ne lisant que `terrestre`.
  // Traitée (choc) ou protégée (barrière) — aérien et terrestre confondus
  // depuis la migration 0083, cf. `libelleSurfaceTraitee`.
  const surfaceTraitee = surfaceTraiteeOuProtegee(traitement)
  const surfaceCumulee = traitement.terrestre?.surface_cumulee_ha ?? traitement.aerien?.surface_cumulee_ha
  const restanteGenerique = traitement.terrestre?.surface_restante_ha ?? traitement.aerien?.surface_restante_ha
  const repriseFiche = traitement.terrestre?.reprise_traitement
    ? traitement.terrestre
    : traitement.aerien?.reprise_traitement
    ? traitement.aerien
    : null
  const estReprenable = (reprenables ?? []).some((t) => t.id === traitement.id)
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
    <div className="flex flex-col gap-4 px-4 pb-10 pt-4 sm:px-7 sm:pt-[26px]">
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
        className="flex flex-wrap items-center gap-x-[18px] gap-y-3 rounded-[12px] bg-ifvm-green-text px-4 py-4 text-white sm:px-[22px] sm:py-5"
      >
        <div className="min-w-0 basis-full sm:flex-1 sm:basis-0">
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

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* Fiche de lecture : le gabarit du PDF (mêmes tableaux), servi par le backend. */}
          <FicheTableau
            endpoint={`/traitements/${traitement.id}/fiche-html`}
            cleVersion={`${traitement.statut}|${traitement.updated_at}`}
            titre={`Fiche de traitement ${traitement.numero_fiche}`}
          />
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
