import { useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { cn } from '@/lib/utils'
import {
  buildEvolution,
  echelleY,
  type Granularite,
  type PointEvolution,
} from '@/lib/dashboard-evolution'
import type { DashboardProspection, DashboardTraitement } from '@/lib/dashboard-metrics'

/**
 * Graphique « Évolution de la campagne » : surfaces infestée, traitée et
 * protégée dans le temps. SVG écrit à la main (aucune bibliothèque de graphes
 * dans le projet) — trois courbes ne justifient pas une dépendance.
 *
 * Choix d'affichage :
 * - un repère vertical suit le pointeur (ou les flèches du clavier) et une seule
 *   infobulle donne les trois valeurs : on vise une date, pas un trait de 2 px ;
 * - la couleur ne porte jamais seule l'identité : légende avec valeur finale,
 *   infobulle nommée et vue « tableau » complète (le vert seul tombe à 2,7:1 de
 *   contraste sur fond blanc, cette vue en est la contrepartie obligée).
 */

const SERIES = [
  { cle: 'infestee', nom: 'Infestée', couleur: '#eb6834' },
  { cle: 'traitee', nom: 'Traitée', couleur: '#1baf7a' },
  { cle: 'protegee', nom: 'Protégée', couleur: '#2a78d6' },
] as const

const nombreFr = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })

// Repère du dessin : le SVG est mis à l'échelle par `viewBox`, les coordonnées
// ci-dessous ne sont donc pas des pixels d'écran.
const L = 680
const H = 250
const MARGE = { haut: 14, droite: 18, bas: 30, gauche: 46 }
const LARGEUR_TRACE = L - MARGE.gauche - MARGE.droite
const HAUTEUR_TRACE = H - MARGE.haut - MARGE.bas
const MAX_ETIQUETTES_X = 8

const GRANULARITES: { valeur: Granularite; label: string }[] = [
  { valeur: 'decade', label: 'Décade' },
  { valeur: 'mois', label: 'Mois' },
]

