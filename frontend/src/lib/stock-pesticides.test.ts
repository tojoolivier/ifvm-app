import { describe, expect, it } from 'vitest'
import {
  FILTRES_STOCK_VIDES,
  FORMULAIRE_MOUVEMENT_VIDE,
  construireMouvement,
  estSoldeNegatif,
  filtresStockActifs,
  formaterQuantite,
  libelleProduit,
  libelleSite,
  libelleTypeMouvement,
  lireQuantite,
  messageErreurMouvement,
  paramsJournal,
  paramsSolde,
  sitesPrincipaux,
  trierSoldes,
  validerMouvement,
  type FormulaireMouvement,
  type Pesticide,
  type SiteAerien,
  type Solde,
} from './stock-pesticides'

const SITES = [
  { id: 's1', numero: 'IHO01', localite: 'Ihosy', parent_site_id: null },
  { id: 's2', numero: 'IHO02', localite: 'Ihosy Sud', parent_site_id: 's1' },
  { id: 's3', numero: 'BET01', localite: 'Betroka', parent_site_id: null },
] as unknown as SiteAerien[]

const PESTICIDES = [
  { id: 'p1', code: 'FEN-01', nom: 'Fenitrothion' },
  { id: 'p2', code: 'DEL-02', nom: 'Deltamethrine' },
] as unknown as Pesticide[]

function erreur(status: number, detail: unknown) {
  return { response: { status, data: { detail } } }
}

function formulaire(surcharges: Partial<FormulaireMouvement> = {}): FormulaireMouvement {
  return { ...FORMULAIRE_MOUVEMENT_VIDE, pesticideId: 'p1', siteId: 's1', quantite: '100', ...surcharges }
}

describe('formats et libellés', () => {
  it.each([
    [100, '100'],
    [12.5, '12,5'],
    [0.1 + 0.2, '0,3'],
    [1250.456, '1250,46'],
    [-30, '-30'],
    [0, '0'],
  ])('formate %d en « %s »', (quantite, attendu) => {
    expect(formaterQuantite(quantite)).toBe(attendu)
  })

  it('libellé d’un site : numéro et localité ; l’identifiant s’il est inconnu ; « — » sans site', () => {
    expect(libelleSite('s1', SITES)).toBe('IHO01 — Ihosy')
    expect(libelleSite('inconnu', SITES)).toBe('inconnu')
    expect(libelleSite(null, SITES)).toBe('—')
  })

  it('libellé d’un produit : code et nom ; l’identifiant s’il est inconnu', () => {
    expect(libelleProduit('p1', PESTICIDES)).toBe('FEN-01 — Fenitrothion')
    expect(libelleProduit('inconnu', PESTICIDES)).toBe('inconnu')
  })

  it('libellé d’un type de mouvement', () => {
    expect(libelleTypeMouvement('approvisionnement')).toBe('Approvisionnement')
    expect(libelleTypeMouvement('transfert')).toBe('Transfert')
    expect(libelleTypeMouvement('consommation')).toBe('Consommation')
    expect(libelleTypeMouvement('autre')).toBe('autre')
  })
})

describe('sitesPrincipaux', () => {
  it('ne garde que les sites sans parent : un stand ou une base secondaire ne porte pas de stock', () => {
    expect(sitesPrincipaux(SITES).map((s) => s.id)).toEqual(['s1', 's3'])
  })
})

