import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { api } from '../api/client'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import type { InfestationRead } from '@/lib/prospection-fiche-lecture'
import {
  buildCarteMarkers,
  buildTraitementMarkers,
  filterProspectionsForCarte,
  type CarteTraitement,
  type SeveriteNiveau,
} from '@/lib/prospection-carte'
import { MODE_LABELS, TYPE_LABELS } from '@/lib/traitement-labels'
import { formatSurface } from '@/lib/traitement-fiche'
import { STATUTS, STATUT_LABELS } from '@/components/ui/status-badge'

interface Campagne {
  id: string
  name: string
}

interface Station {
  id: string
  code: string
  nom: string
  latitude: number
  longitude: number
}

interface Prospection {
  id: string
  campagne_id: string
  station_id: string | null
  statut: string
  n_fiche: string | null
  latitude: number | null
  longitude: number | null
  infestations: InfestationRead[]
  surface_infestee: number | null
  type_prospection: string
}

const SEVERITE_STYLE: Record<SeveriteNiveau, { color: string; radius: number }> = {
  faible: { color: '#facc15', radius: 6 },
  moyenne: { color: '#fb923c', radius: 9 },
  forte: { color: '#dc2626', radius: 13 },
}

const SEVERITE_LABELS: Record<SeveriteNiveau, string> = {
  faible: 'Faible',
  moyenne: 'Moyenne',
  forte: 'Forte',
}

// Surfaces traitées : bleu, trait épais et centre translucide — distinct des points
// d'infestation (jaune→rouge, pleins) pour que les deux couches restent lisibles ensemble.
const TRAITEMENT_STYLE = { color: '#2563eb', radius: 10 }

const MADAGASCAR_CENTER: [number, number] = [-19, 47]

