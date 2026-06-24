import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
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
  n_fiche: string | null
  n_releve: string | null
  created_at: string
}

const STATUTS = ['brouillon', 'en_attente', 'verifiee', 'validee', 'rejetee'] as const

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

const PAGE_SIZE = 20

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

function shortId(id: string | null): string {
  if (!id) return '—'
  return id.slice(0, 8) + '…'
}

export function ProspectionsPage() {
  const [filtreStatut, setFiltreStatut] = useState('')
  const [filtreCampagne, setFiltreCampagne] = useState('')
  const [filtreStation, setFiltreStation] = useState('')
  const [filtreDate, setFiltreDate] = useState('')
  const [page, setPage] = useState(1)
  const navigate = useNavigate()

  const { data: prospections = [], isLoading } = useQuery<Prospection[]>({
    queryKey: ['prospections', 'intensive'],
    queryFn: () => api.get('/prospections', { params: { type: 'intensive' } }).then((r) => r.data),
  })

  const { data: campagnes = [] } = useQuery<Campagne[]>({
    queryKey: ['campagnes'],
    queryFn: () => api.get('/campagnes').then((r) => r.data),
  })

  const campagneMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const c of campagnes) m[c.id] = c.name
    return m
  }, [campagnes])

  const filtered = useMemo(() => {
    let result = prospections
    if (filtreStatut) result = result.filter((p) => p.statut === filtreStatut)
    if (filtreCampagne) result = result.filter((p) => p.campagne_id === filtreCampagne)
    if (filtreStation) result = result.filter((p) => p.station_id?.startsWith(filtreStation))
    if (filtreDate) result = result.filter((p) => p.date_prospection >= filtreDate)
    return result
  }, [prospections, filtreStatut, filtreCampagne, filtreStation, filtreDate])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const hasFiltres = filtreStatut || filtreCampagne || filtreStation || filtreDate

  function resetFiltres() {
    setFiltreStatut('')
    setFiltreCampagne('')
    setFiltreStation('')
    setFiltreDate('')
    setPage(1)
  }

  function onStatutChange(v: string | null) { setFiltreStatut(v ?? ''); setPage(1) }
  function onCampagneChange(v: string | null) { setFiltreCampagne(v ?? ''); setPage(1) }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Prospections intensives</h1>
        <Link to="/prospections/new" className={buttonVariants()}>
          Nouvelle fiche
        </Link>
      </div>

      {/* Filtres */}
      <Card className="mb-4">
        <CardContent className="p-4 flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="filtre-statut">Statut</Label>
            <Select value={filtreStatut} onValueChange={onStatutChange}>
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

          <div className="flex flex-col gap-1">
            <Label htmlFor="filtre-campagne">Campagne</Label>
            <Select value={filtreCampagne} onValueChange={onCampagneChange}>
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

          <div className="flex flex-col gap-1">
            <Label htmlFor="filtre-station">Station (début ID)</Label>
            <Input
              id="filtre-station"
              type="text"
              value={filtreStation}
              onChange={(e) => { setFiltreStation(e.target.value); setPage(1) }}
              placeholder="ex: a1b2c3…"
              className="w-36"
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="filtre-date">À partir du</Label>
            <Input
              id="filtre-date"
              type="date"
              value={filtreDate}
              onChange={(e) => { setFiltreDate(e.target.value); setPage(1) }}
              className="w-40"
            />
          </div>

          {hasFiltres && (
            <Button variant="ghost" size="sm" className="self-end" onClick={resetFiltres}>
              Effacer les filtres
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Contenu */}
      {isLoading ? (
        <p className="text-muted-foreground">Chargement…</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">Aucune fiche trouvée.</p>
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Station</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Prospecteur</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Campagne</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {shortId(p.station_id)}
                      </TableCell>
                      <TableCell>{p.date_prospection}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {shortId(p.prospecteur_id)}
                      </TableCell>
                      <TableCell>
                        <StatutBadge statut={p.statut} />
                      </TableCell>
                      <TableCell>
                        {campagneMap[p.campagne_id] ?? shortId(p.campagne_id)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => navigate(`/prospections/${p.id}`)}
                        >
                          Voir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                {filtered.length} fiche{filtered.length > 1 ? 's' : ''} — page {page} / {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  ← Précédent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Suivant →
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
