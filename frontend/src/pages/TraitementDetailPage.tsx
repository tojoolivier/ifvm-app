import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'

const TYPE_LABELS: Record<string, string> = {
  AERIEN: 'Aérien',
  TERRESTRE: 'Terrestre',
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
  aerien: { pilote: string; mecanicien: string; nb_rotations: number; total_pesticide_l: number | null } | null
  terrestre: {
    heure_debut: string
    heure_fin: string
    vitesse_vent_ms: number
    surface_traitee_ha: number | null
    surface_cumulee_ha: number | null
    surface_restante_ha: number | null
  } | null
  signatures: { id: string; role: string; signataire_nom: string; horodatage: string }[]
}

export function TraitementDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: traitement, isLoading, isError, error } = useQuery<TraitementDetail>({
    queryKey: ['traitement', id],
    queryFn: () => api.get(`/traitements/${id}`).then((r) => r.data),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="px-8 py-6">
        <p className="text-muted-foreground">Chargement…</p>
      </div>
    )
  }

  if (isError || !traitement) {
    const status = (error as { response?: { status?: number; data?: { detail?: string } } })?.response?.status
    const message =
      (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
      "Impossible de charger ce traitement."
    return (
      <div className="px-8 py-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/traitements')} className="mb-4">
          ← Retour aux traitements
        </Button>
        <p className="text-destructive">
          {status ? `Erreur ${status} — ` : ''}
          {message}
        </p>
      </div>
    )
  }

  const lectureSeule = traitement.statut === 'validee'

  return (
    <div className="px-8 py-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/traitements')} className="mb-4">
        ← Retour aux traitements
      </Button>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">Fiche {traitement.numero_fiche}</h1>
        <StatusBadge statut={traitement.statut} />
        {lectureSeule && (
          <span className="inline-flex items-center rounded-full border px-[9px] py-[3px] font-sans text-[10px] font-bold bg-ifvm-green-bg text-ifvm-green-text border-ifvm-green-border">
            Lecture seule
          </span>
        )}
      </div>

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
          <div>
            <p className="text-muted-foreground">Prospection d'origine</p>
            <Link to={`/prospections/${traitement.prospection_id}`} className="text-primary underline">
              Voir la fiche de prospection
            </Link>
          </div>
        </CardContent>
      </Card>

      {traitement.aerien && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Rotations (aérien)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Pilote</p>
              <p>{traitement.aerien.pilote}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Mécanicien</p>
              <p>{traitement.aerien.mecanicien}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Nombre de rotations</p>
              <p className="font-mono">{traitement.aerien.nb_rotations}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total pesticide (L)</p>
              <p className="font-mono">{traitement.aerien.total_pesticide_l ?? '—'}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {traitement.terrestre && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Traitement terrestre</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Horaire</p>
              <p className="font-mono">{traitement.terrestre.heure_debut} – {traitement.terrestre.heure_fin}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Vitesse du vent</p>
              <p className="font-mono">{traitement.terrestre.vitesse_vent_ms} m/s</p>
            </div>
            <div>
              <p className="text-muted-foreground">Surface traitée</p>
              <p className="font-mono">{traitement.terrestre.surface_traitee_ha ?? '—'} ha</p>
            </div>
            <div>
              <p className="text-muted-foreground">Surface restante</p>
              <p className="font-mono">{traitement.terrestre.surface_restante_ha ?? '—'} ha</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Signatures</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {traitement.signatures.length === 0 ? (
            <p className="text-muted-foreground">Aucune signature.</p>
          ) : (
            <ul className="space-y-1">
              {traitement.signatures.map((s) => (
                <li key={s.id}>
                  <span className="font-semibold">{s.role}</span> — {s.signataire_nom}{' '}
                  <span className="text-muted-foreground font-mono">({s.horodatage})</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
