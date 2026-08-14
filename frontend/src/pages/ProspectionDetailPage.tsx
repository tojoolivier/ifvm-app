import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  buildFicheImprimable,
  isFicheValidee,
  type CaptureRead,
  type InfestationRead,
  type PopulationRead,
} from '@/lib/prospection-fiche-lecture'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Population = PopulationRead
type Capture = CaptureRead
type Infestation = InfestationRead

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
  n_releve: string | null
  created_at: string
  latitude: number | null
  longitude: number | null
  surface_station: number | null
  surface_prospectee: number | null
  surface_infestee: number | null
  vegetation: Record<string, unknown> | null
  sol: Record<string, unknown> | null
  degats_cultures: string | null
  populations: Population[]
  captures: Capture[]
  infestations: Infestation[]
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
// Constantes
// ---------------------------------------------------------------------------

const STATUT_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  en_attente: 'En attente',
  verifiee: 'Vérifiée',
  validee: 'Validée',
  rejetee: 'Rejetée',
}

const STATUT_CLASSES: Record<string, string> = {
  brouillon: 'bg-gray-100 text-gray-700',
  en_attente: 'bg-orange-100 text-orange-700',
  verifiee: 'bg-blue-100 text-blue-700',
  validee: 'bg-green-100 text-green-700',
  rejetee: 'bg-red-100 text-red-700',
}

const ACTION_LABELS: Record<string, string> = {
  creation: 'Création',
  soumission: 'Soumission',
  verification: 'Vérification',
  validation: 'Validation',
  rejet: 'Rejet',
  modification: 'Modification',
  commentaire: 'Commentaire',
}

// ---------------------------------------------------------------------------
// Composants utilitaires
// ---------------------------------------------------------------------------

function StatutBadge({ statut }: { statut: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        STATUT_CLASSES[statut] ?? 'bg-gray-100 text-gray-700',
      )}
    >
      {STATUT_LABELS[statut] ?? statut}
    </span>
  )
}

