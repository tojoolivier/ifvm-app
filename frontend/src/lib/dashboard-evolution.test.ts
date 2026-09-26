import { describe, expect, it } from 'vitest'
import { buildEvolution, echelleY } from './dashboard-evolution'
import {
  sommeSurfaceInfestee,
  sommeSurfaceProtegee,
  sommeSurfaceTraitee,
  type DashboardProspection,
  type DashboardTraitement,
} from './dashboard-metrics'

function prospection(over: Partial<DashboardProspection> = {}): DashboardProspection {
  return {
    id: 'p1',
    type_prospection: 'intensive',
    campagne_id: 'c1',
    station_id: 's1',
    prospecteur_id: 'u1',
    statut: 'validee',
    n_fiche: 'PR-1',
    date_prospection: '2025-10-05',
    surface_prospectee: 400,
    surface_infestee: 100,
    created_at: '2025-10-05T08:00:00Z',
    updated_at: '2025-10-05T08:00:00Z',
    ...over,
  }
}

function traitement(over: Partial<DashboardTraitement> = {}): DashboardTraitement {
  return {
    id: 't1',
    prospection_id: 'p1',
    numero_fiche: 'CRT-1',
    type_traitement: 'TERRESTRE',
    date_traitement: '2025-10-06',
    localite: 'Zone',
    statut: 'validee',
    created_at: '2025-10-06T09:00:00Z',
    updated_at: '2025-10-06T09:00:00Z',
    aerien: null,
    terrestre: { surface_traitee_ha: 50, surface_protegee_ha: null },
    signatures: [],
    ...over,
  }
}

const decade = { granularite: 'decade', cumule: false } as const

describe('buildEvolution — regroupement par décade', () => {
  it('range chaque fiche dans sa décade et comble les décades vides par des zéros', () => {
    const points = buildEvolution(
      [
        prospection({ id: 'a', date_prospection: '2025-10-05', surface_infestee: 100 }),
        prospection({ id: 'b', date_prospection: '2025-10-10', surface_infestee: 20 }),
        // Saute la décade du 11 au 20 : elle doit exister, à zéro.
        prospection({ id: 'c', date_prospection: '2025-10-25', surface_infestee: 30 }),
      ],
      [],
      decade,
    )
    expect(points.map((p) => [p.cle, p.infestee])).toEqual([
      ['2025-10-1', 120],
      ['2025-10-2', 0],
      ['2025-10-3', 30],
    ])
    expect(points.map((p) => p.label)).toEqual(['1 oct.', '11 oct.', '21 oct.'])
  })

  it('la dernière décade court jusqu’à la fin du mois', () => {
    const [fevrier] = buildEvolution([prospection({ date_prospection: '2026-02-25' })], [], decade)
    expect(fevrier.libelleLong).toBe('21–28 févr. 2026')
    const [octobre] = buildEvolution([prospection({ date_prospection: '2025-10-25' })], [], decade)
    expect(octobre.libelleLong).toBe('21–31 oct. 2025')
  })

  it('sépare traitée et protégée selon la colonne renseignée', () => {
    const [point] = buildEvolution(
      [],
      [
        traitement({ id: 'a', terrestre: { surface_traitee_ha: 40, surface_protegee_ha: null } }),
        traitement({ id: 'b', terrestre: { surface_traitee_ha: null, surface_protegee_ha: 25 } }),
        traitement({
          id: 'c',
          type_traitement: 'AERIEN',
          terrestre: null,
          aerien: { pilote: 'R.', surface_traitee_ha: 0, surface_protegee_ha: 60 },
        }),
      ],
      decade,
    )
    expect(point.traitee).toBe(40 + 0)
    expect(point.protegee).toBe(25 + 60)
  })
})

