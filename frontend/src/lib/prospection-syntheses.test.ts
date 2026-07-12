import { describe, expect, it } from 'vitest'
import {
  buildAgregatsParEspece,
  buildAgregatsParGroupe,
  buildProspectionsCsv,
  filterProspectionsForSynthese,
  type SyntheseProspection,
} from './prospection-syntheses'

function fiche(overrides: Partial<SyntheseProspection>): SyntheseProspection {
  return {
    id: 'p1',
    campagne_id: 'c1',
    station_id: 's1',
    statut: 'validee',
    n_fiche: 'F-001',
    populations: [],
    captures: [],
    ...overrides,
  }
}

describe('filterProspectionsForSynthese', () => {
  const fiches = [
    fiche({ id: 'p1', campagne_id: 'c1', station_id: 's1', statut: 'validee' }),
    fiche({ id: 'p2', campagne_id: 'c2', station_id: 's2', statut: 'en_attente' }),
  ]

  it('sans filtre retourne toutes les fiches', () => {
    expect(filterProspectionsForSynthese(fiches, {})).toHaveLength(2)
  })

  it('filtre par statut', () => {
    const result = filterProspectionsForSynthese(fiches, { statut: 'validee' })
    expect(result.map((f) => f.id)).toEqual(['p1'])
  })

  it('filtre par campagne', () => {
    const result = filterProspectionsForSynthese(fiches, { campagneId: 'c2' })
    expect(result.map((f) => f.id)).toEqual(['p2'])
  })

  it('filtre par station', () => {
    const result = filterProspectionsForSynthese(fiches, { stationId: 's1' })
    expect(result.map((f) => f.id)).toEqual(['p1'])
  })

  it('cumule les filtres', () => {
    const result = filterProspectionsForSynthese(fiches, { statut: 'validee', campagneId: 'c2' })
    expect(result).toHaveLength(0)
  })
})

describe('buildAgregatsParEspece', () => {
  it('calcule les densités moyennes et captures totales par espèce', () => {
    const fiches = [
      fiche({
        id: 'p1',
        populations: [
          { id: 'pop1', espece: 'LMC', categorie: 'imago', densite_diffuse: 10, densite_groupee: 20 },
        ],
        captures: [
          { id: 'cap1', espece: 'LMC', categorie: 'imago', phase: 'gregaire', stade: 'A1', effectif: 5 },
        ],
      }),
      fiche({
        id: 'p2',
        populations: [
          { id: 'pop2', espece: 'LMC', categorie: 'imago', densite_diffuse: 30, densite_groupee: null },
        ],
        captures: [
          { id: 'cap2', espece: 'NSE', categorie: 'imago', phase: 'solitaire', stade: 'A1', effectif: 3 },
        ],
      }),
    ]

    const result = buildAgregatsParEspece(fiches)
    const lmc = result.find((a) => a.espece === 'LMC')!
    const nse = result.find((a) => a.espece === 'NSE')!

    expect(lmc.densiteDiffuseMoyenne).toBe(20) // (10+30)/2
    expect(lmc.densiteGroupeeMoyenne).toBe(20) // seule valeur non-nulle
    expect(lmc.capturesTotales).toBe(5)
    expect(lmc.nbFiches).toBe(2)

    expect(nse.densiteDiffuseMoyenne).toBeNull()
    expect(nse.capturesTotales).toBe(3)
    expect(nse.nbFiches).toBe(1)
  })

  it('retourne un tableau vide sans données', () => {
    expect(buildAgregatsParEspece([])).toEqual([])
  })
})

describe('buildAgregatsParGroupe', () => {
  it('groupe les fiches et détaille chaque groupe par espèce', () => {
    const fiches = [
      fiche({
        id: 'p1',
        campagne_id: 'c1',
        populations: [{ id: 'pop1', espece: 'LMC', categorie: 'imago', densite_diffuse: 10, densite_groupee: null }],
        captures: [],
      }),
      fiche({
        id: 'p2',
        campagne_id: 'c2',
        populations: [{ id: 'pop2', espece: 'NSE', categorie: 'imago', densite_diffuse: 5, densite_groupee: null }],
        captures: [],
      }),
    ]

    const result = buildAgregatsParGroupe(
      fiches,
      (p) => p.campagne_id,
      (cle) => `Campagne ${cle}`,
    )

    expect(result).toHaveLength(2)
    const g1 = result.find((g) => g.cle === 'c1')!
    expect(g1.label).toBe('Campagne c1')
    expect(g1.nbFiches).toBe(1)
    expect(g1.parEspece.map((a) => a.espece)).toEqual(['LMC'])
  })
})

describe('buildProspectionsCsv', () => {
  it('inclut référence, statut, densités et captures pour chaque fiche', () => {
    const fiches = [
      fiche({
        id: 'p1',
        n_fiche: 'F-001',
        statut: 'validee',
        populations: [{ id: 'pop1', espece: 'LMC', categorie: 'imago', densite_diffuse: 10, densite_groupee: 20 }],
        captures: [{ id: 'cap1', espece: 'LMC', categorie: 'imago', phase: 'gregaire', stade: 'A1', effectif: 7 }],
      }),
    ]

    const csv = buildProspectionsCsv(fiches)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('Référence;Statut;Densité diffuse moy.;Densité groupée moy.;Captures totales')
    expect(lines[1]).toBe('F-001;validee;10.00;20.00;7')
  })

  it('utilise l\'id comme référence si n_fiche est absent', () => {
    const csv = buildProspectionsCsv([fiche({ id: 'p9', n_fiche: null })])
    expect(csv.split('\n')[1].startsWith('p9;')).toBe(true)
  })

  it('reflète exactement le jeu filtré (pas de désynchronisation)', () => {
    const fiches = [fiche({ id: 'p1', statut: 'validee' }), fiche({ id: 'p2', statut: 'en_attente' })]
    const filtered = filterProspectionsForSynthese(fiches, { statut: 'validee' })
    const csv = buildProspectionsCsv(filtered)
    expect(csv.split('\n')).toHaveLength(2) // en-tête + 1 ligne
  })
})
