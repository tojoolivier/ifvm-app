// Détail des populations d'une fiche de prospection (par espèce LMC/NSE et par
// catégorie imago/larve) — reprend ligne pour ligne le récapitulatif Extensif
// du téléphone (mobile/src/app/(prospection)/extensive-recap.tsx), pour que la
// fiche vue sur le web soit aussi complète que celle relue sur le terrain.
//
// Jusqu'ici la page de détail ne lisait des populations que les densités :
// captures par phase, stades, larves par stade, accouplement, ponte,
// interdistance, type de cible, direction, état… arrivaient bien en base mais
// n'étaient affichés nulle part.

export const TIRET = '—'

export interface PopulationDetailRead {
  espece: string
  categorie: string
  captures_nombre?: number | null
  densite_diffuse?: number | null
  densite_groupee?: number | null
  accouplement?: string | null
  ponte?: string | null
  captures_sol?: number | null
  captures_trans?: number | null
  captures_greg?: number | null
  captures_solitaro_transiens?: number | null
  /** Répartition par sexe/sous-stade (femelleA1…) — objet côté API. */
  stades_imago?: Record<string, number> | null
  /** Effectif par stade larvaire (L1…L7) — objet côté API. */
  densites_larve?: Record<string, number> | null
  tache_larvaire?: boolean | null
  bande_larvaire?: boolean | null
  interdistance?: number | null
  deplacement?: string | null
  surface_contaminee_ha?: number | null
  type_cible?: string[] | null
  direction_de?: string | null
  direction_vers?: string | null
  etat?: string | null
  essaim_en_vol?: boolean | null
  essaim_pose?: boolean | null
}

export interface LignePopulation {
  k: string
  v: string
}

export interface GroupePopulation {
  /** Ex. « LMC · Imagos » */
  titre: string
  espece: string
  categorie: string
  lignes: LignePopulation[]
}

const ORDRE_ESPECES = ['LMC', 'NSE']

const INTENSITE_LABELS: Record<string, string> = { neant: 'Néant', rare: 'Rare', beaucoup: 'Beaucoup' }
const TYPE_CIBLE_LABELS: Record<string, string> = { vol_clair: 'Vol clair', dense: 'Dense', tres_dense: 'Très dense' }
const COMPASS_LABELS: Record<string, string> = {
  N: 'Nord',
  NE: 'Nord-Est',
  E: 'Est',
  SE: 'Sud-Est',
  S: 'Sud',
  SO: 'Sud-Ouest',
  O: 'Ouest',
  NO: 'Nord-Ouest',
}

function nombre(v: number | null | undefined): string {
  return v == null ? TIRET : v.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
}

function intensite(v: string | null | undefined): string {
  return v ? (INTENSITE_LABELS[v] ?? v) : TIRET
}

/** « femelleA1 3 · maleA1 4 » — les stades à 0 sont omis, comme sur le téléphone. */
function repartition(obj: Record<string, number> | null | undefined): string {
  const nonNuls = Object.entries(obj ?? {}).filter(([, v]) => v > 0)
  return nonNuls.length > 0 ? nonNuls.map(([stade, v]) => `${stade} ${nombre(v)}`).join(' · ') : TIRET
}

function direction(de: string | null | undefined, vers: string | null | undefined): string {
  const label = (c: string) => COMPASS_LABELS[c] ?? c
  if (de && vers) return `de ${label(de)} vers ${label(vers)}`
  if (de) return `vers ${label(de)}`
  if (vers) return `vers ${label(vers)}`
  return TIRET
}

function phases(p: PopulationDetailRead): string {
  const valeurs = [p.captures_sol, p.captures_trans, p.captures_solitaro_transiens, p.captures_greg]
  if (valeurs.every((v) => v == null)) return TIRET
  return (
    `Sol. ${nombre(p.captures_sol ?? 0)} · Trans. ${nombre(p.captures_trans ?? 0)} · ` +
    `Sol-Trans. ${nombre(p.captures_solitaro_transiens ?? 0)} · Grég. ${nombre(p.captures_greg ?? 0)}`
  )
}

function aDesStades(obj: Record<string, number> | null | undefined): boolean {
  return Object.values(obj ?? {}).some((v) => v > 0)
}

function imagoADesDonnees(p: PopulationDetailRead): boolean {
  return (
    (p.captures_nombre ?? 0) > 0 ||
    [p.captures_sol, p.captures_trans, p.captures_solitaro_transiens, p.captures_greg].some((v) => (v ?? 0) > 0) ||
    aDesStades(p.stades_imago) ||
    !!p.accouplement ||
    !!p.ponte ||
    p.interdistance != null ||
    (p.type_cible ?? []).length > 0 ||
    !!p.direction_de ||
    !!p.direction_vers ||
    !!p.etat ||
    !!p.essaim_en_vol ||
    !!p.essaim_pose ||
    p.densite_diffuse != null ||
    p.densite_groupee != null
  )
}

