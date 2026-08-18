// Logique pure d'agrégation et d'export pour l'écran « Synthèses & export »
// (maquette §9 — `docs/design_handoff_web/Prototype Web IFVM.dc.html`, ligne 817).
// Toutes les valeurs sont dérivées des fiches déjà chargées par SynthesesPage :
// aucun appel API supplémentaire, aucun recalcul divergent d'un écran à l'autre.

import type { CaptureRead, PopulationRead } from './prospection-fiche-lecture'

export interface SyntheseProspection {
  id: string
  campagne_id: string
  station_id: string | null
  prospecteur_id: string
  statut: string
  n_fiche: string | null
  date_prospection: string
  region: string | null
  district: string | null
  commune: string | null
  latitude: number | null
  longitude: number | null
  surface_prospectee: number | null
  surface_infestee: number | null
  updated_at: string
  populations: PopulationRead[]
  captures: CaptureRead[]
}

/** Sous-ensemble de `TraitementRead` utile au calcul de couverture. */
export interface SyntheseTraitement {
  id: string
  region: string | null
  date_traitement: string
  terrestre: { surface_traitee_ha: number | null } | null
}

export interface SyntheseFiltres {
  /** Bornes incluses — la maquette affiche « 2026‑07‑01 → 2026‑08‑15 ». */
  dateDebut?: string
  dateFin?: string
}

/**
 * Les dates arrivent en ISO `YYYY-MM-DD` : la comparaison lexicographique
 * suffit et évite un fuseau horaire parasite (`new Date('2026-07-01')` est UTC).
 */
function dansLaPeriode(date: string, filtres: SyntheseFiltres): boolean {
  if (filtres.dateDebut && date < filtres.dateDebut) return false
  if (filtres.dateFin && date > filtres.dateFin) return false
  return true
}

export function filterProspectionsForSynthese<T extends SyntheseProspection>(
  prospections: T[],
  filtres: SyntheseFiltres,
): T[] {
  return prospections.filter((p) => dansLaPeriode(p.date_prospection, filtres))
}

/**
 * Même période que les prospections : sans ce filtre, la couverture divisait
 * des traitements de tout l'historique par la surface infestée d'une période
 * courte, et le plafond à 100 % masquait l'incohérence.
 */
export function filterTraitementsForSynthese<T extends SyntheseTraitement>(
  traitements: T[],
  filtres: SyntheseFiltres,
): T[] {
  return traitements.filter((t) => dansLaPeriode(t.date_traitement, filtres))
}

// ---------------------------------------------------------------------------
// Agrégats
// ---------------------------------------------------------------------------

/** Axes des pastilles « Groupement » de la maquette (prototype ligne 1495). */
export type AxeGroupement = 'espece' | 'station' | 'prospecteur'

export interface DefinitionAxe {
  axe: AxeGroupement
  /** Libellé de la pastille et du titre de carte. */
  label: string
  /** En-tête de la première colonne du tableau. */
  colonne: string
  /** L'espèce est un nom scientifique : la maquette (L852) le met en italique. */
  italique: boolean
  /**
   * Une fiche appartient-elle à plusieurs groupes à la fois ? Vrai pour
   * l'espèce (une fiche peut en porter plusieurs), faux ailleurs : sur cet axe
   * la surface infestée est attribuée à chaque espèce et la colonne ne
   * s'additionne donc pas en un total de terrain.
   */
  multiGroupe: boolean
  /** Valeur affichée quand la fiche n'a pas de clé sur cet axe. */
  sansValeur: string
}

export const AXES_GROUPEMENT: DefinitionAxe[] = [
  {
    axe: 'espece',
    label: 'Espèce',
    colonne: 'Espèce',
    italique: true,
    multiGroupe: true,
    sansValeur: 'Espèce non identifiée',
  },
  {
    axe: 'station',
    label: 'Station',
    colonne: 'Station',
    italique: false,
    multiGroupe: false,
    sansValeur: 'Sans station',
  },
  {
    axe: 'prospecteur',
    label: 'Prospecteur',
    colonne: 'Prospecteur',
    italique: false,
    multiGroupe: false,
    sansValeur: 'Prospecteur inconnu',
  },
]

export function definitionAxe(axe: AxeGroupement): DefinitionAxe {
  return AXES_GROUPEMENT.find((a) => a.axe === axe)!
}