describe('trierSoldes', () => {
  const solde = (site_id: string, pesticide_id: string, unite: string, quantite = 1): Solde => ({
    site_id,
    pesticide_id,
    unite,
    quantite,
  })

  it('trie par site, puis produit, puis unité', () => {
    const tries = trierSoldes(
      [solde('s1', 'p1', 'L'), solde('s3', 'p1', 'L'), solde('s1', 'p2', 'L'), solde('s1', 'p1', 'kg')],
      SITES,
      PESTICIDES,
    )
    expect(tries.map((s) => `${s.site_id}/${s.pesticide_id}/${s.unite}`)).toEqual([
      's3/p1/L', // BET01 avant IHO01
      's1/p2/L', // DEL-02 avant FEN-01
      's1/p1/kg',
      's1/p1/L',
    ])
  })

  it('garde une ligne par unité : le litre et le kilo ne sont jamais additionnés', () => {
    const tries = trierSoldes([solde('s1', 'p1', 'L', 90), solde('s1', 'p1', 'kg', 40)], SITES, PESTICIDES)
    expect(tries).toHaveLength(2)
    expect(tries.map((s) => [s.unite, s.quantite])).toEqual([
      ['kg', 40],
      ['L', 90],
    ])
  })

  it('ne modifie pas la liste d’origine', () => {
    const origine = [solde('s3', 'p1', 'L'), solde('s1', 'p1', 'L')]
    trierSoldes(origine, SITES, PESTICIDES)
    expect(origine.map((s) => s.site_id)).toEqual(['s3', 's1'])
  })
})

describe('estSoldeNegatif', () => {
  it('signale un solde sous zéro', () => {
    expect(estSoldeNegatif({ quantite: -5 })).toBe(true)
    expect(estSoldeNegatif({ quantite: 0 })).toBe(false)
    expect(estSoldeNegatif({ quantite: 12 })).toBe(false)
  })
})

describe('filtres', () => {
  it('détecte qu’au moins un filtre est renseigné', () => {
    expect(filtresStockActifs(FILTRES_STOCK_VIDES)).toBe(false)
    expect(filtresStockActifs({ ...FILTRES_STOCK_VIDES, type: 'transfert' })).toBe(true)
  })

  it('paramètres du journal : seuls les filtres renseignés sont envoyés', () => {
    expect(paramsJournal(FILTRES_STOCK_VIDES)).toEqual({})
    expect(
      paramsJournal({
        type: 'consommation',
        siteId: 's1',
        pesticideId: 'p1',
        dateDebut: '2026-08-01',
        dateFin: '2026-08-31',
      }),
    ).toEqual({
      type: 'consommation',
      site_id: 's1',
      pesticide_id: 'p1',
      date_debut: '2026-08-01',
      date_fin: '2026-08-31',
    })
  })

  it('paramètres du solde : le site et le produit seulement (le solde ne connaît ni type ni période)', () => {
    expect(
      paramsSolde({ type: 'transfert', siteId: 's1', pesticideId: '', dateDebut: '2026-08-01', dateFin: '' }),
    ).toEqual({ site_id: 's1' })
  })
})

describe('lireQuantite', () => {
  it('accepte la virgule et le point décimal', () => {
    expect(lireQuantite('12,5')).toBe(12.5)
    expect(lireQuantite(' 12.5 ')).toBe(12.5)
  })

  it('NaN pour une saisie qui n’est pas un nombre', () => {
    expect(lireQuantite('abc')).toBeNaN()
  })
})

describe('validerMouvement', () => {
  it('un approvisionnement complet est valide', () => {
    expect(validerMouvement(formulaire())).toEqual([])
  })

  it('exige le produit, le site et la quantité', () => {
    expect(validerMouvement(formulaire({ pesticideId: '', siteId: '', quantite: '' }))).toEqual([
      'Choisissez le produit.',
      'Choisissez le site.',
      'La quantité doit être un nombre supérieur à 0.',
    ])
  })

  it.each(['0', '-5', 'abc', '   '])('refuse la quantité « %s »', (quantite) => {
    expect(validerMouvement(formulaire({ quantite }))).toContain('La quantité doit être un nombre supérieur à 0.')
  })

  it('accepte une quantité décimale avec virgule', () => {
    expect(validerMouvement(formulaire({ quantite: '2,5' }))).toEqual([])
  })

  it('un transfert exige un site de destination', () => {
    const erreurs = validerMouvement(formulaire({ type: 'transfert' }))
    expect(erreurs).toEqual(['Choisissez le site de destination.'])
  })

  it('un transfert vers le même site est refusé', () => {
    expect(validerMouvement(formulaire({ type: 'transfert', siteDestinationId: 's1' }))).toEqual([
      'Le site de destination doit être différent du site source.',
    ])
  })

  it('un transfert vers un autre site est valide', () => {
    expect(validerMouvement(formulaire({ type: 'transfert', siteDestinationId: 's3' }))).toEqual([])
  })

  it('un transfert nomme le site source « source »', () => {
    expect(validerMouvement(formulaire({ type: 'transfert', siteId: '', siteDestinationId: 's3' }))).toContain(
      'Choisissez le site source.',
    )
  })
})

