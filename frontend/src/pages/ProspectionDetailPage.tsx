import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { STATUT_LABELS, type Statut } from '@/components/ui/status-badge'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import {
  buildFicheImprimable,
  isFicheValidee,
  type CaptureRead,
  type InfestationRead,
  type PopulationRead,
} from '@/lib/prospection-fiche-lecture'
import {
  buildCapturesSynthese,
  buildImagoRows,
  buildInfestationRows,
  buildLarveRows,
  buildPisteValidation,
  buildReferenceRows,
  findImago,
  findLarve,
  formatHeure,
  formatNombre,
  humaniser,
  NUMERO_FICHE,
  TIRET,
  type InfestationFiche,
  type LigneCapture,
  type LigneFiche,
} from '@/lib/prospection-fiche-maquette'
import { shortId, useAnnuaire } from '@/lib/use-annuaire'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Population = PopulationRead & {
  phase?: string | null
  methode?: string | null
  temps_capture?: number | null
}
type Capture = CaptureRead & { sexe?: string | null }
/** La fiche de lecture exploite la spécialisation larve/imago, plus riche que `InfestationRead`. */
type Infestation = InfestationRead & InfestationFiche

interface OperationAerienne {
  id: string
  numero: number
  type_operation: string
  motif_divers: string | null
  debut_heure: string
  debut_temperature_c: number | null
  debut_vent_ms: number | null
  fin_heure: string
  fin_temperature_c: number | null
  fin_vent_ms: number | null
  duree_minutes: number
}

interface ProspectionDetail {
  id: string
  type_prospection: string
  campagne_id: string
  prospecteur_id: string
  station_id: string | null
  date_prospection: string
  statut: string
  statut_sync: string
  n_fiche: string | null
  n_message: string | null
  created_at: string
  updated_at: string
  latitude: number | null
  longitude: number | null
  altitude: number | null
  region: string | null
  district: string | null
  commune: string | null
  za: string | null
  pa_code: string | null
  station_libre: string | null
  biotope: string[]
  surface_station: number | null
  surface_prospectee: number | null
  surface_infestee: number | null
  hauteur_herbe_cm: number | null
  hauteur_strate: number | null
  verdissement: number | null
  verdissement_pourcent: number | null
  degats_cultures_pourcent: number | null
  derniere_pluie: string | null
  intensite_pluie: string | null
  ennemis_naturels: string | null
  observations: string | null
  vegetation: Record<string, unknown> | null
  sol: Record<string, unknown> | null
  degats_cultures: string | null
  avertissements: string[]
  // Traçabilité vérification/validation
  verified_by: string | null
  verified_at: string | null
  validated_by: string | null
  validated_at: string | null
  // Extensif & validation
  type_station: string[]
  verdure_strate: string | null
  signalement_source: string | null
  signalement_date: string | null
  signalement_description: string | null
  conclusion_validation: string | null
  // Extensif : mode aérien
  mode_extensif: string | null
  societe: string | null
  immatricule_aeronef: string | null
  pilote: string | null
  mecanicien: string | null
  chef_de_base: string | null
  lieu_base_id: string | null
  // Extensif : pesticides embarqués + signatures
  pesticides_embarques: boolean | null
  pesticide_nom_commercial: string | null
  pesticide_quantite_disponible: number | null
  pesticide_quantite_recue: number | null
  futs_disponible: number | null
  futs_pleins: number | null
  futs_vides: number | null
  futs_recues: number | null
  signature_visa_nom: string | null
  signature_visa_horodatage: string | null
  signature_consultant_fao_nom: string | null
  signature_consultant_fao_horodatage: string | null
  signature_pilote_nom: string | null
  signature_pilote_horodatage: string | null
  signature_chef_base_nom: string | null
  signature_chef_base_horodatage: string | null
  populations: Population[]
  captures: Capture[]
  infestations: Infestation[]
  operations_aeriennes: OperationAerienne[]
}

interface AuditLogEntry {
  id: string
  fiche_type: string
  fiche_id: string
  auteur_id: string
  action: string
  details: Record<string, unknown> | null
  created_at: string
}

interface StationDetail {
  id: string
  code: string
  nom: string
  pa_nom: string
  latitude: number
  longitude: number
  altitude: number | null
}

interface CurrentUser {
  id: string
  nom: string
  role: string
}

// ---------------------------------------------------------------------------
// Composants utilitaires
// ---------------------------------------------------------------------------

/** Pilule de l'en-tête vert (maquette : `rgba(255,255,255,.16)` sur fond `#235a36`). */
function HeaderPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-white/[.16] px-3 py-[6px] font-sans text-[11px] font-bold">
      {children}
    </span>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium mt-0.5">{value ?? '—'}</dd>
    </div>
  )
}

