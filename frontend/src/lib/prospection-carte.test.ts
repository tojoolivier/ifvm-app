import { describe, expect, it } from 'vitest'
import {
  buildCarteMarkers,
  buildTraitementMarkers,
  computeSeverite,
  filterProspectionsForCarte,
  type CarteProspection,
  type CarteTraitement,
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
      {
        prospectionId: 'p-1',
        latitude: -19.1,
        longitude: 47.2,
        severite: 'faible',
        nFiche: 'F-1',
        typeProspection: null,
        infestations: [
          { typeLabel: 'Tache larvaire', surfaceTotale: 5, densiteMoy: null, comportementLabel: '—' },
        ],
        surfaceTotale: 5,
      },
    ])
  })

  it('retombe sur la position de la station à défaut de coordonnées ponctuelles', () => {
    const markers = buildCarteMarkers(
      [prospection({ station_id: 's1', infestations: [infestation({ surface_totale: 60 })] })],
      stations,
    )
    expect(markers).toEqual([
      {
        prospectionId: 'p-1',
        latitude: -18.9,
        longitude: 47.5,
        severite: 'forte',
        nFiche: 'F-1',
        typeProspection: null,
        infestations: [
          { typeLabel: 'Tache larvaire', surfaceTotale: 60, densiteMoy: null, comportementLabel: '—' },
        ],
        surfaceTotale: 60,
      },
    ])
  })

  it("détaille chaque infestation et cumule les surfaces pour la situation d'infestation", () => {
    const markers = buildCarteMarkers(
      [
        prospection({
          latitude: -19,
          longitude: 47,
          infestations: [
            infestation({ id: 'a', type_cible: 'bande_larvaire', surface_totale: 12, densite_moy: 8, comportement: 'deplacement' }),
            infestation({ id: 'b', type_cible: 'vol_clair', surface_totale: null, comportement: 'repos' }),
          ],
        }),
      ],
      stations,
    )
    expect(markers[0].surfaceTotale).toBe(12)
    expect(markers[0].infestations).toEqual([
      { typeLabel: 'Bande larvaire', surfaceTotale: 12, densiteMoy: 8, comportementLabel: 'Déplacement' },
      { typeLabel: 'Vol clair', surfaceTotale: null, densiteMoy: null, comportementLabel: 'Repos' },
    ])
  })

  it('cartographie une fiche extensive qui a une surface infestée mais aucune infestation détaillée', () => {
    const markers = buildCarteMarkers(
      [prospection({ type_prospection: 'extensive', latitude: -20, longitude: 46, surface_infestee: 75, infestations: [] })],
      stations,
    )
    expect(markers).toEqual([
      {
        prospectionId: 'p-1',
        latitude: -20,
        longitude: 46,
        severite: 'forte',
        nFiche: 'F-1',
        typeProspection: 'extensive',
        infestations: [],
        surfaceTotale: 75,
      },
    ])
  })

  it("n'affiche pas une fiche sans infestation ni surface infestée (surface nulle ou 0)", () => {
    const markers = buildCarteMarkers(
      [
        prospection({ id: 'a', latitude: -20, longitude: 46, surface_infestee: 0, infestations: [] }),
        prospection({ id: 'b', latitude: -20, longitude: 46, surface_infestee: null, infestations: [] }),
      ],
      stations,
    )
    expect(markers).toEqual([])
  })

  it('ignore les fiches sans aucune position exploitable', () => {
    const markers = buildCarteMarkers(
      [prospection({ station_id: 's-inconnue', infestations: [infestation({ surface_totale: 5 })] })],
      stations,
    )
    expect(markers).toEqual([])
  })
})

function traitement(overrides: Partial<CarteTraitement> = {}): CarteTraitement {
  return {
    id: 't-1',
    prospection_id: 'p-1',
    numero_fiche: 'T-001',
    type_traitement: 'AERIEN',
    mode_traitement: 'TOTAL',
    date_traitement: '2026-09-10',
    latitude: -19.5,
    longitude: 46.5,
    aerien: { surface_traitee_ha: 40, surface_protegee_ha: 0, surface_restante_ha: 10 },
    terrestre: null,
    ...overrides,
  }
}

describe('buildTraitementMarkers', () => {
  const stations: CarteStation[] = [{ id: 's1', latitude: -18.9, longitude: 47.5 }]

  it('crée un marqueur par traitement avec une surface traitée, à sa propre position', () => {
    expect(buildTraitementMarkers([traitement()], [], [])).toEqual([
      {
        traitementId: 't-1',
        latitude: -19.5,
        longitude: 46.5,
        numeroFiche: 'T-001',
        typeTraitement: 'AERIEN',
        modeTraitement: 'TOTAL',
        dateTraitement: '2026-09-10',
        libelleSurface: 'Traitée',
        surfaceHa: 40,
        surfaceRestanteHa: 10,
      },
    ])
  })

  it('lit la surface protégée en mode barrière et la surface du terrestre (valeurs texte comprises)', () => {
    const [marker] = buildTraitementMarkers(
      [
        traitement({
          type_traitement: 'TERRESTRE',
          mode_traitement: 'BARRIERE',
          aerien: null,
          terrestre: { surface_traitee_ha: 0, surface_protegee_ha: '12.50', surface_restante_ha: null },
        }),
      ],
      [],
      [],
    )
    expect(marker.libelleSurface).toBe('Protégée')
    expect(marker.surfaceHa).toBe(12.5)
    expect(marker.surfaceRestanteHa).toBeNull()
  })

  it('ignore un traitement sans surface traitée (nulle ou 0)', () => {
    expect(
      buildTraitementMarkers(
        [
          traitement({ id: 'a', aerien: { surface_traitee_ha: 0, surface_protegee_ha: 0 } }),
          traitement({ id: 'b', aerien: { surface_traitee_ha: null } }),
        ],
        [],
        [],
      ),
    ).toEqual([])
  })

  it('retombe sur la position de la prospection liée, puis sur celle de sa station', () => {
    const sansPosition = { latitude: null, longitude: null }
    const ponctuelle = buildTraitementMarkers(
      [traitement({ ...sansPosition })],
      [prospection({ latitude: -18, longitude: 45 })],
      stations,
    )
    expect(ponctuelle[0]).toMatchObject({ latitude: -18, longitude: 45 })

    const viaStation = buildTraitementMarkers(
      [traitement({ ...sansPosition })],
      [prospection({ station_id: 's1' })],
      stations,
    )
    expect(viaStation[0]).toMatchObject({ latitude: -18.9, longitude: 47.5 })
  })

  it('ignore un traitement sans aucune position exploitable', () => {
    expect(buildTraitementMarkers([traitement({ latitude: null, longitude: null })], [], stations)).toEqual([])
  })
})
