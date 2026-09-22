// Lecture d'une fiche de prospection telle qu'elle est en base de données.
//
// Règle : la page de détail n'affiche que des colonnes réellement stockées, une
// ligne par colonne, sans agrégat, sans valeur dérivée et sans regroupement
// inventé (ex. « synthèse par phase », « répartition », « durée de comptage »).
//
// Exhaustivité garantie à la compilation : chaque catalogue ci-dessous est typé
// `{ [K in keyof <Schéma>]-?: … }` sur le contrat OpenAPI généré
// (`api-schema.generated.ts`). Quand le backend ajoute une colonne, le web ne
// compile plus tant qu'elle n'est pas rangée dans un groupe (ou explicitement
// déclarée affichée « ailleurs ») : un champ ne peut pas être oublié en silence.

import type { components } from './api-schema.generated'

type Schemas = components['schemas']
export type ProspectionBdd = Schemas['ProspectionRead']
export type PopulationBdd = Schemas['PopulationRead']
export type CaptureBdd = Schemas['CaptureRead']
export type InfestationBdd = Schemas['InfestationRead']
export type OperationBdd = Schemas['OperationAerienneRead']
export type AuditBdd = Schemas['AuditLogRead']

export const TIRET = '—'

// ---------------------------------------------------------------------------
// Formatage (valeur stockée → texte ; jamais d'arrondi ni de conversion d'unité)
// ---------------------------------------------------------------------------

/** Enum backend (`bande_larvaire`) → `Bande larvaire`. */
export function humaniser(value: string | null | undefined): string {
  if (!value) return TIRET
  const mot = value.replace(/_/g, ' ')
  return mot.charAt(0).toUpperCase() + mot.slice(1)
}

const FORMAT_NOMBRE = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 10 })

export function fNombre(v: unknown, unite?: string): string {
  if (v == null || v === '') return TIRET
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return TIRET
  return unite ? `${FORMAT_NOMBRE.format(n)} ${unite}` : FORMAT_NOMBRE.format(n)
}

export function fTexte(v: unknown): string {
  return v == null || v === '' ? TIRET : String(v)
}

export function fEnum(v: unknown): string {
  return typeof v === 'string' ? humaniser(v) : TIRET
}

/** Valeurs autorisées par la contrainte `ck_prospection_statut`, avec leurs accents. */
const STATUT_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  en_attente: 'En attente',
  verifiee: 'Vérifiée',
  validee: 'Validée',
  rejetee: 'Rejetée',
}

export function fStatut(v: unknown): string {
  return typeof v === 'string' ? (STATUT_LABELS[v] ?? humaniser(v)) : TIRET
}

export function fBool(v: unknown): string {
  return v == null ? TIRET : v ? 'Oui' : 'Non'
}

export function fListe(v: unknown): string {
  if (!Array.isArray(v) || v.length === 0) return TIRET
  return v.map((x) => (typeof x === 'string' ? humaniser(x) : String(x))).join(', ')
}

