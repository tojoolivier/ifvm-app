import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface Campagne {
  id: string
  name: string
  start_date: string
  end_date: string | null
}

interface Prospection {
  id: string
  type_prospection: string
  campagne_id: string
  prospecteur_id: string
  station_id: string | null
  date_prospection: string
  statut: string
}

interface Station {
  id: string
  code: string
  nom: string
}

interface Utilisateur {
  id: string
  nom: string
  prenom: string
}

const STATUTS = ['brouillon', 'en_attente', 'verifiee', 'validee', 'rejetee'] as const
type Statut = (typeof STATUTS)[number]

const STAGE_CONFIG: Record<Statut, { label: string; border: string; text: string; bg: string }> = {
  brouillon: { label: 'Brouillon', border: 'border-gray-300', text: 'text-gray-500', bg: '' },
  en_attente: { label: 'En attente', border: 'border-amber-400', text: 'text-amber-600', bg: 'bg-amber-50/40' },
  verifiee: { label: 'Vérifiée', border: 'border-blue-400', text: 'text-blue-600', bg: 'bg-blue-50/40' },
  validee: { label: 'Validée', border: 'border-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50/40' },
  rejetee: { label: 'Rejetée', border: 'border-red-400', text: 'text-red-500', bg: 'bg-red-50/40' },
}

function shortId(id: string | null): string {
  if (!id) return '—'
  return id.slice(0, 8) + '…'
}

function MiniBar({ value, max, className }: { value: number; max: number; className?: string }) {
  return (
    <div className="h-1 rounded-full bg-muted overflow-hidden">
      <div
        style={{ width: max > 0 ? `${(value / max) * 100}%` : '0%' }}
        className={cn('h-full transition-all', className ?? 'bg-primary/60')}
      />
    </div>
  )
}

