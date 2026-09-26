import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { Segmente } from './Segmente'
import {
  buildRepartitionTypes,
  rangCouleurType,
  type MesureRepartition,
} from '@/lib/dashboard-repartition'
import type { DashboardProspection } from '@/lib/dashboard-metrics'

/**
 * Répartition des prospections par type (intensive, extensive, validation…) :
 * une barre empilée à 100 %, lue en nombre de fiches ou en surface prospectée.
 *
 * Forme : une répartition (part d'un tout) sur peu de catégories se lit mieux en
 * barre empilée qu'en camembert — les longueurs se comparent, les angles non.
 * Les types viennent des fiches elles-mêmes : un nouveau type apparaît sans
 * changement de code. Le tableau dessous porte les mêmes chiffres en texte : la
 * couleur n'est jamais la seule façon de savoir quel segment est lequel.
 */

// Ordre des « slots » catégoriels du système graphique, écartés des orange / vert / bleu
// des courbes d'évolution (infestée / traitée / protégée) pour ne pas
// faire dire deux choses à la même couleur dans le même tableau de bord.
// Validés (script dataviz) sur toutes les paires : violet, jaune, vert.
const COULEURS = ['#4a3aa7', '#eda100', '#008300', '#e87ba4', '#e34948', '#2a78d6', '#eb6834', '#1baf7a']

const nombreFr = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })

const MESURES: { valeur: MesureRepartition; label: string }[] = [
  { valeur: 'fiches', label: 'Fiches' },
  { valeur: 'surface', label: 'Surface (ha)' },
]

const pluriel = (n: number) => `${nombreFr.format(n)} fiche${n > 1 ? 's' : ''}`

interface Props {
  prospections: DashboardProspection[]
  /** Libellé du périmètre (« campagne en cours », nom de campagne…). */
  perimetre: string
  enChargement: boolean
  className?: string
}

