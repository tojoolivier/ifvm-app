import { useMemo, useState } from 'react'
import { CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet'
import type { LatLngBoundsExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { cn } from '@/lib/utils'
import {
  buildZones,
  rayonBulle,
  type ModeZone,
} from '@/lib/dashboard-zones'
import type {
  DashboardProspection,
  DashboardStation,
  DashboardTraitement,
} from '@/lib/dashboard-metrics'

/**
 * Carte « Zones suivies par région » : une bulle par région, posée au centre
 * des fiches qui s'y rattachent, dont la taille suit le nombre de fiches.
 * Trois lectures au choix — prospection, infestation, traitement — qui
 * reprennent les couleurs des courbes du graphique d'évolution.
 *
 * Les bulles ne sont pas atteignables au clavier : la vue « liste » donne les
 * mêmes régions et les mêmes chiffres, et c'est la contrepartie accessible.
 */

/** Cadre de l'île : la carte s'y cale à l'ouverture, quelle que soit sa largeur. */
const CADRE_MADAGASCAR: LatLngBoundsExpression = [
  [-26, 42.3],
  [-11.8, 50.8],
]

const MODES: {
  valeur: ModeZone
  label: string
  couleur: string
  fiches: string
  surface: string
}[] = [
  {
    valeur: 'prospection',
    label: 'Prospection',
    couleur: '#1f6e52',
    fiches: 'fiche de prospection',
    surface: 'prospectée',
  },
  {
    valeur: 'infestation',
    label: 'Infestation',
    couleur: '#eb6834',
    fiches: 'fiche avec infestation',
    surface: 'infestée',
  },
  {
    valeur: 'traitement',
    label: 'Traitement',
    couleur: '#1baf7a',
    fiches: 'fiche de traitement',
    surface: 'traitée ou protégée',
  },
]

const nombreFr = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })

const pluriel = (n: number, libelle: string) => {
  // « fiche avec infestation » → « fiches avec infestation » : seul le premier mot s'accorde.
  const [premier, ...reste] = libelle.split(' ')
  return `${n} ${premier}${n > 1 ? 's' : ''}${reste.length ? ' ' + reste.join(' ') : ''}`
}

interface Props {
  prospections: DashboardProspection[]
  traitements: DashboardTraitement[]
  stations: DashboardStation[]
  /** Libellé du périmètre (« campagne en cours », nom de campagne…). */
  perimetre: string
  enChargement: boolean
  className?: string
}

