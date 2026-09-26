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
import { FicheProspectionTableau } from '@/components/fiche/FicheProspectionTableau'
import { buildFicheImprimable, isFicheValidee } from '@/lib/prospection-fiche-lecture'
import {
  TIRET,
  entreesAudit,
  humaniser,
  type AuditBdd,
  type ProspectionBdd,
} from '@/lib/prospection-fiche-bdd'
import { shortId, useAnnuaire } from '@/lib/use-annuaire'

// ---------------------------------------------------------------------------
// Types — issus du contrat OpenAPI (jamais recopiés à la main)
// ---------------------------------------------------------------------------

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
  const [telechargementPdfEnCours, setTelechargementPdfEnCours] = useState(false)
  const [erreurPdf, setErreurPdf] = useState<string | null>(null)

  const { data: prospection, isLoading, isError } = useQuery<ProspectionBdd>({
    queryKey: ['prospection', id],
    queryFn: () => api.get(`/prospections/${id}`).then((r) => r.data),
    enabled: !!id,
  })

  const { data: auditLog = [] } = useQuery<AuditBdd[]>({
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

  const { nomAgent } = useAnnuaire()

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

  const role = currentUser?.role ?? ''
  const statut = prospection?.statut ?? ''

  // `admin` peut se substituer à verificateur/validation_finale (mêmes rôles
  // acceptés côté backend, _TRANSITIONS dans prospection.py) — déploiements où
  // ces comptes dédiés n'existent pas encore ou ne sont pas utilisés.
  const canVerifier = statut === 'en_attente' && (role === 'verificateur' || role === 'admin')
  const canValiderOuRejeter =
    statut === 'verifiee' && (role === 'validation_finale' || role === 'admin')
  const ficheValidee = isFicheValidee(statut)

  const validationEntry = [...auditLog]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .find((entry) => entry.action === 'validation')

  // PDF (#494/#594) généré côté backend (WeasyPrint, #533) — même pattern que
  // le CRT (TraitementDetailPage.telechargerPdf), distinct de « Imprimer A4 »
  // ci-dessus (vue imprimable React existante, window.print).
  async function telechargerPdf() {
    setErreurPdf(null)
    setTelechargementPdfEnCours(true)
    try {
      const response = await api.get(`/prospections/${id}/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(response.data as Blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `fiche-prospection-${prospection?.n_fiche ?? id}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setErreurPdf('Impossible de télécharger le PDF.')
    } finally {
      setTelechargementPdfEnCours(false)
    }
  }

  useEffect(() => {
    if (!showPrintView) return
    const handleAfterPrint = () => setShowPrintView(false)
    window.addEventListener('afterprint', handleAfterPrint)
    window.print()
    return () => window.removeEventListener('afterprint', handleAfterPrint)
  }, [showPrintView])

  if (isLoading) {
    return <div className="px-4 py-4 sm:px-8 sm:py-6 text-muted-foreground">Chargement…</div>
  }

  if (isError || !prospection) {
    return (
      <div className="px-4 py-4 sm:px-8 sm:py-6">
        <p className="text-destructive">Fiche introuvable.</p>
        <Button variant="ghost" className="mt-2" onClick={() => navigate('/prospections')}>
          ← Retour à la liste
        </Button>
      </div>
    )
  }

  const journal = entreesAudit(auditLog, nomAgent)
  const avertissements = prospection.avertissements ?? []

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
    // Grille de la maquette : 1fr (fiche) / 316px (journal de validation + actions).
    <div className="grid grid-cols-1 items-start gap-5 px-4 pb-10 pt-4 sm:px-7 sm:pt-[26px] lg:grid-cols-[minmax(0,1fr)_316px]">
      <div className="flex min-w-0 flex-col gap-4">
        {/* En-tête vert de la maquette */}
        <header className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-[12px] bg-ifvm-green-text px-4 py-4 text-white sm:px-[22px] sm:py-5">
          <div className="min-w-0 basis-full sm:flex-1 sm:basis-0">
            <h1 className="truncate font-mono text-[17px] font-bold tracking-[.4px]">
              {prospection.n_fiche ?? TIRET}
            </h1>
            <p className="mt-1 font-sans text-[12px] font-medium text-white/75">{sousTitre}</p>
          </div>
          <HeaderPill>{STATUT_LABELS[prospection.statut as Statut] ?? prospection.statut}</HeaderPill>
          {/* #revalidation-web-informe : la fiche détaillée n'indiquait nulle
              part qu'il s'agit d'une revalidation (seule la liste,
              ProspectionsPage, le montrait via une pastille dédiée) — devient
              nécessaire maintenant qu'une revalidation suit la même chaîne de
              vérification qu'une fiche neuve : l'administrateur qui l'examine
              doit savoir qu'elle documente à nouveau une situation déjà
              connue, avec le même numéro qu'une fiche périmée. */}
          {prospection.revalide_de_id && <HeaderPill>Revalidation</HeaderPill>}
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
          {ficheValidee && (
            <button
              type="button"
              onClick={telechargerPdf}
              disabled={telechargementPdfEnCours}
              className="shrink-0 rounded-[9px] bg-white px-[14px] py-[9px] font-sans text-[11.5px] font-bold text-ifvm-green-text disabled:opacity-60"
            >
              {telechargementPdfEnCours ? 'Génération…' : 'Télécharger le PDF'}
            </button>
          )}
        </header>

        {erreurPdf && (
          <p className="text-[11.5px] font-medium text-destructive">{erreurPdf}</p>
        )}

        {/* Prospecteur de la fiche : son nom vient de la fiche elle-même (jamais de l'équipe, que
            les backends plus anciens ne renvoient pas), à défaut de l'annuaire. */}
        <p data-testid="fiche-prospecteur" className="font-sans text-[12px] text-ifvm-text-tertiary">
          Prospecteur :{' '}
          <span className="font-semibold">
            {prospection.prospecteur_nom || nomAgent(prospection.prospecteur_id)}
          </span>
        </p>

        {/* Bandeau ambre — colonne `prospection.avertissements` (#106) */}
        {avertissements.length > 0 && (
          <div className="flex flex-col gap-[7px] rounded-[10px] border border-ifvm-amber-border bg-ifvm-amber-bg px-4 py-[13px]">
            <p className="font-sans text-[11.5px] font-bold text-ifvm-amber-text">
              Avertissements de la fiche · {avertissements.length}
            </p>
            <ul className="flex flex-col gap-[7px]">
              {avertissements.map((avertissement, index) => (
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

        {/* Fiche de lecture : mêmes tableaux que le PDF, construits depuis la fiche déjà chargée. */}
        <FicheProspectionTableau
          prospection={prospection}
          stationLabel={station ? `${station.code} ${station.nom}` : null}
        />
      </div>

      <aside className="flex min-w-0 flex-col gap-[14px]">
        {/* Journal d'audit — table `audit_log`, entrées réelles uniquement */}
        <Carte className="px-5 py-[18px]">
          <div className="mb-3 flex items-baseline gap-[10px]">
            <h2 className="font-sans text-[13px] font-bold">Journal de validation</h2>
            <span className="font-mono text-[10px] font-medium text-ifvm-text-weak">audit_log</span>
          </div>
          {journal.length === 0 ? (
            <p className="font-sans text-[11.5px] text-ifvm-text-weak">
              Aucune entrée dans le journal d'audit.
            </p>
          ) : (
            <ol className="flex flex-col">
              {journal.map((entree, i) => (
                <li key={entree.id} className="flex gap-[11px]">
                  <div className="flex w-[14px] flex-col items-center">
                    <span className="mt-[3px] h-[10px] w-[10px] shrink-0 rounded-full bg-[#bdb6a2]" />
                    {i < journal.length - 1 && <span className="w-[2px] flex-1 bg-[#f1ecdd]" />}
                  </div>
                  <div className="min-w-0 pb-[14px]">
                    <div className="font-sans text-[12px] font-bold text-foreground">
                      {entree.label}
                    </div>
                    <div className="font-sans text-[11px] font-medium text-ifvm-text-tertiary">
                      {entree.auteur}
                    </div>
                    <div className="font-mono text-[10.5px] font-medium text-ifvm-text-weak">
                      {entree.quand}
                    </div>
                    {entree.details.map((d, j) => (
                      <div
                        key={j}
                        className="mt-1 break-words font-sans text-[11px] leading-[1.4] text-ifvm-text-tertiary"
                      >
                        {d.chemin ? `${d.chemin} : ` : ''}
                        <span className="text-foreground">{d.valeur}</span>
                      </div>
                    ))}
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
  prospection: ProspectionBdd
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

      <dl className="grid grid-cols-1 gap-4 mb-4 text-sm sm:grid-cols-2">
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
