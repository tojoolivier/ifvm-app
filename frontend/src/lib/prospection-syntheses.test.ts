import { describe, expect, it } from 'vitest'
import {
  buildAgregats,
  buildCouvertureTraitement,
  buildProspectionsCsv,
  filterProspectionsForSynthese,
  filterTraitementsForSynthese,
  type SyntheseProspection,
  type SyntheseTraitement,
} from './prospection-syntheses'

function fiche(overrides: Partial<SyntheseProspection>): SyntheseProspection {
  return {
    id: 'p1',
    campagne_id: 'c1',
    station_id: 's1',
    prospecteur_id: 'u1',
    statut: 'validee',
    n_fiche: 'F-001',
    date_prospection: '2026-07-15',
    region: 'Androy',
    district: null,
    commune: null,
    latitude: null,
    longitude: null,
    surface_prospectee: null,
    surface_infestee: null,
    updated_at: '2026-07-16T08:00:00Z',
    populations: [],
    captures: [],
    ...overrides,
  }
}

function traitement(overrides: Partial<SyntheseTraitement>): SyntheseTraitement {
  return {
    id: 't1',
    region: 'Androy',
    date_traitement: '2026-07-20',
    terrestre: null,
    ...overrides,
  }
}

describe('filterProspectionsForSynthese', () => {
  it('sans filtre retourne toutes les fiches', () => {
    expect(filterProspectionsForSynthese([fiche({}), fiche({ id: 'p2' })], {})).toHaveLength(2)
  })

  // Barre « Période » de la maquette (§9) : bornes incluses des deux côtés.
  describe('période', () => {
    const parDate = [
      fiche({ id: 'a', date_prospection: '2026-06-30' }),
      fiche({ id: 'b', date_prospection: '2026-07-01' }),
      fiche({ id: 'c', date_prospection: '2026-08-15' }),
      fiche({ id: 'd', date_prospection: '2026-08-16' }),
    ]

    it('inclut les bornes de début et de fin', () => {
      const result = filterProspectionsForSynthese(parDate, {
        dateDebut: '2026-07-01',
        dateFin: '2026-08-15',
      })
      expect(result.map((f) => f.id)).toEqual(['b', 'c'])
    })

    it('accepte une borne seule', () => {
      expect(
        filterProspectionsForSynthese(parDate, { dateDebut: '2026-08-15' }).map((f) => f.id),
      ).toEqual(['c', 'd'])
      expect(
        filterProspectionsForSynthese(parDate, { dateFin: '2026-06-30' }).map((f) => f.id),
      ).toEqual(['a'])
    })
  })
})

describe('filterTraitementsForSynthese', () => {
  const traitements = [
    traitement({ id: 'a', date_traitement: '2026-06-30' }),
    traitement({ id: 'b', date_traitement: '2026-07-01' }),
    traitement({ id: 'c', date_traitement: '2026-08-15' }),
    traitement({ id: 'd', date_traitement: '2026-08-16' }),
  ]

  it('applique les mêmes bornes incluses que les prospections', () => {
    const result = filterTraitementsForSynthese(traitements, {
      dateDebut: '2026-07-01',
      dateFin: '2026-08-15',
    })
    expect(result.map((t) => t.id)).toEqual(['b', 'c'])
  })

  it('sans période retourne tout', () => {
    expect(filterTraitementsForSynthese(traitements, {})).toHaveLength(4)
  })
})