function Segmente<T extends string | boolean>({
  legende,
  options,
  valeur,
  onChange,
}: {
  legende: string
  options: { valeur: T; label: string }[]
  valeur: T
  onChange: (v: T) => void
}) {
  return (
    <div
      role="group"
      aria-label={legende}
      className="flex gap-1 rounded-[9px] border border-[#e7e0cd] bg-[#edece3] p-[3px]"
    >
      {options.map((o) => (
        <button
          key={String(o.valeur)}
          type="button"
          aria-pressed={o.valeur === valeur}
          onClick={() => onChange(o.valeur)}
          className={cn(
            'rounded-[6px] px-[10px] py-[5px] font-sans text-[12px] font-semibold',
            o.valeur === valeur ? 'bg-ifvm-green-text text-white' : 'text-ifvm-text-tertiary',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

interface Props {
  prospections: DashboardProspection[]
  traitements: DashboardTraitement[]
  /** Bornes de la campagne affichée (`YYYY-MM-DD`). */
  debut?: string
  fin?: string
  /** Libellé du périmètre (« campagne en cours », nom de campagne…). */
  perimetre: string
  enChargement: boolean
  className?: string
}

export function EvolutionCampagne({
  prospections,
  traitements,
  debut,
  fin,
  perimetre,
  enChargement,
  className,
}: Props) {
  const [granularite, setGranularite] = useState<Granularite>('decade')
  const [cumule, setCumule] = useState(true)
  const [tableau, setTableau] = useState(false)
  const [actif, setActif] = useState<number | null>(null)

  const points = useMemo(
    () => buildEvolution(prospections, traitements, { granularite, cumule, debut, fin }),
    [prospections, traitements, granularite, cumule, debut, fin],
  )

  const maxValeur = Math.max(0, ...points.flatMap((p) => SERIES.map((s) => p[s.cle])))
  const echelle = echelleY(maxValeur)
  const n = points.length
  const x = (i: number) =>
    n === 1 ? MARGE.gauche + LARGEUR_TRACE / 2 : MARGE.gauche + (i * LARGEUR_TRACE) / (n - 1)
  const y = (v: number) => MARGE.haut + HAUTEUR_TRACE * (1 - v / echelle.max)
  const pasEtiquette = Math.max(1, Math.ceil(n / MAX_ETIQUETTES_X))
  const dernier: PointEvolution | undefined = points[n - 1]
  const survol = actif !== null ? points[actif] : undefined

  const choisirGranularite = (g: Granularite) => {
    setGranularite(g)
    setActif(null)
  }

  const survolerPointeur = (e: PointerEvent<SVGRectElement>) => {
    const boite = e.currentTarget.ownerSVGElement?.getBoundingClientRect()
    if (!boite || boite.width === 0 || n === 0) return
    const xDessin = ((e.clientX - boite.left) * L) / boite.width
    const i = n === 1 ? 0 : Math.round(((xDessin - MARGE.gauche) / LARGEUR_TRACE) * (n - 1))
    if (Number.isFinite(i)) setActif(Math.min(n - 1, Math.max(0, i)))
  }

  const naviguerClavier = (e: KeyboardEvent<SVGSVGElement>) => {
    if (n === 0) return
    if (e.key === 'ArrowRight') setActif((a) => Math.min(n - 1, (a ?? -1) + 1))
    else if (e.key === 'ArrowLeft') setActif((a) => Math.max(0, (a ?? n) - 1))
    else if (e.key === 'Home') setActif(0)
    else if (e.key === 'End') setActif(n - 1)
    else if (e.key === 'Escape') setActif(null)
    else return
    e.preventDefault()
  }

  const pctGauche = survol ? (x(actif!) / L) * 100 : 0

  return (
    <section className={className} aria-busy={enChargement}>
      <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-x-2.5 gap-y-2">
        <div>
          <h2 className="font-sans text-[14.5px] font-bold">Évolution de la campagne</h2>
          <p className="mt-0.5 font-sans text-[12px] text-ifvm-text-weak">
            Superficies infestées, traitées et protégées — {perimetre}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmente
            legende="Regroupement des périodes"
            options={GRANULARITES}
            valeur={granularite}
            onChange={choisirGranularite}
          />
          <Segmente
            legende="Mode de calcul"
            options={[
              { valeur: true, label: 'Cumulé' },
              { valeur: false, label: 'Par période' },
            ]}
            valeur={cumule}
            onChange={setCumule}
          />
          <button
            type="button"
            onClick={() => setTableau((t) => !t)}
            className="rounded-[7px] border border-[#d8d4c1] px-2.5 py-[5px] font-sans text-[11.5px] font-semibold text-ifvm-text-tertiary hover:bg-[#edece3]"
          >
            {tableau ? 'Voir le graphique' : 'Voir en tableau'}
          </button>
        </div>
      </div>

      <ul className="flex flex-wrap gap-x-[16px] gap-y-2 pb-2">
        {SERIES.map((s) => (
          <li
            key={s.cle}
            className="inline-flex items-center gap-1.5 font-sans text-[12px] font-semibold text-ifvm-text-tertiary"
          >
            <span
              aria-hidden
              className="h-[2px] w-[14px] rounded-[2px]"
              style={{ background: s.couleur }}
            />
            {s.nom}
            {dernier && (
              <span className="font-mono font-medium text-ifvm-text-weak">
                {nombreFr.format(dernier[s.cle])} ha
              </span>
            )}
          </li>
        ))}
      </ul>

      <div className={cn('transition-opacity', enChargement && 'opacity-60')}>
        {n === 0 ? (
          <div className="flex h-[220px] w-full items-center justify-center rounded-[10px] border border-dashed border-[#e7e0cd] bg-[#fafaf5] font-sans text-[12px] text-ifvm-text-weak">
            {enChargement ? 'Chargement…' : 'Aucune fiche datée sur cette campagne.'}
          </div>
        ) : tableau ? (
          <div className="max-h-[300px] overflow-auto rounded-[10px] border border-[#e7e0cd]">
            <table className="w-full border-collapse font-sans text-[12px]">
              <caption className="sr-only">
                Surfaces {cumule ? 'cumulées' : 'par période'} en hectares
              </caption>
              <thead className="sticky top-0 bg-[#edece3] text-ifvm-text-tertiary">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-semibold">
                    Période
                  </th>
                  {SERIES.map((s) => (
                    <th key={s.cle} scope="col" className="px-3 py-2 text-right font-semibold">
                      {s.nom} (ha)
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={p.cle} className="border-t border-[#f1ecdd]">
                    <th scope="row" className="px-3 py-1.5 text-left font-medium">
                      {p.libelleLong}
                    </th>
                    {SERIES.map((s) => (
                      <td key={s.cle} className="px-3 py-1.5 text-right font-mono tabular-nums">
                        {nombreFr.format(p[s.cle])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="relative">
            <svg
              viewBox={`0 0 ${L} ${H}`}
              className="block h-auto w-full touch-pan-y select-none rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-ifvm-green-text"
              role="group"
              aria-label="Évolution de la campagne : surfaces infestée, traitée et protégée. Flèches gauche et droite pour parcourir les périodes."
              tabIndex={0}
              onKeyDown={naviguerClavier}
              onFocus={() => setActif((a) => a ?? n - 1)}
              onBlur={() => setActif(null)}
            >
              {echelle.ticks.map((t) => (
                <g key={t}>
                  <line
                    x1={MARGE.gauche}
                    x2={L - MARGE.droite}
                    y1={y(t)}
                    y2={y(t)}
                    stroke="#ece6d3"
                    strokeWidth={1}
                  />
                  <text
                    x={MARGE.gauche - 8}
                    y={y(t)}
                    dy="0.32em"
                    textAnchor="end"
                    fontSize={11}
                    className="fill-ifvm-text-weak font-mono"
                  >
                    {nombreFr.format(t)}
                  </text>
                </g>
              ))}

              {points.map(
                (p, i) =>
                  i % pasEtiquette === 0 && (
                    <text
                      key={p.cle}
                      x={x(i)}
                      y={H - 9}
                      textAnchor="middle"
                      fontSize={11}
                      className="fill-ifvm-text-weak font-sans"
                    >
                      {p.label}
                    </text>
                  ),
              )}

              {survol && (
                <line
                  x1={x(actif!)}
                  x2={x(actif!)}
                  y1={MARGE.haut}
                  y2={MARGE.haut + HAUTEUR_TRACE}
                  stroke="#b9b39c"
                  strokeWidth={1}
                />
              )}

              {SERIES.map((s) => (
                <polyline
                  key={s.cle}
                  data-serie={s.cle}
                  points={points.map((p, i) => `${x(i)},${y(p[s.cle])}`).join(' ')}
                  fill="none"
                  stroke={s.couleur}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}

              {/* Point final de chaque courbe, ou point du repère au survol :
                  anneau de 2 px couleur de fond pour rester lisible quand les
                  courbes se croisent. */}
              {SERIES.map((s) => {
                // `actif` peut dater d'avant un changement de données : on le borne.
                const i = Math.min(actif ?? n - 1, n - 1)
                return (
                  <circle
                    key={s.cle}
                    cx={x(i)}
                    cy={y(points[i][s.cle])}
                    r={4}
                    fill={s.couleur}
                    style={{ stroke: 'hsl(var(--card))', strokeWidth: 2 }}
                  />
                )
              })}

              <rect
                x={MARGE.gauche}
                y={MARGE.haut}
                width={LARGEUR_TRACE}
                height={HAUTEUR_TRACE}
                fill="transparent"
                onPointerMove={survolerPointeur}
                onPointerDown={survolerPointeur}
                onPointerLeave={() => setActif(null)}
              />
            </svg>

            {survol && (
              <div
                role="status"
                className="pointer-events-none absolute top-2 z-10 min-w-[150px] rounded-[10px] border border-[#e7e0cd] bg-card px-3 py-2 shadow-[0_6px_20px_-8px_rgba(22,33,26,0.3)]"
                style={{
                  left: `${pctGauche}%`,
                  transform: `translateX(${pctGauche > 60 ? 'calc(-100% - 12px)' : '12px'})`,
                }}
              >
                <div className="mb-1 font-sans text-[11.5px] font-semibold text-ifvm-text-weak">
                  {survol.libelleLong}
                </div>
                {SERIES.map((s) => (
                  <div key={s.cle} className="flex items-center gap-2 py-[1px]">
                    <span
                      aria-hidden
                      className="h-[2px] w-[10px] rounded-[2px]"
                      style={{ background: s.couleur }}
                    />
                    <span className="font-mono text-[13px] font-bold tabular-nums text-foreground">
                      {nombreFr.format(survol[s.cle])} ha
                    </span>
                    <span className="font-sans text-[11.5px] text-ifvm-text-tertiary">{s.nom}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