/** Horodatage ISO → `jj/mm/aaaa hh:mm` (heure locale du navigateur). */
export function fHorodatage(v: unknown): string {
  if (typeof v !== 'string' || v === '') return TIRET
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Le tracé SVG d'une signature n'est pas lisible tel quel : on atteste sa présence. */
export function fTrace(v: unknown): string {
  return typeof v === 'string' && v !== '' ? `Tracé enregistré (${v.length} caractères)` : TIRET
}

// ---------------------------------------------------------------------------
// Catalogues
// ---------------------------------------------------------------------------

export interface ContexteFiche {
  nomAgent: (id: string) => string
  /** Nom de la campagne (jointure `campagne`), si résolu. */
  campagneNom?: string | null
  /** Station (jointure `station_fixe`), si résolue. */
  station?: { code: string; nom: string; pa_nom?: string | null } | null
}

type Fmt<R> = (v: unknown, ctx: ContexteFiche, rec: R) => string

interface ColonneScalaire<R> {
  groupe: string
  label: string
  fmt: Fmt<R>
}
interface ColonneJson {
  groupe: string
  label: string
  json: true
}
/** Colonne affichée par un autre élément de la page (précisé, pour l'audit). */
interface ColonneAilleurs {
  ailleurs: string
}
export type Colonne<R> = ColonneScalaire<R> | ColonneJson | ColonneAilleurs

const sc = <R>(groupe: string, label: string, fmt: Fmt<R>): Colonne<R> => ({ groupe, label, fmt })
const txt = <R>(g: string, l: string) => sc<R>(g, l, (v) => fTexte(v))
const enu = <R>(g: string, l: string) => sc<R>(g, l, (v) => fEnum(v))
const num = <R>(g: string, l: string, unite?: string) => sc<R>(g, l, (v) => fNombre(v, unite))
const bool = <R>(g: string, l: string) => sc<R>(g, l, (v) => fBool(v))
const lst = <R>(g: string, l: string) => sc<R>(g, l, (v) => fListe(v))
const ts = <R>(g: string, l: string) => sc<R>(g, l, (v) => fHorodatage(v))
const trace = <R>(g: string, l: string) => sc<R>(g, l, (v) => fTrace(v))
const json = <R>(groupe: string, label: string): Colonne<R> => ({ groupe, label, json: true })
const ailleurs = <R>(ou: string): Colonne<R> => ({ ailleurs: ou })

type P = ProspectionBdd

const G_ID = 'Identification'
const G_TRACE = 'Traçabilité de la validation'
const G_LOC = 'Localisation'
const G_SURF = 'Surfaces'
const G_MILIEU = 'Milieu & observations'
const G_SIGNAL = 'Signalement & validation'
const G_EQUIPE = 'Extensif aérien — équipe & aéronef'
const G_BASE1 = 'Extensif aérien — base principale'
const G_BASE2 = 'Extensif aérien — base secondaire'
const G_PESTI = 'Extensif aérien — pesticides embarqués'
const G_SIGN = 'Extensif aérien — signatures'

/** Table `prospection`. L'ordre des entrées est l'ordre d'affichage dans chaque groupe. */
export const CATALOGUE_PROSPECTION: { [K in keyof P]-?: Colonne<P> } = {
  id: txt(G_ID, 'Identifiant'),
  type_prospection: enu(G_ID, 'Type de prospection'),
  n_fiche: txt(G_ID, 'N° de fiche'),
  n_message: txt(G_ID, 'N° de message'),
  campagne_id: sc<P>(G_ID, 'Campagne', (v, ctx) => ctx.campagneNom ?? fTexte(v)),
  prospecteur_id: sc<P>(G_ID, 'Prospecteur', (v, ctx, p) =>
    typeof v === 'string' ? (p.prospecteur_nom ?? ctx.nomAgent(v)) : TIRET,
  ),
  prospecteur_nom: ailleurs('ligne « Prospecteur » (jointure utilisateur)'),
  date_prospection: txt(G_ID, 'Date de prospection'),
  statut: sc<P>(G_ID, 'Statut', (v) => fStatut(v)),
  statut_sync: enu(G_ID, 'Statut de synchronisation'),
  revalide_de_id: txt(G_ID, 'Revalide la fiche'),
  created_at: ts(G_ID, 'Créée le'),
  updated_at: ts(G_ID, 'Mise à jour le'),

  verified_by: sc<P>(G_TRACE, 'Vérifiée par', (v, ctx, p) =>
    typeof v === 'string' ? (p.verified_by_nom ?? ctx.nomAgent(v)) : TIRET,
  ),
  verified_by_nom: ailleurs('ligne « Vérifiée par » (jointure utilisateur)'),
  verified_at: ts(G_TRACE, 'Vérifiée le'),
  validated_by: sc<P>(G_TRACE, 'Validée par', (v, ctx, p) =>
    typeof v === 'string' ? (p.validated_by_nom ?? ctx.nomAgent(v)) : TIRET,
  ),
  validated_by_nom: ailleurs('ligne « Validée par » (jointure utilisateur)'),
  validated_at: ts(G_TRACE, 'Validée le'),

  station_id: sc<P>(G_LOC, 'Station', (v, ctx) =>
    ctx.station
      ? `${ctx.station.code} ${ctx.station.nom}${ctx.station.pa_nom ? ` (${ctx.station.pa_nom})` : ''}`
      : fTexte(v),
  ),
  station_libre: txt(G_LOC, 'Localité saisie (station libre)'),
  region: txt(G_LOC, 'Région'),
  district: txt(G_LOC, 'District'),
  commune: txt(G_LOC, 'Commune'),
  za: txt(G_LOC, 'Zone anti-acridienne (ZA)'),
  pa_code: txt(G_LOC, 'Poste avancé (code PA)'),
  latitude: num(G_LOC, 'Latitude'),
  longitude: num(G_LOC, 'Longitude'),
  altitude: num(G_LOC, 'Altitude', 'm'),
  heure_observation_at: ts(G_LOC, "Heure d'observation (GPS)"),

  surface_station: num(G_SURF, 'Surface de la station', 'ha'),
  surface_prospectee: num(G_SURF, 'Surface prospectée', 'ha'),
  surface_infestee: num(G_SURF, 'Surface infestée', 'ha'),

  biotope: lst(G_MILIEU, 'Biotope'),
  type_station: lst(G_MILIEU, 'Type de station'),
  verdure_strate: enu(G_MILIEU, 'Verdure de la strate'),
  vegetation: json(G_MILIEU, 'Végétation'),
  sol: json(G_MILIEU, 'Sol'),
  verdissement: num(G_MILIEU, 'Verdissement'),
  verdissement_pourcent: num(G_MILIEU, 'Verdissement', '%'),
  hauteur_strate: num(G_MILIEU, 'Hauteur de strate'),
  hauteur_herbe_cm: num(G_MILIEU, "Hauteur d'herbe", 'cm'),
  degats_cultures: enu(G_MILIEU, 'Dégâts sur cultures'),
  degats_cultures_pourcent: num(G_MILIEU, 'Dégâts sur cultures', '%'),
  derniere_pluie: txt(G_MILIEU, 'Dernière pluie'),
  intensite_pluie: txt(G_MILIEU, 'Intensité de la pluie'),
  ennemis_naturels: txt(G_MILIEU, 'Ennemis naturels'),
  observations: txt(G_MILIEU, 'Observations'),
  avertissements: ailleurs('bandeau « Avertissements de la fiche »'),

  signalement_source: txt(G_SIGNAL, 'Source du signalement'),
  signalement_date: txt(G_SIGNAL, 'Date du signalement'),
  signalement_description: txt(G_SIGNAL, 'Description du signalement'),
  conclusion_validation: enu(G_SIGNAL, 'Conclusion de la validation'),

  mode_extensif: enu(G_EQUIPE, 'Mode extensif'),
  societe: txt(G_EQUIPE, 'Société'),
  immatricule_aeronef: txt(G_EQUIPE, 'Immatriculation aéronef'),
  pilote: txt(G_EQUIPE, 'Pilote'),
  mecanicien: txt(G_EQUIPE, 'Mécanicien'),
  chef_de_base: txt(G_EQUIPE, 'Chef de base'),

  base: txt(G_BASE1, 'Base principale'),
  base_numero: num(G_BASE1, 'Numéro de la base'),
  base_date_installation: txt(G_BASE1, "Date d'installation"),
  base_latitude: num(G_BASE1, 'Latitude'),
  base_longitude: num(G_BASE1, 'Longitude'),

  base_secondaire: txt(G_BASE2, 'Base secondaire'),
  base_secondaire_date_installation: txt(G_BASE2, "Date d'installation"),
  base_secondaire_latitude: num(G_BASE2, 'Latitude'),
  base_secondaire_longitude: num(G_BASE2, 'Longitude'),

  pesticides_embarques: bool(G_PESTI, 'Pesticides embarqués'),
  pesticide_nom_commercial: txt(G_PESTI, 'Nom commercial'),
  pesticide_quantite_disponible: num(G_PESTI, 'Quantité disponible'),
  pesticide_quantite_recue: num(G_PESTI, 'Quantité reçue'),
  futs_disponible: num(G_PESTI, 'Fûts disponibles'),
  futs_pleins: num(G_PESTI, 'Fûts pleins'),
  futs_vides: num(G_PESTI, 'Fûts vides'),
  futs_recues: num(G_PESTI, 'Fûts reçus'),

  signature_visa_nom: txt(G_SIGN, 'Visa — nom'),
  signature_visa_horodatage: ts(G_SIGN, 'Visa — horodatage'),
  signature_consultant_fao_nom: txt(G_SIGN, 'Consultant FAO — nom'),
  signature_consultant_fao_horodatage: ts(G_SIGN, 'Consultant FAO — horodatage'),
  signature_consultant_fao_image: trace(G_SIGN, 'Consultant FAO — tracé'),
  signature_pilote_nom: txt(G_SIGN, 'Pilote — nom'),
  signature_pilote_horodatage: ts(G_SIGN, 'Pilote — horodatage'),
  signature_pilote_image: trace(G_SIGN, 'Pilote — tracé'),
  signature_chef_base_nom: txt(G_SIGN, 'Chef de base — nom'),
  signature_chef_base_horodatage: ts(G_SIGN, 'Chef de base — horodatage'),
  signature_chef_base_image: trace(G_SIGN, 'Chef de base — tracé'),

  populations: ailleurs('cartes « Populations »'),
  captures: ailleurs('tableau « Captures »'),
  infestations: ailleurs('cartes « Infestations »'),
  operations_aeriennes: ailleurs('tableau « Opérations aériennes »'),
}

type Pop = PopulationBdd
const GP_GEN = 'Population'
const GP_IMAGO = 'Imagos'
const GP_LARVE = 'Larves'

/** Table `prospection_population`. */
export const CATALOGUE_POPULATION: { [K in keyof Pop]-?: Colonne<Pop> } = {
  id: txt(GP_GEN, 'Identifiant'),
  espece: txt(GP_GEN, 'Espèce'),
  categorie: enu(GP_GEN, 'Catégorie'),
  densite_diffuse: num(GP_GEN, 'Densité diffuse'),
  densite_groupee: num(GP_GEN, 'Densité groupée'),
  captures_nombre: num(GP_GEN, 'Nombre de captures'),
  temps_capture: num(GP_GEN, 'Temps de capture', 'min'),
  methode: enu(GP_GEN, 'Méthode'),
  phase: enu(GP_GEN, 'Phase'),
  accouplement: enu(GP_GEN, 'Accouplement'),
  ponte: enu(GP_GEN, 'Ponte'),

  captures_sol: num(GP_IMAGO, 'Captures solitaires'),
  captures_trans: num(GP_IMAGO, 'Captures transiens'),
  captures_greg: num(GP_IMAGO, 'Captures grégaires'),
  stade_imago: txt(GP_IMAGO, 'Stade imago'),
  stades_imago: json(GP_IMAGO, 'Stades imago'),
  essaim_observe: bool(GP_IMAGO, 'Essaim observé'),
  type_cible: lst(GP_IMAGO, 'Type de cible'),
  direction_de: txt(GP_IMAGO, 'Direction — de'),
  direction_vers: txt(GP_IMAGO, 'Direction — vers'),
  etat: enu(GP_IMAGO, 'État'),
  essaim_en_vol: bool(GP_IMAGO, 'Essaim en vol'),
  essaim_pose: bool(GP_IMAGO, 'Essaim posé'),

  densites_larve: json(GP_LARVE, 'Densités par stade larvaire'),
  tache_larvaire: bool(GP_LARVE, 'Tache larvaire'),
  bande_larvaire: bool(GP_LARVE, 'Bande larvaire'),
  interdistance: num(GP_LARVE, 'Interdistance', 'm'),
  deplacement: enu(GP_LARVE, 'Déplacement'),
  surface_contaminee_ha: num(GP_LARVE, 'Surface contaminée', 'ha'),
}

type Inf = InfestationBdd
const GI_GEN = 'Infestation'
const GI_IMAGO = 'Imago (vol clair / essaim)'
const GI_LARVE = 'Larve (tache / bande larvaire)'

/** Tables `prospection_infestation` + sous-types `_imago` et `_larve` (aplatis par l'API). */
export const CATALOGUE_INFESTATION: { [K in keyof Inf]-?: Colonne<Inf> } = {
  id: txt(GI_GEN, 'Identifiant'),
  espece: txt(GI_GEN, 'Espèce'),
  type_cible: enu(GI_GEN, 'Type de cible'),
  taille_min: num(GI_GEN, 'Taille min'),
  taille_max: num(GI_GEN, 'Taille max'),
  taille_moy: num(GI_GEN, 'Taille moyenne'),
  surface_totale: num(GI_GEN, 'Surface totale'),
  densite_min: num(GI_GEN, 'Densité min'),
  densite_max: num(GI_GEN, 'Densité max'),
  densite_moy: num(GI_GEN, 'Densité moyenne'),
  interdistance: num(GI_GEN, 'Interdistance'),
  comportement: enu(GI_GEN, 'Comportement'),
  direction_de: txt(GI_GEN, 'Direction — de'),
  direction_vers: txt(GI_GEN, 'Direction — vers'),
  vent_de: txt(GI_GEN, 'Vent — de'),
  vent_vitesse: num(GI_GEN, 'Vent — vitesse'),

  pullulation_nb: num(GI_IMAGO, 'Pullulation (nombre)'),
  taille_long: num(GI_IMAGO, 'Longueur'),
  taille_large: num(GI_IMAGO, 'Largeur'),
  taille_epaisseur: num(GI_IMAGO, 'Épaisseur'),
  essaim_en_vol: bool(GI_IMAGO, 'Essaim en vol'),
  essaim_pose: bool(GI_IMAGO, 'Essaim posé'),
  type_essaim: enu(GI_IMAGO, "Type d'essaim"),
  heure_observation: txt(GI_IMAGO, "Heure d'observation"),
  densite_en_vol: num(GI_IMAGO, 'Densité en vol'),
  dimension_ha: num(GI_IMAGO, 'Dimension', 'ha'),

  nb_taches_bandes: num(GI_LARVE, 'Nombre de taches / bandes'),
  interdistance_m: num(GI_LARVE, 'Interdistance', 'm'),
  interdistance_min: num(GI_LARVE, 'Interdistance min'),
  interdistance_max: num(GI_LARVE, 'Interdistance max'),
  interdistance_moy: num(GI_LARVE, 'Interdistance moyenne'),
  surface_contaminee_ha: num(GI_LARVE, 'Surface contaminée', 'ha'),
  type_larve: enu(GI_LARVE, 'Type de larve'),
  surface_infestee_pourcent: num(GI_LARVE, 'Surface infestée', '%'),
  stade_dominant: txt(GI_LARVE, 'Stade dominant'),
  taille_groupe_m2: num(GI_LARVE, 'Taille du groupe', 'm²'),
  front_longueur_m: num(GI_LARVE, 'Front — longueur', 'm'),
  front_largeur_m: num(GI_LARVE, 'Front — largeur', 'm'),
  densite_max_front: num(GI_LARVE, 'Densité max du front'),
  densite_moy_arriere_front: num(GI_LARVE, "Densité moyenne à l'arrière du front"),
}

/** Table `prospection_capture` : une ligne du tableau par ligne de la table. */
export const CATALOGUE_CAPTURE: { [K in keyof CaptureBdd]-?: Colonne<CaptureBdd> } = {
  id: txt('Capture', 'Identifiant'),
  espece: txt('Capture', 'Espèce'),
  categorie: enu('Capture', 'Catégorie'),
  sexe: txt('Capture', 'Sexe'),
  phase: enu('Capture', 'Phase'),
  stade: txt('Capture', 'Stade'),
  effectif: num('Capture', 'Effectif'),
}

/** Table `prospection_operation_aerienne`. */
export const CATALOGUE_OPERATION: { [K in keyof OperationBdd]-?: Colonne<OperationBdd> } = {
  id: txt('Opération', 'Identifiant'),
  numero: num('Opération', 'N°'),
  type_operation: enu('Opération', 'Type'),
  motif_divers: txt('Opération', 'Motif (divers)'),
  debut_heure: txt('Opération', 'Début — heure'),
  debut_temperature_c: num('Opération', 'Début — température', '°C'),
  debut_vent_ms: num('Opération', 'Début — vent', 'm/s'),
  fin_heure: txt('Opération', 'Fin — heure'),
  fin_temperature_c: num('Opération', 'Fin — température', '°C'),
  fin_vent_ms: num('Opération', 'Fin — vent', 'm/s'),
  duree_minutes: num('Opération', 'Durée', 'min'),
}

// ---------------------------------------------------------------------------
// Construction des lignes
// ---------------------------------------------------------------------------

export interface LigneBdd {
  /** Table.colonne d'origine — affichée en infobulle. */
  origine: string
  colonne: string
  label: string
  valeur: string
  /** Valeur absente en base (NULL, liste vide) : grisée, jamais masquée. */
  vide: boolean
}

export interface GroupeBdd {
  titre: string
  lignes: LigneBdd[]
}

export interface MetaGroupe<R> {
  titre: string
  /** Groupe attendu pour ce type de fiche ; sinon il n'apparaît que s'il porte une donnée. */
  applicable?: (rec: R) => boolean
}

function cheminLisible(chemin: string[]): string {
  return chemin.map((c) => c.replace(/_/g, ' ')).join(' › ')
}

function valeurJson(v: unknown): string {
  if (v == null) return TIRET
  if (typeof v === 'boolean') return fBool(v)
  if (typeof v === 'number') return fNombre(v)
  if (Array.isArray(v)) return v.length === 0 ? TIRET : v.map(valeurJson).join(', ')
  return String(v)
}

/** Aplatit un JSONB en lignes `chemin › valeur`, sans rien omettre (zéros compris). */
export function aplatirJson(v: unknown, chemin: string[] = []): { chemin: string[]; valeur: string }[] {
  if (v == null) return []
  if (Array.isArray(v) && v.every((x) => x == null || typeof x !== 'object')) {
    return [{ chemin, valeur: valeurJson(v) }]
  }
  if (typeof v === 'object') {
    return Object.entries(v as Record<string, unknown>).flatMap(([cle, sous]) => {
      if (sous == null) return [{ chemin: [...chemin, cle], valeur: TIRET }]
      return aplatirJson(sous, [...chemin, cle])
    })
  }
  return [{ chemin, valeur: valeurJson(v) }]
}

function lignesColonne<R>(
  table: string,
  cle: string,
  def: ScalaireOuJson<R>,
  rec: R,
  ctx: ContexteFiche,
): LigneBdd[] {
  const valeur = (rec as Record<string, unknown>)[cle]
  const origine = `${table}.${cle}`
  if ('json' in def) {
    const lignes = aplatirJson(valeur).map((l) => ({
      origine,
      colonne: cle,
      label: `${def.label} › ${cheminLisible(l.chemin)}`,
      valeur: l.valeur,
      vide: l.valeur === TIRET,
    }))
    return lignes.length > 0
      ? lignes
      : [{ origine, colonne: cle, label: def.label, valeur: TIRET, vide: true }]
  }
  const texte = def.fmt(valeur, ctx, rec)
  return [{ origine, colonne: cle, label: def.label, valeur: texte, vide: texte === TIRET }]
}

type ScalaireOuJson<R> = ColonneScalaire<R> | ColonneJson

function estAffichee<R>(def: Colonne<R>): def is ScalaireOuJson<R> {
  return !('ailleurs' in def)
}

function construire<R>(
  table: string,
  rec: R,
  catalogue: Record<string, Colonne<R>>,
  ordre: MetaGroupe<R>[],
  ctx: ContexteFiche,
): { groupes: GroupeBdd[]; sansDonnees: string[] } {
  const groupes: GroupeBdd[] = []
  const sansDonnees: string[] = []
  for (const meta of ordre) {
    const lignes = Object.entries(catalogue).flatMap(([cle, def]) =>
      estAffichee(def) && def.groupe === meta.titre ? lignesColonne(table, cle, def, rec, ctx) : [],
    )
    if (lignes.length === 0) continue
    const applicable = meta.applicable?.(rec) ?? true
    if (applicable || lignes.some((l) => !l.vide)) groupes.push({ titre: meta.titre, lignes })
    else sansDonnees.push(meta.titre)
  }
  return { groupes, sansDonnees }
}

const estExtensifAerien = (p: P) => p.type_prospection === 'extensive' && p.mode_extensif === 'aerien'

export const GROUPES_PROSPECTION: MetaGroupe<P>[] = [
  { titre: G_ID },
  { titre: G_TRACE },
  { titre: G_LOC },
  { titre: G_SURF },
  { titre: G_MILIEU },
  { titre: G_SIGNAL, applicable: (p) => p.type_prospection === 'validation' },
  { titre: G_EQUIPE, applicable: estExtensifAerien },
  { titre: G_BASE1, applicable: estExtensifAerien },
  { titre: G_BASE2, applicable: estExtensifAerien },
  { titre: G_PESTI, applicable: estExtensifAerien },
  { titre: G_SIGN, applicable: estExtensifAerien },
]

export const GROUPES_POPULATION: MetaGroupe<Pop>[] = [
  { titre: GP_GEN },
  { titre: GP_IMAGO, applicable: (p) => p.categorie === 'imago' },
  { titre: GP_LARVE, applicable: (p) => p.categorie === 'larve' },
]

const CIBLES_IMAGO = ['vol_clair', 'dense', 'tres_dense']
const CIBLES_LARVE = ['tache_larvaire', 'bande_larvaire']

export const GROUPES_INFESTATION: MetaGroupe<Inf>[] = [
  { titre: GI_GEN },
  { titre: GI_IMAGO, applicable: (i) => CIBLES_IMAGO.includes(i.type_cible) },
  { titre: GI_LARVE, applicable: (i) => CIBLES_LARVE.includes(i.type_cible) },
]

/**
 * Groupes de la table `prospection`. `sansDonnees` liste les groupes qui ne
 * concernent pas ce type de fiche ET dont toutes les colonnes sont NULL : ils
 * sont annoncés plutôt que masqués en silence.
 */
export function groupesProspection(p: P, ctx: ContexteFiche) {
  return construire('prospection', p, CATALOGUE_PROSPECTION, GROUPES_PROSPECTION, ctx)
}

export function groupesPopulation(p: Pop, ctx: ContexteFiche) {
  return construire('prospection_population', p, CATALOGUE_POPULATION, GROUPES_POPULATION, ctx)
}

export function groupesInfestation(i: Inf, ctx: ContexteFiche) {
  return construire(
    'prospection_infestation',
    i,
    CATALOGUE_INFESTATION,
    GROUPES_INFESTATION,
    ctx,
  )
}

export interface ColonneTable<R> {
  cle: keyof R & string
  label: string
  fmt: (rec: R) => string
}

/** Colonnes d'un tableau (captures, opérations) : une colonne par colonne de la table. */
export function colonnesTable<R>(
  catalogue: Record<string, Colonne<R>>,
  ctx: ContexteFiche,
): ColonneTable<R>[] {
  return Object.entries(catalogue).flatMap(([cle, def]) =>
    'fmt' in def
      ? [
          {
            cle: cle as keyof R & string,
            label: def.label,
            fmt: (rec: R) => def.fmt((rec as Record<string, unknown>)[cle], ctx, rec),
          },
        ]
      : [],
  )
}

// ---------------------------------------------------------------------------
// Journal d'audit (table `audit_log`) — lignes réelles uniquement
// ---------------------------------------------------------------------------

/** Valeurs autorisées par la contrainte `ck_audit_log_action`. */
const ACTION_LABELS: Record<string, string> = {
  creation: 'Création',
  modification: 'Modification',
  soumission: 'Soumission',
  verification: 'Vérification',
  validation: 'Validation',
  rejet: 'Rejet',
  commentaire: 'Commentaire',
}

export interface EntreeAudit {
  id: string
  action: string
  label: string
  auteur: string
  quand: string
  /** Contenu de `details` (ex. motif d'un rejet, commentaire), aplati. */
  details: { chemin: string; valeur: string }[]
}

/** Entrées de `audit_log`, de la plus ancienne à la plus récente ; aucune étape inventée. */
export function entreesAudit(auditLog: AuditBdd[], nomAuteur: (id: string) => string): EntreeAudit[] {
  return [...auditLog]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((e) => ({
      id: e.id,
      action: e.action,
      label: ACTION_LABELS[e.action] ?? humaniser(e.action),
      auteur: nomAuteur(e.auteur_id),
      quand: fHorodatage(e.created_at),
      details: aplatirJson(e.details).map((l) => ({
        chemin: cheminLisible(l.chemin),
        valeur: l.valeur,
      })),
    }))
}
