// Logique pure du tableau de bord (maquette §1 —
// `docs/design_handoff_web/Prototype Web IFVM.dc.html`, ligne 85).
//
// La maquette dessine quatre indicateurs, un pipeline de validation, un
// classement de stations et une table d'activité. Tout est dérivé des fiches
// déjà chargées par l'écran : aucun agrégat n'existe côté API, et le calcul
// reste ici pour rester testable sans monter le rendu React.

import { STATUTS, STATUT_LABELS, type Statut } from '@/components/ui/status-badge'

export interface DashboardProspection {
  id: string
  type_prospection: string
  campagne_id: string | null
  station_id: string | null
  /** Localité saisie — tient lieu de station pour les fiches Extensive/Validation. */
  station_libre?: string | null
  prospecteur_id: string
  statut: string
  n_fiche: string | null
  date_prospection: string
  surface_prospectee: number | null
  surface_infestee: number | null
  created_at: string
  updated_at: string
}

export interface DashboardTraitement {
  id: string
  /** Porte le rattachement à la campagne : `traitement` n'a pas de `campagne_id`. */
  prospection_id: string
  numero_fiche: string
  type_traitement: string
  mode_traitement?: string | null
  date_traitement: string
  localite: string
  statut: string
  created_at: string
  updated_at: string
  aerien: {
    pilote: string
    surface_traitee_ha?: number | null
    surface_protegee_ha?: number | null
    /** Deux totaux séparés : chaque rotation garde son unité, jamais convertie. */
    total_pesticide_l?: number | null
    total_pesticide_kg?: number | null
  } | null
  terrestre: {
    surface_traitee_ha?: number | null
    surface_protegee_ha?: number | null
    /** Un seul total par fiche, dans l'unité `pesticide_unite` (colonne historique nommée `_l`). */
    total_pesticide_l?: number | null
    pesticide_unite?: 'L' | 'kg'
    surface_atomiseur_ha?: number | null
    surface_atomiseur_autoporte_ha?: number | null
    surface_disque_rotatif_ha?: number | null
    produits?: { produit_id: string; quantite_l: number }[]
  } | null
  signatures: { role: string; signataire_nom: string }[]
}

export interface DashboardPesticide {
  id: string
  type_produit: string | null
}

export interface DashboardStation {
  id: string
  code: string
  nom: string
}

export function compteProspections(
  prospections: DashboardProspection[],
  type: string,
): number {
  return prospections.filter((p) => p.type_prospection === type).length
}

export function sommeSurfaceProspectee(prospections: DashboardProspection[]): number {
  return prospections.reduce((total, p) => total + (p.surface_prospectee ?? 0), 0)
}

export function sommeSurfaceInfestee(prospections: DashboardProspection[]): number {
  return prospections.reduce((total, p) => total + (p.surface_infestee ?? 0), 0)
}

/**
 * Surface traitée : seul `traitement_terrestre` porte une surface
 * (`surface_traitee_ha`). Le traitement aérien n'expose que le volume de
 * pesticide, et un terrestre peut avoir sa surface encore vide — les compter
 * comme 0 donnerait une couverture faussement basse. Toute fiche sans surface
 * est donc comptée à part, et la légende de la tuile le dit.
 */
export function sommeSurfaceTraitee(traitements: DashboardTraitement[]): {
  total: number
  sansSurface: number
} {
  let total = 0
  let sansSurface = 0
  for (const t of traitements) {
    const surface = t.aerien?.surface_traitee_ha ?? t.terrestre?.surface_traitee_ha
    if (surface != null) total += surface
    else sansSurface++
  }
  return { total, sansSurface }
}

/**
 * Surface traitée / protégée d'une seule fiche. Un traitement ne renseigne
 * qu'une des deux colonnes selon son mode (choc → traitée, barrière →
 * protégée). Partagé avec le graphique d'évolution pour que son dernier point
 * égale toujours le cumul des tuiles.
 */
