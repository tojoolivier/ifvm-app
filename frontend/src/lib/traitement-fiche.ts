/**
 * Dérivations de la fiche de traitement — maquette §7 (README du handoff et
 * bloc `data-screen-label="Traitements"` du prototype, lignes 588-737).
 *
 * Tout ce qui est calculé ici est **dérivé** : la maquette impose que les
 * champs `surface_*`, `total_pesticide_l` et `nb_rotations` ne soient jamais
 * saisissables côté web, et le compteur de signatures n'est qu'une lecture de
 * la matrice des rôles. Les regrouper hors des composants les rend testables
 * sans monter React.
 */
import { ROLE_LABELS, SIGNATURE_ROLES } from './traitement-labels'

/** Référentiel des zones exposées — aligné sur `mobile/src/app/(traitement)/moyens.tsx`. */
export const ZONES_EXPOSEES: { key: string; label: string }[] = [
  { key: 'habitations', label: 'Habitations' },
  { key: 'points_eau', label: "Points d'eau" },
  { key: 'cultures', label: 'Cultures' },
  { key: 'paturages', label: 'Pâturages' },
  { key: 'aire_protegee', label: 'Aire protégée' },
  { key: 'ruchers', label: 'Ruchers' },
]

/** Axes d'évaluation du risque — aligné sur `mobile/src/app/(traitement)/impacts.tsx`. */
export const AXES_RISQUE: { key: string; label: string }[] = [
  { key: 'ressources_eau', label: 'Ressources en eau' },
  { key: 'sol', label: 'Sol' },
  { key: 'faune_non_cible', label: 'Faune non cible' },
  { key: 'abeilles', label: 'Abeilles / pollinisateurs' },
]

export type KitEpiKey =
  | 'kit_combinaison'
  | 'kit_gants'
  | 'kit_lunettes'
  | 'kit_masques'
  | 'kit_botte'

/**
 * Kits EPI — `kit_boite` (boîte à pharmacie) a été renommée `kit_botte`
 * (bottes) par la migration backend 0040, à la demande du métier ; le web
 * gardait l'ancien nom, donc `traitement.kit_boite` valait toujours
 * `undefined` et la pastille restait rouge quoi qu'il arrive.
 *
 * Migration 0040 fait aussi passer les 5 colonnes de booléen à un nombre de
 * personnes équipées — la pastille reste dérivée de « > 0 » mais le compte
 * réel est affiché à côté (cf. TraitementDetailPage).
 */
export const KITS_EPI: { key: KitEpiKey; label: string }[] = [
  { key: 'kit_combinaison', label: 'Combinaison' },
  { key: 'kit_gants', label: 'Gants' },
  { key: 'kit_lunettes', label: 'Lunettes' },
  { key: 'kit_masques', label: 'Masques' },
  { key: 'kit_botte', label: 'Botte' },
]

/**
 * Badge de niveau de risque — les trois tons de la maquette (prototype
 * ligne 1470) : vert faible, ambre moyen, rouge élevé. Le backend stocke un
 * JSONB libre, on tolère donc casse et accents.
 */
const NIVEAUX_RISQUE: Record<string, { label: string; className: string }> = {
  FAIBLE: {
    label: 'Faible',
    className: 'bg-ifvm-green-bg text-ifvm-green-text border-ifvm-green-border',
  },
  MOYEN: {
    label: 'Moyen',
    className: 'bg-ifvm-amber-bg text-ifvm-amber-text border-ifvm-amber-border',
  },
  ELEVE: {
    label: 'Élevé',
    className: 'bg-ifvm-danger-bg text-ifvm-danger-text border-ifvm-danger-border',
  },
}

function normaliseNiveau(valeur: unknown): string | null {
  if (typeof valeur !== 'string') return null
  const sansAccent = valeur
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
  return sansAccent || null
}

export interface SignatureLike {
  role: string
  signataire_nom: string
}