export function RepartitionProspections({
  prospections,
  perimetre,
  enChargement,
  className,
}: Props) {
  const [mesure, setMesure] = useState<MesureRepartition>('fiches')
  const [actif, setActif] = useState<string | null>(null)

  const parts = useMemo(() => buildRepartitionTypes(prospections, mesure), [prospections, mesure])
  const typesPresents = useMemo(() => parts.map((p) => p.type), [parts])
  const couleur = (type: string) =>
    COULEURS[rangCouleurType(type, typesPresents) % COULEURS.length]

  const total = parts.reduce((somme, p) => somme + p.valeur, 0)
  const nFichesTotal = parts.reduce((somme, p) => somme + p.nFiches, 0)
  const partActive = parts.find((p) => p.type === actif)

  // Centre de chaque segment, en % de la largeur : l'infobulle s'y accroche.
  let cumul = 0
  const centres = new Map<string, number>()
  for (const p of parts) {
    centres.set(p.type, total > 0 ? ((cumul + p.valeur / 2) / total) * 100 : 0)
    cumul += p.valeur
  }
  const centreActif = partActive ? (centres.get(partActive.type) ?? 0) : 0

  return (
    <section className={className} aria-busy={enChargement}>
      <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-x-2.5 gap-y-2">
        <div>
          <h2 className="font-sans text-[14.5px] font-bold">Répartition des prospections par type</h2>
          <p className="mt-0.5 font-sans text-[12px] text-ifvm-text-weak">
            {nombreFr.format(nFichesTotal)} fiche{nFichesTotal > 1 ? 's' : ''} — {perimetre}
          </p>
        </div>
        <Segmente
          legende="Mesure de la répartition"
          options={MESURES}
          valeur={mesure}
          onChange={setMesure}
        />
      </div>

      <div className={cn('transition-opacity', enChargement && 'opacity-60')}>
        {parts.length === 0 ? (
          <div className="flex h-[120px] w-full items-center justify-center rounded-[10px] border border-dashed border-[#e7e0cd] bg-[#fafaf5] font-sans text-[12px] text-ifvm-text-weak">
            {enChargement ? 'Chargement…' : 'Aucune prospection sur cette campagne.'}
          </div>
        ) : (
          <>
            <div className="relative pt-1">
              {partActive && (
                <div
                  role="status"
                  className="pointer-events-none absolute top-full z-10 mt-1 min-w-[150px] rounded-[10px] border border-[#e7e0cd] bg-card px-3 py-2 shadow-[0_6px_20px_-8px_rgba(22,33,26,0.3)]"
                  style={{
                    left: `${centreActif}%`,
                    // Recentré, mais jamais hors du cadre aux deux extrémités.
                    transform: `translateX(${centreActif < 20 ? '0%' : centreActif > 80 ? '-100%' : '-50%'})`,
                  }}
                >
                  <div className="font-sans text-[11.5px] font-semibold text-ifvm-text-weak">
                    {partActive.label}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[13px] font-bold tabular-nums text-foreground">
                      {pluriel(partActive.nFiches)}
                    </span>
                    <span className="font-sans text-[11.5px] text-ifvm-text-tertiary">
                      {nombreFr.format(partActive.surfaceHa)} ha
                    </span>
                  </div>
                </div>
              )}

              <ul
                aria-label="Répartition des prospections par type"
                className="flex h-[30px] gap-[2px]"
              >
                {parts
                  .filter((p) => p.valeur > 0)
                  .map((p) => (
                    <li
                      key={p.type}
                      className="min-w-[6px] overflow-hidden first:rounded-l-[8px] last:rounded-r-[8px]"
                      style={{ flexGrow: p.valeur, flexBasis: 0 }}
                    >
                      <button
                        type="button"
                        aria-label={`${p.label} : ${pluriel(p.nFiches)}, ${nombreFr.format(p.surfaceHa)} ha, ${nombreFr.format(p.pct)} %`}
                        className={cn(
                          'block h-full w-full outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground',
                          actif && actif !== p.type && 'opacity-45',
                        )}
                        style={{ background: couleur(p.type) }}
                        onPointerEnter={() => setActif(p.type)}
                        onPointerLeave={() => setActif(null)}
                        onFocus={() => setActif(p.type)}
                        onBlur={() => setActif(null)}
                      />
                    </li>
                  ))}
              </ul>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse font-sans text-[12px]">
                <caption className="sr-only">
                  Prospections par type — {mesure === 'fiches' ? 'en nombre de fiches' : 'en surface prospectée'}
                </caption>
                <thead className="text-ifvm-text-weak">
                  <tr className="border-b border-[#e7e0cd]">
                    <th scope="col" className="px-2 py-1.5 text-left font-semibold">
                      Type
                    </th>
                    <th scope="col" className="px-2 py-1.5 text-right font-semibold">
                      Fiches
                    </th>
                    <th scope="col" className="px-2 py-1.5 text-right font-semibold">
                      Surface
                    </th>
                    <th scope="col" className="px-2 py-1.5 text-right font-semibold">
                      Part {mesure === 'fiches' ? 'des fiches' : 'de la surface'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {parts.map((p) => (
                    <tr
                      key={p.type}
                      className={cn(
                        'border-b border-[#f1ecdd] last:border-0',
                        actif === p.type && 'bg-[#fafaf5]',
                      )}
                      onPointerEnter={() => setActif(p.type)}
                      onPointerLeave={() => setActif(null)}
                    >
                      <th scope="row" className="px-2 py-1.5 text-left font-semibold">
                        <span className="inline-flex items-center gap-2">
                          <span
                            aria-hidden
                            className="h-2.5 w-2.5 rounded-[3px]"
                            style={{ background: couleur(p.type) }}
                          />
                          {p.label}
                        </span>
                      </th>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                        {nombreFr.format(p.nFiches)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                        {nombreFr.format(p.surfaceHa)} ha
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono font-bold tabular-nums">
                        {nombreFr.format(p.pct)} %
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