describe('buildEvolution — cumul', () => {
  it('additionne d’une période à l’autre et finit sur les totaux des tuiles', () => {
    const prospections = [
      prospection({ id: 'a', date_prospection: '2025-10-05', surface_infestee: 100 }),
      prospection({ id: 'b', date_prospection: '2025-11-15', surface_infestee: 50 }),
    ]
    const traitements = [
      traitement({ id: 'a', date_traitement: '2025-10-06' }),
      traitement({
        id: 'b',
        date_traitement: '2025-12-02',
        terrestre: { surface_traitee_ha: null, surface_protegee_ha: 30 },
      }),
    ]
    const points = buildEvolution(prospections, traitements, {
      granularite: 'mois',
      cumule: true,
    })

    expect(points.map((p) => p.infestee)).toEqual([100, 150, 150])
    const dernier = points[points.length - 1]
    expect(dernier.infestee).toBe(sommeSurfaceInfestee(prospections))
    expect(dernier.traitee).toBe(sommeSurfaceTraitee(traitements).total)
    expect(dernier.protegee).toBe(sommeSurfaceProtegee(traitements))
  })

  it('en mode « par période », chaque point ne porte que sa propre période', () => {
    const points = buildEvolution(
      [
        prospection({ id: 'a', date_prospection: '2025-10-05', surface_infestee: 100 }),
        prospection({ id: 'b', date_prospection: '2025-11-15', surface_infestee: 50 }),
      ],
      [],
      { granularite: 'mois', cumule: false },
    )
    expect(points.map((p) => p.infestee)).toEqual([100, 50])
  })
})

describe('buildEvolution — axe du temps', () => {
  it('précise l’année au premier mois et en janvier', () => {
    const points = buildEvolution(
      [
        prospection({ id: 'a', date_prospection: '2025-12-10' }),
        prospection({ id: 'b', date_prospection: '2026-02-10' }),
      ],
      [],
      { granularite: 'mois', cumule: false },
    )
    expect(points.map((p) => p.label)).toEqual(['déc. 25', 'janv. 26', 'févr.'])
  })

  it('étend l’axe jusqu’aux bornes de la campagne, même sans fiche', () => {
    const points = buildEvolution([prospection({ date_prospection: '2025-11-05' })], [], {
      granularite: 'mois',
      cumule: true,
      debut: '2025-10-01',
      fin: '2026-01-31',
    })
    expect(points.map((p) => p.cle)).toEqual(['2025-10', '2025-11', '2025-12', '2026-01'])
    // Le cumul reste plat après la dernière fiche.
    expect(points.map((p) => p.infestee)).toEqual([0, 100, 100, 100])
  })

  it('n’écarte jamais une fiche qui sort des bornes : l’axe s’étend pour la contenir', () => {
    const points = buildEvolution([prospection({ date_prospection: '2025-08-05' })], [], {
      granularite: 'mois',
      cumule: true,
      debut: '2025-10-01',
      fin: '2025-10-31',
    })
    expect(points.map((p) => p.cle)).toEqual(['2025-08', '2025-09', '2025-10'])
  })

  it('renvoie une liste vide sans fiche datée, et ignore les dates illisibles', () => {
    expect(buildEvolution([], [], { ...decade, debut: '2025-10-01', fin: '2026-01-31' })).toEqual([])
    expect(buildEvolution([prospection({ date_prospection: 'pas-une-date' })], [], decade)).toEqual(
      [],
    )
  })
})

describe('echelleY', () => {
  it('arrondit le maximum à une graduation ronde (1, 2, 5 × 10ⁿ)', () => {
    expect(echelleY(87)).toEqual({ max: 100, ticks: [0, 50, 100] })
    expect(echelleY(1200)).toEqual({ max: 1500, ticks: [0, 500, 1000, 1500] })
  })

  it('supporte les petites surfaces sans erreur d’arrondi flottant', () => {
    expect(echelleY(0.7).ticks).toEqual([0, 0.2, 0.4, 0.6, 0.8])
  })

  it('reste valide sans donnée', () => {
    expect(echelleY(0)).toEqual({ max: 1, ticks: [0, 1] })
  })
})
