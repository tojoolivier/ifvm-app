import type { AxiosError } from 'axios'
import type { components } from '@/lib/api-schema.generated'

// Types tirés du contrat OpenAPI (généré par `npm run generate:api-types`) — jamais recopiés à la
// main, même règle que côté mobile (CLAUDE.md, « Contrat API mobile ↔ backend »).
export type Solde = components['schemas']['SoldePesticideRead']
export type Mouvement = components['schemas']['MouvementPesticideRead']
export type Pesticide = components['schemas']['PesticideRead']
export type SiteAerien = components['schemas']['SiteAerienneRead']
export type MouvementCreate = components['schemas']['MouvementPesticideCreate']

export const TYPES_MOUVEMENT = ['approvisionnement', 'transfert', 'consommation'] as const
export type TypeMouvement = (typeof TYPES_MOUVEMENT)[number]

/** Types qu'on saisit à la main : la consommation vient toujours d'une fiche de traitement (#609). */
export const TYPES_SAISISSABLES = ['approvisionnement', 'transfert'] as const
export type TypeSaisissable = (typeof TYPES_SAISISSABLES)[number]

export const UNITES = ['L', 'kg'] as const
export type Unite = (typeof UNITES)[number]

export const LIBELLE_TYPE_MOUVEMENT: Record<TypeMouvement, string> = {
  approvisionnement: 'Approvisionnement',
  transfert: 'Transfert',
  consommation: 'Consommation',
}

/** Teinte de la pastille de chaque type (palette `ifvm-*`, trio fond / texte / bordure). */
export const TEINTE_TYPE_MOUVEMENT: Record<TypeMouvement, string> = {
  approvisionnement: 'border-ifvm-green-border bg-ifvm-green-bg text-ifvm-green-text',
  transfert: 'border-[#c9d8e8] bg-[#eef4fa] text-[#2c5a87]',
  consommation: 'border-ifvm-amber-border bg-ifvm-amber-bg text-ifvm-amber-text',
}

export function libelleTypeMouvement(type: string): string {
  return LIBELLE_TYPE_MOUVEMENT[type as TypeMouvement] ?? type
}

/** « 1250,5 » : au plus deux décimales (colonnes NUMERIC(10,2)), virgule décimale, sans zéros inutiles. */
export function formaterQuantite(quantite: number): string {
  return String(Math.round(quantite * 100) / 100).replace('.', ',')
}

/** « IHO01 — Ihosy » ; l'identifiant si le site est inconnu du référentiel. */
export function libelleSite(siteId: string | null | undefined, sites: SiteAerien[]): string {
  if (!siteId) return '—'
  const site = sites.find((s) => s.id === siteId)
  return site ? `${site.numero} — ${site.localite}` : siteId
}

/** « FEN-01 — Fenitrothion » ; l'identifiant si le produit est inconnu du référentiel. */
export function libelleProduit(pesticideId: string, pesticides: Pesticide[]): string {
  const pesticide = pesticides.find((p) => p.id === pesticideId)
  return pesticide ? `${pesticide.code} — ${pesticide.nom}` : pesticideId
}

/**
 * Le stock est tenu au niveau des sites aériens PRINCIPAUX (`parent_site_id` nul) : un stand ou une
 * base secondaire n'en porte pas (le backend refuse le mouvement, `SiteNonPrincipalError`, #606).
 */
export function sitesPrincipaux(sites: SiteAerien[]): SiteAerien[] {
  return sites.filter((s) => s.parent_site_id === null)
}

/**
 * Soldes triés par site, produit puis unité. Un site ou un produit peut porter plusieurs unités :
 * chaque (site, produit, unité) reste UNE ligne — le litre et le kilo ne s'additionnent jamais.
 */
export function trierSoldes(soldes: Solde[], sites: SiteAerien[], pesticides: Pesticide[]): Solde[] {
  const cle = (s: Solde) =>
    [libelleSite(s.site_id, sites), libelleProduit(s.pesticide_id, pesticides), s.unite].join('\u0000')
  return [...soldes].sort((a, b) => cle(a).localeCompare(cle(b), 'fr'))
}

export function estSoldeNegatif(solde: Pick<Solde, 'quantite'>): boolean {
  return solde.quantite < 0
}

export interface FiltresStock {
  type: TypeMouvement | ''
  siteId: string
  pesticideId: string
  /** Bornes de la période du journal, incluses (AAAA-MM-JJ). */
  dateDebut: string
  dateFin: string
}

export const FILTRES_STOCK_VIDES: FiltresStock = {
  type: '',
  siteId: '',
  pesticideId: '',
  dateDebut: '',
  dateFin: '',
}

export function filtresStockActifs(filtres: FiltresStock): boolean {
  return Object.values(filtres).some((valeur) => valeur !== '')
}

/** Paramètres de `GET /mouvements-pesticide` : seuls les filtres renseignés sont envoyés. */
export function paramsJournal(filtres: FiltresStock): Record<string, string> {
  const params: Record<string, string> = {}
  if (filtres.type) params.type = filtres.type
  if (filtres.siteId) params.site_id = filtres.siteId
  if (filtres.pesticideId) params.pesticide_id = filtres.pesticideId
  if (filtres.dateDebut) params.date_debut = filtres.dateDebut
  if (filtres.dateFin) params.date_fin = filtres.dateFin
  return params
}