export interface AgregatLigne {
  cle: string
  label: string
  nbFiches: number
  /** Somme des effectifs de capture. */
  individus: number
  /** Moyenne des densités renseignées, diffuses et groupées confondues. */
  densiteMoyenne: number | null
  /** Somme des `surface_infestee` des fiches du groupe, en hectares. */
  surfaceInfestee: number
}

/** Libellés résolus par axe : `{ station: { <id>: 'ST-001 — …' } }`. */
export interface LibellesGroupement {
  station?: Record<string, string>
  prospecteur?: Record<string, string>
}

function moyenne(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

/** Espèces distinctes rencontrées sur une fiche (populations + captures). */
function especesDe(p: SyntheseProspection): string[] {
  return [...new Set([...p.populations.map((x) => x.espece), ...p.captures.map((c) => c.espece)])]
}

/** Clés d'appartenance d'une fiche pour un axe donné (cf. `multiGroupe`). */
function clesDe(p: SyntheseProspection, def: DefinitionAxe): string[] {
  if (def.axe === 'espece') {
    const especes = especesDe(p)
    return especes.length > 0 ? especes : [def.sansValeur]
  }
  if (def.axe === 'station') return [p.station_id ?? def.sansValeur]
  return [p.prospecteur_id || def.sansValeur]
}

function labelDe(cle: string, def: DefinitionAxe, libelles: LibellesGroupement): string {
  if (cle === def.sansValeur) return def.sansValeur
  if (def.axe === 'espece') return cle
  const table = def.axe === 'station' ? libelles.station : libelles.prospecteur
  return table?.[cle] ?? cle
}

/**
 * Tableau « Agrégats » de la maquette : une ligne par valeur de l'axe choisi,
 * colonnes fiches / individus / densité moyenne / surface infestée.
 *
 * Sur l'axe « espèce », densités et individus sont restreints à l'espèce de la
 * ligne ; sur les autres axes ils portent sur toute la fiche.
 */
export function buildAgregats(
  prospections: SyntheseProspection[],
  axe: AxeGroupement,
  libelles: LibellesGroupement,
): AgregatLigne[] {
  const def = definitionAxe(axe)
  const groupes = new Map<string, SyntheseProspection[]>()
  for (const p of prospections) {
    for (const cle of clesDe(p, def)) {
      const bucket = groupes.get(cle)
      if (bucket) bucket.push(p)
      else groupes.set(cle, [p])
    }
  }

  return [...groupes.entries()]
    .map(([cle, fiches]) => {
      const densites: number[] = []
      let individus = 0
      let surfaceInfestee = 0

      for (const p of fiches) {
        // Sur l'axe espèce, densités et individus sont restreints à l'espèce
        // de la ligne ; sur une partition ils portent sur toute la fiche.
        const parEspece = def.axe === 'espece'
        const populations = parEspece
          ? p.populations.filter((pop) => pop.espece === cle)
          : p.populations
        const captures = parEspece ? p.captures.filter((c) => c.espece === cle) : p.captures

        for (const pop of populations) {
          if (pop.densite_diffuse !== null) densites.push(pop.densite_diffuse)
          if (pop.densite_groupee !== null) densites.push(pop.densite_groupee)
        }
        for (const cap of captures) individus += cap.effectif
        surfaceInfestee += p.surface_infestee ?? 0
      }

      return {
        cle,
        label: labelDe(cle, def, libelles),
        nbFiches: fiches.length,
        individus,
        densiteMoyenne: moyenne(densites),
        surfaceInfestee,
      }
    })
    // La maquette met les foyers majeurs en tête ; `localeCompare` départage
    // les ex æquo pour que l'ordre reste stable d'un rendu à l'autre.
    .sort((a, b) => b.surfaceInfestee - a.surfaceInfestee || a.label.localeCompare(b.label))
}

// ---------------------------------------------------------------------------
// Couverture du traitement
// ---------------------------------------------------------------------------

export interface CouvertureZone {
  zone: string
  /** Pourcentage entier, borné à [0, 100]. */
  pct: number
  surfaceInfestee: number
  surfaceTraitee: number
}

const SANS_REGION = 'Région non renseignée'

/**
 * Carte « Couverture du traitement » : part de la surface infestée relevée en
 * prospection qui a effectivement été traitée, par région.
 *
 * Limite connue et assumée : seul le volet **terrestre** porte une
 * `surface_traitee_ha` (`traitement_schemas.py`). Un traitement aérien ne
 * contribue donc rien au numérateur et la couverture d'une région traitée par
 * voie aérienne est sous-estimée. Corriger cela demande une surface traitée
 * côté aérien dans le schéma backend, hors périmètre de ce lot.
 */
export function buildCouvertureTraitement(
  prospections: SyntheseProspection[],
  traitements: SyntheseTraitement[],
): CouvertureZone[] {
  const infestee = new Map<string, number>()
  for (const p of prospections) {
    if (p.surface_infestee === null) continue
    const zone = p.region ?? SANS_REGION
    infestee.set(zone, (infestee.get(zone) ?? 0) + p.surface_infestee)
  }

  const traitee = new Map<string, number>()
  for (const t of traitements) {
    const surface = t.terrestre?.surface_traitee_ha
    if (surface === null || surface === undefined) continue
    const zone = t.region ?? SANS_REGION
    traitee.set(zone, (traitee.get(zone) ?? 0) + surface)
  }

  return [...infestee.entries()]
    .filter(([, surface]) => surface > 0)
    .map(([zone, surfaceInfestee]) => {
      const surfaceTraitee = traitee.get(zone) ?? 0
      return {
        zone,
        pct: Math.min(100, Math.round((surfaceTraitee / surfaceInfestee) * 100)),
        surfaceInfestee,
        surfaceTraitee,
      }
    })
    .sort((a, b) => b.pct - a.pct || a.zone.localeCompare(b.zone))
}

// ---------------------------------------------------------------------------
// Export CSV
// ---------------------------------------------------------------------------

/** ~1 m au sol : une seule décimale situait la fiche à ±11 km près. */
const DECIMALES_GPS = 5

const CSV_COLUMNS = [
  'Référence',
  'Date',
  'Statut',
  'Région',
  'District',
  'Commune',
  'Station',
  'Latitude',
  'Longitude',
  'Espèces',
  'Individus',
  'Densité diffuse moy.',
  'Densité groupée moy.',
  'Surface prospectée (ha)',
  'Surface infestée (ha)',
  'Dernière mise à jour',
] as const

/**
 * Le séparateur étant « ; », la virgule n'a pas à être échappée — sinon toutes
 * les décimales françaises partiraient entre guillemets.
 */
function csvEscape(value: string): string {
  if (/["\r\n;]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

/**
 * Décimales à la virgule : l'encart de la maquette annonce un fichier destiné
 * à Excel francophone, où « ; » est le séparateur de colonnes — le point
 * décimal y serait interprété comme du texte.
 */
function nombreCsvFr(value: number | null, decimales = 0): string {
  if (value === null) return ''
  return value.toFixed(decimales).replace('.', ',')
}

/**
 * Une ligne par fiche : références, localisation, captures agrégées, surfaces
 * et statut — contenu annoncé par l'encart « Contenu de l'export » (§9).
 * Le BOM UTF‑8 est ajouté au moment du téléchargement, pas ici.
 */
export function buildProspectionsCsv(
  prospections: SyntheseProspection[],
  libelles: LibellesGroupement,
): string {
  const lignes = prospections.map((p) => {
    const diffuses = p.populations
      .map((pop) => pop.densite_diffuse)
      .filter((v): v is number => v !== null)
    const groupees = p.populations
      .map((pop) => pop.densite_groupee)
      .filter((v): v is number => v !== null)

    return [
      p.n_fiche ?? p.id,
      p.date_prospection,
      p.statut,
      p.region ?? '',
      p.district ?? '',
      p.commune ?? '',
      (p.station_id ? libelles.station?.[p.station_id] : undefined) ?? '',
      nombreCsvFr(p.latitude, DECIMALES_GPS),
      nombreCsvFr(p.longitude, DECIMALES_GPS),
      especesDe(p).join(' / '),
      String(p.captures.reduce((sum, c) => sum + c.effectif, 0)),
      nombreCsvFr(moyenne(diffuses), 2),
      nombreCsvFr(moyenne(groupees), 2),
      nombreCsvFr(p.surface_prospectee),
      nombreCsvFr(p.surface_infestee),
      p.updated_at,
    ]
      .map(csvEscape)
      .join(';')
  })

  // CRLF : fin de ligne attendue par Excel (et par la RFC 4180).
  return [CSV_COLUMNS.join(';'), ...lignes].join('\r\n')
}
