// Grilles de la fiche de prospection en tableaux — mêmes constantes et mêmes règles de
// sélection que `backend/app/presentation/prospection_pdf.py` (formulaires papier intensif et
// extensif). Hors composants : testable sans monter React.

import type { CaptureBdd, InfestationBdd, PopulationBdd } from './prospection-fiche-bdd'

export const PHASES_IMAGO: { valeur: string; label: string }[] = [
  { valeur: 'solitaire', label: 'Solitaires' },
  { valeur: 'solitaro_trans', label: 'Solitaro-trans' },
  { valeur: 'transiens', label: 'Transiens' },
  { valeur: 'gregaire', label: 'Grégaires' },
]

export const STADES_IMAGO_INTENSIF = ['A1', 'A2', 'A3', 'A3-1/4', 'A3-1/2', 'A3-3/4', 'A3-4/4', 'A4', 'A5']
export const STADES_IMAGO_EXTENSIF = ['A1', 'A2', 'A3', 'A4', 'A5']
export const STADES_LARVE_LMC = ['L1', 'L2', 'L3', 'L4', 'L5']
export const STADES_LARVE_NSE = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7']
/** L'extensif s'arrête à L6 pour NSE (formulaire papier extensif). */
export const STADES_LARVE_NSE_EXTENSIF = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6']

export const NIVEAUX_POPULATION: { valeur: string; label: string }[] = [
  { valeur: 'neant', label: 'Néant' },
  { valeur: 'rare', label: 'Rare' },
  { valeur: 'peu', label: 'Peu' },
  { valeur: 'beaucoup', label: 'Beaucoup' },
  { valeur: 'dominant', label: 'Dominant' },
]

export const TYPES_INFESTATION_INTENSIF: { valeur: string; label: string }[] = [
  { valeur: 'tache_larvaire', label: 'Tache L' },
  { valeur: 'bande_larvaire', label: 'Bande L' },
  { valeur: 'vol_clair', label: 'Vol clair' },
  { valeur: 'essaim', label: 'Essaim' },
]

export const STRATES: { cle: string; label: string }[] = [
  { cle: 'arboree', label: 'Strate arborée' },
  { cle: 'arbustive', label: 'Strate arbustive' },
  { cle: 'buissonneuse', label: 'Strate buissonneuse' },
  { cle: 'herbeuse', label: 'Strate herbeuse' },
  { cle: 'cultures_seches', label: 'Cultures sèches' },
  { cle: 'cultures_hygro', label: 'Cultures hygrophiles' },
]

export const DEGATS: { valeur: string; label: string }[] = [
  { valeur: 'nuls', label: 'Nuls' },
  { valeur: 'faibles', label: 'Faibles' },
  { valeur: 'moyens', label: 'Moyens' },
  { valeur: 'forts', label: 'Forts' },
]
export const HUMIDITES: { valeur: string; label: string }[] = [
  { valeur: 'surface', label: 'Surf.' },
  { valeur: '0_5cm', label: '0,5 cm' },
  { valeur: '5_12cm', label: '5-12 cm' },
  { valeur: '12_30cm', label: '12-30 cm' },
  { valeur: 'gt_30cm', label: '>30cm' },
]
export const TEXTURES: { valeur: string; label: string }[] = [
  { valeur: 'argileuse', label: 'Argileuse' },
  { valeur: 'limoneuse', label: 'Limoneuse' },
  { valeur: 'sable_fin', label: 'Sable fin' },
  { valeur: 'sable_grossier', label: 'Sable grossier' },
  { valeur: 'gravier', label: 'Gravier' },
  { valeur: 'cailloux', label: 'Cailloux' },
  { valeur: 'bloc', label: 'Bloc' },
]

const LIBELLES_ESSAIM: Record<string, string> = {
  vol_clair: 'Vol Clair',
  dense: 'Dense',
  tres_dense: 'Très dense',
}

export function libelleEssaim(typeCible: string): string {
  return LIBELLES_ESSAIM[typeCible] ?? typeCible
}

export function nomEspece(espece: string): string {
  return espece === 'LMC' ? 'Locusta migratoria capito' : 'Nomadacris septemfasciata'
}

/** Effectif cumulé des captures d'une case de la grille (espèce × catégorie × sexe × phase × stade). */
export function effectif(
  captures: CaptureBdd[],
  espece: string,
  categorie: string,
  sexe: string | null,
  phase: string,
  stade: string,
): number {
  return captures
    .filter(
      (c) =>
        c.espece === espece &&
        c.categorie === categorie &&
        (c.sexe ?? null) === sexe &&
        c.phase === phase &&
        c.stade === stade,
    )
    .reduce((somme, c) => somme + c.effectif, 0)
}

/** Première population de l'espèce et de la catégorie — le PDF n'en lit qu'une. */
export function populationDe(
  populations: PopulationBdd[],
  espece: string,
  categorie: string,
): PopulationBdd | undefined {
  return populations.find((p) => p.espece === espece && p.categorie === categorie)
}

/** Infestation d'un type de la grille intensive ; « Essaim » regroupe dense et très dense. */
export function infestationParType(
  infestations: InfestationBdd[],
  typeCible: string,
): InfestationBdd | undefined {
  if (typeCible === 'essaim') {
    return infestations.find((i) => i.type_cible === 'dense' || i.type_cible === 'tres_dense')
  }
  return infestations.find((i) => i.type_cible === typeCible)
}

/** Phases des grilles de larves : NSE n'a pas de phase « Solitaro-trans » (formulaire papier). */
export function phasesLarve(espece: string) {
  return espece === 'LMC' ? PHASES_IMAGO : PHASES_IMAGO.filter((p) => p.valeur !== 'solitaro_trans')
}

/** Phénologie d'une strate : liste jointe par des virgules, texte tel quel, « — » si vide. */
export function phenologie(valeurs: unknown): string {
  // Une liste vide vaut « rien » comme dans le PDF (`not []` en Python), pas en JavaScript.
  if (!valeurs || (Array.isArray(valeurs) && valeurs.length === 0)) return '—'
  if (Array.isArray(valeurs)) return valeurs.map(String).join(', ')
  return String(valeurs)
}