describe('buildAgregats', () => {
  const fiches = [
    fiche({
      id: 'p1',
      station_id: 's1',
      prospecteur_id: 'u1',
      surface_infestee: 100,
      populations: [
        { id: 'pop1', espece: 'LMC', categorie: 'imago', densite_diffuse: 10, densite_groupee: 30 },
      ],
      captures: [
        { id: 'cap1', espece: 'LMC', categorie: 'imago', phase: 'gregaire', stade: 'A1', effectif: 5 },
      ],
    }),
    fiche({
      id: 'p2',
      station_id: 's2',
      prospecteur_id: 'u1',
      surface_infestee: 40,
      populations: [
        { id: 'pop2', espece: 'NSE', categorie: 'imago', densite_diffuse: 20, densite_groupee: null },
      ],
      captures: [
        { id: 'cap2', espece: 'NSE', categorie: 'imago', phase: 'solitaire', stade: 'A1', effectif: 3 },
      ],
    }),
  ]

  it("agrège par espèce : fiches, individus, densité moyenne et surface infestée", () => {
    const result = buildAgregats(fiches, 'espece', {})
    const lmc = result.find((l) => l.cle === 'LMC')!

    expect(lmc.label).toBe('LMC')
    expect(lmc.nbFiches).toBe(1)
    expect(lmc.individus).toBe(5)
    expect(lmc.densiteMoyenne).toBe(20) // (10 + 30) / 2, diffuse et groupée confondues
    expect(lmc.surfaceInfestee).toBe(100)
  })

  it('agrège par station en résolvant le libellé', () => {
    const result = buildAgregats(fiches, 'station', { station: { s1: 'ST-001 — Ampanihy' } })
    expect(result.map((l) => l.label)).toContain('ST-001 — Ampanihy')
    expect(result.find((l) => l.cle === 's1')!.individus).toBe(5)
  })

  it('agrège par prospecteur en regroupant les fiches d’un même agent', () => {
    const result = buildAgregats(fiches, 'prospecteur', { prospecteur: { u1: 'Rakoto' } })
    expect(result).toHaveLength(1)
    const ligne = result[0]
    expect(ligne.label).toBe('Rakoto')
    expect(ligne.nbFiches).toBe(2)
    expect(ligne.individus).toBe(8)
    expect(ligne.surfaceInfestee).toBe(140)
  })

  it('retombe sur un libellé lisible quand la clé est inconnue ou absente', () => {
    const result = buildAgregats([fiche({ station_id: null })], 'station', {})
    expect(result[0].label).toBe('Sans station')
  })

  it("trie par surface infestée décroissante — la maquette met les foyers majeurs en tête", () => {
    const result = buildAgregats(fiches, 'espece', {})
    expect(result.map((l) => l.cle)).toEqual(['LMC', 'NSE'])
  })

  it('retourne un tableau vide sans données', () => {
    expect(buildAgregats([], 'espece', {})).toEqual([])
  })

  it('laisse la densité moyenne à null quand aucune densité n’est renseignée', () => {
    const sansDensite = [
      fiche({
        populations: [
          { id: 'x', espece: 'LMC', categorie: 'imago', densite_diffuse: null, densite_groupee: null },
        ],
      }),
    ]
    expect(buildAgregats(sansDensite, 'espece', {})[0].densiteMoyenne).toBeNull()
  })
})

describe('buildCouvertureTraitement', () => {
  it('rapporte la surface traitée à la surface infestée, par région', () => {
    const prospections = [
      fiche({ id: 'p1', region: 'Androy', surface_infestee: 200 }),
      fiche({ id: 'p2', region: 'Androy', surface_infestee: 300 }),
      fiche({ id: 'p3', region: 'Menabe', surface_infestee: 100 }),
    ]
    const traitements = [
      traitement({ id: 't1', region: 'Androy', terrestre: { surface_traitee_ha: 150 } }),
      traitement({ id: 't2', region: 'Androy', terrestre: { surface_traitee_ha: 50 } }),
      traitement({ id: 't3', region: 'Menabe', terrestre: { surface_traitee_ha: 23 } }),
    ]

    const result = buildCouvertureTraitement(prospections, traitements)
    expect(result.find((z) => z.zone === 'Androy')!.pct).toBe(40) // 200 / 500
    expect(result.find((z) => z.zone === 'Menabe')!.pct).toBe(23)
  })

  it('plafonne à 100 % quand la surface traitée dépasse la surface infestée', () => {
    const result = buildCouvertureTraitement(
      [fiche({ region: 'Androy', surface_infestee: 10 })],
      [traitement({ region: 'Androy', terrestre: { surface_traitee_ha: 90 } })],
    )
    expect(result[0].pct).toBe(100)
  })

  it('ignore une région sans surface infestée connue plutôt que de diviser par zéro', () => {
    const result = buildCouvertureTraitement(
      [fiche({ region: 'Androy', surface_infestee: null })],
      [traitement({ region: 'Androy', terrestre: { surface_traitee_ha: 90 } })],
    )
    expect(result).toEqual([])
  })

  it('compte une couverture nulle pour une région infestée sans traitement', () => {
    const result = buildCouvertureTraitement(
      [fiche({ region: 'Androy', surface_infestee: 50 })],
      [],
    )
    expect(result[0].pct).toBe(0)
  })

  it("n'attribue aucune surface à un traitement aérien (le schéma n'en porte pas)", () => {
    const result = buildCouvertureTraitement(
      [fiche({ region: 'Androy', surface_infestee: 50 })],
      [traitement({ region: 'Androy', terrestre: null })],
    )
    expect(result[0].pct).toBe(0)
  })

  it('trie par couverture décroissante, comme la maquette', () => {
    const result = buildCouvertureTraitement(
      [
        fiche({ id: 'p1', region: 'Faible', surface_infestee: 100 }),
        fiche({ id: 'p2', region: 'Forte', surface_infestee: 100 }),
      ],
      [
        traitement({ id: 't1', region: 'Faible', terrestre: { surface_traitee_ha: 20 } }),
        traitement({ id: 't2', region: 'Forte', terrestre: { surface_traitee_ha: 80 } }),
      ],
    )
    expect(result.map((z) => z.zone)).toEqual(['Forte', 'Faible'])
  })

  it('regroupe les fiches sans région sous une zone explicite', () => {
    const result = buildCouvertureTraitement(
      [fiche({ region: null, surface_infestee: 50 })],
      [traitement({ region: null, terrestre: { surface_traitee_ha: 25 } })],
    )
    expect(result[0].zone).toBe('Région non renseignée')
    expect(result[0].pct).toBe(50)
  })
})