export function ZonesParRegion({
  prospections,
  traitements,
  stations,
  perimetre,
  enChargement,
  className,
}: Props) {
  const [mode, setMode] = useState<ModeZone>('infestation')
  const [liste, setListe] = useState(false)

  const config = MODES.find((m) => m.valeur === mode)!
  const { zones, sansPosition } = useMemo(
    () => buildZones(mode, prospections, traitements, stations),
    [mode, prospections, traitements, stations],
  )
  const maxFiches = Math.max(0, ...zones.map((z) => z.nFiches))

  return (
    <section className={className} aria-busy={enChargement}>
      <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-x-2.5 gap-y-2">
        <div>
          <h2 className="font-sans text-[14.5px] font-bold">Zones suivies par région</h2>
          <p className="mt-0.5 font-sans text-[12px] text-ifvm-text-weak">
            Taille = nombre de fiches rattachées — {perimetre}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Lecture de la carte"
            className="flex gap-1 rounded-[9px] border border-[#e7e0cd] bg-[#edece3] p-[3px]"
          >
            {MODES.map((m) => (
              <button
                key={m.valeur}
                type="button"
                aria-pressed={m.valeur === mode}
                onClick={() => setMode(m.valeur)}
                className={cn(
                  'rounded-[6px] px-[10px] py-[5px] font-sans text-[12px] font-semibold',
                  m.valeur === mode ? 'bg-ifvm-green-text text-white' : 'text-ifvm-text-tertiary',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setListe((l) => !l)}
            className="rounded-[7px] border border-[#d8d4c1] px-2.5 py-[5px] font-sans text-[11.5px] font-semibold text-ifvm-text-tertiary hover:bg-[#edece3]"
          >
            {liste ? 'Voir la carte' : 'Voir en liste'}
          </button>
        </div>
      </div>

      <div className={cn('transition-opacity', enChargement && 'opacity-60')}>
        {liste ? (
          zones.length === 0 ? (
            <Vide enChargement={enChargement} />
          ) : (
            <div className="max-h-[440px] overflow-auto rounded-[10px] border border-[#e7e0cd]">
              <table className="w-full border-collapse font-sans text-[12px]">
                <caption className="sr-only">
                  Régions suivies — lecture « {config.label.toLowerCase()} »
                </caption>
                <thead className="sticky top-0 bg-[#edece3] text-ifvm-text-tertiary">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left font-semibold">
                      Région
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">
                      Fiches
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">
                      Surface {config.surface} (ha)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {zones.map((z) => (
                    <tr key={z.cle} className="border-t border-[#f1ecdd]">
                      <th scope="row" className="px-3 py-1.5 text-left font-medium">
                        {z.region}
                      </th>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                        {nombreFr.format(z.nFiches)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                        {nombreFr.format(z.surfaceHa)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="relative h-[440px] overflow-hidden rounded-[10px] border border-[#e7e0cd]">
            <MapContainer
              bounds={CADRE_MADAGASCAR}
              // Par défaut Leaflet ne cale que sur des zooms entiers : l'île, haute et
              // étroite, flotterait au milieu d'un cadre trop large.
              zoomSnap={0.25}
              // La molette défile la page du tableau de bord : le zoom passe par les boutons.
              scrollWheelZoom={false}
              className="h-full w-full"
              data-testid="carte-zones"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {zones.map((z) => (
                <CircleMarker
                  key={`${mode}-${z.cle}`}
                  center={[z.latitude, z.longitude]}
                  radius={rayonBulle(z.nFiches, maxFiches)}
                  // Voile de 45 % + contour plein : les bulles qui se chevauchent restent lisibles.
                  pathOptions={{
                    color: config.couleur,
                    weight: 2,
                    fillColor: config.couleur,
                    fillOpacity: 0.45,
                  }}
                >
                  <Tooltip>
                    <div className="font-bold">{z.region}</div>
                    <div>{pluriel(z.nFiches, config.fiches)}</div>
                    <div>
                      {nombreFr.format(z.surfaceHa)} ha {config.surface}
                    </div>
                  </Tooltip>
                </CircleMarker>
              ))}
            </MapContainer>
            {zones.length === 0 && (
              <div className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center">
                <span className="rounded-[8px] bg-card px-3 py-2 font-sans text-[12px] text-ifvm-text-weak shadow">
                  {enChargement ? 'Chargement…' : `Aucune zone à afficher (${config.label.toLowerCase()}).`}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#e7e0cd] pt-3">
        <span className="inline-flex items-center gap-1.5 font-sans text-[11.5px] font-semibold text-ifvm-text-tertiary">
          <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-full border-2"
            style={{ borderColor: config.couleur, background: `${config.couleur}73` }}
          />
          Une bulle = une région ({config.label.toLowerCase()})
        </span>
        {zones.length > 0 && (
          <span className="font-sans text-[11.5px] text-ifvm-text-weak">
            {zones.length} région{zones.length > 1 ? 's' : ''} · plus grosse bulle ={' '}
            {pluriel(maxFiches, config.fiches)}
          </span>
        )}
        {sansPosition > 0 && (
          <span className="font-sans text-[11.5px] text-ifvm-text-weak">
            {sansPosition} fiche{sansPosition > 1 ? 's' : ''} sans position, non placée
            {sansPosition > 1 ? 's' : ''} sur la carte
          </span>
        )}
      </div>
    </section>
  )
}

function Vide({ enChargement }: { enChargement: boolean }) {
  return (
    <div className="flex h-[220px] w-full items-center justify-center rounded-[10px] border border-dashed border-[#e7e0cd] bg-[#fafaf5] font-sans text-[12px] text-ifvm-text-weak">
      {enChargement ? 'Chargement…' : 'Aucune zone à afficher.'}
    </div>
  )
}
