import type { components } from '@/lib/api-schema.generated'

// Types tirés du contrat OpenAPI (généré par `npm run generate:api-types`) — jamais recopiés à la
// main, même règle que côté mobile (CLAUDE.md, « Contrat API mobile ↔ backend »).
export type Vol = components['schemas']['VolRead']
export type CategorieVol = components['schemas']['VolCreate']['type']
export type SiteAerien = components['schemas']['SiteAerienneRead']

export const CATEGORIES_VOL: CategorieVol[] = ['mise_en_place', 'application', 'convoyage', 'prospection', 'divers']

/** Libellés des catégories — mêmes mots que l'app mobile (`(app)/vols.tsx`). */
export const LIBELLE_CATEGORIE: Record<CategorieVol, string> = {
  mise_en_place: 'Mise en place',
  application: 'Application',
  convoyage: 'Convoyage',
  prospection: 'Prospection',
  divers: 'Divers',
}

/** Teinte de la pastille de chaque catégorie (palette `ifvm-*`, trio fond / texte / bordure). */
export const TEINTE_CATEGORIE: Record<CategorieVol, string> = {
  mise_en_place: 'border-[#e0d9c4] bg-ifvm-brouillon-bg text-ifvm-text-tertiary',
  application: 'border-ifvm-green-border bg-ifvm-green-bg text-ifvm-green-text',
  convoyage: 'border-ifvm-amber-border bg-ifvm-amber-bg text-ifvm-amber-text',
  prospection: 'border-[#c9d8e8] bg-[#eef4fa] text-[#2c5a87]',
  divers: 'border-[#e0d9c4] bg-ifvm-brouillon-bg text-ifvm-text-tertiary',
}

export function libelleCategorie(type: string): string {
  return LIBELLE_CATEGORIE[type as CategorieVol] ?? type
}

/** « 08:05:00 » (ou « 08:05 ») → minutes depuis minuit. `NaN` pour une valeur illisible. */
function enMinutes(heure: string): number {
  const [h, m] = heure.split(':').map(Number)
  return h * 60 + m
}

/** « 08:05:00 » → « 08:05 ». */
export function formaterHeure(heure: string): string {
  return heure.slice(0, 5)
}

/** « 2026-07-01 » → « 01/07/2026 ». Renvoie la valeur telle quelle si elle n'est pas une date ISO. */
export function formaterDateVol(iso: string): string {
  const morceaux = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return morceaux ? `${morceaux[3]}/${morceaux[2]}/${morceaux[1]}` : iso
}

/**
 * Durée d'un vol en minutes. Le backend la dérive à la lecture (`VolRead.duree_minutes`, jamais
 * stockée, cf. #608) : c'est la référence. À défaut (donnée partielle), on la recalcule depuis les
 * heures, `heure_fin − heure_debut` — le serveur refuse une fin qui n'est pas postérieure au début.
 */
export function dureeMinutes(
  vol: Pick<Vol, 'heure_debut' | 'heure_fin'> & { duree_minutes?: number | null },
): number {
  if (typeof vol.duree_minutes === 'number' && Number.isFinite(vol.duree_minutes)) {
    return Math.max(vol.duree_minutes, 0)
  }
  const duree = enMinutes(vol.heure_fin) - enMinutes(vol.heure_debut)
  return Number.isFinite(duree) ? Math.max(duree, 0) : 0
}

/** 150 → « 2 h 30 » ; 45 → « 45 min » ; 120 → « 2 h » ; 0 → « 0 min ». */
export function formaterDuree(minutes: number): string {
  const heures = Math.floor(minutes / 60)
  const reste = minutes % 60
  if (heures === 0) return `${reste} min`
  return reste === 0 ? `${heures} h` : `${heures} h ${String(reste).padStart(2, '0')}`
}

export interface FiltresVols {
  categorie: CategorieVol | ''
  equipeId: string
  aeronefId: string
  /** Bornes de la période, incluses (AAAA-MM-JJ). Vide = pas de borne. */
  dateDebut: string
  dateFin: string
}

