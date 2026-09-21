import { describe, expect, it } from 'vitest'
import { buildPopulationsDetail, type PopulationDetailRead } from './prospection-populations-detail'

const imagoLmc: PopulationDetailRead = {
  espece: 'LMC',
  categorie: 'imago',
  captures_nombre: 12,
  captures_sol: 5,
  captures_trans: 0,
  captures_solitaro_transiens: 1,
  captures_greg: 2,
  stades_imago: { femelleA1: 3, maleA1: 4, femelleA2: 0 },
  accouplement: 'rare',
  ponte: 'neant',
  interdistance: 2.5,
  type_cible: ['vol_clair', 'tres_dense'],
  direction_de: 'NE',
  etat: 'deplacement',
  essaim_en_vol: true,
  densite_diffuse: 20,
  densite_groupee: 3,
}

const larveNse: PopulationDetailRead = {
  espece: 'NSE',
  categorie: 'larve',
  captures_nombre: 9,
  densites_larve: { L1: 10, L4: 3, L5: 0 },
  interdistance: 1,
  surface_contaminee_ha: 4,
  tache_larvaire: true,
  bande_larvaire: false,
  deplacement: 'perchee',
  densite_diffuse: 8,
}

/** Transforme un groupe en {libellé: valeur} pour des assertions lisibles. */
function lignes(p: PopulationDetailRead) {
  const groupe = buildPopulationsDetail([p])[0]
  return Object.fromEntries(groupe.lignes.map((l) => [l.k, l.v]))
}

describe('buildPopulationsDetail — mêmes lignes que le récapitulatif Extensif du téléphone', () => {
  it('affiche toutes les données d’un imago : captures, phases, stades, accouplement, ponte…', () => {
    expect(lignes(imagoLmc)).toEqual({
      'Nombre de captures': '12',
      Phases: 'Sol. 5 · Trans. 0 · Sol-Trans. 1 · Grég. 2',
      Stades: 'femelleA1 3 · maleA1 4',
      Accouplement: 'Rare',
      Ponte: 'Néant',
      'Interdistance (m)': '2,5',
      'Type de cible': 'Vol clair, Très dense',
      'Direction du déplacement': 'vers Nord-Est',
      État: 'Déplacement',
      'Comportement de l’essaim': 'En vol',
      'Densité diffuse': '20 ind./ha',
      'Densité groupée': '3 ind./m²',
    })
  })

  it('affiche toutes les données d’une larve : stades, interdistance, surface, tache/bande…', () => {
    expect(lignes(larveNse)).toEqual({
      'Nombre de captures': '9',
      'Stades renseignés': 'L1 10 · L4 3',
      'Interdistance (m)': '1',
      'Surface contaminée (ha)': '4',
      'Densité diffuse': '8 ind./ha',
      'Densité groupée': '—',
      'Autres informations': 'Tache larvaire · Déplacement : Perchée',
    })
  })

  it('ordonne LMC imago, LMC larve, NSE imago, NSE larve et titre chaque groupe', () => {
    const groupes = buildPopulationsDetail([
      larveNse,
      { ...imagoLmc, espece: 'NSE' },
      { ...larveNse, espece: 'LMC' },
      imagoLmc,
    ])
    expect(groupes.map((g) => g.titre)).toEqual(['LMC · Imagos', 'LMC · Larves', 'NSE · Imagos', 'NSE · Larves'])
  })

  it('omet le groupe entier d’une espèce jamais ouverte, mais garde chaque ligne (« — ») des autres', () => {
    const groupes = buildPopulationsDetail([
      { espece: 'LMC', categorie: 'larve' },
      { espece: 'NSE', categorie: 'imago', accouplement: 'beaucoup' },
    ])
    expect(groupes).toHaveLength(1)
    expect(groupes[0].titre).toBe('NSE · Imagos')
    expect(groupes[0].lignes).toHaveLength(12)
    expect(groupes[0].lignes.find((l) => l.k === 'Ponte')?.v).toBe('—')
  })

  it('un imago dont seules les stades sont renseignés reste affiché (rien de saisi ne disparaît)', () => {
    expect(buildPopulationsDetail([{ espece: 'LMC', categorie: 'imago', stades_imago: { maleA1: 2 } }])).toHaveLength(1)
  })

  it('conserve un vrai zéro (0 capture) mais n’invente pas de nombre absent', () => {
    const l = lignes({ espece: 'LMC', categorie: 'imago', captures_nombre: 0, densite_diffuse: 0 })
    expect(l['Nombre de captures']).toBe('0')
    expect(l['Densité diffuse']).toBe('0 ind./ha')
    expect(l['Interdistance (m)']).toBe('—')
    expect(l.Phases).toBe('—')
  })

  it('affiche « de X vers Y » quand les deux directions sont connues', () => {
    expect(lignes({ ...imagoLmc, direction_de: 'N', direction_vers: 'SE' })['Direction du déplacement']).toBe(
      'de Nord vers Sud-Est',
    )
  })

  it('rend une liste vide sans population', () => {
    expect(buildPopulationsDetail([])).toEqual([])
  })
})
