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
  prospecteur_id: string
  statut: string
  n_fiche: string | null
  n_releve: string | null
  date_prospection: string
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
  date_traitement: string
  localite: string
  statut: string
  created_at: string
  updated_at: string
  aerien: { pilote: string } | null
  terrestre: { surface_traitee_ha: number | null } | null
  signatures: { role: string; signataire_nom: string }[]
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
    const surface = t.terrestre?.surface_traitee_ha
    if (surface != null) total += surface
    else sansSurface++
  }
  return { total, sansSurface }
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
  const libelleStation = (id: string | null): string => {
    if (!id) return '—'
    const station = index.get(id)
    return station ? `${station.code} ${station.nom}` : 'Station inconnue'
  }

  const lignes: LigneActivite[] = [
    ...prospections.map((p) => ({
      id: p.id,
      numero: p.n_fiche ?? p.n_releve ?? p.id.slice(0, 8) + '…',
      type: TYPE_PROSPECTION_LABELS[p.type_prospection] ?? p.type_prospection,
      agent: nomAgent(p.prospecteur_id),
      lieu: libelleStation(p.station_id),
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
