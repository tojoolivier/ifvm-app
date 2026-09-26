import { describe, expect, it } from 'vitest'
import {
  LARGEUR_MIN_PCT,
  aujourdhuiIso,
  calculerFrise,
  equipeEnServiceDe,
  estEnCours,
  formaterDate,
  messageErreurAeronef,
  messageErreurAffectation,
  type EquipeParc,
} from './parc-aeronefs'

function erreur(status: number, detail: string) {
  return { response: { status, data: { detail } } }
}

describe('aujourdhuiIso', () => {
  it('formate la date locale en AAAA-MM-JJ, avec zéros de tête', () => {
    expect(aujourdhuiIso(new Date(2026, 6, 4))).toBe('2026-07-04')
    expect(aujourdhuiIso(new Date(2026, 11, 31))).toBe('2026-12-31')
  })
})

describe('formaterDate', () => {
  it('passe de AAAA-MM-JJ à JJ/MM/AAAA', () => {
    expect(formaterDate('2026-07-01')).toBe('01/07/2026')
  })

  it('ignore l’heure d’un horodatage ISO', () => {
    expect(formaterDate('2026-07-01T10:30:00Z')).toBe('01/07/2026')
  })

  it('renvoie une valeur qui n’est pas une date telle quelle', () => {
    expect(formaterDate('bientôt')).toBe('bientôt')
  })
})

describe('estEnCours', () => {
  it('une affectation sans date de fin est en cours', () => {
    expect(estEnCours({ date_fin: null })).toBe(true)
    expect(estEnCours({ date_fin: undefined })).toBe(true)
    expect(estEnCours({ date_fin: '2026-07-01' })).toBe(false)
  })
})

describe('calculerFrise', () => {
  it('sans affectation : frise vide, bornée à aujourd’hui', () => {
    expect(calculerFrise([], '2026-09-26')).toEqual({ debut: '2026-09-26', fin: '2026-09-26', barres: [] })
  })

  it('positionne chaque barre entre la plus ancienne date de début et la fin la plus tardive', () => {
    // 100 jours au total, du 1er juin au 9 septembre (aujourd'hui n'entre pas en jeu : tout est clos).
    const frise = calculerFrise(
      [
        { date_debut: '2026-06-01', date_fin: '2026-07-01' }, // 30 jours
        { date_debut: '2026-07-01', date_fin: '2026-09-09' }, // 70 jours
      ],
      '2026-09-26',
    )

    expect(frise.debut).toBe('2026-06-01')
    expect(frise.fin).toBe('2026-09-09')
    expect(frise.barres[0].gauche).toBeCloseTo(0, 5)
    expect(frise.barres[0].largeur).toBeCloseTo(30, 5)
    expect(frise.barres[1].gauche).toBeCloseTo(30, 5)
    expect(frise.barres[1].largeur).toBeCloseTo(70, 5)
  })

  it('une affectation en cours va jusqu’à aujourd’hui', () => {
    const frise = calculerFrise(
      [
        { date_debut: '2026-07-01', date_fin: null },
        { date_debut: '2026-06-01', date_fin: '2026-07-01' },
      ],
      '2026-07-31',
    )

    expect(frise.debut).toBe('2026-06-01')
    expect(frise.fin).toBe('2026-07-31')
    // Étendue : 60 jours. La barre en cours : de 30/60 = 50 % à 60/60, soit 50 % de large.
    expect(frise.barres[0].gauche).toBeCloseTo(50, 5)
    expect(frise.barres[0].largeur).toBeCloseTo(50, 5)
    // La barre close : de 0 à 30/60 = 50 %.
    expect(frise.barres[1].gauche).toBeCloseTo(0, 5)
    expect(frise.barres[1].largeur).toBeCloseTo(50, 5)
  })

  it('garde une barre visible pour une affectation d’un seul jour, sans déborder', () => {
    const frise = calculerFrise(
      [
        { date_debut: '2026-01-01', date_fin: '2026-12-31' },
        { date_debut: '2026-12-31', date_fin: '2026-12-31' },
      ],
      '2026-12-31',
    )

    const courte = frise.barres[1]
    expect(courte.largeur).toBeGreaterThanOrEqual(LARGEUR_MIN_PCT)
    expect(courte.gauche + courte.largeur).toBeLessThanOrEqual(100 + 1e-9)
  })

  it('une affectation qui ne commence que dans le futur reste dans la frise', () => {
    const frise = calculerFrise([{ date_debut: '2026-10-15', date_fin: null }], '2026-09-26')

    expect(frise.debut).toBe('2026-10-15')
    expect(frise.fin).toBe('2026-10-15')
    expect(frise.barres[0].gauche).toBeGreaterThanOrEqual(0)
    expect(frise.barres[0].gauche + frise.barres[0].largeur).toBeLessThanOrEqual(100 + 1e-9)
  })

  it('une seule affectation d’un jour ne divise pas par zéro', () => {
    const frise = calculerFrise([{ date_debut: '2026-07-01', date_fin: '2026-07-01' }], '2026-07-01')

    expect(Number.isFinite(frise.barres[0].gauche)).toBe(true)
    expect(Number.isFinite(frise.barres[0].largeur)).toBe(true)
  })
})

