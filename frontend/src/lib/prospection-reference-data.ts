const STADES_LMC_LARVE = ['A1', 'A2', 'A3', 'A3-1/4', 'A3-2/4', 'A3-3/4', 'A3-4/4', 'A4', 'A5']
const STADES_NSE_LARVE = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7']

export function getStades(espece: string, categorie: string): string[] {
  if (categorie === 'imago') return ['imago']
  if (espece === 'LMC') return STADES_LMC_LARVE
  if (espece === 'NSE') return STADES_NSE_LARVE
  return []
}

export const PHASES = [
  { value: 'solitaire', label: 'Solitaire' },
  { value: 'solitaro_trans', label: 'Solitaro-transiens' },
  { value: 'transiens', label: 'Transiens' },
  { value: 'gregaire', label: 'Grégaire' },
]

// Accouplement/Ponte — 3 niveaux communs LMC/NSE (migration backend 0059,
// remplace les 5 niveaux d'origine issus du PDF papier).
export const ABONDANCE = [
  { value: 'neant', label: 'Néant' },
  { value: 'rare', label: 'Rare' },
  { value: 'beaucoup', label: 'Beaucoup' },
]

export const TYPES_INFESTATION = [
  { value: 'tache_larvaire', label: 'Tache larvaire' },
  { value: 'bande_larvaire', label: 'Bande larvaire' },
  { value: 'vol_clair', label: 'Vol clair' },
  { value: 'essaim', label: 'Essaim' },
]

export const STRATES_VEGETATION = [
  { key: 'H1', label: 'H1 — Herbe rase (< 10 cm)' },
  { key: 'H2', label: 'H2 — Herbe courte (10–50 cm)' },
  { key: 'H3', label: 'H3 — Herbe haute (> 50 cm)' },
  { key: 'A1', label: 'A1 — Arbuste bas (< 1 m)' },
  { key: 'A2', label: 'A2 — Arbuste haut (1–3 m)' },
  { key: 'Ar', label: 'Ar — Arbre (> 3 m)' },
  { key: 'L', label: 'L — Litière / sol nu' },
]

export const RECOUVREMENT_OPTIONS = ['0-25', '25-50', '50-75', '75-100']
export const PHENOLOGIE_OPTIONS = [
  { value: 'sec', label: 'Sec' },
  { value: 'vert', label: 'Vert' },
  { value: 'floraison', label: 'Floraison' },
  { value: 'fructification', label: 'Fructification' },
]
export const ACTIVITE_OPTIONS = [
  { value: 'nulle', label: 'Nulle' },
  { value: 'faible', label: 'Faible' },
  { value: 'forte', label: 'Forte' },
]

export const HUMIDITE_SOL = [
  { value: 'sec', label: 'Sec' },
  { value: 'frais', label: 'Frais' },
  { value: 'humide', label: 'Humide' },
  { value: 'tres_humide', label: 'Très humide' },
]

export const TEXTURE_SOL = [
  { value: 'sableux', label: 'Sableux' },
  { value: 'limoneux_sableux', label: 'Limoneux-sableux' },
  { value: 'limoneux', label: 'Limoneux' },
  { value: 'limoneux_argileux', label: 'Limoneux-argileux' },
  { value: 'argileux', label: 'Argileux' },
  { value: 'caillouteux', label: 'Caillouteux' },
]

export const STEPS = [
  { label: 'Général & Localisation' },
  { label: 'Captures & Population' },
  { label: 'Infestation, Végétation & Sol' },
  { label: 'Conditions & Récap.' },
]
