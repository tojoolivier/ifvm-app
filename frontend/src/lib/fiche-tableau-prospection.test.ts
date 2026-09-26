import { describe, expect, it } from 'vitest'
import {
  CAPTURES,
  INFESTATION_IMAGO,
  INFESTATION_LARVE,
  POPULATION_IMAGO,
  POPULATION_LARVE,
} from '@/test/prospection-fixtures'
import {
  effectif,
  infestationParType,
  libelleEssaim,
  nomEspece,
  phasesLarve,
  phenologie,
  populationDe,
} from './fiche-tableau-prospection'

describe('effectif', () => {
  it("lit l'effectif de la case espèce × catégorie × sexe × phase × stade", () => {
    expect(effectif(CAPTURES, 'LMC', 'imago', 'F', 'solitaire', 'A3')).toBe(4)
    expect(effectif(CAPTURES, 'LMC', 'imago', 'M', 'gregaire', 'A4')).toBe(3)
  })

  it('cumule plusieurs lignes tombant dans la même case', () => {
    const doublon = { ...CAPTURES[0], id: 'cap-x', effectif: 6 }
    expect(effectif([...CAPTURES, doublon], 'LMC', 'imago', 'F', 'solitaire', 'A3')).toBe(10)
  })

  it("distingue le sexe NULL d'une larve du sexe d'un imago", () => {
    expect(effectif(CAPTURES, 'NSE', 'larve', null, 'transiens', 'L2')).toBe(9)
    expect(effectif(CAPTURES, 'NSE', 'larve', 'F', 'transiens', 'L2')).toBe(0)
  })
})

describe('populationDe', () => {
  it("retrouve la population d'une espèce et d'une catégorie", () => {
    const populations = [POPULATION_IMAGO, POPULATION_LARVE]
    expect(populationDe(populations, 'LMC', 'imago')?.id).toBe('pop-imago')
    expect(populationDe(populations, 'NSE', 'larve')?.id).toBe('pop-larve')
    expect(populationDe(populations, 'NSE', 'imago')).toBeUndefined()
  })
})

describe('infestationParType', () => {
  it("retrouve l'infestation d'un type de cible", () => {
    expect(infestationParType([INFESTATION_LARVE], 'tache_larvaire')?.id).toBe('inf-larve')
    expect(infestationParType([INFESTATION_LARVE], 'bande_larvaire')).toBeUndefined()
  })

  it('regroupe dense et très dense sous « Essaim »', () => {
    const dense = { ...INFESTATION_IMAGO, id: 'dense', type_cible: 'dense' as const }
    const tresDense = { ...INFESTATION_IMAGO, id: 'td', type_cible: 'tres_dense' as const }
    expect(infestationParType([dense], 'essaim')?.id).toBe('dense')
    expect(infestationParType([tresDense], 'essaim')?.id).toBe('td')
    expect(infestationParType([INFESTATION_LARVE], 'essaim')).toBeUndefined()
  })
})

describe('libellés', () => {
  it('phasesLarve retire « Solitaro-trans » pour NSE seulement', () => {
    expect(phasesLarve('LMC').map((p) => p.valeur)).toContain('solitaro_trans')
    expect(phasesLarve('NSE').map((p) => p.valeur)).not.toContain('solitaro_trans')
  })

  it("nomme l'espèce et le type d'essaim", () => {
    expect(nomEspece('LMC')).toBe('Locusta migratoria capito')
    expect(nomEspece('NSE')).toBe('Nomadacris septemfasciata')
    expect(libelleEssaim('tres_dense')).toBe('Très dense')
    expect(libelleEssaim('inconnu')).toBe('inconnu')
  })

  it('phenologie joint une liste, garde un texte et rend « — » sans valeur', () => {
    expect(phenologie(['a', 'b'])).toBe('a, b')
    expect(phenologie('fleur')).toBe('fleur')
    expect(phenologie(null)).toBe('—')
    expect(phenologie([])).toBe('—')
  })
})