/** Paramètres de `GET /stock-pesticide/solde` : le solde ne connaît que le site et le produit. */
export function paramsSolde(filtres: FiltresStock): Record<string, string> {
  const params: Record<string, string> = {}
  if (filtres.siteId) params.site_id = filtres.siteId
  if (filtres.pesticideId) params.pesticide_id = filtres.pesticideId
  return params
}

// --- Saisie d'un mouvement --------------------------------------------------------------------

export interface FormulaireMouvement {
  type: TypeSaisissable
  pesticideId: string
  siteId: string
  siteDestinationId: string
  /** Saisie brute : virgule ou point décimal. */
  quantite: string
  unite: Unite
  /** AAAA-MM-JJ ; vide = la date du jour, côté serveur. */
  date: string
}

export const FORMULAIRE_MOUVEMENT_VIDE: FormulaireMouvement = {
  type: 'approvisionnement',
  pesticideId: '',
  siteId: '',
  siteDestinationId: '',
  quantite: '',
  unite: 'L',
  date: '',
}

/** « 12,5 » → 12.5 ; `NaN` si la saisie n'est pas un nombre. */
export function lireQuantite(saisie: string): number {
  return Number(saisie.trim().replace(',', '.'))
}

/**
 * Erreurs de saisie lisibles, avant tout envoi. Le serveur reste juge (422) : ces contrôles évitent
 * un aller-retour pour les oublis évidents.
 */
export function validerMouvement(formulaire: FormulaireMouvement): string[] {
  const erreurs: string[] = []
  if (!formulaire.pesticideId) erreurs.push('Choisissez le produit.')
  if (!formulaire.siteId) erreurs.push(formulaire.type === 'transfert' ? 'Choisissez le site source.' : 'Choisissez le site.')

  if (formulaire.type === 'transfert') {
    if (!formulaire.siteDestinationId) {
      erreurs.push('Choisissez le site de destination.')
    } else if (formulaire.siteDestinationId === formulaire.siteId) {
      erreurs.push('Le site de destination doit être différent du site source.')
    }
  }

  const quantite = lireQuantite(formulaire.quantite)
  if (!formulaire.quantite.trim() || !Number.isFinite(quantite) || quantite <= 0) {
    erreurs.push('La quantité doit être un nombre supérieur à 0.')
  }
  return erreurs
}

/** Corps de `POST /mouvements-pesticide` — `site_destination_id` seulement pour un transfert. */
export function construireMouvement(formulaire: FormulaireMouvement): MouvementCreate {
  const estTransfert = formulaire.type === 'transfert'
  return {
    type: formulaire.type,
    pesticide_id: formulaire.pesticideId,
    site_id: formulaire.siteId,
    ...(estTransfert ? { site_destination_id: formulaire.siteDestinationId } : {}),
    quantite: lireQuantite(formulaire.quantite),
    unite: formulaire.unite,
    ...(formulaire.date ? { date_mouvement: formulaire.date } : {}),
  }
}

type ErreurApi = AxiosError<{ detail?: unknown }> | undefined

/**
 * Message lisible d'un refus de `POST /mouvements-pesticide` : 403 (droit de saisie), 404 (site ou
 * produit introuvable), 409 (identifiant déjà pris), 422 (règles du stock, ou validation du corps —
 * `detail` est alors une liste d'erreurs Pydantic).
 */
export function messageErreurMouvement(erreur: unknown): string {
  const reponse = (erreur as ErreurApi)?.response
  const detail = reponse?.data?.detail
  const statut = reponse?.status

  if (statut === 403) return 'Seuls les chefs de base et les administrateurs peuvent enregistrer un mouvement de stock.'

  if (Array.isArray(detail)) {
    const concerneQuantite = detail.some((d) => Array.isArray(d?.loc) && d.loc.includes('quantite'))
    if (concerneQuantite) return 'La quantité doit être un nombre supérieur à 0.'
    const premier = detail.find((d) => typeof d?.msg === 'string')
    return premier ? String(premier.msg).replace(/^Value error, /, '') : "Le mouvement n'est pas valide."
  }

  if (typeof detail === 'string') {
    if (detail.startsWith('le stock de pesticides est rattaché au site aérien principal')) {
      return 'Le stock est tenu au niveau des sites principaux : ce site est un stand ou une base secondaire.'
    }
    if (detail.includes('site_destination_id est requis')) return 'Choisissez le site de destination du transfert.'
    if (detail.includes('ne doit être renseigné que pour un transfert')) {
      return "Un site de destination n'a de sens que pour un transfert."
    }
    if (statut === 404 && detail.startsWith('site introuvable')) return 'Site introuvable : rechargez la page.'
    if (statut === 404 && detail.includes('pesticide_id introuvable')) return 'Produit introuvable : rechargez la page.'
    if (statut === 409) return 'Ce mouvement a déjà été enregistré.'
    return detail
  }
  return "Impossible d'enregistrer ce mouvement."
}
