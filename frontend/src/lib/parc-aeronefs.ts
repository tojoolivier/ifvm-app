import type { AxiosError } from 'axios'
import type { components } from '@/lib/api-schema.generated'

// Types tirés du contrat OpenAPI (généré par `npm run generate:api-types`) — jamais recopiés à la
// main, même règle que côté mobile (CLAUDE.md, « Contrat API mobile ↔ backend »).
export type Aeronef = components['schemas']['AeronefRead']
export type Affectation = components['schemas']['AffectationAeronefRead']
export type EquipeParc = components['schemas']['EquipeRead']

const MS_PAR_JOUR = 24 * 60 * 60 * 1000

/** Date du jour au format ISO (AAAA-MM-JJ), en heure locale — celle qu'un `<input type="date">` manipule. */
export function aujourdhuiIso(maintenant: Date = new Date()): string {
  const mois = String(maintenant.getMonth() + 1).padStart(2, '0')
  const jour = String(maintenant.getDate()).padStart(2, '0')
  return `${maintenant.getFullYear()}-${mois}-${jour}`
}

/** « 2026-07-01 » → « 01/07/2026 ». Renvoie la valeur telle quelle si elle n'est pas une date ISO. */
export function formaterDate(iso: string): string {
  const morceaux = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return morceaux ? `${morceaux[3]}/${morceaux[2]}/${morceaux[1]}` : iso
}

function enJours(iso: string): number {
  const [annee, mois, jour] = iso.slice(0, 10).split('-').map(Number)
  return Date.UTC(annee, mois - 1, jour) / MS_PAR_JOUR
}

/** Une affectation est « en cours » tant qu'elle n'a pas de date de fin (`date_fin: null`, #603). */
export function estEnCours(affectation: Pick<Affectation, 'date_fin'>): boolean {
  return affectation.date_fin == null
}

export interface BarreFrise {
  /** Position de départ, en % de la largeur de la frise. */
  gauche: number
  /** Largeur, en % (au moins `LARGEUR_MIN_PCT`, pour qu'une affectation d'un jour reste visible). */
  largeur: number
}

export interface Frise {
  /** Bornes de la frise : de la plus ancienne date de début à la plus tardive des fins (ou d'aujourd'hui). */
  debut: string
  fin: string
  barres: BarreFrise[]
}

export const LARGEUR_MIN_PCT = 2

/**
 * Frise temporelle des affectations : chaque affectation devient une barre positionnée entre la plus
 * ancienne date de début et la fin la plus tardive. Une affectation en cours va jusqu'à aujourd'hui.
 * Les barres sont rendues dans l'ordre reçu (`barres[i]` ↔ `affectations[i]`).
 */
export function calculerFrise(
  affectations: Pick<Affectation, 'date_debut' | 'date_fin'>[],
  aujourdhui: string,
): Frise {
  if (affectations.length === 0) return { debut: aujourdhui, fin: aujourdhui, barres: [] }

  const debuts = affectations.map((a) => enJours(a.date_debut))
  const fins = affectations.map((a) => enJours(a.date_fin ?? aujourdhui))
  const debutJours = Math.min(...debuts)
  // Une affectation pas encore commencée (début futur) ne doit pas sortir de la frise.
  const finJours = Math.max(...fins, ...debuts)
  const etendue = Math.max(finJours - debutJours, 1)

  const barres = affectations.map((_, index) => {
    const debut = debuts[index]
    const fin = Math.max(fins[index], debut)
    // La barre minimale ne doit pas déborder à droite : on ramène d'abord son départ, puis sa largeur.
    const gauche = Math.min(((debut - debutJours) / etendue) * 100, 100 - LARGEUR_MIN_PCT)
    const largeur = Math.min(Math.max(((fin - debut) / etendue) * 100, LARGEUR_MIN_PCT), 100 - gauche)
    return { gauche, largeur }
  })

  const iso = (jours: number) => new Date(jours * MS_PAR_JOUR).toISOString().slice(0, 10)
  return { debut: iso(debutJours), fin: iso(finJours), barres }
}

/** L'appareil actuellement en service dans une équipe (l'API expose l'affectation en cours dans `aeronef`). */
export function equipeEnServiceDe(aeronefId: string, equipes: EquipeParc[]): EquipeParc | undefined {
  return equipes.find((equipe) => equipe.actif && equipe.aeronef?.id === aeronefId)
}

type ErreurApi = AxiosError<{ detail?: unknown }> | undefined

function detailDe(erreur: unknown): string {
  const detail = (erreur as ErreurApi)?.response?.data?.detail
  return typeof detail === 'string' ? detail : ''
}

function statutDe(erreur: unknown): number | undefined {
  return (erreur as ErreurApi)?.response?.status
}

/**
 * Message lisible d'une erreur de création / modification d'un appareil. Le backend répond 409 avec
 * « immatriculation déjà utilisée par un autre aéronef : 5R-MJA » quand l'immatriculation existe déjà.
 */
export function messageErreurAeronef(erreur: unknown): string {
  const detail = detailDe(erreur)
  if (statutDe(erreur) === 409 && detail.startsWith('immatriculation déjà utilisée')) {
    const immatriculation = detail.split(':').slice(1).join(':').trim()
    return immatriculation
      ? `L'immatriculation « ${immatriculation} » est déjà utilisée par un autre appareil du parc.`
      : "Cette immatriculation est déjà utilisée par un autre appareil du parc."
  }
  if (statutDe(erreur) === 403) return 'Seul un administrateur peut modifier le parc aéronefs.'
  return detail || "Impossible d'enregistrer cet appareil."
}

/**
 * Message lisible d'une erreur d'affectation ou de clôture (422 : « le calendrier ne tient pas »,
 * 409 : affectation déjà clôturée, 404 : introuvable).
 */
export function messageErreurAffectation(erreur: unknown): string {
  const detail = detailDe(erreur)
  const statut = statutDe(erreur)
  if (detail.startsWith('aéronef déjà affecté')) {
    return 'Cet appareil est déjà affecté à une équipe sur une période qui chevauche celle-ci.'
  }
  if (detail.startsWith("l'équipe a déjà un aéronef")) {
    return 'Cette équipe a déjà un appareil sur une période qui chevauche celle-ci.'
  }
  if (detail.startsWith('un aéronef ne s’affecte') || detail.startsWith("un aéronef ne s'affecte")) {
    return 'Un appareil ne peut être affecté qu’à une équipe aérienne.'
  }
  if (detail.startsWith("période d'affectation invalide")) {
    return 'Les dates ne sont pas valides : la date de fin doit être postérieure ou égale à la date de début.'
  }
  if (statut === 409 && detail.startsWith('affectation déjà clôturée')) {
    return 'Cette affectation est déjà clôturée.'
  }
  if (statut === 404) return detail || 'Affectation introuvable.'
  return detail || "Impossible d'enregistrer cette affectation."
}
