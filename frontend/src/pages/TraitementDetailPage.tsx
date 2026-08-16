import { useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { MODE_LABELS, ROLE_LABELS, SIGNATURE_ROLES, STATUS_LABELS, TYPE_LABELS } from '@/lib/traitement-labels'

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

function OuiNon({ value }: { value: boolean }) {
  return <p>{value ? 'Oui' : 'Non'}</p>
}

function DictSummary({ value }: { value: Record<string, unknown> | null }) {
  if (!value || Object.keys(value).length === 0) {
    return <p className="text-muted-foreground">—</p>
  }
  return (
    <ul className="space-y-0.5">
      {Object.entries(value).map(([key, val]) => (
        <li key={key}>
          <span className="text-muted-foreground">{key} :</span> {String(val)}
        </li>
      ))}
    </ul>
  )
}

function Pastille({ actif }: { actif: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center w-4 h-4 rounded-[4px] text-white text-[9px] font-bold mr-2',
        actif ? 'bg-ifvm-green-text' : 'bg-ifvm-text-weak',
      )}
    >
      {actif ? '✓' : '–'}
    </span>
  )
}

function Panel({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn('bg-ifvm-green-bg border-ifvm-green-border mb-4', className)}>
      <CardHeader>
        <CardTitle className="text-[13px]">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-2">{children}</CardContent>
    </Card>
  )
}