describe('construireMouvement', () => {
  it('approvisionnement : pas de site de destination, pas de date par défaut', () => {
    expect(construireMouvement(formulaire({ quantite: '100', unite: 'L' }))).toEqual({
      type: 'approvisionnement',
      pesticide_id: 'p1',
      site_id: 's1',
      quantite: 100,
      unite: 'L',
    })
  })

  it('transfert : avec le site de destination', () => {
    expect(
      construireMouvement(formulaire({ type: 'transfert', siteDestinationId: 's3', quantite: '30,5', unite: 'kg' })),
    ).toEqual({
      type: 'transfert',
      pesticide_id: 'p1',
      site_id: 's1',
      site_destination_id: 's3',
      quantite: 30.5,
      unite: 'kg',
    })
  })

  it('date renseignée : envoyée', () => {
    expect(construireMouvement(formulaire({ date: '2026-08-12' })).date_mouvement).toBe('2026-08-12')
  })

  it('un approvisionnement n’envoie jamais de destination, même restée dans le formulaire', () => {
    expect(construireMouvement(formulaire({ siteDestinationId: 's3' }))).not.toHaveProperty('site_destination_id')
  })
})

describe('messageErreurMouvement', () => {
  it('403 : droit de saisie réservé', () => {
    expect(messageErreurMouvement(erreur(403, 'Réservé aux chefs de base et aux administrateurs'))).toBe(
      'Seuls les chefs de base et les administrateurs peuvent enregistrer un mouvement de stock.',
    )
  })

  it('site non principal', () => {
    expect(
      messageErreurMouvement(
        erreur(
          422,
          "le stock de pesticides est rattaché au site aérien principal : abc n'en est pas un",
        ),
      ),
    ).toBe('Le stock est tenu au niveau des sites principaux : ce site est un stand ou une base secondaire.')
  })

  it('destination manquante ou superflue', () => {
    expect(messageErreurMouvement(erreur(422, 'site_destination_id est requis pour un transfert'))).toBe(
      'Choisissez le site de destination du transfert.',
    )
    expect(
      messageErreurMouvement(erreur(422, 'site_destination_id ne doit être renseigné que pour un transfert')),
    ).toBe("Un site de destination n'a de sens que pour un transfert.")
  })

  it('site ou produit introuvable', () => {
    expect(messageErreurMouvement(erreur(404, 'site introuvable : abc'))).toBe('Site introuvable : rechargez la page.')
    expect(messageErreurMouvement(erreur(404, 'pesticide_id introuvable : abc'))).toBe(
      'Produit introuvable : rechargez la page.',
    )
  })

  it('identifiant déjà utilisé', () => {
    expect(messageErreurMouvement(erreur(409, "l'identifiant x est déjà utilisé par un mouvement différent"))).toBe(
      'Ce mouvement a déjà été enregistré.',
    )
  })

  it('validation du corps (liste d’erreurs) : la quantité, sinon le premier message', () => {
    expect(
      messageErreurMouvement(
        erreur(422, [{ loc: ['body', 'quantite'], msg: 'Input should be greater than 0', type: 'greater_than' }]),
      ),
    ).toBe('La quantité doit être un nombre supérieur à 0.')
    expect(
      messageErreurMouvement(erreur(422, [{ loc: ['body'], msg: 'Value error, site_destination_id est requis', type: 'value_error' }])),
    ).toBe('site_destination_id est requis')
  })

  it('détail inconnu : repris tel quel ; aucune réponse : message par défaut', () => {
    expect(messageErreurMouvement(erreur(500, 'panne serveur'))).toBe('panne serveur')
    expect(messageErreurMouvement(new Error('réseau'))).toBe("Impossible d'enregistrer ce mouvement.")
  })
})
