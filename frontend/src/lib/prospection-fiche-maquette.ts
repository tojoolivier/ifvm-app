// Dérivations de la fiche de lecture, maquette §5 du handoff
// (`docs/design_handoff_web/Prototype Web IFVM.dc.html`, bloc
// `data-screen-label="Detail prospection"`).
//
// Tout est dérivé de la fiche déjà chargée par ProspectionDetailPage : aucun
// appel API supplémentaire, aucune valeur recalculée différemment du backend.

export const TIRET = '—'

export interface LigneFiche {
  k: string
  v: string
  /** Valeur absente : la maquette la grise (`#bdb6a2`) au lieu de la masquer. */
  muted?: boolean
}

export interface CaptureFiche {
  id: string
  espece: string
  categorie: string
  sexe?: string | null
  phase: string
  stade: string
  effectif: number
}

export interface PopulationFiche {
  id: string
  espece: string
  categorie: string
  phase?: string | null
  methode?: string | null
  densite_diffuse: number | null
  densite_groupee: number | null
}

export interface InfestationFiche {
  id: string
  type_cible: string
  espece?: string | null
  surface_totale: number | null
  densite_moy: number | null
  comportement: string | null
  // Spécialisation larve (C)
  type_larve?: string | null
  stade_dominant?: string | null
  taille_groupe_m2?: number | null
  nb_taches_bandes?: number | null
  interdistance_min?: number | null
  interdistance_max?: number | null
  interdistance_moy?: number | null
  front_longueur_m?: number | null
  front_largeur_m?: number | null
  densite_max_front?: number | null
  densite_moy_arriere_front?: number | null
  surface_contaminee_ha?: number | null
  surface_infestee_pourcent?: number | null
  // Spécialisation imago (B)
  type_essaim?: string | null
  essaim_en_vol?: boolean | null
  essaim_pose?: boolean | null
  heure_observation?: string | null
  densite_en_vol?: number | null
  dimension_ha?: number | null
  pullulation_nb?: number | null
}

export interface ProspectionFiche {
  n_fiche: string | null
  n_releve: string | null
  type_prospection: string
  date_prospection: string
  created_at: string
  latitude: number | null
  longitude: number | null
  altitude?: number | null
  region?: string | null
  district?: string | null
  commune?: string | null
  station_libre?: string | null
  surface_prospectee: number | null
  surface_infestee: number | null
}

export interface StationFiche {
  code: string
  nom: string
}

// ---------------------------------------------------------------------------
// Formatage
// ---------------------------------------------------------------------------

/** Nombre à la française (espace fine insécable comme séparateur de milliers). */
export function formatNombre(value: number | null | undefined): string {
  if (value == null) return TIRET
  return value.toLocaleString('fr-FR')
}

/** Coordonnée décimale à la française : `-22,4021`. */
export function formatCoord(value: number | null | undefined): string {
  if (value == null) return TIRET
  return value.toFixed(4).replace('.', ',')
}