export function surfaceTraiteeDe(t: DashboardTraitement): number {
  return t.aerien?.surface_traitee_ha ?? t.terrestre?.surface_traitee_ha ?? 0
}

export function surfaceProtegeeDe(t: DashboardTraitement): number {
  return t.aerien?.surface_protegee_ha ?? t.terrestre?.surface_protegee_ha ?? 0
}

export function sommeSurfaceProtegee(traitements: DashboardTraitement[]): number {
  return traitements.reduce((total, t) => total + surfaceProtegeeDe(t), 0)
}

/**
 * Part de `partie` dans `total`, en % arrondi à une décimale ; `null` quand le
 * total est nul, pour que l'écran dise « aucune surface » plutôt qu'un « 0 % »
 * trompeur.
 */
export function pourcentage(partie: number, total: number): number | null {
  if (total <= 0) return null
  return Math.round((partie / total) * 1000) / 10
}

/**
 * Pesticide consommé, en litres et en kilogrammes **sans jamais les convertir**
 * (la densité varie selon le produit). Aérien : deux totaux déjà séparés.
 * Terrestre : un seul total, à ranger dans L ou kg selon `pesticide_unite`.
 */
export function sommePesticide(traitements: DashboardTraitement[]): {
  litres: number
  kilos: number
} {
  let litres = 0
  let kilos = 0
  for (const t of traitements) {
    if (t.aerien) {
      litres += t.aerien.total_pesticide_l ?? 0
      kilos += t.aerien.total_pesticide_kg ?? 0
    }
    if (t.terrestre) {
      const total = t.terrestre.total_pesticide_l ?? 0
      if (t.terrestre.pesticide_unite === 'kg') kilos += total
      else litres += total
    }
  }
  return { litres, kilos }
}

export interface RepartitionDashboard {
  label: string
  valeur: number
  pct: number
}

function repartition(
  valeurs: { label: string; valeur: number }[],
): RepartitionDashboard[] {
  const total = valeurs.reduce((sum, item) => sum + item.valeur, 0)
  return valeurs.map((item) => ({
    ...item,
    pct: total === 0 ? 0 : Math.round((item.valeur / total) * 1000) / 10,
  }))
}

export function repartitionVoies(traitements: DashboardTraitement[]): RepartitionDashboard[] {
  return repartition([
    {
      label: 'Aérien',
      valeur: traitements
        .filter((t) => t.type_traitement === 'AERIEN')
        .reduce((total, t) => total + (t.aerien?.surface_traitee_ha ?? 0) + (t.aerien?.surface_protegee_ha ?? 0), 0),
    },
    {
      label: 'Terrestre',
      valeur: traitements
        .filter((t) => t.type_traitement === 'TERRESTRE')
        .reduce((total, t) => total + (t.terrestre?.surface_traitee_ha ?? 0) + (t.terrestre?.surface_protegee_ha ?? 0), 0),
    },
  ])
}

export function repartitionModes(traitements: DashboardTraitement[]): RepartitionDashboard[] {
  return repartition([
    {
      label: 'Barrière',
      valeur: traitements
        .filter((t) => t.mode_traitement === 'BARRIERE')
        .reduce((total, t) => total + (t.aerien?.surface_protegee_ha ?? t.terrestre?.surface_protegee_ha ?? 0), 0),
    },
    {
      label: 'Couverture totale',
      valeur: traitements
        .filter((t) => t.mode_traitement === 'TOTAL')
        .reduce((total, t) => total + (t.aerien?.surface_traitee_ha ?? t.terrestre?.surface_traitee_ha ?? 0), 0),
    },
    {
      label: 'Autre / non renseigné',
      valeur: traitements
        .filter((t) => t.mode_traitement !== 'BARRIERE' && t.mode_traitement !== 'TOTAL')
        .reduce((total, t) => total + (t.aerien?.surface_traitee_ha ?? t.terrestre?.surface_traitee_ha ?? 0), 0),
    },
  ])
}