/** Carte blanche du handoff : rayon 11px, bordure `#e7e0cd`. */
function Carte({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={cn('rounded-[11px] border border-[#e7e0cd] bg-card', className)}>
      {children}
    </section>
  )
}

/** Sur-titre de bloc : `600 9.5px` uppercase, interlettrage 1px. */
function BlocLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-sans text-[9.5px] font-semibold uppercase tracking-[1px] text-ifvm-text-weak">
      {children}
    </span>
  )
}

/** Ligne clé/valeur des blocs A et D : libellé sur 132px, valeur en mono. */
function LigneCle({ ligne }: { ligne: LigneFiche }) {
  return (
    <div className="flex items-baseline gap-[10px]">
      <span className="w-[132px] shrink-0 font-sans text-[11.5px] font-medium text-ifvm-text-tertiary">
        {ligne.k}
      </span>
      <span
        className={cn(
          'font-mono text-[12px] font-semibold',
          ligne.muted ? 'text-[#bdb6a2]' : 'text-foreground',
        )}
      >
        {ligne.v}
      </span>
    </div>
  )
}

/** Cellule des cartes larve / imago : libellé fin au-dessus, valeur mono en gras. */
function CelluleSpecialisation({ ligne }: { ligne: LigneFiche }) {
  return (
    <div>
      <div className="font-sans text-[10px] font-medium text-ifvm-text-weak">{ligne.k}</div>
      <div
        className={cn(
          'font-mono text-[12.5px] font-bold',
          ligne.muted ? 'text-[#bdb6a2]' : 'text-foreground',
        )}
      >
        {ligne.v}
      </div>
    </div>
  )
}

/** Tuile de statistique du bloc E (fond `#faf7ef`, rayon 9px). */
function Tuile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[9px] bg-background px-[14px] py-3">
      <div className="font-sans text-[10.5px] font-medium text-ifvm-text-weak">{label}</div>
      <div className="font-mono text-[17px] font-bold text-foreground">{value}</div>
    </div>
  )
}

/** Même convention que `ligne()` de prospection-fiche-maquette.ts (non exportée) : une
 * valeur absente est grisée plutôt que masquée. */
function champ(k: string, v: string): LigneFiche {
  return v === TIRET ? { k, v, muted: true } : { k, v }
}

const captureColumns: DataTableColumn<LigneCapture>[] = [
  {
    key: 'phase',
    header: 'Phase',
    render: (l) => <span className="font-semibold">{l.phaseLabel}</span>,
  },
  { key: 'males', header: 'Mâles', align: 'right', mono: true, render: (l) => l.males },
  { key: 'femelles', header: 'Femelles', align: 'right', mono: true, render: (l) => l.femelles },
  {
    key: 'stade',
    header: 'Stade dominant',
    render: (l) => <span className="text-ifvm-text-tertiary">{l.stade}</span>,
  },
  {
    key: 'methode',
    header: 'Méthode',
    render: (l) => <span className="text-ifvm-text-tertiary">{l.methode}</span>,
  },
  {
    key: 'densite',
    header: 'Densité (ind/ha)',
    align: 'right',
    mono: true,
    render: (l) => <span className="text-ifvm-green-text">{l.densite}</span>,
  },
]

const operationColumns: DataTableColumn<OperationAerienne>[] = [
  { key: 'numero', header: 'N°', mono: true, render: (o) => o.numero },
  {
    key: 'type',
    header: 'Type',
    render: (o) => (
      <span className="font-semibold">
        {humaniser(o.type_operation)}
        {o.motif_divers ? ` — ${o.motif_divers}` : ''}
      </span>
    ),
  },
  {
    key: 'debut',
    header: 'Début',
    align: 'right',
    mono: true,
    render: (o) =>
      `${formatHeure(o.debut_heure)} · ${formatNombre(o.debut_temperature_c)} °C · ${formatNombre(o.debut_vent_ms)} m/s`,
  },
  {
    key: 'fin',
    header: 'Fin',
    align: 'right',
    mono: true,
    render: (o) =>
      `${formatHeure(o.fin_heure)} · ${formatNombre(o.fin_temperature_c)} °C · ${formatNombre(o.fin_vent_ms)} m/s`,
  },
  { key: 'duree', header: 'Durée (min)', align: 'right', mono: true, render: (o) => o.duree_minutes },
]

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ---------------------------------------------------------------------------
// Modale de confirmation d'action
// ---------------------------------------------------------------------------

type ActionType = 'verifier' | 'valider' | 'rejeter' | null