/** `HH:MM` extrait d'un timestamp ISO, en heure locale. */
export function formatHeure(iso: string | null | undefined): string {
  if (!iso) return TIRET
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return TIRET
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

/** Enum backend (`bande_larvaire`) → libellé lisible (`Bande larvaire`). */
export function humaniser(value: string | null | undefined): string {
  if (!value) return TIRET
  const mot = value.replace(/_/g, ' ')
  return mot.charAt(0).toUpperCase() + mot.slice(1)
}

function ligne(k: string, v: string): LigneFiche {
  return v === TIRET ? { k, v, muted: true } : { k, v }
}

export const NUMERO_FICHE = (p: Pick<ProspectionFiche, 'n_fiche' | 'n_releve'>): string =>
  p.n_fiche ?? p.n_releve ?? TIRET

// ---------------------------------------------------------------------------
// Bloc A — Référence & localisation
// ---------------------------------------------------------------------------

export function buildReferenceRows(
  p: ProspectionFiche,
  station: StationFiche | null,
): LigneFiche[] {
  const coord =
    p.latitude == null || p.longitude == null
      ? TIRET
      : `${formatCoord(p.latitude)} · ${formatCoord(p.longitude)}`

  const regionDistrict = [p.region, p.district].filter(Boolean).join(' / ') || TIRET

  return [
    ligne('N° de fiche', NUMERO_FICHE(p)),
    // L'heure vient de `created_at` : c'est l'horodatage de saisie de la fiche,
    // `date_prospection` ne portant que la date.
    ligne('Date · heure', `${p.date_prospection} · ${formatHeure(p.created_at)}`),
    ligne('Coordonnées', coord),
    ligne('Altitude', p.altitude == null ? TIRET : `${formatNombre(p.altitude)} m`),
    ligne('Région / District', regionDistrict),
    ligne('Localité', p.commune || p.station_libre || (station ? `${station.code} ${station.nom}` : TIRET)),
  ]
}

// ---------------------------------------------------------------------------
// Bloc D — Infestation
// ---------------------------------------------------------------------------

// "essaim" a disparu (migration backend 0031) : Dense et Très dense sont désormais des
// types de cible à part entière, au même niveau que Vol clair.
const CIBLES_IMAGO = ['vol_clair', 'dense', 'tres_dense']
const CIBLES_LARVE = ['tache_larvaire', 'bande_larvaire']

export function buildInfestationRows(
  p: ProspectionFiche,
  infestations: InfestationFiche[],
  populations: PopulationFiche[],
): LigneFiche[] {
  const groupee = populations.some((pop) => (pop.densite_groupee ?? 0) > 0)
  const diffuse = populations.some((pop) => (pop.densite_diffuse ?? 0) > 0)
  const repartition = groupee && diffuse ? 'Mixte' : groupee ? 'Groupée' : diffuse ? 'Diffuse' : TIRET

  const compte = (cible: string) => infestations.filter((i) => i.type_cible === cible).length

  return [
    ligne(
      'Surface infestée',
      p.surface_infestee == null ? TIRET : `${formatNombre(p.surface_infestee)} ha`,
    ),
    ligne('Répartition', repartition),
    ligne('Vols clairs', String(compte('vol_clair'))),
    // "Essaims" regroupe les deux niveaux de densité (Dense + Très dense) : la maquette
    // imprimée garde une seule ligne, comme avant la bascule du type de cible "essaim".
    ligne('Essaims', String(compte('dense') + compte('tres_dense'))),
    // Dernière ligne de la maquette : « Niveau d'alerte », qu'aucune colonne
    // backend ne fournit — remplacée par la surface prospectée, de même nature.
    ligne(
      'Surface prospectée',
      p.surface_prospectee == null ? TIRET : `${formatNombre(p.surface_prospectee)} ha`,
    ),
  ]
}

// ---------------------------------------------------------------------------
// Spécialisation larve / imago (tables distinctes en base)
// ---------------------------------------------------------------------------

export function findLarve(infestations: InfestationFiche[]): InfestationFiche | null {
  return infestations.find((i) => CIBLES_LARVE.includes(i.type_cible)) ?? null
}

export function findImago(infestations: InfestationFiche[]): InfestationFiche | null {
  return infestations.find((i) => CIBLES_IMAGO.includes(i.type_cible)) ?? null
}

/** `StadeDominant` backend (`l4_l5`) → notation de la maquette (`L4-L5`). */
export function formatStade(value: string | null | undefined): string {
  if (!value) return TIRET
  return value.toUpperCase().replace(/_/g, '-')
}

export function buildLarveRows(inf: InfestationFiche | null): LigneFiche[] {
  const triple = (a?: number | null, b?: number | null, c?: number | null) =>
    a == null && b == null && c == null
      ? TIRET
      : `${formatNombre(a)} / ${formatNombre(b)} / ${formatNombre(c)}`

  const paire = (a: number | null | undefined, b: number | null | undefined, sep: string) =>
    a == null && b == null ? TIRET : `${formatNombre(a)} ${sep} ${formatNombre(b)}`

  return [
    ligne('Type de larve', humaniser(inf?.type_larve)),
    ligne('Stade dominant', formatStade(inf?.stade_dominant)),
    ligne('Taille du groupe (m²)', formatNombre(inf?.taille_groupe_m2)),
    ligne('Nb taches / bandes', formatNombre(inf?.nb_taches_bandes)),
    ligne(
      'Interdistance min/max/moy (m)',
      triple(inf?.interdistance_min, inf?.interdistance_max, inf?.interdistance_moy),
    ),
    ligne('Front longueur × largeur (m)', paire(inf?.front_longueur_m, inf?.front_largeur_m, '×')),
    ligne(
      'Densité max front / arrière',
      paire(inf?.densite_max_front, inf?.densite_moy_arriere_front, '/'),
    ),
    ligne(
      'Surface contaminée · infestée',
      inf?.surface_contaminee_ha == null && inf?.surface_infestee_pourcent == null
        ? TIRET
        : `${formatNombre(inf?.surface_contaminee_ha)} ha · ${formatNombre(inf?.surface_infestee_pourcent)} %`,
    ),
  ]
}

export function buildImagoRows(inf: InfestationFiche | null): LigneFiche[] {
  const oui = (v: boolean | null | undefined) => (v == null ? TIRET : v ? 'Oui' : 'Non')
  const enVolPose =
    inf?.essaim_en_vol == null && inf?.essaim_pose == null
      ? TIRET
      : `${oui(inf?.essaim_en_vol)} / ${oui(inf?.essaim_pose)}`

  return [
    ligne("Type d'essaim", humaniser(inf?.type_essaim)),
    ligne('En vol / posé', enVolPose),
    ligne("Heure d'observation", inf?.heure_observation ?? TIRET),
    ligne('Densité en vol (ind/ha)', formatNombre(inf?.densite_en_vol)),
    ligne('Dimension (ha)', formatNombre(inf?.dimension_ha)),
    ligne('Pullulation (nb)', formatNombre(inf?.pullulation_nb)),
  ]
}

// ---------------------------------------------------------------------------
// Bloc B — captures agrégées par phase
// ---------------------------------------------------------------------------

export interface LigneCapture {
  phase: string
  phaseLabel: string
  males: string
  femelles: string
  stade: string
  methode: string
  densite: string
}

export interface CapturesSynthese {
  lignes: LigneCapture[]
  total: number
}

/**
 * La maquette montre une ligne par phase acridienne, avec mâles / femelles.
 * Elle affiche un « phénotype dominant » qu'aucune colonne ne porte : la
 * colonne rend le stade dominant de la phase, réellement stocké sur capture.
 * La densité et la méthode viennent de `population`, rapprochée par phase.
 */
export function buildCapturesSynthese(
  captures: CaptureFiche[],
  populations: PopulationFiche[],
): CapturesSynthese {
  const phases = [...new Set(captures.map((c) => c.phase))]

  const lignes = phases.map((phase) => {
    const ofPhase = captures.filter((c) => c.phase === phase)
    // `Sexe` est un enum backend à deux valeurs : "M" et "F".
    const somme = (sexe: string) =>
      ofPhase.filter((c) => c.sexe === sexe).reduce((s, c) => s + c.effectif, 0)

    const males = somme('M')
    const femelles = somme('F')

    // Stade dominant : celui qui porte le plus gros effectif dans la phase.
    const parStade = new Map<string, number>()
    for (const c of ofPhase) parStade.set(c.stade, (parStade.get(c.stade) ?? 0) + c.effectif)
    const stade = [...parStade.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? TIRET

    const pop = populations.find((p) => p.phase === phase)
    const densite = pop
      ? formatNombre((pop.densite_groupee ?? 0) + (pop.densite_diffuse ?? 0))
      : TIRET

    return {
      phase,
      phaseLabel: humaniser(phase),
      males: males > 0 ? formatNombre(males) : TIRET,
      femelles: femelles > 0 ? formatNombre(femelles) : TIRET,
      stade: formatStade(stade === TIRET ? null : stade),
      methode: humaniser(pop?.methode),
      densite,
    }
  })

  return { lignes, total: captures.reduce((s, c) => s + c.effectif, 0) }
}

// ---------------------------------------------------------------------------
// Piste de validation (colonne latérale)
// ---------------------------------------------------------------------------

export interface EtapeValidation {
  id: string
  label: string
  who: string
  when: string
  /** Couleur de pastille de la maquette. */
  dot: string
}

const ACTION_LABELS: Record<string, string> = {
  creation: 'Saisie terrain',
  soumission: 'Soumise',
  synchronisation: 'Synchronisée',
  verification: 'Vérifiée',
  validation: 'Validation finale',
  rejet: 'Rejetée',
  modification: 'Modifiée',
  commentaire: 'Commentaire',
}

const ACTION_DOTS: Record<string, string> = {
  creation: '#bdb6a2',
  soumission: '#e89b2b',
  synchronisation: '#235a36',
  verification: '#5b83b5',
  validation: '#235a36',
  rejet: '#c0412b',
  modification: '#bdb6a2',
  commentaire: '#bdb6a2',
}

export const DOT_EN_ATTENTE = '#e0d9c4'

export interface EntreeAudit {
  id: string
  action: string
  auteur_id: string
  created_at: string
}

/**
 * Piste chronologique (plus ancien en haut, comme la maquette) suivie d'une
 * étape grise « en attente » tant que la fiche n'est ni validée ni rejetée.
 */
export function buildPisteValidation(
  auditLog: EntreeAudit[],
  statut: string,
  nomAuteur: (id: string) => string,
): EtapeValidation[] {
  const etapes = [...auditLog]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((e) => ({
      id: e.id,
      label: ACTION_LABELS[e.action] ?? humaniser(e.action),
      who: nomAuteur(e.auteur_id),
      when: e.created_at,
      dot: ACTION_DOTS[e.action] ?? '#bdb6a2',
    }))

  if (statut !== 'validee' && statut !== 'rejetee') {
    etapes.push({
      id: 'en-attente',
      label: 'Validation finale',
      who: 'en attente',
      when: TIRET,
      dot: DOT_EN_ATTENTE,
    })
  }

  return etapes
}
