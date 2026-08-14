import { describe, expect, it } from 'vitest'
import {
  buildEspecesSynthese,
  buildFicheImprimable,
  buildInfestationSynthese,
  buildVegetationSummary,
  isFicheValidee,
  type CaptureRead,
  type InfestationRead,
  type PopulationRead,
} from './prospection-fiche-lecture'

describe('isFicheValidee', () => {
  it('est vraie uniquement pour le statut validee', () => {
    expect(isFicheValidee('validee')).toBe(true)
    expect(isFicheValidee('verifiee')).toBe(false)
    expect(isFicheValidee('en_attente')).toBe(false)
  })
})

describe('buildEspecesSynthese', () => {
  const captures: CaptureRead[] = [
    { id: '1', espece: 'LMC', categorie: 'imago', phase: 'gregaire', stade: 'A1', effectif: 10 },
    { id: '2', espece: 'LMC', categorie: 'imago', phase: 'transiens', stade: 'A1', effectif: 4 },
    { id: '3', espece: 'NSE', categorie: 'imago', phase: 'solitaire', stade: 'A1', effectif: 2 },
  ]
  const populations: PopulationRead[] = [
    { id: 'p1', espece: 'LMC', categorie: 'imago', densite_diffuse: 3, densite_groupee: null },
    { id: 'p2', espece: 'LMC', categorie: 'imago', densite_diffuse: 2, densite_groupee: 5 },
  ]

  it('agrège totaux, densités et phénotype dominant par espèce', () => {
    const result = buildEspecesSynthese(captures, populations)
    expect(result).toHaveLength(2)

    const lmc = result.find((r) => r.espece === 'LMC')
    expect(lmc).toEqual({
      espece: 'LMC',
      totalCaptures: 14,
      densiteDiffuse: 5,
      densiteGroupee: 5,
      phenotypeDominantLabel: 'Grégaires',
    })

    const nse = result.find((r) => r.espece === 'NSE')
    expect(nse).toEqual({
      espece: 'NSE',
      totalCaptures: 2,
      densiteDiffuse: null,
      densiteGroupee: null,
      phenotypeDominantLabel: 'Solitaires',
    })
  })
})

describe('buildInfestationSynthese', () => {
  it("retourne hasInfestation=false si aucune infestation", () => {
    expect(buildInfestationSynthese([])).toEqual({
      hasInfestation: false,
      typeLabel: '—',
      surfaceTotale: null,
      comportementLabel: '—',
    })
  })

  it('résout les labels de type de cible et comportement', () => {
    const infestations: InfestationRead[] = [
      { id: 'i1', type_cible: 'essaim', surface_totale: 12.5, densite_moy: null, comportement: 'deplacement' },
    ]
    expect(buildInfestationSynthese(infestations)).toEqual({
      hasInfestation: true,
      typeLabel: 'Essaim',
      surfaceTotale: 12.5,
      comportementLabel: 'Déplacement',
    })
  })
})

describe('buildVegetationSummary', () => {
  it('liste les strates non nulles et les attributs sol', () => {
    const summary = buildVegetationSummary(
      { strates: { herbeuse: { recouvrement: 60 }, arboree: { recouvrement: 40 }, sol_nu: { recouvrement: 0 } } },
      { humidite: '0_5cm', texture: 'limoneuse' },
      'faibles',
    )
    expect(summary).toBe('Strates (100%) : herbeuse 60%, arboree 40% · Humidité 0,5 cm · Texture Limoneuse · Dégâts culture Faibles'
      .replace('herbeuse', 'Herbeuse')
      .replace('arboree', 'Arborée'))
  })

  it('retourne un tiret si aucune donnée de végétation', () => {
    expect(buildVegetationSummary(null, null, null)).toBe('Strates (0%) : —')
  })
})

describe('buildFicheImprimable', () => {
  it('dérive la vue imprimable sans resaisie', () => {
    const vm = buildFicheImprimable({
      n_fiche: 'F-042',
      date_prospection: '2026-07-10',
      latitude: -18.5,
      longitude: 47.2,
      surface_station: 100,
      surface_prospectee: 80,
      surface_infestee: 10,
      vegetation: { strates: { herbeuse: { recouvrement: 100 } } },
      sol: { humidite: 'surface', texture: 'sable_fin' },
      degats_cultures: 'nuls',
      captures: [{ id: '1', espece: 'LMC', categorie: 'imago', phase: 'gregaire', stade: 'A1', effectif: 5 }],
      populations: [],
      infestations: [{ id: 'i1', type_cible: 'essaim', surface_totale: 10, densite_moy: null, comportement: 'repos' }],
    })

    expect(vm.nFiche).toBe('F-042')
    expect(vm.positionGps).toBe('-18.5000, 47.2000')
    expect(vm.especes).toHaveLength(1)
    expect(vm.infestation.typeLabel).toBe('Essaim')
    expect(vm.vegetationSummary).toContain('Herbeuse 100%')
  })

  it("affiche un tiret pour la position GPS si absente", () => {
    const vm = buildFicheImprimable({
      n_fiche: null,
      date_prospection: '2026-07-10',
      latitude: null,
      longitude: null,
      surface_station: null,
      surface_prospectee: null,
      surface_infestee: null,
      vegetation: null,
      sol: null,
      degats_cultures: null,
      captures: [],
      populations: [],
      infestations: [],
    })
    expect(vm.positionGps).toBe('—')
    expect(vm.nFiche).toBe('—')
  })
})