export function CartePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

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
  }

  const { data: prospections = [], isLoading } = useQuery<Prospection[]>({
    queryKey: ['prospections', 'carte'],
    queryFn: () => api.get('/prospections').then((r) => r.data),
  })

  const { data: campagnes = [] } = useQuery<Campagne[]>({
    queryKey: ['campagnes'],
    queryFn: () => api.get('/campagnes').then((r) => r.data),
  })

  const { data: stations = [] } = useQuery<Station[]>({
    queryKey: ['stations'],
    queryFn: () => api.get('/stations').then((r) => r.data),
  })

  const filtered = useMemo(
    () =>
      filterProspectionsForCarte(prospections, {
        statut: filtreStatut || undefined,
        campagneId: filtreCampagne || undefined,
        stationId: filtreStationId || undefined,
      }),
    [prospections, filtreStatut, filtreCampagne, filtreStationId],
  )

  const markers = useMemo(() => buildCarteMarkers(filtered, stations), [filtered, stations])

  const { data: traitements = [] } = useQuery<CarteTraitement[]>({
    queryKey: ['traitements', 'carte'],
    queryFn: () => api.get('/traitements').then((r) => r.data),
  })

  // Les filtres campagne/station portent sur la fiche de prospection d'origine : un
  // traitement suit sa prospection. Le statut est celui de la prospection — pas de
  // filtre équivalent côté traitement.
  const traitementMarkers = useMemo(() => {
    const prospectionsVisibles = filterProspectionsForCarte(prospections, {
      campagneId: filtreCampagne || undefined,
      stationId: filtreStationId || undefined,
    })
    const idsVisibles = new Set(prospectionsVisibles.map((p) => p.id))
    const traitementsVisibles =
      filtreCampagne || filtreStationId
        ? traitements.filter((t) => idsVisibles.has(t.prospection_id))
        : traitements
    return buildTraitementMarkers(traitementsVisibles, prospections, stations)
  }, [traitements, prospections, stations, filtreCampagne, filtreStationId])

  const [afficherInfestations, setAfficherInfestations] = useState(true)
  const [afficherTraitements, setAfficherTraitements] = useState(true)

  const hasFiltres = filtreStatut || filtreCampagne || filtreStationId

  return (
    <div className="px-8 py-6 flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Carte des infestations</h1>
      </div>

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
            <Label htmlFor="filtre-station">Station</Label>
            <select
              id="filtre-station"
              value={filtreStationId}
              onChange={(e) => setFiltre('station', e.target.value)}
              className="flex h-8 w-48 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Toutes les stations</option>
              {stations.map((s) => (
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

          <fieldset className="flex items-center gap-4 text-sm">
            <legend className="sr-only">Couches affichées</legend>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={afficherInfestations}
                onChange={(e) => setAfficherInfestations(e.target.checked)}
              />
              Infestations
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={afficherTraitements}
                onChange={(e) => setAfficherTraitements(e.target.checked)}
              />
              Surfaces traitées
            </label>
          </fieldset>

          <div className="flex items-center gap-4 ml-auto text-xs text-muted-foreground">
            {(Object.keys(SEVERITE_LABELS) as SeveriteNiveau[]).map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span
                  className="inline-block rounded-full"
                  style={{
                    backgroundColor: SEVERITE_STYLE[s].color,
                    width: SEVERITE_STYLE[s].radius,
                    height: SEVERITE_STYLE[s].radius,
                  }}
                />
                {SEVERITE_LABELS[s]}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block rounded-full border-2"
                style={{ borderColor: TRAITEMENT_STYLE.color, width: 12, height: 12 }}
              />
              Surface traitée
            </span>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-muted-foreground">Chargement…</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-3">
            {markers.length} fiche{markers.length > 1 ? 's' : ''} avec infestation
            {' · '}
            {traitementMarkers.length} surface{traitementMarkers.length > 1 ? 's' : ''} traitée
            {traitementMarkers.length > 1 ? 's' : ''}
          </p>
          <Card className="flex-1 overflow-hidden">
            <CardContent className="p-0 h-full min-h-[480px]">
              <MapContainer center={MADAGASCAR_CENTER} zoom={6} className="h-full w-full" data-testid="map-container">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {afficherTraitements &&
                  traitementMarkers.map((marker) => (
                    <CircleMarker
                      key={`traitement-${marker.traitementId}`}
                      center={[marker.latitude, marker.longitude]}
                      radius={TRAITEMENT_STYLE.radius}
                      pathOptions={{
                        color: TRAITEMENT_STYLE.color,
                        fillColor: TRAITEMENT_STYLE.color,
                        fillOpacity: 0.25,
                        weight: 3,
                      }}
                      eventHandlers={{
                        click: () => navigate(`/traitements/${marker.traitementId}`),
                      }}
                    >
                      <Popup>
                        <div className="text-sm">
                          <p className="font-semibold">{marker.numeroFiche}</p>
                          <p>
                            Traitement {(TYPE_LABELS[marker.typeTraitement] ?? marker.typeTraitement).toLowerCase()}
                            {marker.modeTraitement ? ` — ${MODE_LABELS[marker.modeTraitement] ?? marker.modeTraitement}` : ''}
                          </p>
                          <p>Date : {marker.dateTraitement}</p>
                          <p>
                            Surface {marker.libelleSurface.toLowerCase()} : {formatSurface(marker.surfaceHa)} ha
                          </p>
                          {marker.surfaceRestanteHa != null && (
                            <p>Surface restante : {formatSurface(marker.surfaceRestanteHa)} ha</p>
                          )}
                          <button
                            className="text-primary underline"
                            onClick={() => navigate(`/traitements/${marker.traitementId}`)}
                          >
                            Voir le traitement
                          </button>
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))}
                {afficherInfestations && markers.map((marker) => (
                  <CircleMarker
                    key={marker.prospectionId}
                    center={[marker.latitude, marker.longitude]}
                    radius={SEVERITE_STYLE[marker.severite].radius}
                    pathOptions={{
                      color: SEVERITE_STYLE[marker.severite].color,
                      fillColor: SEVERITE_STYLE[marker.severite].color,
                      fillOpacity: 0.7,
                    }}
                    eventHandlers={{
                      click: () => navigate(`/prospections/${marker.prospectionId}`),
                    }}
                  >
                    <Popup>
                      <div className="text-sm">
                        <p className="font-semibold">{marker.nFiche ?? 'Fiche sans numéro'}</p>
                        {marker.typeProspection && (
                          <p className="text-muted-foreground">
                            Prospection {marker.typeProspection === 'extensive' ? 'extensive' : 'intensive'}
                          </p>
                        )}
                        <p>Sévérité : {SEVERITE_LABELS[marker.severite]}</p>
                        <p className="mt-2 font-medium">Situation d&apos;infestation acridienne</p>
                        <p>Surface infestée : {marker.surfaceTotale != null ? `${marker.surfaceTotale} ha` : '—'}</p>
                        <ul className="mb-2 list-disc pl-4" hidden={marker.infestations.length === 0}>
                          {marker.infestations.map((infestation, index) => (
                            <li key={index}>
                              {infestation.typeLabel}
                              {' — '}
                              {infestation.surfaceTotale != null ? `${infestation.surfaceTotale} ha` : 'surface —'}
                              {' — '}
                              {infestation.densiteMoy != null ? `densité ${infestation.densiteMoy}` : 'densité —'}
                              {' — '}
                              {infestation.comportementLabel}
                            </li>
                          ))}
                        </ul>
                        <button
                          className="text-primary underline"
                          onClick={() => navigate(`/prospections/${marker.prospectionId}`)}
                        >
                          Voir la fiche
                        </button>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
