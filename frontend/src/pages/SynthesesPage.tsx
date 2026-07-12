import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  buildAgregatsParEspece,
  buildAgregatsParGroupe,
  buildProspectionsCsv,
  filterProspectionsForSynthese,
  type SyntheseProspection,
} from '@/lib/prospection-syntheses'

interface Campagne {
  id: string
  name: string
}

interface Station {
  id: string
  code: string
  nom: string
  pa_code: string
  pa_nom: string
}

const STATUTS = ['brouillon', 'en_attente', 'verifiee', 'validee', 'rejetee'] as const

const STATUT_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  en_attente: 'En attente',
  verifiee: 'Vérifiée',
  validee: 'Validée',
  rejetee: 'Rejetée',
}

function shortId(id: string | null): string {
  if (!id) return '—'
  return id.slice(0, 8) + '…'
}

function fmt(value: number | null): string {
  return value !== null ? value.toFixed(2) : '—'
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function SynthesesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [stationSearch, setStationSearch] = useState('')

  const filtreStatut = searchParams.get('statut') ?? ''
  const filtreCampagne = searchParams.get('campagne') ?? ''
  const filtreStationId = searchParams.get('station') ?? ''

  function setFiltre(key: string, value: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    }, { replace: true })
  }

  function resetFiltres() {
    setSearchParams({}, { replace: true })
    setStationSearch('')
  }

  const { data: prospections = [], isLoading } = useQuery<SyntheseProspection[]>({
    queryKey: ['prospections', 'intensive'],
    queryFn: () => api.get('/prospections', { params: { type: 'intensive' } }).then((r) => r.data),
  })

  const { data: campagnes = [] } = useQuery<Campagne[]>({
    queryKey: ['campagnes'],
    queryFn: () => api.get('/campagnes').then((r) => r.data),
  })

  const { data: stations = [] } = useQuery<Station[]>({
    queryKey: ['stations'],
    queryFn: () => api.get('/stations').then((r) => r.data),
  })

  const campagneMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const c of campagnes) m[c.id] = c.name
    return m
  }, [campagnes])

  const stationMap = useMemo(() => {
    const m: Record<string, Station> = {}
    for (const s of stations) m[s.id] = s
    return m
  }, [stations])

  const filteredStations = useMemo(() => {
    if (!stationSearch) return stations
    const q = stationSearch.toLowerCase()
    return stations.filter(
      (s) => s.code.toLowerCase().includes(q) || s.nom.toLowerCase().includes(q)
    )
  }, [stations, stationSearch])

  const filtered = useMemo(
    () =>
      filterProspectionsForSynthese(prospections, {
        statut: filtreStatut,
        campagneId: filtreCampagne,
        stationId: filtreStationId,
      }),
    [prospections, filtreStatut, filtreCampagne, filtreStationId],
  )

  const parEspece = useMemo(() => buildAgregatsParEspece(filtered), [filtered])

  const parCampagne = useMemo(
    () =>
      buildAgregatsParGroupe(
        filtered,
        (p) => p.campagne_id,
        (cle) => campagneMap[cle] ?? shortId(cle),
      ),
    [filtered, campagneMap],
  )

  const parPA = useMemo(
    () =>
      buildAgregatsParGroupe(
        filtered,
        (p) => (p.station_id ? stationMap[p.station_id]?.pa_code ?? 'inconnu' : 'sans_station'),
        (cle) => {
          if (cle === 'sans_station') return 'Sans station'
          const station = Object.values(stationMap).find((s) => s.pa_code === cle)
          return station ? `${station.pa_code} — ${station.pa_nom}` : cle
        },
      ),
    [filtered, stationMap],
  )

  const hasFiltres = filtreStatut || filtreCampagne || filtreStationId

  function handleExportCsv() {
    const csv = buildProspectionsCsv(filtered)
    downloadCsv(csv, `syntheses-prospections-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  return (
    <div className="px-8 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Synthèses &amp; export</h1>
        <Button onClick={handleExportCsv} disabled={filtered.length === 0}>
          Exporter en CSV
        </Button>
      </div>

      {/* Filtres */}
      <Card className="mb-4">
        <CardContent className="p-4 flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="filtre-statut">Statut</Label>
            <Select value={filtreStatut} onValueChange={(v) => setFiltre('statut', v ?? '')}>
              <SelectTrigger id="filtre-statut" className="w-40">
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tous</SelectItem>
                {STATUTS.map((s) => (
                  <SelectItem key={s} value={s}>{STATUT_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="filtre-campagne">Campagne</Label>
            <Select value={filtreCampagne} onValueChange={(v) => setFiltre('campagne', v ?? '')}>
              <SelectTrigger id="filtre-campagne" className="w-48">
                <SelectValue placeholder="Toutes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Toutes</SelectItem>
                {campagnes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="filtre-station-search">Station</Label>
            <Input
              id="filtre-station-search"
              type="text"
              value={stationSearch}
              onChange={(e) => setStationSearch(e.target.value)}
              placeholder="Rechercher par nom ou code…"
              className="w-48"
            />
            <select
              id="filtre-station"
              value={filtreStationId}
              onChange={(e) => setFiltre('station', e.target.value)}
              className="flex h-8 w-48 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Toutes les stations</option>
              {filteredStations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.nom}
                </option>
              ))}
            </select>
          </div>

          {hasFiltres && (
            <Button variant="ghost" size="sm" className="self-end" onClick={resetFiltres}>
              Effacer les filtres
            </Button>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-muted-foreground">Chargement…</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">Aucune fiche trouvée.</p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {filtered.length} fiche{filtered.length > 1 ? 's' : ''}
          </p>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Par espèce</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Espèce</TableHead>
                    <TableHead className="text-right">Densité diffuse moy.</TableHead>
                    <TableHead className="text-right">Densité groupée moy.</TableHead>
                    <TableHead className="text-right">Captures totales</TableHead>
                    <TableHead className="text-right">Fiches</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parEspece.map((a) => (
                    <TableRow key={a.espece}>
                      <TableCell className="font-medium">{a.espece}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(a.densiteDiffuseMoyenne)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(a.densiteGroupeeMoyenne)}</TableCell>
                      <TableCell className="text-right tabular-nums">{a.capturesTotales}</TableCell>
                      <TableCell className="text-right tabular-nums">{a.nbFiches}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Par campagne</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {parCampagne.map((g) => (
                  <div key={g.cle}>
                    <p className="text-sm font-medium mb-1">{g.label} <span className="text-muted-foreground font-normal">({g.nbFiches} fiches)</span></p>
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      {g.parEspece.map((a) => (
                        <li key={a.espece}>
                          {a.espece} — densité diff. {fmt(a.densiteDiffuseMoyenne)}, groupée {fmt(a.densiteGroupeeMoyenne)}, captures {a.capturesTotales}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Par poste acridien (PA)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {parPA.map((g) => (
                  <div key={g.cle}>
                    <p className="text-sm font-medium mb-1">{g.label} <span className="text-muted-foreground font-normal">({g.nbFiches} fiches)</span></p>
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      {g.parEspece.map((a) => (
                        <li key={a.espece}>
                          {a.espece} — densité diff. {fmt(a.densiteDiffuseMoyenne)}, groupée {fmt(a.densiteGroupeeMoyenne)}, captures {a.capturesTotales}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
