import { describe, expect, it } from 'vitest'
import {
  aeronefDeFiche,
  libelleAeronef,
  libelleVolLie,
  normaliserImmatriculation,
  prospectionAerienne,
  siteDeFiche,
  trouverAeronefParImmatriculation,
} from './rattachements'
import type { SiteAerien } from './vols'

const AERONEFS = [
  { id: 'a1', immatriculation: '5R-MJA', societe: 'Heli Madagascar', volume_cuve_l: 800, actif: true },
  { id: 'a2', immatriculation: '5R-MJB', societe: 'Vieux Heli', volume_cuve_l: 600, actif: false },
] as never[]

const SITES = [{ id: 's1', numero: 'IHO01', localite: 'Ihosy', parent_site_id: null, actif: true }] as unknown as SiteAerien[]

describe('normaliserImmatriculation', () => {
  it('retire les espaces et met en majuscules', () => {
    expect(normaliserImmatriculation('  5r-mja ')).toBe('5R-MJA')
    expect(normaliserImmatriculation(null)).toBe('')
    expect(normaliserImmatriculation(undefined)).toBe('')
  })
})

describe('trouverAeronefParImmatriculation', () => {
  it('retrouve l’appareil du parc malgré la casse et les espaces du texte libre', () => {
    expect(trouverAeronefParImmatriculation(' 5r-mja', AERONEFS)?.id).toBe('a1')
  })

  it('retrouve aussi un appareil inactif (une fiche ancienne peut l’avoir utilisé)', () => {
    expect(trouverAeronefParImmatriculation('5R-MJB', AERONEFS)?.id).toBe('a2')
  })

  it('undefined pour une immatriculation inconnue ou vide', () => {
    expect(trouverAeronefParImmatriculation('5R-XXX', AERONEFS)).toBeUndefined()
    expect(trouverAeronefParImmatriculation('  ', AERONEFS)).toBeUndefined()
    expect(trouverAeronefParImmatriculation(null, AERONEFS)).toBeUndefined()
  })
})

describe('aeronefDeFiche', () => {
  it('1. l’aéronef du vol lié prime, et n’est pas historique', () => {
    expect(aeronefDeFiche({ aeronef_id: 'a1' }, '5R-ZZZ', AERONEFS)).toEqual({
      texte: '5R-MJA — Heli Madagascar',
      historique: false,
    })
  })

  it('2. sans vol : l’appareil du parc qui correspond au texte libre', () => {
    expect(aeronefDeFiche(null, '5r-mjb', AERONEFS)).toEqual({ texte: '5R-MJB — Vieux Heli', historique: false })
  })

  it('3. texte libre sans correspondance dans le parc : repris tel quel, signalé historique', () => {
    expect(aeronefDeFiche(undefined, '  5R-OLD ', AERONEFS)).toEqual({ texte: '5R-OLD', historique: true })
  })

  it('4. ni vol ni texte : rien', () => {
    expect(aeronefDeFiche(null, null, AERONEFS)).toBeNull()
    expect(aeronefDeFiche(null, '   ', AERONEFS)).toBeNull()
  })

  it('vol lié dont l’appareil n’est pas (encore) chargé : retombe sur le texte libre, jamais sur l’identifiant', () => {
    expect(aeronefDeFiche({ aeronef_id: 'a-inconnu' }, '5R-OLD', AERONEFS)).toEqual({ texte: '5R-OLD', historique: true })
    expect(aeronefDeFiche({ aeronef_id: 'a-inconnu' }, null, AERONEFS)).toBeNull()
  })

  it('parc vide (pas encore chargé) : le texte libre reste lisible', () => {
    expect(aeronefDeFiche(null, '5R-MJA', [])).toEqual({ texte: '5R-MJA', historique: true })
  })
})

describe('siteDeFiche', () => {
  it('1. le site rattaché : numéro et localité, pas historique', () => {
    expect(siteDeFiche('s1', 'Base texte', 7, SITES)).toEqual({ texte: 'IHO01 — Ihosy', historique: false })
  })

  it('2. sans site : le texte libre historique, avec le numéro de base', () => {
    expect(siteDeFiche(null, 'Base Betioky', 12, SITES)).toEqual({ texte: 'Base Betioky (n° 12)', historique: true })
  })

  it('texte libre sans numéro : le texte seul', () => {
    expect(siteDeFiche(null, 'Base Betioky', null, SITES)).toEqual({ texte: 'Base Betioky', historique: true })
    expect(siteDeFiche(undefined, 'Base Betioky', '', SITES)).toEqual({ texte: 'Base Betioky', historique: true })
  })

  it('un numéro de base 0 est un numéro, pas une absence', () => {
    expect(siteDeFiche(null, 'Base', 0, SITES)).toEqual({ texte: 'Base (n° 0)', historique: true })
  })

  it('site rattaché mais inconnu du référentiel : retombe sur le texte libre, jamais sur l’identifiant', () => {
    expect(siteDeFiche('s-inconnu', 'Base Betioky', null, SITES)).toEqual({ texte: 'Base Betioky', historique: true })
    expect(siteDeFiche('s-inconnu', null, null, SITES)).toBeNull()
  })

  it('3. ni site ni texte : rien (un numéro de base seul ne suffit pas à décrire un site)', () => {
    expect(siteDeFiche(null, null, null, SITES)).toBeNull()
    expect(siteDeFiche(null, '  ', 5, SITES)).toBeNull()
  })
})

describe('libelleVolLie', () => {
  it('date, catégorie et horaires du vol', () => {
    expect(
      libelleVolLie({ date_vol: '2026-08-12', type: 'application', heure_debut: '08:00:00', heure_fin: '09:30:00' }),
    ).toBe('12/08/2026 — Application · 08:00 – 09:30')
  })
})

describe('libelleAeronef', () => {
  it('immatriculation et société', () => {
    expect(libelleAeronef({ immatriculation: '5R-MJA', societe: 'Heli Madagascar' })).toBe('5R-MJA — Heli Madagascar')
  })
})

describe('prospectionAerienne', () => {
  it('vrai avec un vol lié, une immatriculation ou une base texte', () => {
    expect(prospectionAerienne({ vol_id: 'v1' })).toBe(true)
    expect(prospectionAerienne({ immatricule_aeronef: '5R-MJA' })).toBe(true)
    expect(prospectionAerienne({ base: 'Base Betioky' })).toBe(true)
  })

  it('faux pour une prospection terrestre (aucun des trois)', () => {
    expect(prospectionAerienne({})).toBe(false)
    expect(prospectionAerienne({ vol_id: null, immatricule_aeronef: '  ', base: '' })).toBe(false)
  })
})