export interface TraitementResponsableLike {
  aerien: { pilote: string } | null
  signatures: SignatureLike[]
}

/**
 * Colonne « Responsable » : la maquette affiche « nom (rôle) » — par exemple
 * `Rakoto A. (chef de base)` sur une fiche aérienne et
 * `Soa Lalao (chef d'équipe)` en terrestre (prototype ligne 1441). C'est donc
 * le responsable **hiérarchique** qui est attendu, pas le pilote : celui-ci ne
 * sert que de repli quand aucun chef n'a signé.
 */
const RESPONSABLES_PAR_PRIORITE = ['CHEF_DE_BASE', 'CHEF_EQUIPE'] as const

export function responsableTraitement(traitement: TraitementResponsableLike): string {
  for (const role of RESPONSABLES_PAR_PRIORITE) {
    const signature = traitement.signatures.find((s) => s.role === role)
    if (signature) {
      return `${signature.signataire_nom} (${(ROLE_LABELS[role] ?? role).toLowerCase()})`
    }
  }
  if (traitement.aerien?.pilote) {
    return `${traitement.aerien.pilote} (${ROLE_LABELS.PILOTE.toLowerCase()})`
  }
  // La maquette n'affiche jamais de case vide — d'où le tiret cadratin.
  return '—'
}

/**
 * Horodatage de signature : la maquette impose `2026-08-12 17:04` en mono, là
 * où le backend renvoie un ISO 8601 complet.
 */
