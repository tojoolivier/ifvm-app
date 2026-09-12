import { describe, expect, it } from 'vitest'
import {
  buildActiviteRecente,
  buildPipeline,
  buildTopStations,
  compteProspections,
  formatReception,
  sommeSurfaceInfestee,
  sommeSurfaceTraitee,
  tauxValidation,
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
    n_fiche: 'PR-2026-0148-INT',
    date_prospection: '2026-08-16',
    surface_infestee: 100,
    created_at: '2026-08-16T08:00:00Z',
    updated_at: '2026-08-16T08:00:00Z',
    ...over,
  }
}

function traitement(over: Partial<DashboardTraitement> = {}): DashboardTraitement {
  return {
    id: 't1',
    prospection_id: 'p1',
    numero_fiche: 'CRT-2026-0036',
    type_traitement: 'TERRESTRE',
    date_traitement: '2026-08-16',
    localite: 'Zone Sakaraha',
    statut: 'validee',
    created_at: '2026-08-16T09:00:00Z',
    updated_at: '2026-08-16T09:00:00Z',
    aerien: null,
    terrestre: { surface_traitee_ha: 50 },
    signatures: [],
    ...over,
  }
}

describe('compteProspections', () => {
  it('ne compte que le type demandé', () => {
    const fiches = [
      prospection({ id: 'a', type_prospection: 'intensive' }),
      prospection({ id: 'b', type_prospection: 'extensive' }),
      prospection({ id: 'c', type_prospection: 'intensive' }),
    ]
    expect(compteProspections(fiches, 'intensive')).toBe(2)
  })
})

describe('sommeSurfaceInfestee', () => {
  it('additionne les surfaces déclarées en ignorant les valeurs absentes', () => {
    const fiches = [
      prospection({ id: 'a', surface_infestee: 120.5 }),
      prospection({ id: 'b', surface_infestee: null }),
      prospection({ id: 'c', surface_infestee: 80 }),
    ]
    expect(sommeSurfaceInfestee(fiches)).toBe(200.5)
  })
})

describe('sommeSurfaceTraitee', () => {
  it('additionne la surface terrestre et compte à part toute fiche sans surface', () => {
    const fiches = [
      traitement({ id: 'a', terrestre: { surface_traitee_ha: 30 } }),
      // Terrestre à surface vide : il ne doit pas disparaître silencieusement.
      traitement({ id: 'b', terrestre: { surface_traitee_ha: null } }),
      // L'aérien n'expose aucune surface traitée côté API : même traitement.
      traitement({
        id: 'c',
        type_traitement: 'AERIEN',
        terrestre: null,
        aerien: { pilote: 'Rakoto' },
      }),
    ]
    expect(sommeSurfaceTraitee(fiches)).toEqual({ total: 30, sansSurface: 2 })
  })
})

describe('tauxValidation', () => {
  it('rapporte les validées au total statué (validées + rejetées)', () => {
    const fiches = [
      ...Array.from({ length: 9 }, (_, i) => prospection({ id: `v${i}`, statut: 'validee' })),
      prospection({ id: 'r1', statut: 'rejetee' }),
      // Une fiche non statuée ne doit pas entrer au dénominateur.
      prospection({ id: 'a1', statut: 'en_attente' }),
    ]
    expect(tauxValidation(fiches)).toEqual({ validation: 90, rejet: 10 })
  })

  it('renvoie null quand aucune fiche n’est statuée', () => {
    expect(tauxValidation([prospection({ statut: 'brouillon' })])).toBeNull()
  })
})

describe('buildPipeline', () => {
  it('rend les 5 étapes de la maquette avec leur part du total', () => {
    const fiches = [
      prospection({ id: 'a', statut: 'brouillon' }),
      prospection({ id: 'b', statut: 'validee' }),
      prospection({ id: 'c', statut: 'validee' }),
      prospection({ id: 'd', statut: 'rejetee' }),
    ]
    const pipeline = buildPipeline(fiches)
    expect(pipeline.map((e) => e.statut)).toEqual([
      'brouillon',
      'en_attente',
      'verifiee',
      'validee',
      'rejetee',
    ])
    expect(pipeline.map((e) => e.n)).toEqual([1, 0, 0, 2, 1])
    expect(pipeline.map((e) => e.pct)).toEqual([25, 0, 0, 50, 25])
    expect(pipeline.map((e) => e.label)).toContain('Brouillon (mobile, non synchronisé)')
  })

  it('ne divise pas par zéro sur une liste vide', () => {
    expect(buildPipeline([]).every((e) => e.n === 0 && e.pct === 0)).toBe(true)
  })
})

