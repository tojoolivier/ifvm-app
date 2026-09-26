import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { texteOuNull } from '@/lib/fiche-tableau'

/**
 * Briques des fiches de lecture en tableaux : elles reprennent la mise en page des formulaires
 * papier (gabarits PDF du backend) — titres de section, lignes « Libellé : valeur », cases à
 * cocher, grilles — pour que l'écran et le PDF téléchargé se lisent de la même façon.
 */

/** Feuille de la fiche : fond blanc, bordure des cartes, largeur de lecture bornée. */
export function Feuille({ children, label }: { children: ReactNode; label: string }) {
  return (
    <article
      aria-label={label}
      className="mx-auto w-full min-w-0 max-w-[900px] rounded-[11px] border border-[#e7e0cd] bg-white px-4 py-5 font-sans text-[13px] leading-[1.5] text-[#111827] sm:px-8 sm:py-7"
    >
      {children}
    </article>
  )
}

/** En-tête centré : organisme, titre du formulaire, et éventuellement le sigle à droite. */
export function Entete({
  organisme,
  titre,
  sousTitre,
  sigle,
}: {
  organisme: string
  titre?: string
  sousTitre?: string
  sigle?: ReactNode
}) {
  return (
    <header className="mb-2 text-center">
      <p className={cn('m-0 font-bold', titre ? 'text-[13px]' : 'text-[15px]')}>{organisme}</p>
      {titre && <h2 className="mb-1 mt-0.5 text-[14px] font-bold">{titre}</h2>}
      {sousTitre && <h2 className="mb-3 mt-0.5 text-[13px] font-bold">{sousTitre}</h2>}
      {sigle && <p className="m-0 text-right text-[12.5px]">{sigle}</p>}
    </header>
  )
}

/** Titre de section du formulaire papier (`h3` gras, sous-numéros en corps normal). */
export function Section({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className="mt-4 first-of-type:mt-2">
      <h3 className="mb-1 text-[13.5px] font-bold">{titre}</h3>
      {children}
    </section>
  )
}

/** Bandeau gris des titres de blocs de la fiche de prospection (A. Références, B. Imagos…). */
export function Bandeau({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className="mt-4">
      <h3 className="mb-2 rounded-[3px] bg-[#e5e7eb] px-2 py-1 text-[13px] font-bold">{titre}</h3>
      {children}
    </section>
  )
}

/** Ligne de champs indentée sous son titre (retour à la ligne libre selon la largeur). */
export function Ligne({ children }: { children: ReactNode }) {
  return <p className="my-0.5 ml-0 flex flex-wrap items-baseline gap-x-5 gap-y-1 sm:ml-[0.45cm]">{children}</p>
}

/**
 * « Libellé : valeur » du CRT — valeur soulignée si renseignée, pointillés (à remplir) sinon,
 * comme sur le formulaire papier.
 */
export function Champ({ label, valeur }: { label: string; valeur: unknown }) {
  const contenu = texteOuNull(valeur)
  return (
    <span className="whitespace-nowrap">
      <span>{label} :</span>{' '}
      {contenu === null ? (
        <span className="inline-block min-w-[1.6cm] border-b border-dotted border-[#6b7280]">
          <span className="sr-only">non renseigné</span>&nbsp;
        </span>
      ) : (
        <span className="border-b border-[#111827] px-1">{contenu}</span>
      )}
    </span>
  )
}

/** Case à cocher en lecture seule ; exposée comme telle aux lecteurs d'écran. */
export function Case({ cochee, label }: { cochee: boolean; label: string }) {
  return (
    <span
      role="checkbox"
      aria-checked={cochee}
      aria-readonly="true"
      aria-label={label}
      className="ml-1 inline-flex h-[13px] w-[13px] items-center justify-center border border-[#111827] align-[-2px] text-[9px] font-bold leading-none"
    >
      {cochee ? 'X' : ''}
    </span>
  )
}

/**
 * « Libellé ☐ » — l'ordre le plus courant du formulaire papier. `nom` précise le nom accessible
 * quand le libellé affiché seul serait ambigu (« Non » revient dans plusieurs sections).
 */
export function Option({ label, cochee, nom }: { label: string; cochee: boolean; nom?: string }) {
  return (
    <span className="whitespace-nowrap">
      {label} <Case cochee={cochee} label={nom ?? label} />
    </span>
  )
}

export function LigneOptions({ options }: { options: { label: string; cochee: boolean; nom?: string }[] }) {
  return (
    <Ligne>
      {options.map((o) => (
        <Option key={o.nom ?? o.label} label={o.label} cochee={o.cochee} nom={o.nom} />
      ))}
    </Ligne>
  )
}

/** Grille : défile dans son propre cadre plutôt que d'élargir la page sur un petit écran. */
export function Grille({
  children,
  className,
  caption,
}: {
  children: ReactNode
  className?: string
  caption?: string
}) {
  return (
    <div className={cn('my-1 max-w-full overflow-x-auto', className)}>
      <table className="w-full border-collapse text-[12px]">
        {caption && <caption className="sr-only">{caption}</caption>}
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

const CELLULE = 'border border-[#9ca3af] px-1.5 py-1 align-middle'

export function Th({
  children,
  colSpan,
  rowSpan,
  gauche,
  scope,
}: {
  children?: ReactNode
  colSpan?: number
  rowSpan?: number
  gauche?: boolean
  scope?: 'row' | 'col'
}) {
  return (
    <th
      colSpan={colSpan}
      rowSpan={rowSpan}
      scope={scope}
      className={cn(CELLULE, 'font-bold', gauche ? 'text-left' : 'text-center')}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  colSpan,
  rowSpan,
  gauche,
}: {
  children?: ReactNode
  colSpan?: number
  rowSpan?: number
  gauche?: boolean
}) {
  return (
    <td colSpan={colSpan} rowSpan={rowSpan} className={cn(CELLULE, gauche ? 'text-left' : 'text-center')}>
      {children}
    </td>
  )
}

/** Zone de texte encadrée (« 12. Observation générale »). */
export function ZoneTexte({ children }: { children: ReactNode }) {
  return (
    <div className="my-1 min-h-[1.2cm] whitespace-pre-wrap break-words border border-[#9ca3af] p-2 sm:ml-[0.45cm]">
      {children}
    </div>
  )
}
