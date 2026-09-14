import { describe, expect, it } from 'vitest'
import { formatDureeMinutes, ROLE_SIGNATURE_LABELS, TYPE_VOL_LABELS } from './fiche-vol'

describe('formatDureeMinutes', () => {
  it('formate en HH:MM, zéro-paddé', () => {
    expect(formatDureeMinutes(5)).toBe('00:05')
    expect(formatDureeMinutes(65)).toBe('01:05')
    expect(formatDureeMinutes(600)).toBe('10:00')
  })

  it('formate 0 minute sans planter', () => {
    expect(formatDureeMinutes(0)).toBe('00:00')
  })
})

describe('TYPE_VOL_LABELS / ROLE_SIGNATURE_LABELS', () => {
  it('couvre les 5 types de vol du domaine backend', () => {
    expect(Object.keys(TYPE_VOL_LABELS).sort()).toEqual(
      ['APPLICATION', 'CONVOYAGE', 'DIVERS', 'MEP', 'PROSPECTION'].sort(),
    )
  })

  it('couvre les 4 rôles de signature du domaine backend', () => {
    expect(Object.keys(ROLE_SIGNATURE_LABELS).sort()).toEqual(
      ['CHEF_DE_BASE', 'CONSULTANT_INTERNATIONAL', 'MECANICIEN', 'PILOTE'].sort(),
    )
  })
})
