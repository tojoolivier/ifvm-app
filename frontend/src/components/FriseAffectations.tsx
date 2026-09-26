import { calculerFrise, estEnCours, formaterDate } from '@/lib/parc-aeronefs'
import { Pill } from '@/components/ui/pill'

export interface LigneFrise {
  id: string
  /** Ce qui est affecté : l'équipe (vue appareil) ou l'appareil (vue équipe). */
  titre: string
  sousTitre?: string
  date_debut: string
  /** `null` : l'affectation est en cours. */
  date_fin: string | null
  /** Action de la ligne (ex. « Clore »), affichée à droite. */
  action?: React.ReactNode
}

/**
 * Frise temporelle des affectations d'aéronefs (#621, #603) : une ligne par période, dont la barre est
 * positionnée entre la plus ancienne date de début et la fin la plus tardive (aujourd'hui pour une
 * affectation en cours). Sert des deux côtés — l'historique d'un appareil (les équipes qui l'ont
 * utilisé) et celui d'une équipe (les appareils qu'elle a utilisés).
 */
export function FriseAffectations({
  lignes,
  aujourdhui,
  ariaLabel,
  messageVide,
}: {
  lignes: LigneFrise[]
  aujourdhui: string
  ariaLabel: string
  messageVide: string
}) {
  if (lignes.length === 0) {
    return <p className="font-sans text-[12px] text-ifvm-text-weak">{messageVide}</p>
  }

  const frise = calculerFrise(lignes, aujourdhui)

  return (
    <div role="list" aria-label={ariaLabel} className="flex flex-col gap-3">
      <div className="flex justify-between font-mono text-[10px] text-ifvm-text-weak" aria-hidden>
        <span>{formaterDate(frise.debut)}</span>
        <span>{formaterDate(frise.fin)}</span>
      </div>
      {lignes.map((ligne, index) => {
        const barre = frise.barres[index]
        const enCours = estEnCours(ligne)
        return (
          <div key={ligne.id} role="listitem" data-testid="frise-ligne" className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-sans text-[12.5px] font-semibold">{ligne.titre}</span>
              {ligne.sousTitre && (
                <span className="font-sans text-[11px] text-ifvm-text-weak">{ligne.sousTitre}</span>
              )}
              {enCours && (
                <Pill tone="border-ifvm-green-border bg-ifvm-green-bg text-ifvm-green-text">En cours</Pill>
              )}
              {ligne.action && <span className="ml-auto">{ligne.action}</span>}
            </div>
            <div className="relative h-3 rounded-full bg-[#f1ecdc]" aria-hidden>
              <div
                data-testid="frise-barre"
                className={`absolute top-0 h-3 rounded-full ${enCours ? 'bg-ifvm-green-text' : 'bg-[#c9c2ac]'}`}
                style={{ left: `${barre.gauche}%`, width: `${barre.largeur}%` }}
              />
            </div>
            <p className="font-mono text-[10.5px] text-ifvm-text-weak">
              {enCours
                ? `Depuis le ${formaterDate(ligne.date_debut)}`
                : `Du ${formaterDate(ligne.date_debut)} au ${formaterDate(ligne.date_fin as string)}`}
            </p>
          </div>
        )
      })}
    </div>
  )
}
