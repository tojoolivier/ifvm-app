import { describe, expect, it } from 'vitest'
import {
  FAMILLES_COMPORTEMENT_PAPIER,
  FAMILLES_MORTALITE_PAPIER,
  casesFamilles,
  dateFr,
  jourFr,
  normaliser,
  texte,
  texteOuNull,
  viewBoxTrace,
} from './fiche-tableau'

describe('texte', () => {
  it('rend « — » pour une valeur vide, comme les gabarits PDF', () => {
    expect(texte(null)).toBe('—')
    expect(texte(undefined)).toBe('—')
    expect(texte('')).toBe('—')
  })

  it('rend Oui / Non pour un booléen et garde le reste tel quel', () => {
    expect(texte(true)).toBe('Oui')
    expect(texte(false)).toBe('Non')
    expect(texte(0)).toBe('0')
    expect(texte('faibles')).toBe('faibles')
    expect(texte(2500)).toBe('2500')
  })

  it("texteOuNull distingue un champ à remplir d'un zéro", () => {
    expect(texteOuNull(null)).toBeNull()
    expect(texteOuNull(0)).toBe('0')
  })
})

describe('dateFr', () => {
  it('lit une date seule sans passer par le fuseau du navigateur', () => {
    expect(dateFr('2026-09-24')).toBe('24/09/2026')
  })

  it('met en forme un horodatage complet en jj/mm/aaaa hh:mm', () => {
    expect(dateFr('2026-09-22T08:50:00')).toBe('22/09/2026 08:50')
  })

  it('rend « — » sans valeur et la valeur brute si elle est illisible', () => {
    expect(dateFr(null)).toBe('—')
    expect(dateFr('pas une date')).toBe('pas une date')
  })

  it("jourFr ne garde que la date d'un horodatage", () => {
    expect(jourFr('2026-09-21T08:00:00Z')).toBe('21/09/2026')
    expect(jourFr(null)).toBe('—')
  })
})

describe('normaliser', () => {
  it('ignore accents, casse et pluriel', () => {
    expect(normaliser('Mammifères')).toBe('mammifere')
    expect(normaliser('Insectes utiles')).toBe('insectes utile')
  })

  it('rapproche « Oiseux » (§10) et « Oiseaux » (§11) du papier', () => {
    expect(normaliser('Oiseux')).toBe('oiseau')
    expect(normaliser('Oiseaux')).toBe('oiseau')
  })
})

describe('casesFamilles', () => {
  it('coche la case papier dont le libellé correspond à la clé saisie côté mobile', () => {
    const { cases } = casesFamilles({ 'Insectes utiles': true, Reptiles: true }, FAMILLES_COMPORTEMENT_PAPIER)
    expect(cases.filter((c) => c.cochee).map((c) => c.label)).toEqual(['Reptile', 'Insecte'])
  })

  it('coche « Oiseux » (§10) comme « Oiseaux » (§11) pour la même saisie', () => {
    const familles = { Oiseaux: true }
    expect(casesFamilles(familles, FAMILLES_COMPORTEMENT_PAPIER).cases[0]).toEqual({ label: 'Oiseux', cochee: true })
    expect(casesFamilles(familles, FAMILLES_MORTALITE_PAPIER).cases[0]).toEqual({ label: 'Oiseaux', cochee: true })
  })

  it('restitue à part une famille sans case papier au lieu de la perdre', () => {
    const { nonRapprochees } = casesFamilles({ Insectes: true, Abeilles: true }, FAMILLES_MORTALITE_PAPIER)
    expect(nonRapprochees).toEqual(['Abeilles'])
  })

  it('ne coche rien sans famille saisie', () => {
    const { cases, nonRapprochees } = casesFamilles(null, FAMILLES_MORTALITE_PAPIER)
    expect(cases.every((c) => !c.cochee)).toBe(true)
    expect(nonRapprochees).toEqual([])
  })
})

describe('viewBoxTrace', () => {
  it('encadre le tracé par sa boîte englobante, avec une marge', () => {
    expect(viewBoxTrace('M 10 20 L 110 70')).toBe('7 17 106 56')
  })

  it('accepte des coordonnées décimales et négatives', () => {
    expect(viewBoxTrace('M -5.5 2 L 4.5 12')).toBe('-8.5 -1 16 16')
  })

  it('rend null pour un tracé vide', () => {
    expect(viewBoxTrace(null)).toBeNull()
    expect(viewBoxTrace('')).toBeNull()
    expect(viewBoxTrace('M')).toBeNull()
  })
})
