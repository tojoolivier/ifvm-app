import { describe, expect, it } from 'vitest'
import {
  FILTRES_VIDES,
  champsSpecifiques,
  dureeMinutes,
  filtresActifs,
  filtrerVols,
  formaterDateVol,
  formaterDuree,
  formaterHeure,
  libelleCategorie,
  libelleSite,
  peutPorterProspections,
  peutPorterTraitement,
  totalMinutes,
  type SiteAerien,
  type Vol,
} from './vols'

function vol(surcharges: Partial<Vol> = {}): Vol {
  return {
    id: 'v1',
    type: 'application',
    equipe_id: 'e1',
    aeronef_id: 'a1',
    site_principal_id: null,
    stand_id: null,
    base_secondaire_id: null,
    traitement_id: null,
    date_vol: '2026-08-12',
    heure_debut: '08:00:00',
    heure_fin: '09:30:00',
    motif: null,
    lieu_depart: null,
    lieu_arrivee: null,
    observations: null,
    created_at: '2026-08-12T10:00:00Z',
    updated_at: '2026-08-12T10:00:00Z',
    ...surcharges,
    // `duree_minutes` (champ calculé du serveur) n'est volontairement pas posé par défaut : la plupart des
    // tests exercent le repli sur les heures ; ceux qui portent sur le champ le passent explicitement.
  } as Vol
}

const SITES = [
  { id: 's1', numero: 'IHO01', localite: 'Ihosy', parent_site_id: null },
  { id: 's2', numero: 'IHO02', localite: 'Ihosy Sud', parent_site_id: 's1' },
] as unknown as SiteAerien[]

describe('durée et formats', () => {
  it('calcule la durée d’un vol en minutes, avec ou sans secondes', () => {
    expect(dureeMinutes({ heure_debut: '08:00:00', heure_fin: '09:30:00' })).toBe(90)
    expect(dureeMinutes({ heure_debut: '06:15', heure_fin: '07:00' })).toBe(45)
  })

  it('utilise la durée calculée par le serveur (duree_minutes) quand elle est fournie', () => {
    expect(dureeMinutes({ heure_debut: '08:00:00', heure_fin: '09:30:00', duree_minutes: 95 })).toBe(95)
    expect(totalMinutes([vol({ duree_minutes: 60 }), vol({ duree_minutes: 25 })])).toBe(85)
  })

  it('ignore une durée serveur absente ou invalide et retombe sur les heures', () => {
    expect(dureeMinutes({ heure_debut: '08:00:00', heure_fin: '09:30:00', duree_minutes: null })).toBe(90)
    expect(dureeMinutes({ heure_debut: '08:00:00', heure_fin: '09:30:00', duree_minutes: Number.NaN })).toBe(90)
  })

  it('ne renvoie jamais une durée négative ni NaN', () => {
    expect(dureeMinutes({ heure_debut: '10:00:00', heure_fin: '09:00:00' })).toBe(0)
    expect(dureeMinutes({ heure_debut: 'x', heure_fin: 'y' })).toBe(0)
  })

  it.each([
    [0, '0 min'],
    [45, '45 min'],
    [60, '1 h'],
    [90, '1 h 30'],
    [125, '2 h 05'],
    [600, '10 h'],
  ])('formate %i minutes en « %s »', (minutes, attendu) => {
    expect(formaterDuree(minutes)).toBe(attendu)
  })

  it('formate les heures et les dates', () => {
    expect(formaterHeure('08:05:00')).toBe('08:05')
    expect(formaterDateVol('2026-08-12')).toBe('12/08/2026')
    expect(formaterDateVol('n/a')).toBe('n/a')
  })

  it('libellé de catégorie : mots de l’app mobile, valeur inconnue telle quelle', () => {
    expect(libelleCategorie('mise_en_place')).toBe('Mise en place')
    expect(libelleCategorie('application')).toBe('Application')
    expect(libelleCategorie('autre')).toBe('autre')
  })
})

describe('totalMinutes', () => {
  it('additionne les durées', () => {
    expect(
      totalMinutes([
        vol({ heure_debut: '08:00:00', heure_fin: '09:30:00' }),
        vol({ heure_debut: '10:00:00', heure_fin: '10:45:00' }),
      ]),
    ).toBe(135)
  })

  it('vaut 0 pour une liste vide', () => {
    expect(totalMinutes([])).toBe(0)
  })
})