describe('buildTopStations', () => {
  const stations = [
    { id: 's1', code: 'ST-014', nom: 'Ankazoabo' },
    { id: 's2', code: 'ST-009', nom: 'Sakaraha' },
  ]

  it('classe les stations par nombre de fiches et rapporte la barre au maximum', () => {
    const fiches = [
      prospection({ id: 'a', station_id: 's1' }),
      prospection({ id: 'b', station_id: 's1' }),
      prospection({ id: 'c', station_id: 's2' }),
      // Sans station : n'invente pas une ligne fantôme.
      prospection({ id: 'd', station_id: null }),
    ]
    expect(buildTopStations(fiches, stations)).toEqual([
      { id: 's1', code: 'ST-014', nom: 'Ankazoabo', n: 2, pct: 100 },
      { id: 's2', code: 'ST-009', nom: 'Sakaraha', n: 1, pct: 50 },
    ])
  })

  it('limite la liste et reste lisible si la station est inconnue de l’annuaire', () => {
    const fiches = [prospection({ id: 'a', station_id: 'inconnue' })]
    const [ligne] = buildTopStations(fiches, stations, 6)
    expect(ligne.nom).toBe('Station inconnue')
    expect(ligne.code).toBe('—')
  })
})

describe('formatReception', () => {
  const maintenant = new Date('2026-08-17T10:00:00')

  it('affiche les minutes puis les heures dans la journée', () => {
    expect(formatReception(new Date('2026-08-17T09:40:00').toISOString(), maintenant)).toBe(
      'il y a 20 min',
    )
    expect(formatReception(new Date('2026-08-17T09:00:00').toISOString(), maintenant)).toBe(
      'il y a 1 h',
    )
  })

  it('bascule sur « hier HH:MM » au-delà de 12 h', () => {
    expect(formatReception(new Date('2026-08-16T18:40:00').toISOString(), maintenant)).toBe(
      'hier 18:40',
    )
  })

  it('garde les heures pour une veille proche (23:00 vu à 01:00)', () => {
    expect(
      formatReception(new Date('2026-08-16T23:00:00').toISOString(), new Date('2026-08-17T01:00:00')),
    ).toBe('il y a 2 h')
  })
})

describe('buildActiviteRecente', () => {
  const maintenant = new Date('2026-08-17T10:00:00')
  const stations = [{ id: 's1', code: 'ST-014', nom: 'Ankazoabo' }]
  const options = { maintenant, stations, nomAgent: () => 'Randria Jean' }

  it('fusionne prospections et traitements, du plus récent au plus ancien', () => {
    const lignes = buildActiviteRecente(
      [prospection({ id: 'p1', created_at: new Date('2026-08-17T08:00:00').toISOString() })],
      [traitement({ id: 't1', created_at: new Date('2026-08-17T09:30:00').toISOString() })],
      options,
    )
    expect(lignes.map((l) => l.id)).toEqual(['t1', 'p1'])
    expect(lignes[0]).toMatchObject({
      numero: 'CRT-2026-0036',
      type: 'Traitement terrestre',
      lieu: 'Zone Sakaraha',
      statut: 'validee',
      lien: '/traitements',
      reception: 'il y a 30 min',
    })
    expect(lignes[1]).toMatchObject({
      numero: 'PR-2026-0148-INT',
      type: 'Intensive',
      agent: 'Randria Jean',
      lieu: 'ST-014 Ankazoabo',
      lien: '/prospections/p1',
    })
  })

  it('écarte ce qui sort de la fenêtre de 24 h', () => {
    const lignes = buildActiviteRecente(
      [prospection({ id: 'vieux', created_at: new Date('2026-08-15T09:00:00').toISOString() })],
      [],
      options,
    )
    expect(lignes).toEqual([])
  })

  it('tronque à la limite demandée', () => {
    const fiches = Array.from({ length: 10 }, (_, i) =>
      prospection({
        id: `p${i}`,
        created_at: new Date(2026, 7, 17, 9, i).toISOString(),
      }),
    )
    expect(buildActiviteRecente(fiches, [], { ...options, limite: 6 })).toHaveLength(6)
  })
})