export const FILTRES_VIDES: FiltresVols = { categorie: '', equipeId: '', aeronefId: '', dateDebut: '', dateFin: '' }

export function filtresActifs(filtres: FiltresVols): boolean {
  return Object.values(filtres).some((valeur) => valeur !== '')
}

/** Vols correspondant aux filtres, du plus récent au plus ancien (date puis heure de début). */
export function filtrerVols(vols: Vol[], filtres: FiltresVols): Vol[] {
  return vols
    .filter(
      (vol) =>
        (!filtres.categorie || vol.type === filtres.categorie) &&
        (!filtres.equipeId || vol.equipe_id === filtres.equipeId) &&
        (!filtres.aeronefId || vol.aeronef_id === filtres.aeronefId) &&
        (!filtres.dateDebut || vol.date_vol >= filtres.dateDebut) &&
        (!filtres.dateFin || vol.date_vol <= filtres.dateFin),
    )
    .sort((a, b) => b.date_vol.localeCompare(a.date_vol) || b.heure_debut.localeCompare(a.heure_debut))
}

/** Total des heures de vol, en minutes, de la liste donnée. */
export function totalMinutes(
  vols: (Pick<Vol, 'heure_debut' | 'heure_fin'> & { duree_minutes?: number | null })[],
): number {
  return vols.reduce((total, vol) => total + dureeMinutes(vol), 0)
}

export interface LigneChamp {
  libelle: string
  valeur: string
}

/** « IHO01 — Ihosy » pour un site, « — » s'il n'y en a pas, l'identifiant s'il est inconnu du référentiel. */
export function libelleSite(siteId: string | null, sites: SiteAerien[]): string | null {
  if (!siteId) return null
  const site = sites.find((s) => s.id === siteId)
  return site ? `${site.numero} — ${site.localite}` : siteId
}

/**
 * Champs propres à la catégorie d'un vol (§5.3, §5.5, §6 du document de cadrage) :
 *  - mise en place et application : site principal, stand de remplissage, base secondaire ;
 *  - convoyage : motif, lieux de départ et d'arrivée ;
 *  - divers : motif ;
 *  - prospection : les sites éventuellement renseignés.
 * Les champs facultatifs vides sont omis ; les obligatoires de la catégorie s'affichent toujours
 * (« Non renseigné » si le serveur ne les a pas).
 */
export function champsSpecifiques(vol: Vol, sites: SiteAerien[]): LigneChamp[] {
  const lignes: LigneChamp[] = []
  const site = (libelle: string, id: string | null, obligatoire: boolean) => {
    const valeur = libelleSite(id, sites)
    if (valeur) lignes.push({ libelle, valeur })
    else if (obligatoire) lignes.push({ libelle, valeur: 'Non renseigné' })
  }
  const texte = (libelle: string, valeur: string | null, obligatoire: boolean) => {
    if (valeur) lignes.push({ libelle, valeur })
    else if (obligatoire) lignes.push({ libelle, valeur: 'Non renseigné' })
  }

  switch (vol.type) {
    case 'mise_en_place':
    case 'application':
      site('Site principal', vol.site_principal_id, true)
      site('Stand de remplissage', vol.stand_id, true)
      site('Base secondaire', vol.base_secondaire_id, false)
      break
    case 'convoyage':
      texte('Motif', vol.motif, true)
      texte('Lieu de départ', vol.lieu_depart, true)
      texte('Lieu d’arrivée', vol.lieu_arrivee, true)
      break
    case 'divers':
      texte('Motif', vol.motif, true)
      break
    default:
      site('Site principal', vol.site_principal_id, false)
      site('Stand de remplissage', vol.stand_id, false)
      site('Base secondaire', vol.base_secondaire_id, false)
  }
  return lignes
}

/** Seul un vol d'application peut porter un traitement aérien (#610, `ck_vol_traitement_type`). */
export function peutPorterTraitement(vol: Pick<Vol, 'type'>): boolean {
  return vol.type === 'application'
}

/** Seul un vol de prospection peut être relié à des fiches de prospection (#610). */
export function peutPorterProspections(vol: Pick<Vol, 'type'>): boolean {
  return vol.type === 'prospection'
}