describe('filtrerVols', () => {
  const vols = [
    vol({ id: 'v1', type: 'application', equipe_id: 'e1', aeronef_id: 'a1', date_vol: '2026-08-10' }),
    vol({ id: 'v2', type: 'convoyage', equipe_id: 'e2', aeronef_id: 'a1', date_vol: '2026-08-12' }),
    vol({ id: 'v3', type: 'application', equipe_id: 'e1', aeronef_id: 'a2', date_vol: '2026-08-14' }),
    vol({ id: 'v4', type: 'prospection', equipe_id: 'e2', aeronef_id: 'a2', date_vol: '2026-09-01' }),
  ]
  const ids = (liste: Vol[]) => liste.map((v) => v.id)

  it('sans filtre : tous les vols, du plus récent au plus ancien', () => {
    expect(ids(filtrerVols(vols, FILTRES_VIDES))).toEqual(['v4', 'v3', 'v2', 'v1'])
  })

  it('à date égale, le vol qui a commencé le plus tard passe en premier', () => {
    const memeJour = [
      vol({ id: 'matin', date_vol: '2026-08-12', heure_debut: '06:00:00' }),
      vol({ id: 'soir', date_vol: '2026-08-12', heure_debut: '16:00:00' }),
    ]
    expect(ids(filtrerVols(memeJour, FILTRES_VIDES))).toEqual(['soir', 'matin'])
  })

  it('filtre par catégorie', () => {
    expect(ids(filtrerVols(vols, { ...FILTRES_VIDES, categorie: 'application' }))).toEqual(['v3', 'v1'])
  })

  it('filtre par équipe', () => {
    expect(ids(filtrerVols(vols, { ...FILTRES_VIDES, equipeId: 'e2' }))).toEqual(['v4', 'v2'])
  })

  it('filtre par aéronef', () => {
    expect(ids(filtrerVols(vols, { ...FILTRES_VIDES, aeronefId: 'a2' }))).toEqual(['v4', 'v3'])
  })

  it('filtre par période, bornes incluses', () => {
    expect(ids(filtrerVols(vols, { ...FILTRES_VIDES, dateDebut: '2026-08-12', dateFin: '2026-08-14' }))).toEqual([
      'v3',
      'v2',
    ])
  })

  it('une seule borne de période suffit', () => {
    expect(ids(filtrerVols(vols, { ...FILTRES_VIDES, dateDebut: '2026-08-14' }))).toEqual(['v4', 'v3'])
    expect(ids(filtrerVols(vols, { ...FILTRES_VIDES, dateFin: '2026-08-10' }))).toEqual(['v1'])
  })

  it('combine les filtres (et logique)', () => {
    expect(
      ids(filtrerVols(vols, { ...FILTRES_VIDES, categorie: 'application', aeronefId: 'a1', dateFin: '2026-08-31' })),
    ).toEqual(['v1'])
  })

  it('ne modifie pas la liste d’origine', () => {
    const copie = [...vols]
    filtrerVols(vols, FILTRES_VIDES)
    expect(vols).toEqual(copie)
  })
})

describe('filtresActifs', () => {
  it('détecte qu’au moins un filtre est renseigné', () => {
    expect(filtresActifs(FILTRES_VIDES)).toBe(false)
    expect(filtresActifs({ ...FILTRES_VIDES, equipeId: 'e1' })).toBe(true)
  })
})

describe('libelleSite', () => {
  it('numéro et localité du site', () => {
    expect(libelleSite('s1', SITES)).toBe('IHO01 — Ihosy')
  })

  it('null sans site ; l’identifiant si le site est inconnu du référentiel', () => {
    expect(libelleSite(null, SITES)).toBeNull()
    expect(libelleSite('s-inconnu', SITES)).toBe('s-inconnu')
  })
})

describe('champsSpecifiques', () => {
  it('application et mise en place : site principal et stand toujours affichés, base secondaire si présente', () => {
    const complet = champsSpecifiques(vol({ site_principal_id: 's1', stand_id: 's2', base_secondaire_id: 's2' }), SITES)
    expect(complet).toEqual([
      { libelle: 'Site principal', valeur: 'IHO01 — Ihosy' },
      { libelle: 'Stand de remplissage', valeur: 'IHO02 — Ihosy Sud' },
      { libelle: 'Base secondaire', valeur: 'IHO02 — Ihosy Sud' },
    ])

    const incomplet = champsSpecifiques(vol({ type: 'mise_en_place' }), SITES)
    expect(incomplet).toEqual([
      { libelle: 'Site principal', valeur: 'Non renseigné' },
      { libelle: 'Stand de remplissage', valeur: 'Non renseigné' },
    ])
  })

  it('convoyage : motif, départ et arrivée', () => {
    expect(
      champsSpecifiques(
        vol({ type: 'convoyage', motif: 'Rapatriement', lieu_depart: 'Ihosy', lieu_arrivee: 'Toliara' }),
        SITES,
      ),
    ).toEqual([
      { libelle: 'Motif', valeur: 'Rapatriement' },
      { libelle: 'Lieu de départ', valeur: 'Ihosy' },
      { libelle: 'Lieu d’arrivée', valeur: 'Toliara' },
    ])
  })

  it('divers : le motif seulement', () => {
    expect(champsSpecifiques(vol({ type: 'divers', motif: 'Essai' }), SITES)).toEqual([
      { libelle: 'Motif', valeur: 'Essai' },
    ])
  })

  it('prospection : rien d’obligatoire, les sites seulement s’ils sont renseignés', () => {
    expect(champsSpecifiques(vol({ type: 'prospection' }), SITES)).toEqual([])
    expect(champsSpecifiques(vol({ type: 'prospection', site_principal_id: 's1' }), SITES)).toEqual([
      { libelle: 'Site principal', valeur: 'IHO01 — Ihosy' },
    ])
  })
})

describe('rattachements (#610)', () => {
  it('seul un vol d’application porte un traitement', () => {
    expect(peutPorterTraitement({ type: 'application' })).toBe(true)
    expect(peutPorterTraitement({ type: 'prospection' })).toBe(false)
    expect(peutPorterTraitement({ type: 'convoyage' })).toBe(false)
  })

  it('seul un vol de prospection porte des prospections', () => {
    expect(peutPorterProspections({ type: 'prospection' })).toBe(true)
    expect(peutPorterProspections({ type: 'application' })).toBe(false)
  })
})
