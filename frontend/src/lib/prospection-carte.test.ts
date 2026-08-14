import { describe, expect, it } from 'vitest'
import {
  buildCarteMarkers,
  computeSeverite,
  filterProspectionsForCarte,
  type CarteProspection,
  type CarteStation,
} from './prospection-carte'
import type { InfestationRead } from './prospection-fiche-lecture'

function infestation(overrides: Partial<InfestationRead> = {}): InfestationRead {
  return {
    id: 'inf-1',
    type_cible: 'tache_larvaire',
    surface_totale: null,
    densite_moy: null,
    comportement: null,
    ...overrides,
  }
}

function prospection(overrides: Partial<CarteProspection> = {}): CarteProspection {
  return {
    id: 'p-1',
    campagne_id: 'camp-1',
    station_id: null,
    statut: 'validee',
    n_fiche: 'F-1',
    latitude: null,
    longitude: null,
    infestations: [],
    ...overrides,
  }
}

describe('filterProspectionsForCarte', () => {
  it('filtre par statut, campagne et station', () => {
    const prospections = [
      prospection({ id: 'a', statut: 'validee', campagne_id: 'c1', station_id: 's1' }),
      prospection({ id: 'b', statut: 'brouillon', campagne_id: 'c1', station_id: 's1' }),
      prospection({ id: 'c', statut: 'validee', campagne_id: 'c2', station_id: 's2' }),
    ]

    expect(filterProspectionsForCarte(prospections, { statut: 'validee' }).map((p) => p.id)).toEqual(['a', 'c'])
    expect(filterProspectionsForCarte(prospections, { campagneId: 'c1' }).map((p) => p.id)).toEqual(['a', 'b'])
    expect(filterProspectionsForCarte(prospections, { stationId: 's2' }).map((p) => p.id)).toEqual(['c'])
    expect(filterProspectionsForCarte(prospections, {}).map((p) => p.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('computeSeverite', () => {
  it('priorise la surface infestée sur la densité', () => {
    expect(computeSeverite([infestation({ surface_totale: 60 })])).toBe('forte')
    expect(computeSeverite([infestation({ surface_totale: 20 })])).toBe('moyenne')
    expect(computeSeverite([infestation({ surface_totale: 2 })])).toBe('faible')
  })

  it("somme les surfaces de plusieurs infestations", () => {
    expect(computeSeverite([infestation({ surface_totale: 30 }), infestation({ surface_totale: 25 })])).toBe('forte')
  })

  it('retombe sur la densité moyenne si aucune surface', () => {
    expect(computeSeverite([infestation({ densite_moy: 25 })])).toBe('forte')
    expect(computeSeverite([infestation({ densite_moy: 6 })])).toBe('moyenne')
    expect(computeSeverite([infestation({ densite_moy: 1 })])).toBe('faible')
  })

  it('retombe sur faible sans aucune donnée', () => {
    expect(computeSeverite([infestation()])).toBe('faible')
  })
})

describe('buildCarteMarkers', () => {
  const stations: CarteStation[] = [{ id: 's1', latitude: -18.9, longitude: 47.5 }]

  it("ignore les fiches sans infestation", () => {
    const markers = buildCarteMarkers([prospection({ infestations: [] })], stations)
    expect(markers).toEqual([])
  })

  it('utilise la position ponctuelle si présente', () => {
    const markers = buildCarteMarkers(
      [prospection({ latitude: -19.1, longitude: 47.2, infestations: [infestation({ surface_totale: 5 })] })],
      stations,
    )
    expect(markers).toEqual([
      { prospectionId: 'p-1', latitude: -19.1, longitude: 47.2, severite: 'faible', nFiche: 'F-1' },
    ])
  })

  it('retombe sur la position de la station à défaut de coordonnées ponctuelles', () => {
    const markers = buildCarteMarkers(
      [prospection({ station_id: 's1', infestations: [infestation({ surface_totale: 60 })] })],
      stations,
    )
    expect(markers).toEqual([
      { prospectionId: 'p-1', latitude: -18.9, longitude: 47.5, severite: 'forte', nFiche: 'F-1' },
    ])
  })

  it('ignore les fiches sans aucune position exploitable', () => {
    const markers = buildCarteMarkers(
      [prospection({ station_id: 's-inconnue', infestations: [infestation({ surface_totale: 5 })] })],
      stations,
    )
    expect(markers).toEqual([])
  })
})
