import type { components } from '@/lib/api-schema.generated'
import { formaterDateVol, formaterHeure, libelleCategorie, libelleSite, type SiteAerien, type Vol } from '@/lib/vols'

type Aeronef = components['schemas']['AeronefRead']

/**
 * Un rattachement affiché sur une fiche : la valeur lisible, et si elle vient du TEXTE LIBRE
 * historique (`historique: true`) plutôt que d'un rattachement au référentiel. Les fiches antérieures
 * au chantier équipe / site / aéronef / vol (#647–#651) ne portent que ce texte : il reste affiché,
 * mais signalé, plutôt que masqué ou présenté comme un rattachement fiable.
 */
export interface ValeurRattachement {
  texte: string
  historique: boolean
}

/** Immatriculation comparable : sans espaces autour, en majuscules (« 5r-mja » = « 5R-MJA »). */
export function normaliserImmatriculation(immatriculation: string | null | undefined): string {
  return (immatriculation ?? '').trim().toUpperCase()
}

/** « 5R-MJA — Heli Madagascar » : l'appareil du parc, avec sa société. */
export function libelleAeronef(aeronef: Pick<Aeronef, 'immatriculation' | 'societe'>): string {
  return `${aeronef.immatriculation} — ${aeronef.societe}`
}

/** L'appareil du parc dont l'immatriculation correspond à un texte libre — `undefined` s'il n'y en a pas. */
export function trouverAeronefParImmatriculation(
  immatriculation: string | null | undefined,
  aeronefs: Aeronef[],
): Aeronef | undefined {
  const cherchee = normaliserImmatriculation(immatriculation)
  if (!cherchee) return undefined
  return aeronefs.find((a) => normaliserImmatriculation(a.immatriculation) === cherchee)
}

/**
 * L'aéronef d'une fiche, par ordre de fiabilité :
 *  1. celui du vol lié (`vol.aeronef_id`) — un rattachement au référentiel ;
 *  2. l'appareil du parc dont l'immatriculation correspond au texte libre de la fiche ;
 *  3. ce texte libre, tel quel, signalé comme historique ;
 *  4. rien : `null`.
 * `aeronefs` vide (parc pas encore chargé) et vol lié : l'identifiant de l'appareil n'est pas montré
 * brut, on retombe sur le texte libre s'il y en a un.
 */
export function aeronefDeFiche(
  vol: Pick<Vol, 'aeronef_id'> | null | undefined,
  texteLibre: string | null | undefined,
  aeronefs: Aeronef[],
): ValeurRattachement | null {
  const duVol = vol ? aeronefs.find((a) => a.id === vol.aeronef_id) : undefined
  if (duVol) return { texte: libelleAeronef(duVol), historique: false }

  const libre = (texteLibre ?? '').trim()
  const duParc = trouverAeronefParImmatriculation(libre, aeronefs)
  if (duParc) return { texte: libelleAeronef(duParc), historique: false }
  return libre ? { texte: libre, historique: true } : null
}

/**
 * Le site principal d'une fiche :
 *  1. le site rattaché (`siteId`, ou celui du vol lié) — « IHO01 — Ihosy » ;
 *  2. le texte libre historique (`base` d'une prospection, `base_principale` d'un traitement), avec
 *     son numéro de base éventuel — signalé comme historique ;
 *  3. rien : `null`.
 */
export function siteDeFiche(
  siteId: string | null | undefined,
  texteLibre: string | null | undefined,
  numeroBase: number | string | null | undefined,
  sites: SiteAerien[],
): ValeurRattachement | null {
  if (siteId) {
    const site = sites.find((s) => s.id === siteId)
    // Site inconnu du référentiel (référentiel pas encore chargé) : pas d'identifiant brut à l'écran.
    if (site) return { texte: libelleSite(siteId, sites) as string, historique: false }
  }
  const libre = (texteLibre ?? '').trim()
  if (!libre) return null
  const numero = numeroBase != null && numeroBase !== '' ? ` (n° ${numeroBase})` : ''
  return { texte: `${libre}${numero}`, historique: true }
}

/** « 12/08/2026 — Application · 08:00 – 09:30 » : la ligne qui décrit un vol lié. */
export function libelleVolLie(vol: Pick<Vol, 'date_vol' | 'type' | 'heure_debut' | 'heure_fin'>): string {
  return `${formaterDateVol(vol.date_vol)} — ${libelleCategorie(vol.type)} · ${formaterHeure(vol.heure_debut)} – ${formaterHeure(vol.heure_fin)}`
}

/**
 * Faut-il montrer les rattachements aériens d'une prospection ? Seule une prospection menée en
 * aérien en porte : un vol lié, ou les anciens champs texte de l'extensif aérien (base principale,
 * immatriculation). Une prospection terrestre n'affiche pas de lignes « non renseigné » qui ne la
 * concernent pas.
 */
export function prospectionAerienne(prospection: {
  vol_id?: string | null
  immatricule_aeronef?: string | null
  base?: string | null
}): boolean {
  return Boolean(prospection.vol_id || prospection.immatricule_aeronef?.trim() || prospection.base?.trim())
}