export function repartitionProduits(
  traitements: DashboardTraitement[],
  pesticides: DashboardPesticide[],
): RepartitionDashboard[] {
  const types = new Map(pesticides.map((p) => [p.id, p.type_produit]))
  let barriere = 0
  let choc = 0
  let nonClasse = 0
  for (const traitement of traitements) {
    for (const produit of traitement.terrestre?.produits ?? []) {
      if (types.get(produit.produit_id) === 'produit_barriere') barriere += produit.quantite_l
      else if (types.get(produit.produit_id) === 'produit_choc') choc += produit.quantite_l
      else nonClasse += produit.quantite_l
    }
  }
  return repartition([
    { label: 'Barrière', valeur: barriere },
    { label: 'Choc', valeur: choc },
    { label: 'Non classé', valeur: nonClasse },
  ])
}

/**
 * Taux de validation de la maquette (« 91 % » / « 9 % rejetées ») : rapport
 * des fiches statuées, pas du total — une fiche encore en attente n'est ni un
 * succès ni un rejet.
 */
export function tauxValidation(
  prospections: DashboardProspection[],
): { validation: number; rejet: number } | null {
  const validees = prospections.filter((p) => p.statut === 'validee').length
  const rejetees = prospections.filter((p) => p.statut === 'rejetee').length
  const statuees = validees + rejetees
  if (statuees === 0) return null
  const validation = Math.round((validees / statuees) * 100)
  return { validation, rejet: 100 - validation }
}

export interface EtapePipeline {
  statut: Statut
  label: string
  n: number
  pct: number
}

/** Libellés longs du pipeline, plus explicites que le badge de statut. */
const PIPELINE_LABELS: Record<Statut, string> = {
  brouillon: 'Brouillon (mobile, non synchronisé)',
  en_attente: 'En attente de vérification',
  verifiee: 'Vérifiée — en attente validation finale',
  validee: 'Validée',
  rejetee: 'Rejetée',
}

export function buildPipeline(prospections: DashboardProspection[]): EtapePipeline[] {
  const total = prospections.length
  return STATUTS.map((statut) => {
    const n = prospections.filter((p) => p.statut === statut).length
    return {
      statut,
      label: PIPELINE_LABELS[statut] ?? STATUT_LABELS[statut],
      n,
      pct: total === 0 ? 0 : Math.round((n / total) * 100),
    }
  })
}

function indexStations(stations: DashboardStation[]): Map<string, DashboardStation> {
  return new Map(stations.map((s) => [s.id, s]))
}

export interface LigneStation {
  id: string
  code: string
  nom: string
  n: number
  /** Part relative au premier du classement — la barre de la maquette est un rang, pas un taux. */
  pct: number
}

export function buildTopStations(
  prospections: DashboardProspection[],
  stations: DashboardStation[],
  limite = 6,
): LigneStation[] {
  const compteurs = new Map<string, number>()
  for (const p of prospections) {
    if (!p.station_id) continue
    compteurs.set(p.station_id, (compteurs.get(p.station_id) ?? 0) + 1)
  }
  const classement = [...compteurs.entries()].sort((a, b) => b[1] - a[1]).slice(0, limite)
  const max = classement[0]?.[1] ?? 0
  const index = indexStations(stations)
  return classement.map(([id, n]) => {
    const station = index.get(id)
    return {
      id,
      code: station?.code ?? '—',
      nom: station?.nom ?? 'Station inconnue',
      n,
      pct: max === 0 ? 0 : Math.round((n / max) * 100),
    }
  })
}

const MS_PAR_MINUTE = 60_000
const MS_PAR_HEURE = 3_600_000