export function TraitementDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

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

  const rotationColumns: DataTableColumn<Rotation>[] = useMemo(
    () => [
      { key: 'numero_cuve', header: 'N° cuve', mono: true, render: (r) => r.numero_cuve },
      { key: 'produit', header: 'Produit', render: (r) => pesticideNoms.get(r.produit_id) ?? '—' },
      { key: 'quantite', header: 'Quantité (l)', align: 'right', mono: true, render: (r) => r.quantite_l },
      {
        key: 'temperature',
        header: 'T° début → fin',
        align: 'right',
        mono: true,
        render: (r) => `${r.temperature_debut_c}°C → ${r.temperature_fin_c}°C`,
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
      { key: 'quantite', header: 'Quantité (l)', align: 'right', mono: true, render: (p) => p.quantite_l },
    ],
    [pesticideNoms],
  )

  if (isLoading) {
    return (
      <div className="px-8 py-6">
        <p className="text-muted-foreground">Chargement…</p>
      </div>
    )
  }

  if (isError || !traitement) {
    const status = (error as { response?: { status?: number } })?.response?.status
    const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
    const label = status ? STATUS_LABELS[status] ?? `Erreur ${status}` : 'Erreur'
    const message = detail ?? "Impossible de charger ce traitement."
    return (
      <div className="px-8 py-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/traitements')} className="mb-4">
          ← Retour aux traitements
        </Button>
        <p className="text-destructive">
          {label} — {message}
        </p>
      </div>
    )
  }

  const lectureSeule = traitement.statut === 'validee'
  const modeLabel = traitement.mode_traitement ? MODE_LABELS[traitement.mode_traitement] ?? traitement.mode_traitement : null
  const sousTitre = [
    TYPE_LABELS[traitement.type_traitement] ?? traitement.type_traitement,
    modeLabel ? `mode ${modeLabel}` : null,
    traitement.localite,
    lectureSeule ? `validée le ${traitement.date_validation}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="px-8 py-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/traitements')} className="mb-4">
        ← Retour aux traitements
      </Button>

      <div data-testid="traitement-header" className="bg-[#235a36] text-white rounded-[12px] px-[22px] py-5 mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-extrabold">{traitement.numero_fiche}</h1>
          {lectureSeule && (
            <span className="inline-flex items-center rounded-full bg-white/[.16] px-[9px] py-[3px] text-[10px] font-bold">
              🔒 Lecture seule
            </span>
          )}
        </div>
        <p className="text-sm text-white/80 mt-1">{sousTitre}</p>
      </div>

      {traitement.cible && (
        <Card className="mb-4 bg-ifvm-amber-bg border-ifvm-amber-border">
          <CardContent className="text-sm space-y-1">
            <p className="font-semibold text-ifvm-amber-text">Cibles — snapshot figé à la création</p>
            <p>
              Espèce {traitement.cible.espece ?? '—'} · répartition {traitement.cible.repartition_population ?? '—'} ·
              surface infestée de référence {traitement.cible.surface_infestee_ha ?? '—'} ha
            </p>
            <Link to={`/prospections/${traitement.prospection_id}`} className="text-primary underline">
              Voir la fiche de prospection
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
        <div className="min-w-0">
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Informations générales</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Type</p>
                <p>{TYPE_LABELS[traitement.type_traitement] ?? traitement.type_traitement}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Date de traitement</p>
                <p>{traitement.date_traitement}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Localité</p>
                <p>{traitement.localite}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Région / District / Commune</p>
                <p>{[traitement.region, traitement.district, traitement.commune].filter(Boolean).join(' / ') || '—'}</p>
              </div>
            </CardContent>
          </Card>

          {traitement.aerien && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>
                  Rotations — rapprochement fiche de vol par n° de cuve
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <p className="text-muted-foreground mb-2">
                  {traitement.aerien.nb_rotations} rotation{traitement.aerien.nb_rotations > 1 ? 's' : ''}
                  {traitement.aerien.total_pesticide_l != null ? ` · ${traitement.aerien.total_pesticide_l} l` : ''}
                </p>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <p className="text-muted-foreground">Pilote</p>
                    <p>{traitement.aerien.pilote}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Mécanicien</p>
                    <p>{traitement.aerien.mecanicien}</p>
                  </div>
                </div>
                <DataTable
                  columns={rotationColumns}
                  rows={traitement.aerien.rotations}
                  getRowKey={(r) => r.id}
                  emptyMessage="Aucune rotation."
                />
              </CardContent>
            </Card>
          )}

          {traitement.terrestre && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>Produits utilisés</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <p className="text-muted-foreground">Horaire</p>
                    <p className="font-mono">
                      {traitement.terrestre.heure_debut} – {traitement.terrestre.heure_fin}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Vitesse du vent</p>
                    <p className="font-mono">{traitement.terrestre.vitesse_vent_ms} m/s</p>
                  </div>
                </div>
                <DataTable
                  columns={produitColumns}
                  rows={traitement.terrestre.produits}
                  getRowKey={(p) => p.id}
                  emptyMessage="Aucun produit utilisé."
                />
              </CardContent>
            </Card>
          )}

          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Moyens & protection</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <p><Pastille actif={traitement.kit_combinaison} />Combinaison</p>
              <p><Pastille actif={traitement.kit_gants} />Gants</p>
              <p><Pastille actif={traitement.kit_lunettes} />Lunettes</p>
              <p><Pastille actif={traitement.kit_masques} />Masques</p>
              <p><Pastille actif={traitement.kit_boite} />Boîte de protection</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Impacts & évaluation du risque</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Empoisonnement</p>
                <OuiNon value={traitement.empoisonnement} />
              </div>
              {traitement.empoisonnement && (
                <div>
                  <p className="text-muted-foreground">Type / mode</p>
                  <p>
                    {[traitement.empoisonnement_type, traitement.empoisonnement_mode, traitement.empoisonnement_autre]
                      .filter(Boolean)
                      .join(' / ') || '—'}
                  </p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">Comportement anormal</p>
                <OuiNon value={traitement.comportement_anormal} />
              </div>
              {traitement.comportement_anormal && (
                <div>
                  <p className="text-muted-foreground">Comportement — non-cibles</p>
                  <DictSummary value={traitement.comportement_non_cibles} />
                </div>
              )}
              <div>
                <p className="text-muted-foreground">Mortalité</p>
                <OuiNon value={traitement.mortalite} />
              </div>
              {traitement.mortalite && (
                <div>
                  <p className="text-muted-foreground">Mortalité — familles</p>
                  <DictSummary value={traitement.mortalite_familles} />
                </div>
              )}
              <div className="col-span-2">
                <p className="text-muted-foreground">Évaluation du risque</p>
                <DictSummary value={traitement.evaluation_risque} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          {traitement.terrestre && (
            <Panel title="Surfaces">
              {traitement.cible?.surface_infestee_ha != null && (
                <p>
                  <span className="text-muted-foreground">Infestée (snapshot) : </span>
                  <span className="font-mono">{traitement.cible.surface_infestee_ha} ha</span>
                </p>
              )}
              <p>
                <span className="text-muted-foreground">Traitée : </span>
                <span className="font-mono">{traitement.terrestre.surface_traitee_ha ?? '—'} ha</span>
              </p>
              <p>
                <span className="text-muted-foreground">Cumulée : </span>
                <span className="font-mono">{traitement.terrestre.surface_cumulee_ha ?? '—'} ha</span>
              </p>
              <p className="pt-2 border-t border-ifvm-amber-border">
                <span className="text-muted-foreground">Restante : </span>
                <span
                  className={cn(
                    'font-mono',
                    (traitement.terrestre.surface_restante_ha ?? 0) > 0 && 'text-ifvm-amber-text font-semibold',
                  )}
                >
                  {traitement.terrestre.surface_restante_ha ?? '—'} ha
                </span>
              </p>
              {traitement.terrestre.surface_restante_abandonnee && (
                <div className="bg-ifvm-amber-bg border border-ifvm-amber-border rounded-[9px] p-3 text-ifvm-amber-text">
                  <p className="font-semibold">Surface restante abandonnée</p>
                  <p>{traitement.terrestre.motif_surface_restante_abandonnee ?? '—'}</p>
                </div>
              )}
            </Panel>
          )}

          <Panel title="Signatures">
            <ul className="space-y-1">
              {SIGNATURE_ROLES.map((role) => {
                const signature = traitement.signatures.find((s) => s.role === role)
                return (
                  <li key={role} className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{ROLE_LABELS[role]}</span>
                    {signature ? (
                      <span className="text-right">
                        {signature.signataire_nom}{' '}
                        <span className="text-muted-foreground font-mono block">{signature.horodatage}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">ne signe pas</span>
                    )}
                  </li>
                )
              })}
            </ul>
          </Panel>

          {traitement.terrestre && (
            <Panel title="Chaîne de reprise" className="mb-0">
              <p>
                <span className="text-muted-foreground">Reprise d'un traitement : </span>
                {traitement.terrestre.reprise_traitement ? 'Oui' : 'Non'}
              </p>
              {traitement.terrestre.reprise_traitement && traitement.terrestre.traitement_origine_id && (
                <Link
                  to={`/traitements/${traitement.terrestre.traitement_origine_id}`}
                  className="text-primary underline"
                >
                  Voir la fiche d'origine
                </Link>
              )}
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}
