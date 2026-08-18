import { describe, expect, it } from 'vitest'
import {
  buildCapturesSynthese,
  buildImagoRows,
  buildInfestationRows,
  buildLarveRows,
  buildPisteValidation,
  buildReferenceRows,
  DOT_EN_ATTENTE,
  findImago,
  findLarve,
  formatCoord,
  humaniser,
  TIRET,
  type CaptureFiche,
  type InfestationFiche,
  type PopulationFiche,
  type ProspectionFiche,
} from './prospection-fiche-maquette'

const PROSPECTION: ProspectionFiche = {
  n_fiche: 'PR-2026-0148-INT',
  n_releve: null,
  type_prospection: 'intensive',
  date_prospection: '2026-08-14',
  created_at: '2026-08-14T07:42:00',
  latitude: -22.4021,
  longitude: 44.1873,
  altitude: 612,
  region: 'Atsimo-Andrefana',
  district: 'Beroroha',
  commune: 'Ambatolahy',
  station_libre: null,
  surface_prospectee: 3000,
  surface_infestee: 1200,
}

function valeur(rows: { k: string; v: string }[], k: string) {
  return rows.find((r) => r.k === k)?.v
}

describe('buildReferenceRows — bloc A de la maquette', () => {
  it('reprend les six lignes de la maquette dans l’ordre', () => {
    const rows = buildReferenceRows(PROSPECTION, { code: 'ST-014', nom: 'Ankazoabo' })
    expect(rows.map((r) => r.k)).toEqual([
      'N° de fiche',
      'Date · heure',
      'Coordonnées',
      'Altitude',
      'Région / District',
      'Localité',
    ])
  })

  it('formate les coordonnées à la française, séparées par un point médian', () => {
    const rows = buildReferenceRows(PROSPECTION, null)
    expect(valeur(rows, 'Coordonnées')).toBe('-22,4021 · 44,1873')
  })

  it('rend la commune comme localité, et retombe sur la station libre', () => {
    expect(valeur(buildReferenceRows(PROSPECTION, null), 'Localité')).toBe('Ambatolahy')
    const sansCommune = buildReferenceRows(
      { ...PROSPECTION, commune: null, station_libre: 'Zone hors station' },
      null,
    )
    expect(valeur(sansCommune, 'Localité')).toBe('Zone hors station')
  })

  it('marque les valeurs absentes comme grisées plutôt que de les masquer', () => {
    const rows = buildReferenceRows(
      { ...PROSPECTION, latitude: null, longitude: null, altitude: null },
      null,
    )
    expect(rows.find((r) => r.k === 'Coordonnées')?.muted).toBe(true)
    expect(rows.find((r) => r.k === 'Altitude')?.v).toBe(TIRET)
  })
})

describe('buildInfestationRows — bloc D de la maquette', () => {
  const populations: PopulationFiche[] = [
    { id: 'p1', espece: 'LMC', categorie: 'imago', densite_diffuse: 120, densite_groupee: null },
  ]

  it('déduit la répartition des densités saisies', () => {
    expect(valeur(buildInfestationRows(PROSPECTION, [], populations), 'Répartition')).toBe('Diffuse')
    expect(
      valeur(
        buildInfestationRows(PROSPECTION, [], [{ ...populations[0], densite_groupee: 40 }]),
        'Répartition',
      ),
    ).toBe('Mixte')
    expect(valeur(buildInfestationRows(PROSPECTION, [], []), 'Répartition')).toBe(TIRET)
  })

  it('compte les vols clairs et les essaims parmi les cibles', () => {
    const infestations = [
      { id: 'i1', type_cible: 'vol_clair' },
      { id: 'i2', type_cible: 'vol_clair' },
      { id: 'i3', type_cible: 'bande_larvaire' },
    ] as InfestationFiche[]
    const rows = buildInfestationRows(PROSPECTION, infestations, populations)
    expect(valeur(rows, 'Vols clairs')).toBe('2')
    expect(valeur(rows, 'Essaims')).toBe('0')
  })

  it('exprime les surfaces en hectares', () => {
    const rows = buildInfestationRows(PROSPECTION, [], populations)
    expect(valeur(rows, 'Surface infestée')).toMatch(/^1\s?200 ha$/)
  })
})