describe('equipeEnServiceDe', () => {
  const equipe = (id: string, aeronefId: string | null, actif = true) =>
    ({ id, nom: id, type: 'aerien', actif, aeronef: aeronefId ? { id: aeronefId } : null }) as unknown as EquipeParc

  it('trouve l’équipe active où l’appareil est en service', () => {
    const equipes = [equipe('e1', 'a1'), equipe('e2', 'a2')]
    expect(equipeEnServiceDe('a2', equipes)?.id).toBe('e2')
  })

  it('renvoie undefined pour un appareil libre ou dans une équipe inactive', () => {
    expect(equipeEnServiceDe('a3', [equipe('e1', 'a1')])).toBeUndefined()
    expect(equipeEnServiceDe('a1', [equipe('e1', 'a1', false)])).toBeUndefined()
  })
})

describe('messageErreurAeronef', () => {
  it('immatriculation en double : un message lisible qui reprend l’immatriculation', () => {
    expect(
      messageErreurAeronef(erreur(409, 'immatriculation déjà utilisée par un autre aéronef : 5R-MJA')),
    ).toBe("L'immatriculation « 5R-MJA » est déjà utilisée par un autre appareil du parc.")
  })

  it('immatriculation en double sans valeur : message générique de doublon', () => {
    expect(messageErreurAeronef(erreur(409, 'immatriculation déjà utilisée par un autre aéronef'))).toBe(
      'Cette immatriculation est déjà utilisée par un autre appareil du parc.',
    )
  })

  it('un profil non administrateur (403) est renvoyé à l’administrateur', () => {
    expect(messageErreurAeronef(erreur(403, 'Forbidden'))).toBe(
      'Seul un administrateur peut modifier le parc aéronefs.',
    )
  })

  it('reprend le détail du serveur pour les autres erreurs, sinon un message par défaut', () => {
    expect(messageErreurAeronef(erreur(404, 'Aéronef non trouvé'))).toBe('Aéronef non trouvé')
    expect(messageErreurAeronef(new Error('réseau'))).toBe("Impossible d'enregistrer cet appareil.")
  })
})

describe('messageErreurAffectation', () => {
  it('appareil déjà affecté sur la période', () => {
    expect(
      messageErreurAffectation(
        erreur(422, 'aéronef déjà affecté sur une période qui se chevauche : 5R-MJA'),
      ),
    ).toBe('Cet appareil est déjà affecté à une équipe sur une période qui chevauche celle-ci.')
  })

  it('équipe déjà équipée sur la période', () => {
    expect(
      messageErreurAffectation(erreur(422, "l'équipe a déjà un aéronef sur cette période : 5R-MJA")),
    ).toBe('Cette équipe a déjà un appareil sur une période qui chevauche celle-ci.')
  })

  it('équipe non aérienne', () => {
    expect(
      messageErreurAffectation(erreur(422, "un aéronef ne s'affecte qu'à une équipe aérienne : e1")),
    ).toBe('Un appareil ne peut être affecté qu’à une équipe aérienne.')
  })

  it('période invalide', () => {
    expect(messageErreurAffectation(erreur(422, "période d'affectation invalide : fin < début"))).toBe(
      'Les dates ne sont pas valides : la date de fin doit être postérieure ou égale à la date de début.',
    )
  })

  it('affectation déjà clôturée', () => {
    expect(messageErreurAffectation(erreur(409, 'affectation déjà clôturée : 2026-07-01'))).toBe(
      'Cette affectation est déjà clôturée.',
    )
  })

  it('reprend le détail inconnu du serveur, sinon un message par défaut', () => {
    expect(messageErreurAffectation(erreur(500, 'panne'))).toBe('panne')
    expect(messageErreurAffectation(new Error('réseau'))).toBe("Impossible d'enregistrer cette affectation.")
  })
})