describe('buildProspectionsCsv', () => {
  it('produit une ligne par fiche avec références, localisation, agrégats et surfaces', () => {
    const csv = buildProspectionsCsv(
      [
        fiche({
          id: 'p1',
          n_fiche: 'F-001',
          statut: 'validee',
          date_prospection: '2026-07-15',
          region: 'Androy',
          district: 'Ambovombe',
          commune: 'Antanimora',
          latitude: -25.10345,
          longitude: 45.4021,
          surface_prospectee: 500,
          surface_infestee: 120,
          updated_at: '2026-07-16T08:00:00Z',
          populations: [
            { id: 'pop1', espece: 'LMC', categorie: 'imago', densite_diffuse: 10, densite_groupee: 20 },
          ],
          captures: [
            { id: 'cap1', espece: 'LMC', categorie: 'imago', phase: 'gregaire', stade: 'A1', effectif: 7 },
          ],
        }),
      ],
      { station: { s1: 'ST-001 — Ampanihy' } },
    )

    const [entete, ligne] = csv.split('\r\n')
    expect(entete).toBe(
      'Référence;Date;Statut;Région;District;Commune;Station;Latitude;Longitude;Espèces;Individus;Densité diffuse moy.;Densité groupée moy.;Surface prospectée (ha);Surface infestée (ha);Dernière mise à jour',
    )
    expect(ligne).toBe(
      'F-001;2026-07-15;validee;Androy;Ambovombe;Antanimora;ST-001 — Ampanihy;-25,10345;45,40210;LMC;7;10,00;20,00;500;120;2026-07-16T08:00:00Z',
    )
  })

  it('sépare les colonnes par « ; » et les décimales par « , » (Excel francophone)', () => {
    const csv = buildProspectionsCsv(
      [
        fiche({
          populations: [
            { id: 'pop1', espece: 'LMC', categorie: 'imago', densite_diffuse: 1.5, densite_groupee: null },
          ],
        }),
      ],
      {},
    )
    expect(csv.split('\r\n')[1]).toContain(';1,50;')
  })

  it("utilise l'id comme référence si n_fiche est absent", () => {
    const csv = buildProspectionsCsv([fiche({ id: 'p9', n_fiche: null })], {})
    expect(csv.split('\r\n')[1].startsWith('p9;')).toBe(true)
  })

  it('échappe les valeurs contenant le séparateur', () => {
    const csv = buildProspectionsCsv([fiche({ commune: 'Anosy; Sud' })], {})
    expect(csv.split('\r\n')[1]).toContain('"Anosy; Sud"')
  })

  it('liste les espèces rencontrées, dédoublonnées', () => {
    const csv = buildProspectionsCsv(
      [
        fiche({
          populations: [
            { id: 'a', espece: 'LMC', categorie: 'imago', densite_diffuse: null, densite_groupee: null },
          ],
          captures: [
            { id: 'b', espece: 'LMC', categorie: 'imago', phase: 'gregaire', stade: 'A1', effectif: 1 },
            { id: 'c', espece: 'NSE', categorie: 'imago', phase: 'gregaire', stade: 'A1', effectif: 2 },
          ],
        }),
      ],
      {},
    )
    expect(csv.split('\r\n')[1]).toContain('LMC / NSE')
  })

  it('sépare les lignes par CRLF, comme attendu par Excel', () => {
    const csv = buildProspectionsCsv([fiche({}), fiche({ id: 'p2' })], {})
    expect(csv).toContain('\r\n')
    expect(csv.split('\n').every((l) => l === '' || l.endsWith('\r') || !l.includes('\r'))).toBe(true)
  })

  it('reflète exactement le jeu filtré (pas de désynchronisation)', () => {
    const fiches = [fiche({ id: 'p1', date_prospection: '2026-07-15' }), fiche({ id: 'p2', date_prospection: '2026-09-01' })]
    const filtered = filterProspectionsForSynthese(fiches, { dateFin: '2026-08-01' })
    expect(buildProspectionsCsv(filtered, {}).split('\r\n')).toHaveLength(2)
  })
})
