import { describe, expect, it } from 'vitest'
import { buildRepartitionTypes, libelleType, rangCouleurType } from './dashboard-repartition'
import type { DashboardProspection } from './dashboard-metrics'

function prospection(over: Partial<DashboardProspection> = {}): DashboardProspection {
  return {
    id: 'p1',
    type_prospection: 'intensive',
    campagne_id: 'c1',
    station_id: null,
    prospecteur_id: 'u1',
    statut: 'validee',
    n_fiche: 'PR-1',
    date_prospection: '2025-10-05',
    surface_prospectee: 100,
    surface_infestee: 10,
    created_at: '2025-10-05T08:00:00Z',
    updated_at: '2025-10-05T08:00:00Z',
    ...over,
  }
}

const FICHES = [
  prospection({ id: 'a', type_prospection: 'intensive', surface_prospectee: 300 }),
  prospection({ id: 'b', type_prospection: 'intensive', surface_prospectee: 100 }),
  prospection({ id: 'c', type_prospection: 'intensive', surface_prospectee: null }),
  prospection({ id: 'd', type_prospection: 'extensive', surface_prospectee: 1000 }),
  prospection({ id: 'e', type_prospection: 'validation', surface_prospectee: 50 }),
]

describe('buildRepartitionTypes', () => {
  it('compte les fiches par type, du plus fréquent au moins fréquent', () => {
    const parts = buildRepartitionTypes(FICHES, 'fiches')
    expect(parts.map((p) => [p.type, p.nFiches, p.pct])).toEqual([
      ['intensive', 3, 60],
      ['extensive', 1, 20],
      ['validation', 1, 20],
    ])
    expect(parts.map((p) => p.label)).toEqual(['Intensive', 'Extensive', 'Validation'])
  })

  it('bascule sur la surface prospectée, où l’ordre peut s’inverser', () => {
    const parts = buildRepartitionTypes(FICHES, 'surface')
    // 1 000 ha en extensive contre 400 ha en intensive : ici l'extensive domine.
    expect(parts.map((p) => [p.type, p.valeur])).toEqual([
      ['extensive', 1000],
      ['intensive', 400],
      ['validation', 50],
    ])
    expect(parts[0].pct).toBe(69)
    // Le nombre de fiches reste disponible quelle que soit la mesure.
    expect(parts.find((p) => p.type === 'intensive')?.nFiches).toBe(3)
  })

  it('ne fait apparaître que les types réellement présents', () => {
    const parts = buildRepartitionTypes(
      [prospection({ id: 'a' }), prospection({ id: 'b' })],
      'fiches',
    )
    expect(parts).toHaveLength(1)
    expect(parts[0]).toMatchObject({ type: 'intensive', pct: 100 })
  })

  it('accepte un type inconnu sans changement de code', () => {
    const parts = buildRepartitionTypes(
      [prospection({ id: 'a', type_prospection: 'aerienne' })],
      'fiches',
    )
    expect(parts[0]).toMatchObject({ type: 'aerienne', label: 'Aerienne' })
  })

  it('ne divise jamais par zéro : total nul → 0 %', () => {
    const parts = buildRepartitionTypes(
      [prospection({ id: 'a', surface_prospectee: null })],
      'surface',
    )
    expect(parts[0]).toMatchObject({ valeur: 0, pct: 0 })
  })

  it('renvoie une liste vide sans fiche', () => {
    expect(buildRepartitionTypes([], 'fiches')).toEqual([])
  })
})

describe('rangCouleurType', () => {
  it('attache la couleur au type, pas à son rang du moment', () => {
    // Que « validation » soit seul ou avec les autres, son rang ne bouge pas.
    expect(rangCouleurType('validation', ['validation'])).toBe(2)
    expect(rangCouleurType('validation', ['intensive', 'extensive', 'validation'])).toBe(2)
    expect(rangCouleurType('intensive', ['extensive'])).toBe(0)
  })

  it('range les types inconnus après les connus, par ordre alphabétique', () => {
    const presents = ['intensive', 'zeta', 'alpha']
    expect(rangCouleurType('alpha', presents)).toBe(3)
    expect(rangCouleurType('zeta', presents)).toBe(4)
  })
})

describe('libelleType', () => {
  it('nomme les types connus et met une majuscule aux autres', () => {
    expect(libelleType('validation')).toBe('Validation')
    expect(libelleType('nouveau')).toBe('Nouveau')
  })
})