describe('spécialisation larve / imago', () => {
  const larve: InfestationFiche = {
    id: 'i1',
    type_cible: 'bande_larvaire',
    surface_totale: 4.2,
    densite_moy: null,
    comportement: null,
    type_larve: 'bande_larvaire',
    stade_dominant: 'l4_l5',
    taille_groupe_m2: 45,
    nb_taches_bandes: 8,
    interdistance_min: 2,
    interdistance_max: 15,
    interdistance_moy: 7,
    front_longueur_m: 180,
    front_largeur_m: 25,
    densite_max_front: 620,
    densite_moy_arriere_front: 210,
    surface_contaminee_ha: 4.2,
    surface_infestee_pourcent: 38,
  }

  const imago: InfestationFiche = {
    id: 'i2',
    type_cible: 'vol_clair',
    surface_totale: null,
    densite_moy: null,
    comportement: null,
    type_essaim: 'vol_clair',
    essaim_en_vol: true,
    essaim_pose: false,
    heure_observation: '09:15',
    densite_en_vol: 140,
    dimension_ha: 12,
    pullulation_nb: null,
  }

  it('sépare les deux cibles par leur table d’origine', () => {
    expect(findLarve([imago, larve])?.id).toBe('i1')
    expect(findImago([imago, larve])?.id).toBe('i2')
    expect(findLarve([imago])).toBeNull()
  })

  it('rend les huit lignes larve de la maquette', () => {
    const rows = buildLarveRows(larve)
    expect(rows).toHaveLength(8)
    expect(valeur(rows, 'Type de larve')).toBe('Bande larvaire')
    expect(valeur(rows, 'Stade dominant')).toBe('L4-L5')
    expect(valeur(rows, 'Interdistance min/max/moy (m)')).toBe('2 / 15 / 7')
    expect(valeur(rows, 'Front longueur × largeur (m)')).toBe('180 × 25')
    expect(valeur(rows, 'Densité max front / arrière')).toBe('620 / 210')
    expect(valeur(rows, 'Surface contaminée · infestée')).toBe('4,2 ha · 38 %')
  })

  it('rend les six lignes imago de la maquette', () => {
    const rows = buildImagoRows(imago)
    expect(rows).toHaveLength(6)
    expect(valeur(rows, "Type d'essaim")).toBe('Vol clair')
    expect(valeur(rows, 'En vol / posé')).toBe('Oui / Non')
    expect(valeur(rows, "Heure d'observation")).toBe('09:15')
    // Pullulation non renseignée : grisée, comme dans la maquette.
    expect(rows.find((r) => r.k === 'Pullulation (nb)')?.muted).toBe(true)
  })

  it('reste rendable quand la spécialisation est absente', () => {
    expect(buildLarveRows(null)).toHaveLength(8)
    expect(buildImagoRows(null).every((r) => r.muted)).toBe(true)
  })
})

describe('buildCapturesSynthese — bloc B de la maquette', () => {
  const captures: CaptureFiche[] = [
    { id: 'c1', espece: 'LMC', categorie: 'imago', sexe: 'M', phase: 'solitaire', stade: 'imago', effectif: 18 },
    { id: 'c2', espece: 'LMC', categorie: 'imago', sexe: 'F', phase: 'solitaire', stade: 'imago', effectif: 22 },
    { id: 'c3', espece: 'LMC', categorie: 'imago', sexe: 'M', phase: 'gregaire', stade: 'imago', effectif: 44 },
  ]
  const populations: PopulationFiche[] = [
    {
      id: 'p1',
      espece: 'LMC',
      categorie: 'imago',
      phase: 'solitaire',
      methode: 'comptage_direct',
      densite_diffuse: 320,
      densite_groupee: null,
    },
  ]

  it('agrège une ligne par phase, mâles et femelles séparés', () => {
    const { lignes } = buildCapturesSynthese(captures, populations)
    expect(lignes.map((l) => l.phase)).toEqual(['solitaire', 'gregaire'])
    expect(lignes[0].males).toBe('18')
    expect(lignes[0].femelles).toBe('22')
    // Aucune femelle grégaire capturée : tiret plutôt que zéro.
    expect(lignes[1].femelles).toBe(TIRET)
  })

  it('rapproche la méthode et la densité depuis la population de même phase', () => {
    const { lignes } = buildCapturesSynthese(captures, populations)
    expect(lignes[0].methode).toBe('Comptage direct')
    expect(lignes[0].densite).toBe('320')
    expect(lignes[1].methode).toBe(TIRET)
  })

  it('ignore les valeurs de sexe hors enum backend plutôt que de les compter', () => {
    // Régression : la première version comparait à 'male'/'femelle', alors que
    // l'enum backend `Sexe` vaut "M"/"F" — les deux colonnes restaient vides.
    const { lignes } = buildCapturesSynthese(
      [{ ...captures[0], sexe: 'male' }],
      [],
    )
    expect(lignes[0].males).toBe(TIRET)
  })

  it('totalise tous les effectifs capturés', () => {
    expect(buildCapturesSynthese(captures, populations).total).toBe(84)
  })

  it('rend une synthèse vide sans capture', () => {
    expect(buildCapturesSynthese([], [])).toEqual({ lignes: [], total: 0 })
  })
})

describe('buildPisteValidation — colonne latérale', () => {
  const audit = [
    { id: 'a2', action: 'verification', auteur_id: 'u2', created_at: '2026-08-14T15:31:00Z' },
    { id: 'a1', action: 'creation', auteur_id: 'u1', created_at: '2026-08-14T07:42:00Z' },
  ]
  const nom = (id: string) => ({ u1: 'Randria Jean', u2: 'Naivo Tiana' })[id] ?? id

  it('ordonne du plus ancien au plus récent et libelle les actions', () => {
    const etapes = buildPisteValidation(audit, 'verifiee', nom)
    expect(etapes.map((e) => e.label)).toEqual(['Saisie terrain', 'Vérifiée', 'Validation finale'])
    expect(etapes[0].who).toBe('Randria Jean')
  })

  it('ajoute une étape grise tant que la fiche n’est pas statuée', () => {
    const etapes = buildPisteValidation(audit, 'verifiee', nom)
    expect(etapes[etapes.length - 1]).toMatchObject({ who: 'en attente', dot: DOT_EN_ATTENTE, when: TIRET })
  })

  it('n’ajoute rien quand la fiche est validée ou rejetée', () => {
    expect(buildPisteValidation(audit, 'validee', nom)).toHaveLength(2)
    expect(buildPisteValidation(audit, 'rejetee', nom)).toHaveLength(2)
  })
})

describe('helpers de formatage', () => {
  it('humanise les enums backend', () => {
    expect(humaniser('bande_larvaire')).toBe('Bande larvaire')
    expect(humaniser(null)).toBe(TIRET)
  })

  it('formate les coordonnées à quatre décimales', () => {
    expect(formatCoord(44.18734)).toBe('44,1873')
    expect(formatCoord(null)).toBe(TIRET)
  })
})
