import { describe, expect, it } from 'vitest'
import {
  buildBaseAerienneMarkers,
  buildCarteMarkers,
  buildTraitementMarkers,
  coucheProspection,
  prospectionVisible,
  traitementVisible,
  TOUTES_LES_COUCHES,
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

describe('buildBaseAerienneMarkers', () => {
  it('crée un marqueur par base principale et par base secondaire déclarées', () => {
    const markers = buildBaseAerienneMarkers([
      prospection({
        type_prospection: 'extensive',
        base: 'Ankazoabo',
        base_numero: 2,
        base_date_installation: '2026-09-01',
        base_latitude: -22.3,
        base_longitude: 44.5,
        base_secondaire: 'Betioky',
        base_secondaire_date_installation: '2026-09-08',
        base_secondaire_latitude: -23.7,
        base_secondaire_longitude: 44.4,
      }),
    ])
    expect(markers).toEqual([
      {
        key: 'principale|-22.3000|44.5000',
        type: 'principale',
        nom: 'Ankazoabo',
        numero: 2,
        dateInstallation: '2026-09-01',
        latitude: -22.3,
        longitude: 44.5,
        nbFiches: 1,
        prospectionId: 'p-1',
      },
      {
        key: 'secondaire|-23.7000|44.4000',
        type: 'secondaire',
        nom: 'Betioky',
        numero: null,
        dateInstallation: '2026-09-08',
        latitude: -23.7,
        longitude: 44.4,
        nbFiches: 1,
        prospectionId: 'p-1',
      },
    ])
  })

  it('regroupe la même base déclarée sur plusieurs fiches et ignore les fiches sans base géolocalisée', () => {
    const base = { base: 'Ankazoabo', base_latitude: -22.3, base_longitude: 44.5 }
    const markers = buildBaseAerienneMarkers([
      prospection({ id: 'a', ...base }),
      prospection({ id: 'b', ...base }),
      prospection({ id: 'c', base: 'Sans coordonnées', base_latitude: null, base_longitude: null }),
      prospection({ id: 'd' }),
    ])
    expect(markers).toHaveLength(1)
    expect(markers[0]).toMatchObject({ nbFiches: 2, prospectionId: 'a' })
  })
})

describe('couches de la carte', () => {
  it('associe chaque type de prospection à sa couche', () => {
    expect(coucheProspection('intensive')).toBe('prospection_intensive')
    expect(coucheProspection('extensive')).toBe('prospection_extensive')
    expect(coucheProspection('validation')).toBe('prospection_validation')
    expect(coucheProspection(undefined)).toBeNull()
  })

  it('filtre les prospections selon le type coché', () => {
    const seulementExtensive = new Set(['prospection_extensive'] as const)
    expect(prospectionVisible('extensive', seulementExtensive)).toBe(true)
    expect(prospectionVisible('intensive', seulementExtensive)).toBe(false)
    expect(prospectionVisible('validation', seulementExtensive)).toBe(false)
  })

  it('garde visible une fiche de type inconnu tant qu\'une couche de prospection est cochée', () => {
    expect(prospectionVisible(undefined, new Set(['prospection_validation'] as const))).toBe(true)
    expect(prospectionVisible(undefined, new Set(['traitement_aerien'] as const))).toBe(false)
  })

  it('filtre les traitements par type', () => {
    const seulementTerrestre = new Set(['traitement_terrestre'] as const)
    expect(traitementVisible('TERRESTRE', seulementTerrestre)).toBe(true)
    expect(traitementVisible('AERIEN', seulementTerrestre)).toBe(false)
  })

  it('expose toutes les couches par défaut', () => {
    expect(TOUTES_LES_COUCHES).toHaveLength(6)
  })
})