function SyncBadge({ statut_sync }: { statut_sync: string }) {
  const synced = statut_sync === 'synced'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium',
        synced ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700',
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', synced ? 'bg-green-500' : 'bg-amber-500')} />
      {synced ? 'Synchronisé' : 'Non synchronisé'}
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

function shortId(id: string | null | undefined): string {
  if (!id) return '—'
  return id.slice(0, 8) + '…'
}

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

  const campagneName = campagnes.find((c) => c.id === prospection?.campagne_id)?.name

  const mutation = useMutation({
    mutationFn: ({ statut, commentaire }: { statut: string; commentaire?: string }) =>
      api.patch(`/prospections/${id}/statut`, { statut, commentaire }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospection', id] })
      queryClient.invalidateQueries({ queryKey: ['prospection-audit', id] })
      queryClient.invalidateQueries({ queryKey: ['prospections', 'intensive'] })
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

  const canVerifier = statut === 'en_attente' && role === 'verificateur'
  const canValiderOuRejeter = statut === 'verifiee' && role === 'validation_finale'
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

  return (
    <div className="px-8 py-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2 text-muted-foreground"
            onClick={() => navigate('/prospections')}
          >
            ← Retour
          </Button>
          <h1 className="text-2xl font-bold">
            Fiche intensive{prospection.n_fiche ? ` n° ${prospection.n_fiche}` : ''}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Créée le {formatDate(prospection.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          {ficheValidee && (
            <Button variant="outline" size="sm" onClick={() => setShowPrintView(true)}>
              Exporter en PDF
            </Button>
          )}
          <SyncBadge statut_sync={prospection.statut_sync} />
          <StatutBadge statut={prospection.statut} />
        </div>
      </div>

      {/* Actions */}
      {(canVerifier || canValiderOuRejeter) && (
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-center justify-between">
            <p className="text-sm font-medium">
              {canVerifier ? 'Cette fiche est en attente de vérification.' : 'Cette fiche est en attente de validation.'}
            </p>
            <div className="flex gap-2">
              {canVerifier && (
                <Button onClick={() => setActiveAction('verifier')}>Vérifier</Button>
              )}
              {canValiderOuRejeter && (
                <>
                  <Button variant="outline" onClick={() => setActiveAction('rejeter')}>
                    Rejeter
                  </Button>
                  <Button onClick={() => setActiveAction('valider')}>Valider</Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Informations générales */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Informations générales</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Field label="Date de prospection" value={prospection.date_prospection} />
            <Field label="Campagne" value={campagneName ?? shortId(prospection.campagne_id)} />
            <Field label="Prospecteur" value={shortId(prospection.prospecteur_id)} />
            {prospection.n_fiche && <Field label="N° fiche" value={prospection.n_fiche} />}
            {prospection.n_releve && <Field label="N° relevé" value={prospection.n_releve} />}
          </dl>
        </CardContent>
      </Card>

      {/* Station */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Station</CardTitle>
        </CardHeader>
        <CardContent>
          {station ? (
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Field label="Nom" value={station.nom} />
              <Field label="Point d'appui" value={station.pa_nom} />
              <Field label="Latitude" value={station.latitude?.toFixed(6)} />
              <Field label="Longitude" value={station.longitude?.toFixed(6)} />
              {station.altitude != null && (
                <Field label="Altitude (m)" value={station.altitude} />
              )}
            </dl>
          ) : prospection.station_id ? (
            <p className="text-sm text-muted-foreground">Chargement de la station…</p>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune station associée.</p>
          )}
        </CardContent>
      </Card>

      {/* Populations */}
      {prospection.populations.length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Populations ({prospection.populations.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Espèce</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Catégorie</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Densité diffuse /ha</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Densité groupée /ha</th>
                </tr>
              </thead>
              <tbody>
                {prospection.populations.map((pop) => (
                  <tr key={pop.id} className="border-b last:border-0">
                    <td className="px-4 py-2 font-medium">{pop.espece}</td>
                    <td className="px-4 py-2 capitalize">{pop.categorie}</td>
                    <td className="px-4 py-2 text-right">{pop.densite_diffuse ?? '—'}</td>
                    <td className="px-4 py-2 text-right">{pop.densite_groupee ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Captures */}
      {prospection.captures.length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Captures ({prospection.captures.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Espèce</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Catégorie</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Stade</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Phase</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Effectif</th>
                </tr>
              </thead>
              <tbody>
                {prospection.captures.map((cap) => (
                  <tr key={cap.id} className="border-b last:border-0">
                    <td className="px-4 py-2 font-medium">{cap.espece}</td>
                    <td className="px-4 py-2 capitalize">{cap.categorie}</td>
                    <td className="px-4 py-2">{cap.stade}</td>
                    <td className="px-4 py-2">{cap.phase}</td>
                    <td className="px-4 py-2 text-right">{cap.effectif}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Infestations */}
      {prospection.infestations.length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Infestations ({prospection.infestations.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Type de cible</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Surface totale (ha)</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Comportement</th>
                </tr>
              </thead>
              <tbody>
                {prospection.infestations.map((inf) => (
                  <tr key={inf.id} className="border-b last:border-0">
                    <td className="px-4 py-2">{inf.type_cible}</td>
                    <td className="px-4 py-2 text-right">{inf.surface_totale ?? '—'}</td>
                    <td className="px-4 py-2 text-muted-foreground">{inf.comportement ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Separator className="my-6" />

      {/* Audit log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historique</CardTitle>
        </CardHeader>
        <CardContent>
          {auditLogSorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun historique disponible.</p>
          ) : (
            <ol className="space-y-4">
              {auditLogSorted.map((entry, i) => (
                <li key={entry.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    {i < auditLogSorted.length - 1 && (
                      <div className="w-px flex-1 bg-border mt-1" />
                    )}
                  </div>
                  <div className="pb-4 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-sm font-medium">
                        {ACTION_LABELS[entry.action] ?? entry.action}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(entry.created_at)}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        par {shortId(entry.auteur_id)}
                      </span>
                    </div>
                    {entry.details && Object.keys(entry.details).length > 0 && (
                      <dl className="mt-1 space-y-0.5">
                        {Object.entries(entry.details).map(([k, v]) => (
                          <div key={k} className="text-xs text-muted-foreground">
                            <span className="font-medium">{k} :</span>{' '}
                            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

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
            <th className="text-right px-2 py-1">Densité diffuse /ha</th>
            <th className="text-right px-2 py-1">Densité groupée /ha</th>
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