interface ConfirmDialogProps {
  action: ActionType
  onClose: () => void
  onConfirm: (commentaire: string) => void
  isPending: boolean
}

function ConfirmDialog({ action, onClose, onConfirm, isPending }: ConfirmDialogProps) {
  const [commentaire, setCommentaire] = useState('')
  const requiresComment = action === 'rejeter'
  const canSubmit = !requiresComment || commentaire.trim().length > 0

  const TITRES: Record<NonNullable<ActionType>, string> = {
    verifier: 'Confirmer la vérification',
    valider: 'Confirmer la validation',
    rejeter: 'Rejeter la fiche',
  }

  const DESCRIPTIONS: Record<NonNullable<ActionType>, string> = {
    verifier: 'Cette fiche passera en statut « Vérifiée ».',
    valider: 'Cette fiche passera en statut « Validée ».',
    rejeter: 'Cette fiche sera rejetée. Un commentaire est obligatoire.',
  }

  if (!action) return null

  return (
    <Dialog open onOpenChange={(open: boolean) => { if (!open) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{TITRES[action]}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{DESCRIPTIONS[action]}</p>

        {requiresComment && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="commentaire-rejet">
              Motif du rejet <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="commentaire-rejet"
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              placeholder="Expliquez la raison du rejet…"
              rows={3}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Annuler
          </Button>
          <Button
            variant={action === 'rejeter' ? 'destructive' : 'default'}
            onClick={() => onConfirm(commentaire)}
            disabled={!canSubmit || isPending}
          >
            {isPending ? 'En cours…' : action === 'rejeter' ? 'Rejeter' : 'Confirmer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export function ProspectionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeAction, setActiveAction] = useState<ActionType>(null)
  const [showPrintView, setShowPrintView] = useState(false)

  const { data: prospection, isLoading, isError } = useQuery<ProspectionDetail>({
    queryKey: ['prospection', id],
    queryFn: () => api.get(`/prospections/${id}`).then((r) => r.data),
    enabled: !!id,
  })

  const { data: auditLog = [] } = useQuery<AuditLogEntry[]>({
    queryKey: ['prospection-audit', id],
    queryFn: () => api.get(`/prospections/${id}/audit-log`).then((r) => r.data),
    enabled: !!id,
  })

  const { data: currentUser } = useQuery<CurrentUser>({
    queryKey: ['me'],
    queryFn: () => api.get('/users/me').then((r) => r.data),
  })

  const { data: station } = useQuery<StationDetail>({
    queryKey: ['station', prospection?.station_id],
    queryFn: () =>
      api.get(`/referentiel/stations/${prospection!.station_id}`).then((r) => r.data),
    enabled: !!prospection?.station_id,
  })

  const { data: campagnes = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['campagnes'],
    queryFn: () => api.get('/campagnes').then((r) => r.data),
  })

  const { nomAgent } = useAnnuaire()

  // Base aérienne (extensif, mode aérien) — référentiel distinct de la station.
  const { data: lieuxAeriens = [] } = useQuery<{ id: string; nom: string }[]>({
    queryKey: ['lieux-aeriens'],
    queryFn: () =>
      api.get('/referentiel/lieux-aeriens', { params: { inclure_inactifs: true } }).then((r) => r.data),
    enabled: !!prospection?.lieu_base_id,
  })
  const nomLieu = (lieuId: string | null | undefined) =>
    lieuxAeriens.find((l) => l.id === lieuId)?.nom ?? shortId(lieuId)

  const campagneName = campagnes.find((c) => c.id === prospection?.campagne_id)?.name

  const mutation = useMutation({
    mutationFn: ({ statut, commentaire }: { statut: string; commentaire?: string }) =>
      api.patch(`/prospections/${id}/statut`, { statut, commentaire }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospection', id] })
      queryClient.invalidateQueries({ queryKey: ['prospection-audit', id] })
      // Préfixe volontairement court : invalide à la fois la liste complète
      // (`['prospections']`, écran Prospections) et les vues filtrées
      // `['prospections', 'intensive']` du dashboard, de la carte et des synthèses.
      queryClient.invalidateQueries({ queryKey: ['prospections'] })
      setActiveAction(null)
    },
  })

  function handleConfirm(commentaire: string) {
    if (!activeAction) return
    const statut =
      activeAction === 'verifier' ? 'verifiee' :
      activeAction === 'valider' ? 'validee' :
      'rejetee'
    mutation.mutate({ statut, commentaire: commentaire.trim() || undefined })
  }

  const auditLogSorted = [...auditLog].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )

  const role = currentUser?.role ?? ''
  const statut = prospection?.statut ?? ''

  // `admin` peut se substituer à verificateur/validation_finale (mêmes rôles
  // acceptés côté backend, _TRANSITIONS dans prospection.py) — déploiements où
  // ces comptes dédiés n'existent pas encore ou ne sont pas utilisés.
  const canVerifier = statut === 'en_attente' && (role === 'verificateur' || role === 'admin')
  const canValiderOuRejeter =
    statut === 'verifiee' && (role === 'validation_finale' || role === 'admin')
  const ficheValidee = isFicheValidee(statut)

  const validationEntry = auditLogSorted.find((entry) => entry.action === 'validation')

  useEffect(() => {
    if (!showPrintView) return
    const handleAfterPrint = () => setShowPrintView(false)
    window.addEventListener('afterprint', handleAfterPrint)
    window.print()
    return () => window.removeEventListener('afterprint', handleAfterPrint)
  }, [showPrintView])

  if (isLoading) {
    return <div className="px-8 py-6 text-muted-foreground">Chargement…</div>
  }

  if (isError || !prospection) {
    return (
      <div className="px-8 py-6">
        <p className="text-destructive">Fiche introuvable.</p>
        <Button variant="ghost" className="mt-2" onClick={() => navigate('/prospections')}>
          ← Retour à la liste
        </Button>
      </div>
    )
  }

  const referenceRows = buildReferenceRows(
    prospection,
    station ? { code: station.code, nom: station.nom } : null,
  )
  const infestationRows = buildInfestationRows(
    prospection,
    prospection.infestations,
    prospection.populations,
  )
  const larveRows = buildLarveRows(findLarve(prospection.infestations))
  const imagoRows = buildImagoRows(findImago(prospection.infestations))
  const capturesSynthese = buildCapturesSynthese(prospection.captures, prospection.populations)
  const piste = buildPisteValidation(auditLog, prospection.statut, nomAgent)

  // Bloc E : recouvrement total des strates du JSONB `vegetation` (ADR-006).
  const strates =
    (prospection.vegetation?.strates as Record<string, { recouvrement?: number }> | undefined) ?? {}
  const recouvrement = Object.values(strates).reduce((s, d) => s + (d?.recouvrement ?? 0), 0)

  // Durée de comptage : `temps_capture` est saisi par population, en minutes.
  const tempsCaptures = prospection.populations
    .map((p) => p.temps_capture)
    .filter((t): t is number => t != null)
  const dureeComptage = tempsCaptures.length > 0 ? Math.max(...tempsCaptures) : null

  const sousTitre = [
    humaniser(prospection.type_prospection),
    prospection.commune,
    station ? `${station.code} ${station.nom}` : prospection.station_libre,
    prospection.date_prospection,
    nomAgent(prospection.prospecteur_id),
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    // Grille de la maquette : 1fr (fiche) / 316px (piste de validation + actions).
    <div className="grid grid-cols-1 items-start gap-5 px-7 pb-10 pt-[26px] lg:grid-cols-[1fr_316px]">
      <div className="flex min-w-0 flex-col gap-4">
        {/* En-tête vert de la maquette */}
        <header className="flex items-center gap-5 rounded-[12px] bg-ifvm-green-text px-[22px] py-5 text-white">
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-mono text-[17px] font-bold tracking-[.4px]">
              {NUMERO_FICHE(prospection)}
            </h1>
            <p className="mt-1 font-sans text-[12px] font-medium text-white/75">{sousTitre}</p>
          </div>
          <HeaderPill>{STATUT_LABELS[prospection.statut as Statut] ?? prospection.statut}</HeaderPill>
          {prospection.statut_sync !== 'synced' && <HeaderPill>Non synchronisée</HeaderPill>}
          {ficheValidee && (
            <button
              type="button"
              onClick={() => setShowPrintView(true)}
              className="shrink-0 rounded-[9px] bg-white px-[14px] py-[9px] font-sans text-[11.5px] font-bold text-ifvm-green-text"
            >
              Imprimer A4
            </button>
          )}
        </header>

        {/* Bandeau ambre — avertissements de la fiche (#106) */}
        {prospection.avertissements.length > 0 && (
          <div className="flex flex-col gap-[7px] rounded-[10px] border border-ifvm-amber-border bg-ifvm-amber-bg px-4 py-[13px]">
            <p className="font-sans text-[11.5px] font-bold text-ifvm-amber-text">
              Avertissements de la fiche · {prospection.avertissements.length}
            </p>
            <ul className="flex flex-col gap-[7px]">
              {prospection.avertissements.map((avertissement, index) => (
                <li
                  key={index}
                  className="font-sans text-[11.5px] font-medium leading-[1.45] text-ifvm-amber-text"
                >
                  {avertissement}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* D · Infestation — spécialisation larve / imago (tables distinctes) */}
        <Carte className="px-5 py-[18px]">
          <div className="mb-3 flex items-baseline gap-[10px]">
            <BlocLabel>D · Infestation — spécialisation</BlocLabel>
            <span className="font-sans text-[10.5px] font-medium text-ifvm-text-weak">
              tables imago / larve distinctes
            </span>
          </div>
          <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2">
            <div className="overflow-hidden rounded-[10px] border border-ifvm-danger-border">
              <div className="bg-ifvm-danger-bg px-3 py-2 font-sans text-[11px] font-bold text-ifvm-danger-text">
                Larve · bande larvaire
              </div>
              <div className="grid grid-cols-2 gap-x-[14px] gap-y-[9px] p-3">
                {larveRows.map((l) => (
                  <CelluleSpecialisation key={l.k} ligne={l} />
                ))}
              </div>
            </div>
            <div className="overflow-hidden rounded-[10px] border border-[#e7e0cd]">
              <div className="bg-background px-3 py-2 font-sans text-[11px] font-bold text-ifvm-text-tertiary">
                Imago · vol clair
              </div>
              <div className="grid grid-cols-2 gap-x-[14px] gap-y-[9px] p-3">
                {imagoRows.map((l) => (
                  <CelluleSpecialisation key={l.k} ligne={l} />
                ))}
              </div>
            </div>
          </div>
        </Carte>

        {/* A · Référence & localisation | D · Infestation */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Carte className="px-5 py-[18px]">
            <div className="mb-3">
              <BlocLabel>A · Référence &amp; localisation</BlocLabel>
            </div>
            <div className="flex flex-col gap-[9px]">
              {referenceRows.map((l) => (
                <LigneCle key={l.k} ligne={l} />
              ))}
              <LigneCle
                ligne={{
                  k: 'Campagne',
                  v: campagneName ?? shortId(prospection.campagne_id),
                }}
              />
            </div>
          </Carte>
          <Carte className="px-5 py-[18px]">
            <div className="mb-3">
              <BlocLabel>D · Infestation</BlocLabel>
            </div>
            <div className="flex flex-col gap-[9px]">
              {infestationRows.map((l) => (
                <LigneCle key={l.k} ligne={l} />
              ))}
            </div>
          </Carte>
        </div>

        {/* B · Captures agrégées par phase */}
        <Carte className="overflow-hidden">
          <div className="flex flex-wrap items-baseline gap-3 border-b border-[#f1ecdd] px-5 py-4">
            <h2 className="font-sans text-[14px] font-bold">B · Captures — synthèse par phase</h2>
            <span className="font-sans text-[11px] font-medium text-ifvm-text-weak">
              Grille de comptage repliée en synthèse
              {dureeComptage != null ? ` · durée ${formatNombre(dureeComptage)} min` : ''}
            </span>
            <span className="flex-1" />
            <span className="font-mono text-[12px] font-semibold text-ifvm-green-text">
              Total {formatNombre(capturesSynthese.total)}
            </span>
          </div>
          <DataTable
            columns={captureColumns}
            rows={capturesSynthese.lignes}
            getRowKey={(l) => l.phase}
            emptyMessage="Aucune capture enregistrée."
          />
        </Carte>

        {/* E · Végétation & sol */}
        <Carte className="px-5 py-[18px]">
          <div className="mb-3">
            <BlocLabel>E · Végétation &amp; sol</BlocLabel>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tuile
              label="Strate herbeuse"
              value={
                prospection.hauteur_herbe_cm == null
                  ? TIRET
                  : `${formatNombre(prospection.hauteur_herbe_cm / 100)} m`
              }
            />
            <Tuile
              label="Strate arborée"
              value={
                prospection.hauteur_strate == null
                  ? TIRET
                  : `${formatNombre(prospection.hauteur_strate)} m`
              }
            />
            <Tuile
              label="Recouvrement"
              value={recouvrement > 0 ? `${formatNombre(recouvrement)} %` : TIRET}
            />
            <Tuile
              label="Type de sol"
              value={
                // Sélection multiple (cf. mobile veg.tsx) : `sol.texture` est un tableau ;
                // une ancienne fiche enregistrée avant le multi-select peut encore porter
                // une simple string — les deux formats sont acceptés.
                Array.isArray(prospection.sol?.texture)
                  ? prospection.sol.texture.map((t) => humaniser(t as string)).join(', ') || TIRET
                  : humaniser(prospection.sol?.texture as string | undefined)
              }
            />
          </div>
        </Carte>

        {/* Autres observations — champs jusqu'ici absents de la fiche de
            lecture web (issue « afficher toutes les données ») */}
        <Carte className="px-5 py-[18px]">
          <div className="mb-3">
            <BlocLabel>Autres observations</BlocLabel>
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-[9px] md:grid-cols-2">
            {[
              champ('N° message', prospection.n_message ?? TIRET),
              champ('Biotope', prospection.biotope?.map((b) => humaniser(b)).join(', ') || TIRET),
              champ(
                'Dégâts sur cultures',
                prospection.degats_cultures_pourcent != null
                  ? `${humaniser(prospection.degats_cultures)} · ${prospection.degats_cultures_pourcent} %`
                  : humaniser(prospection.degats_cultures),
              ),
              champ('Verdissement', prospection.verdissement_pourcent == null ? TIRET : `${prospection.verdissement_pourcent} %`),
              champ('Dernière pluie', prospection.derniere_pluie ?? TIRET),
              champ('Intensité de pluie', prospection.intensite_pluie ?? TIRET),
              champ('Ennemis naturels', prospection.ennemis_naturels ?? TIRET),
              champ('Zone anti-acridienne / poste', [prospection.za, prospection.pa_code].filter(Boolean).join(' / ') || TIRET),
              champ('Type de station', prospection.type_station?.map((t) => humaniser(t)).join(', ') || TIRET),
              champ('Verdure de la strate', humaniser(prospection.verdure_strate)),
            ].map((l) => (
              <LigneCle key={l.k} ligne={l} />
            ))}
          </div>
          {prospection.observations && (
            <p className="mt-3 border-t border-[#f1ecdd] pt-3 font-sans text-[11.5px] font-medium leading-[1.5] text-ifvm-text-tertiary">
              Observations : <span className="text-foreground">{prospection.observations}</span>
            </p>
          )}
        </Carte>

        {/* Signalement & traçabilité de la validation */}
        <Carte className="px-5 py-[18px]">
          <div className="mb-3">
            <BlocLabel>Signalement &amp; traçabilité</BlocLabel>
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-[9px] md:grid-cols-2">
            {[
              champ('Source du signalement', prospection.signalement_source ?? TIRET),
              champ('Date du signalement', prospection.signalement_date ?? TIRET),
              champ('Conclusion de validation', humaniser(prospection.conclusion_validation)),
              champ('Vérifiée par', prospection.verified_by ? nomAgent(prospection.verified_by) : TIRET),
              champ('Validée par', prospection.validated_by ? nomAgent(prospection.validated_by) : TIRET),
              champ('Dernière mise à jour', formatDate(prospection.updated_at)),
            ].map((l) => (
              <LigneCle key={l.k} ligne={l} />
            ))}
          </div>
          {prospection.signalement_description && (
            <p className="mt-3 border-t border-[#f1ecdd] pt-3 font-sans text-[11.5px] font-medium leading-[1.5] text-ifvm-text-tertiary">
              {prospection.signalement_description}
            </p>
          )}
        </Carte>

        {/* Extensif — mode aérien : équipe, aéronef, base (pilote/mécanicien/chef de
            base sont du texte libre depuis le retour en arrière de la migration 0048,
            même patron que traitement_aerien). N'apparaît que si la fiche est extensive
            aérienne — inutile d'afficher une carte pleine de tirets sur une intensive. */}
        {prospection.mode_extensif && (
          <Carte className="px-5 py-[18px]">
            <div className="mb-3">
              <BlocLabel>Extensif — équipe &amp; aéronef</BlocLabel>
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-[9px] md:grid-cols-2">
              {[
                champ('Mode', humaniser(prospection.mode_extensif)),
                champ('Société', prospection.societe ?? TIRET),
                champ('Immatriculation aéronef', prospection.immatricule_aeronef ?? TIRET),
                champ('Pilote', prospection.pilote ?? TIRET),
                champ('Mécanicien', prospection.mecanicien ?? TIRET),
                champ('Chef de base', prospection.chef_de_base ?? TIRET),
                champ('Base', nomLieu(prospection.lieu_base_id)),
              ].map((l) => (
                <LigneCle key={l.k} ligne={l} />
              ))}
            </div>
          </Carte>
        )}

        {/* Extensif — pesticides embarqués (fûts, quantités) */}
        {prospection.pesticides_embarques != null && (
          <Carte className="px-5 py-[18px]">
            <div className="mb-3">
              <BlocLabel>Extensif — pesticides embarqués</BlocLabel>
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-[9px] md:grid-cols-2">
              {[
                champ('Pesticides embarqués', prospection.pesticides_embarques ? 'Oui' : 'Non'),
                champ('Nom commercial', prospection.pesticide_nom_commercial ?? TIRET),
                champ('Quantité disponible', formatNombre(prospection.pesticide_quantite_disponible)),
                champ('Quantité reçue', formatNombre(prospection.pesticide_quantite_recue)),
                champ('Fûts disponibles', formatNombre(prospection.futs_disponible)),
                champ('Fûts pleins', formatNombre(prospection.futs_pleins)),
                champ('Fûts vides', formatNombre(prospection.futs_vides)),
                champ('Fûts reçus', formatNombre(prospection.futs_recues)),
              ].map((l) => (
                <LigneCle key={l.k} ligne={l} />
              ))}
            </div>
          </Carte>
        )}

        {/* Extensif — signatures (visa, consultant international, pilote, chef de base) */}
        {(prospection.signature_visa_nom ||
          prospection.signature_consultant_fao_nom ||
          prospection.signature_pilote_nom ||
          prospection.signature_chef_base_nom) && (
          <Carte className="px-5 py-[18px]">
            <div className="mb-3">
              <BlocLabel>Extensif — signatures</BlocLabel>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {(
                [
                  ['Visa', prospection.signature_visa_nom, prospection.signature_visa_horodatage],
                  [
                    'Consultant International',
                    prospection.signature_consultant_fao_nom,
                    prospection.signature_consultant_fao_horodatage,
                  ],
                  ['Pilote', prospection.signature_pilote_nom, prospection.signature_pilote_horodatage],
                  [
                    'Chef de base',
                    prospection.signature_chef_base_nom,
                    prospection.signature_chef_base_horodatage,
                  ],
                ] as [string, string | null, string | null][]
              ).map(([label, nom, horodatage]) => (
                <div key={label} className="rounded-[9px] bg-background px-[14px] py-3">
                  <div className="font-sans text-[10.5px] font-medium text-ifvm-text-weak">{label}</div>
                  <div className="font-mono text-[12.5px] font-bold text-foreground">{nom ?? TIRET}</div>
                  {horodatage && (
                    <div className="font-mono text-[10px] font-medium text-ifvm-text-weak">
                      {formatDate(horodatage)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Carte>
        )}

        {/* Extensif (mode aérien) — opérations aériennes 1-N */}
        {(prospection.operations_aeriennes ?? []).length > 0 && (
          <Carte className="overflow-hidden">
            <div className="border-b border-[#f1ecdd] px-5 py-4">
              <h2 className="font-sans text-[14px] font-bold">Opérations aériennes</h2>
            </div>
            <DataTable
              columns={operationColumns}
              rows={prospection.operations_aeriennes}
              getRowKey={(o) => o.id}
              emptyMessage="Aucune opération aérienne."
            />
          </Carte>
        )}
      </div>

      <aside className="flex min-w-0 flex-col gap-[14px]">
        {/* Piste de validation — chronologie du plus ancien au plus récent */}
        <Carte className="px-5 py-[18px]">
          <h2 className="mb-3 font-sans text-[13px] font-bold">Piste de validation</h2>
          {piste.length === 0 ? (
            <p className="font-sans text-[11.5px] text-ifvm-text-weak">
              Aucun historique disponible.
            </p>
          ) : (
            <ol className="flex flex-col">
              {piste.map((etape, i) => (
                <li key={etape.id} className="flex gap-[11px]">
                  <div className="flex w-[14px] flex-col items-center">
                    <span
                      className="mt-[3px] h-[10px] w-[10px] shrink-0 rounded-full"
                      style={{ background: etape.dot }}
                    />
                    {i < piste.length - 1 && <span className="w-[2px] flex-1 bg-[#f1ecdd]" />}
                  </div>
                  <div className="min-w-0 pb-[14px]">
                    <div className="font-sans text-[12px] font-bold text-foreground">
                      {etape.label}
                    </div>
                    <div className="font-sans text-[11px] font-medium text-ifvm-text-tertiary">
                      {etape.who}
                    </div>
                    <div className="font-mono text-[10.5px] font-medium text-ifvm-text-weak">
                      {etape.when === TIRET ? TIRET : formatDate(etape.when)}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Carte>

        {/* Actions — verificateur/validation_finale, ou admin en substitution */}
        <Carte className="flex flex-col gap-[9px] px-5 py-[18px]">
          <h2 className="font-sans text-[13px] font-bold">Actions</h2>
          {canVerifier && (
            <button
              type="button"
              onClick={() => setActiveAction('verifier')}
              className="rounded-[9px] bg-ifvm-green-text py-[11px] text-center font-sans text-[12px] font-bold text-white"
            >
              Vérifier la fiche
            </button>
          )}
          {canValiderOuRejeter && (
            <>
              <button
                type="button"
                onClick={() => setActiveAction('valider')}
                className="rounded-[9px] bg-ifvm-green-text py-[11px] text-center font-sans text-[12px] font-bold text-white"
              >
                Valider la fiche
              </button>
              <button
                type="button"
                onClick={() => setActiveAction('rejeter')}
                className="rounded-[9px] border border-ifvm-danger-border bg-ifvm-danger-bg py-[11px] text-center font-sans text-[12px] font-bold text-ifvm-danger-text"
              >
                Rejeter avec motif
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => navigate(`/traitements?prospection_id=${prospection.id}`)}
            className="rounded-[9px] border border-[#e0d9c4] bg-card py-[11px] text-center font-sans text-[12px] font-semibold text-[#3a3a30]"
          >
            Créer une fiche de traitement
          </button>
          <p className="mt-[2px] font-sans text-[10.5px] font-medium leading-[1.5] text-ifvm-text-weak">
            La création de traitement fige un <b>snapshot des cibles</b> depuis cette fiche.
          </p>
        </Carte>
      </aside>

      {/* Modale de confirmation */}
      {activeAction && (
        <ConfirmDialog
          action={activeAction}
          onClose={() => setActiveAction(null)}
          onConfirm={handleConfirm}
          isPending={mutation.isPending}
        />
      )}

      {showPrintView && (
        <FicheImprimable
          prospection={prospection}
          station={station}
          validateurId={validationEntry?.auteur_id ?? null}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Vue imprimable A4 (#19) — mise en page dédiée à l'export PDF d'une fiche
// validée, dérivée des données déjà chargées par ProspectionDetailPage.
// ---------------------------------------------------------------------------

function FicheImprimable({
  prospection,
  station,
  validateurId,
}: {
  prospection: ProspectionDetail
  station: StationDetail | undefined
  validateurId: string | null
}) {
  const synthese = buildFicheImprimable(prospection)
  const stationLabel = station ? `${station.nom} (${station.pa_nom})` : shortId(prospection.station_id)

  return (
    <div data-testid="fiche-imprimable" className="fiche-imprimable">
      <header className="text-center mb-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">IFVM — Fiche de prospection</p>
        <h2 className="text-xl font-bold">Fiche n° {synthese.nFiche}</h2>
        <p className="inline-flex items-center gap-1 mt-1 text-sm font-medium text-green-700">
          Validé ✓{validateurId ? ` — par ${shortId(validateurId)}` : ''}
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <Field label="Prospecteur" value={shortId(prospection.prospecteur_id)} />
        <Field label="Date de prospection" value={synthese.dateProspection} />
        <Field label="Point d'appui / station" value={stationLabel} />
        <Field label="Position GPS" value={synthese.positionGps} />
        <Field
          label="Surfaces (station / prospectée / infestée, ha)"
          value={`${synthese.surfaceStation ?? '—'} / ${synthese.surfaceProspectee ?? '—'} / ${synthese.surfaceInfestee ?? '—'}`}
        />
      </dl>

      <h3 className="text-sm font-semibold mt-4 mb-2">Synthèse par espèce</h3>
      <table className="w-full text-sm border">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-2 py-1">Espèce</th>
            <th className="text-right px-2 py-1">Capturés</th>
            <th className="text-right px-2 py-1">Densité diffuse ind./ha</th>
            <th className="text-right px-2 py-1">Densité groupée ind./m²</th>
            <th className="text-left px-2 py-1">Phénotype dominant</th>
          </tr>
        </thead>
        <tbody>
          {synthese.especes.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-2 py-2 text-muted-foreground text-center">
                Aucune capture enregistrée.
              </td>
            </tr>
          ) : (
            synthese.especes.map((e) => (
              <tr key={e.espece} className="border-b">
                <td className="px-2 py-1 font-medium">{e.espece}</td>
                <td className="px-2 py-1 text-right">{e.totalCaptures}</td>
                <td className="px-2 py-1 text-right">{e.densiteDiffuse ?? '—'}</td>
                <td className="px-2 py-1 text-right">{e.densiteGroupee ?? '—'}</td>
                <td className="px-2 py-1">{e.phenotypeDominantLabel}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <h3 className="text-sm font-semibold mt-4 mb-2">Synthèse infestation</h3>
      <p className="text-sm">
        {synthese.infestation.hasInfestation
          ? `${synthese.infestation.typeLabel} — surface ${synthese.infestation.surfaceTotale ?? '—'} ha — ${synthese.infestation.comportementLabel}`
          : 'Aucune infestation renseignée.'}
      </p>

      <h3 className="text-sm font-semibold mt-4 mb-2">Synthèse végétation / sol</h3>
      <p className="text-sm">{synthese.vegetationSummary}</p>
    </div>
  )
}