export function formatHorodatage(valeur: string | null | undefined): string {
  if (!valeur) return '—'
  const date = new Date(valeur)
  if (Number.isNaN(date.getTime())) return valeur
  const deuxChiffres = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${deuxChiffres(date.getMonth() + 1)}-${deuxChiffres(date.getDate())}` +
    ` ${deuxChiffres(date.getHours())}:${deuxChiffres(date.getMinutes())}`
  )
}

/** `06:00:00` → `06:00` : la maquette ne montre jamais les secondes. */
export function formatHeure(valeur: string | null | undefined): string {
  if (!valeur) return '—'
  const [heures, minutes] = valeur.split(':')
  return minutes ? `${heures}:${minutes}` : valeur
}

/**
 * Ligne d'impact de la maquette : « Non », « Oui », ou « Oui — <détail> ».
 * Les trois lignes (empoisonnement, comportement, mortalité) ont la même
 * forme — la factoriser évite qu'elles divergent.
 */
export function libelleImpact(actif: boolean, detail?: string | null): string {
  if (!actif) return 'Non'
  return detail ? `Oui — ${detail}` : 'Oui'
}

/** « 2 espèces non cibles », « 1 famille » — accord au pluriel compris. */
export function resumeEspeces(
  liste: string[],
  singulier: string,
  pluriel: string,
): string | null {
  if (liste.length === 0) return null
  return `${liste.length} ${liste.length > 1 ? pluriel : singulier}`
}

/**
 * Compteur « n/5 » de la colonne Signatures. Le dénominateur est la matrice
 * fixe des 5 rôles backend, pas le nombre de lignes reçues : une signature
 * portant un rôle inconnu ne doit pas gonfler le compteur.
 */
export function compteurSignatures(signatures: SignatureLike[]): {
  libelle: string
  complet: boolean
} {
  const rolesSignes = new Set(
    signatures.map((s) => s.role).filter((role) => SIGNATURE_ROLES.includes(role)),
  )
  return {
    libelle: `${rolesSignes.size}/${SIGNATURE_ROLES.length}`,
    complet: rolesSignes.size === SIGNATURE_ROLES.length,
  }
}

/**
 * Surfaces en mono fr-FR (« 1 200 »). Le backend sérialise les `Numeric` en
 * chaîne : on les accepte pour éviter un « 860.00 » brut dans la colonne.
 */
export function formatSurface(valeur: number | string | null | undefined): string {
  if (valeur == null || valeur === '') return '—'
  const nombre = typeof valeur === 'number' ? valeur : Number(valeur)
  if (!Number.isFinite(nombre)) return '—'
  return nombre.toLocaleString('fr-FR')
}

/**
 * Ce qu'un traitement fait de sa surface dépend du produit : un produit de
 * choc (`mode_traitement` TOTAL) *traite* la surface infestée, un produit de
 * barrière (BARRIERE) la *protège* (#surface-bloc-mode-infestee, cf.
 * `valider_surfaces_bloc` côté backend). Le backend stocke deux colonnes
 * distinctes, `surface_traitee_ha` (choc) et `surface_protegee_ha` (barrière),
 * jamais renseignées ensemble — pour l'Aérien depuis la migration 0081, pour
 * le Terrestre depuis la migration 0083 (généralisée : une équipe au sol peut
 * elle aussi appliquer un produit de barrière). Le mode seul décide, quel que
 * soit le type de traitement.
 */
export function libelleSurfaceTraitee(traitement: {
  mode_traitement: string | null
}): 'Traitée' | 'Protégée' {
  return traitement.mode_traitement === 'BARRIERE' ? 'Protégée' : 'Traitée'
}

type Surface = number | string | null

/**
 * La surface à montrer pour une fiche : la colonne `surface_protegee_ha` en
 * mode barrière, sinon `surface_traitee_ha` — aérien et terrestre confondus
 * depuis la migration 0083. Associée à `libelleSurfaceTraitee`, qui la nomme.
 */
export function surfaceTraiteeOuProtegee(traitement: {
  mode_traitement: string | null
  aerien: { surface_traitee_ha?: Surface; surface_protegee_ha?: Surface } | null
  terrestre?: { surface_traitee_ha?: Surface; surface_protegee_ha?: Surface } | null
}): Surface | undefined {
  const protegee = libelleSurfaceTraitee(traitement) === 'Protégée'
  const specialisation = traitement.terrestre ?? traitement.aerien
  return protegee ? specialisation?.surface_protegee_ha : specialisation?.surface_traitee_ha
}

/** Zones cochées, dans l'ordre du référentiel ; les clés hors référentiel suivent. */
export function zonesExposeesLabels(zones: Record<string, unknown> | null | undefined): string[] {
  if (!zones) return []
  const connues = ZONES_EXPOSEES.filter((z) => zones[z.key]).map((z) => z.label)
  const cataloguees = new Set(ZONES_EXPOSEES.map((z) => z.key))
  const inconnues = Object.keys(zones).filter((key) => !cataloguees.has(key) && zones[key])
  return [...connues, ...inconnues]
}

export interface AxeRisque {
  key: string
  label: string
  niveau: string
  className: string
}

/** Axes renseignés seulement : un badge sans niveau n'existe pas dans la maquette. */
export function axesRisque(evaluation: Record<string, unknown> | null | undefined): AxeRisque[] {
  if (!evaluation) return []
  return AXES_RISQUE.flatMap((axe) => {
    const niveau = normaliseNiveau(evaluation[axe.key])
    if (!niveau) return []
    const rendu = NIVEAUX_RISQUE[niveau]
    return [
      {
        key: axe.key,
        label: axe.label,
        niveau: rendu?.label ?? String(evaluation[axe.key]),
        className:
          rendu?.className ??
          'bg-ifvm-brouillon-bg text-ifvm-brouillon-text border-ifvm-brouillon-border',
      },
    ]
  })
}

/**
 * `comportement_non_cibles` / `mortalite_familles` : le mobile envoie un
 * tableau, le schéma Pydantic les type `dict`. On lit les deux formes plutôt
 * que de parier sur l'une — c'est ce genre d'écart qui vide un écran.
 */
export function especesListees(valeur: unknown): string[] {
  if (Array.isArray(valeur)) return valeur.map(String)
  if (valeur && typeof valeur === 'object') {
    return Object.entries(valeur as Record<string, unknown>)
      .filter(([, v]) => v)
      .map(([k]) => k)
  }
  return []
}