function deuxChiffres(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Colonne « Reçue » de la maquette : `il y a 20 min`, `il y a 1 h`,
 * `hier 18:40`. L'écart en heures prime jusqu'à 12 h — sans cela une fiche
 * reçue à 23:00 et consultée à 01:00 s'affichait « hier 23:00 » là où la
 * maquette attend « il y a 2 h ». Au-delà, le jour calendaire est plus parlant.
 */
export function formatReception(iso: string, maintenant: Date): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const ecartMs = maintenant.getTime() - date.getTime()
  if (ecartMs < MS_PAR_HEURE) {
    const minutes = Math.max(1, Math.round(ecartMs / MS_PAR_MINUTE))
    return `il y a ${minutes} min`
  }
  const heure = `${deuxChiffres(date.getHours())}:${deuxChiffres(date.getMinutes())}`
  const heures = Math.round(ecartMs / MS_PAR_HEURE)
  if (heures <= 12) return `il y a ${heures} h`
  const hier = new Date(maintenant)
  hier.setDate(hier.getDate() - 1)
  if (date.toDateString() === hier.toDateString()) return `hier ${heure}`
  return `${date.getFullYear()}-${deuxChiffres(date.getMonth() + 1)}-${deuxChiffres(date.getDate())} ${heure}`
}

export interface LigneActivite {
  id: string
  numero: string
  type: string
  agent: string
  lieu: string
  statut: string
  reception: string
  /** Destination du clic sur la ligne — la maquette rend chaque ligne cliquable. */
  lien: string
  /** Horodatage brut, conservé pour l'attribut `dateTime` et les tests. */
  recuLe: string
}

const TYPE_PROSPECTION_LABELS: Record<string, string> = {
  intensive: 'Intensive',
  extensive: 'Extensive',
}

const TYPE_TRAITEMENT_LABELS: Record<string, string> = {
  AERIEN: 'Traitement aérien',
  TERRESTRE: 'Traitement terrestre',
}

export interface OptionsActivite {
  maintenant: Date
  stations: DashboardStation[]
  nomAgent: (id: string | null | undefined) => string
  /** Fenêtre de la maquette : « Dernières 24 h ». */
  fenetreHeures?: number
  limite?: number
}

export function buildActiviteRecente(
  prospections: DashboardProspection[],
  traitements: DashboardTraitement[],
  { maintenant, stations, nomAgent, fenetreHeures = 24, limite = 6 }: OptionsActivite,
): LigneActivite[] {
  const debutFenetre = maintenant.getTime() - fenetreHeures * MS_PAR_HEURE

  const index = indexStations(stations)
  const libelleStation = (id: string | null, stationLibre?: string | null): string => {
    if (!id) return stationLibre?.trim() || '—'
    const station = index.get(id)
    return station ? `${station.code} ${station.nom}` : 'Station inconnue'
  }

  const lignes: LigneActivite[] = [
    ...prospections.map((p) => ({
      id: p.id,
      numero: p.n_fiche ?? p.id.slice(0, 8) + '…',
      type: TYPE_PROSPECTION_LABELS[p.type_prospection] ?? p.type_prospection,
      agent: nomAgent(p.prospecteur_id),
      lieu: libelleStation(p.station_id, p.station_libre),
      statut: p.statut,
      recuLe: p.created_at ?? p.updated_at,
      lien: `/prospections/${p.id}`,
      reception: '',
    })),
    ...traitements.map((t) => ({
      id: t.id,
      numero: t.numero_fiche,
      type: TYPE_TRAITEMENT_LABELS[t.type_traitement] ?? t.type_traitement,
      // Le traitement n'a pas de prospecteur : la maquette y affiche le
      // responsable, que porte la première signature (ou le pilote en aérien).
      agent: t.signatures[0]?.signataire_nom ?? t.aerien?.pilote ?? '—',
      lieu: t.localite,
      statut: t.statut,
      recuLe: t.created_at ?? t.updated_at,
      lien: '/traitements',
      reception: '',
    })),
  ]

  return lignes
    .filter((l) => {
      const recu = new Date(l.recuLe).getTime()
      return !Number.isNaN(recu) && recu >= debutFenetre && recu <= maintenant.getTime()
    })
    .sort((a, b) => (a.recuLe < b.recuLe ? 1 : -1))
    .slice(0, limite)
    .map((l) => ({ ...l, reception: formatReception(l.recuLe, maintenant) }))
}
