import { describe, expect, it } from 'vitest'
import { buildZones, rayonBulle, SANS_REGION } from './dashboard-zones'
import type {
  DashboardProspection,
  DashboardStation,
  DashboardTraitement,
} from './dashboard-metrics'

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
    surface_prospectee: 400,
    surface_infestee: 100,
    region: 'Atsimo-Andrefana',
    latitude: -22,
    longitude: 44,
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

const STATIONS: DashboardStation[] = [
  { id: 's1', code: 'ST-1', nom: 'Sakaraha', latitude: -22.9, longitude: 44.5 },
]

describe('buildZones — prospection', () => {
  it('regroupe les fiches par région, au centre de leurs positions', () => {
    const { zones } = buildZones(
      'prospection',
      [
        prospection({ id: 'a', latitude: -22, longitude: 44, surface_prospectee: 300 }),
        prospection({ id: 'b', latitude: -24, longitude: 46, surface_prospectee: 200 }),
        prospection({ id: 'c', region: 'Menabe', latitude: -20, longitude: 44.5 }),
      ],
      [],
      [],
    )
    expect(zones).toHaveLength(2)
    // Trié par nombre de fiches décroissant.
    expect(zones[0]).toMatchObject({
      region: 'Atsimo-Andrefana',
      nFiches: 2,
      surfaceHa: 500,
      latitude: -23,
      longitude: 45,
    })
    expect(zones[1]).toMatchObject({ region: 'Menabe', nFiches: 1 })
  })

  it('confond les écritures d’une même région (casse, accents, tirets)', () => {
    const { zones } = buildZones(
      'prospection',
      [
        prospection({ id: 'a', region: 'Atsimo-Andrefana' }),
        prospection({ id: 'b', region: '  atsimo andrefana ' }),
        prospection({ id: 'c', region: 'Boeny' }),
        prospection({ id: 'd', region: 'BOÉNY' }),
      ],
      [],
      [],
    )
    expect(zones.map((z) => z.nFiches)).toEqual([2, 2])
  })

  it('retombe sur la station quand la fiche n’a pas de coordonnées propres', () => {
    const { zones, sansPosition } = buildZones(
      'prospection',
      [prospection({ latitude: null, longitude: null, station_id: 's1' })],
      [],
      STATIONS,
    )
    expect(sansPosition).toBe(0)
    expect(zones[0]).toMatchObject({ latitude: -22.9, longitude: 44.5 })
  })

  it('compte à part les fiches sans position, sans les placer au hasard', () => {
    const { zones, sansPosition } = buildZones(
      'prospection',
      [prospection({ id: 'a' }), prospection({ id: 'b', latitude: null, longitude: null })],
      [],
      [],
    )
    expect(zones).toHaveLength(1)
    expect(sansPosition).toBe(1)
  })

  it('garde une bulle par fiche quand la région est vide', () => {
    const { zones } = buildZones(
      'prospection',
      [
        prospection({ id: 'a', region: null, latitude: -13, longitude: 49 }),
        prospection({ id: 'b', region: '  ', latitude: -24, longitude: 44 }),
      ],
      [],
      [],
    )
    expect(zones).toHaveLength(2)
    expect(zones.every((z) => z.region === SANS_REGION && z.nFiches === 1)).toBe(true)
  })
})

describe('buildZones — infestation', () => {
  it('ne garde que les fiches où une surface infestée est déclarée', () => {
    const { zones } = buildZones(
      'infestation',
      [
        prospection({ id: 'a', surface_infestee: 120 }),
        prospection({ id: 'b', surface_infestee: 0 }),
        prospection({ id: 'c', surface_infestee: null }),
      ],
      [],
      [],
    )
    expect(zones).toHaveLength(1)
    expect(zones[0]).toMatchObject({ nFiches: 1, surfaceHa: 120 })
  })
})

describe('buildZones — traitement', () => {
  it('additionne surface traitée et protégée, et ignore les traitements sans surface', () => {
    const { zones } = buildZones(
      'traitement',
      [prospection()],
      [
        traitement({ id: 'a', terrestre: { surface_traitee_ha: 40, surface_protegee_ha: null } }),
        traitement({ id: 'b', terrestre: { surface_traitee_ha: null, surface_protegee_ha: 25 } }),
        traitement({ id: 'c', terrestre: { surface_traitee_ha: null, surface_protegee_ha: null } }),
      ],
      [],
    )
    expect(zones).toHaveLength(1)
    expect(zones[0]).toMatchObject({ region: 'Atsimo-Andrefana', nFiches: 2, surfaceHa: 65 })
  })

  it('hérite région et position de la fiche de prospection liée', () => {
    const { zones } = buildZones(
      'traitement',
      [prospection({ id: 'p1', region: 'Menabe', latitude: -20, longitude: 44.5 })],
      [traitement({ prospection_id: 'p1' })],
      [],
    )
    expect(zones[0]).toMatchObject({ region: 'Menabe', latitude: -20, longitude: 44.5 })
  })

  it('préfère les coordonnées propres du traitement', () => {
    const { zones } = buildZones(
      'traitement',
      [prospection()],
      [traitement({ latitude: -18, longitude: 47, region: 'Analamanga' })],
      [],
    )
    expect(zones[0]).toMatchObject({ region: 'Analamanga', latitude: -18, longitude: 47 })
  })
})

describe('rayonBulle', () => {
  it('donne la plus grande bulle à la région la plus suivie, à l’échelle de l’aire', () => {
    expect(rayonBulle(9, 9)).toBe(30)
    expect(rayonBulle(1, 9)).toBeCloseTo(7 + 23 / 3, 5)
    expect(rayonBulle(0, 9)).toBe(7)
  })

  it('reste valide sans donnée', () => {
    expect(rayonBulle(0, 0)).toBe(7)
  })
})