function larveADesDonnees(p: PopulationDetailRead): boolean {
  return (
    (p.captures_nombre ?? 0) > 0 ||
    aDesStades(p.densites_larve) ||
    p.interdistance != null ||
    p.surface_contaminee_ha != null ||
    !!p.tache_larvaire ||
    !!p.bande_larvaire ||
    !!p.deplacement ||
    p.densite_diffuse != null ||
    p.densite_groupee != null
  )
}

function lignesImago(p: PopulationDetailRead): LignePopulation[] {
  return [
    { k: 'Nombre de captures', v: nombre(p.captures_nombre) },
    { k: 'Phases', v: phases(p) },
    { k: 'Stades', v: repartition(p.stades_imago) },
    { k: 'Accouplement', v: intensite(p.accouplement) },
    { k: 'Ponte', v: intensite(p.ponte) },
    { k: 'Interdistance (m)', v: nombre(p.interdistance) },
    { k: 'Type de cible', v: (p.type_cible ?? []).map((c) => TYPE_CIBLE_LABELS[c] ?? c).join(', ') || TIRET },
    { k: 'Direction du déplacement', v: direction(p.direction_de, p.direction_vers) },
    { k: 'État', v: p.etat === 'repos' ? 'Repos' : p.etat === 'deplacement' ? 'Déplacement' : TIRET },
    { k: 'Comportement de l’essaim', v: p.essaim_en_vol ? 'En vol' : p.essaim_pose ? 'Posé' : TIRET },
    { k: 'Densité diffuse', v: p.densite_diffuse != null ? `${nombre(p.densite_diffuse)} ind./ha` : TIRET },
    { k: 'Densité groupée', v: p.densite_groupee != null ? `${nombre(p.densite_groupee)} ind./m²` : TIRET },
  ]
}

function lignesLarve(p: PopulationDetailRead): LignePopulation[] {
  const autres = [
    p.tache_larvaire ? 'Tache larvaire' : null,
    p.bande_larvaire ? 'Bande larvaire' : null,
    p.deplacement ? `Déplacement : ${p.deplacement === 'perchee' ? 'Perchée' : 'Repos'}` : null,
  ].filter(Boolean)
  return [
    { k: 'Nombre de captures', v: nombre(p.captures_nombre) },
    { k: 'Stades renseignés', v: repartition(p.densites_larve) },
    { k: 'Interdistance (m)', v: nombre(p.interdistance) },
    { k: 'Surface contaminée (ha)', v: nombre(p.surface_contaminee_ha) },
    { k: 'Densité diffuse', v: p.densite_diffuse != null ? `${nombre(p.densite_diffuse)} ind./ha` : TIRET },
    { k: 'Densité groupée', v: p.densite_groupee != null ? `${nombre(p.densite_groupee)} ind./m²` : TIRET },
    { k: 'Autres informations', v: autres.length > 0 ? autres.join(' · ') : TIRET },
  ]
}

/**
 * Un groupe par (espèce, catégorie) ayant au moins une donnée saisie, dans
 * l'ordre LMC imago, LMC larve, NSE imago, NSE larve. Chaque ligne du
 * récapitulatif du téléphone est affichée, même « — » : ne jamais masquer un
 * champ silencieusement. Seul le groupe entier est omis quand l'espèce n'a
 * strictement aucune donnée (jamais ouverte).
 */
export function buildPopulationsDetail(populations: PopulationDetailRead[]): GroupePopulation[] {
  const especes = [
    ...ORDRE_ESPECES,
    ...[...new Set(populations.map((p) => p.espece))].filter((e) => !ORDRE_ESPECES.includes(e)).sort(),
  ]
  const groupes: GroupePopulation[] = []
  for (const espece of especes) {
    for (const categorie of ['imago', 'larve'] as const) {
      const p = populations.find((x) => x.espece === espece && x.categorie === categorie)
      if (!p) continue
      const aDesDonnees = categorie === 'imago' ? imagoADesDonnees(p) : larveADesDonnees(p)
      if (!aDesDonnees) continue
      groupes.push({
        titre: `${espece} · ${categorie === 'imago' ? 'Imagos' : 'Larves'}`,
        espece,
        categorie,
        lignes: categorie === 'imago' ? lignesImago(p) : lignesLarve(p),
      })
    }
  }
  return groupes
}