export function DashboardPage() {
  const [filtreCampagne, setFiltreCampagne] = useState('')

  const { data: prospections = [] } = useQuery<Prospection[]>({
    queryKey: ['prospections', 'intensive'],
    queryFn: () => api.get('/prospections', { params: { type: 'intensive' } }).then((r) => r.data),
  })

  const { data: campagnes = [] } = useQuery<Campagne[]>({
    queryKey: ['campagnes'],
    queryFn: () => api.get('/campagnes').then((r) => r.data),
  })

  const { data: stations = [] } = useQuery<Station[]>({
    queryKey: ['stations'],
    queryFn: () => api.get('/stations', { params: { actif: true } }).then((r) => r.data),
  })

  const { data: utilisateurs = [] } = useQuery<Utilisateur[]>({
    queryKey: ['utilisateurs'],
    queryFn: () => api.get('/users/').then((r) => r.data),
  })

  const stationMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const s of stations) m[s.id] = s.nom || s.code
    return m
  }, [stations])

  const userMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const u of utilisateurs) m[u.id] = `${u.prenom} ${u.nom}`
    return m
  }, [utilisateurs])

  const campagneMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const c of campagnes) m[c.id] = c.name
    return m
  }, [campagnes])

  const filtered = useMemo(() => {
    if (!filtreCampagne) return prospections
    return prospections.filter((p) => p.campagne_id === filtreCampagne)
  }, [prospections, filtreCampagne])

  const parStatut = useMemo(() => {
    const counts: Record<Statut, number> = {
      brouillon: 0, en_attente: 0, verifiee: 0, validee: 0, rejetee: 0,
    }
    for (const p of filtered) {
      if (p.statut in counts) counts[p.statut as Statut]++
    }
    return counts
  }, [filtered])

  const parCampagne = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of filtered) counts[p.campagne_id] = (counts[p.campagne_id] ?? 0) + 1
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [filtered])

  const topStations = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of filtered) {
      if (p.station_id) counts[p.station_id] = (counts[p.station_id] ?? 0) + 1
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10)
  }, [filtered])

  const parProspecteur = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of filtered) counts[p.prospecteur_id] = (counts[p.prospecteur_id] ?? 0) + 1
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [filtered])

  const taux = useMemo(() => {
    const total = parStatut.validee + parStatut.rejetee
    if (total === 0) return null
    return {
      validation: Math.round((parStatut.validee / total) * 100),
      rejet: Math.round((parStatut.rejetee / total) * 100),
    }
  }, [parStatut])

  // Pipeline: interleave stages with arrow dividers
  const pipelineItems = useMemo(() => {
    const items: React.ReactNode[] = []
    STATUTS.forEach((statut, i) => {
      if (i > 0) {
        items.push(
          <div
            key={`arrow-${i}`}
            className="flex items-center px-1 text-muted-foreground/25 text-xl select-none shrink-0"
            aria-hidden
          >
            →
          </div>,
        )
      }
      const cfg = STAGE_CONFIG[statut]
      items.push(
        <div
          key={statut}
          className={cn(
            'flex-1 border-t-4 px-4 py-5 text-center min-w-0',
            cfg.border,
            cfg.bg,
          )}
        >
          <div className={cn('text-4xl font-black tabular-nums leading-none', cfg.text)}>
            {parStatut[statut]}
          </div>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mt-2">
            {cfg.label}
          </div>
        </div>,
      )
    })
    return items
  }, [parStatut])

  return (
    <div className="px-8 py-6 space-y-5">

      {/* En-tête */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vue d'ensemble</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} fiche{filtered.length !== 1 ? 's' : ''} de prospection intensive
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Label htmlFor="filtre-campagne-dash" className="text-sm text-muted-foreground shrink-0">
            Campagne
          </Label>
          <Select value={filtreCampagne} onValueChange={(v) => setFiltreCampagne(v ?? '')}>
            <SelectTrigger id="filtre-campagne-dash" className="w-52">
              <SelectValue placeholder="Toutes les campagnes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Toutes les campagnes</SelectItem>
              {campagnes.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Pipeline de statuts */}
      <div className="flex items-stretch rounded-xl overflow-hidden ring-1 ring-foreground/10 bg-card">
        {pipelineItems}
      </div>

      {/* Taux de résolution */}
      {taux !== null ? (
        <div className="space-y-1.5">
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Taux de résolution
            </span>
            <span className="text-xs text-muted-foreground">
              <span className="text-emerald-600 font-semibold">{taux.validation}% validées</span>
              {' · '}
              <span className="text-red-500 font-semibold">{taux.rejet}% rejetées</span>
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden bg-muted flex">
            <div
              style={{ width: `${taux.validation}%` }}
              className="bg-emerald-500 transition-all"
            />
            <div
              style={{ width: `${taux.rejet}%` }}
              className="bg-red-400 transition-all"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Taux de résolution
          </span>
          <div className="h-2 rounded-full bg-muted" />
        </div>
      )}

      {/* Grille par campagne / stations */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Par campagne
            </CardTitle>
          </CardHeader>
          <CardContent>
            {parCampagne.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune donnée</p>
            ) : (
              <ul className="space-y-2.5">
                {parCampagne.map(([id, count]) => (
                  <li key={id} className="space-y-1">
                    <div className="flex justify-between items-baseline text-sm">
                      <span className="font-medium truncate">{campagneMap[id] ?? shortId(id)}</span>
                      <span className="tabular-nums text-muted-foreground ml-4 shrink-0">{count}</span>
                    </div>
                    <MiniBar value={count} max={parCampagne[0]?.[1] ?? 1} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Top 10 stations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topStations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune donnée</p>
            ) : (
              <ul className="space-y-2.5">
                {topStations.map(([id, count]) => (
                  <li key={id} className="space-y-1">
                    <div className="flex justify-between items-baseline text-sm">
                      <span className="font-medium truncate">{stationMap[id] ?? shortId(id)}</span>
                      <span className="tabular-nums text-muted-foreground ml-4 shrink-0">{count}</span>
                    </div>
                    <MiniBar value={count} max={topStations[0]?.[1] ?? 1} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Par prospecteur */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Par prospecteur
          </CardTitle>
        </CardHeader>
        <CardContent>
          {parProspecteur.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune donnée</p>
          ) : (
            <ul className="grid grid-cols-2 gap-x-8 gap-y-2.5">
              {parProspecteur.map(([id, count]) => (
                <li key={id} className="space-y-1">
                  <div className="flex justify-between items-baseline text-sm">
                    <span className="font-medium truncate">{userMap[id] ?? shortId(id)}</span>
                    <span className="tabular-nums text-muted-foreground ml-4 shrink-0">{count}</span>
                  </div>
                  <MiniBar value={count} max={parProspecteur[0]?.[1] ?? 1} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
