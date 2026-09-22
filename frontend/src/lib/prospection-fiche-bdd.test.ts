import { describe, expect, it } from 'vitest'
import {
  CATALOGUE_CAPTURE,
  CATALOGUE_INFESTATION,
  CATALOGUE_OPERATION,
  CATALOGUE_POPULATION,
  CATALOGUE_PROSPECTION,
  GROUPES_INFESTATION,
  GROUPES_POPULATION,
  GROUPES_PROSPECTION,
  TIRET,
  aplatirJson,
  colonnesTable,
  entreesAudit,
  fBool,
  fListe,
  fNombre,
  fTrace,
  groupesProspection,
  humaniser,
  type AuditBdd,
  type ContexteFiche,
} from './prospection-fiche-bdd'
import { ficheVide } from '@/test/prospection-fixtures'

const ctx: ContexteFiche = { nomAgent: (id) => `agent-${id}` }

describe('formatage — la valeur stockée, sans arrondi ni conversion', () => {
  it('ne tronque jamais un nombre (Numeric illimité en base)', () => {
    expect(fNombre(12.3456789)).toBe('12,3456789')
    expect(fNombre('860.50')).toBe('860,5')
  })

  it('garde l’unité de la colonne, sans convertir (hauteur d’herbe : cm)', () => {
    expect(fNombre(35, 'cm')).toBe('35 cm')
  })

  it('rend un tiret pour NULL, chaîne vide ou valeur non numérique', () => {
    expect(fNombre(null)).toBe(TIRET)
    expect(fNombre('')).toBe(TIRET)
    expect(fNombre('n/a')).toBe(TIRET)
  })

  it('distingue false de NULL pour un booléen', () => {
    expect(fBool(false)).toBe('Non')
    expect(fBool(true)).toBe('Oui')
    expect(fBool(null)).toBe(TIRET)
  })

  it('liste : tiret si vide, valeurs lisibles sinon', () => {
    expect(fListe([])).toBe(TIRET)
    expect(fListe(['xerophyle', 'tres_dense'])).toBe('Xerophyle, Tres dense')
  })

  it('atteste la présence d’un tracé de signature sans afficher le SVG brut', () => {
    expect(fTrace('M0 0 L10 10')).toBe('Tracé enregistré (11 caractères)')
    expect(fTrace(null)).toBe(TIRET)
  })

  it('humanise un enum backend', () => {
    expect(humaniser('bande_larvaire')).toBe('Bande larvaire')
    expect(humaniser(null)).toBe(TIRET)
  })
})

describe('aplatirJson — un JSONB affiché en entier', () => {
  it('parcourt les objets imbriqués et garde les zéros', () => {
    expect(aplatirJson({ strates: { herbacee: { recouvrement: 40, hauteur: 0 } }, sol_nu: 10 })).toEqual([
      { chemin: ['strates', 'herbacee', 'recouvrement'], valeur: '40' },
      { chemin: ['strates', 'herbacee', 'hauteur'], valeur: '0' },
      { chemin: ['sol_nu'], valeur: '10' },
    ])
  })

  it('joint un tableau de valeurs simples et marque un null', () => {
    expect(aplatirJson({ texture: ['sableux', 'argileux'], humidite: null })).toEqual([
      { chemin: ['texture'], valeur: 'sableux, argileux' },
      { chemin: ['humidite'], valeur: TIRET },
    ])
  })

  it('ne rend rien pour NULL', () => {
    expect(aplatirJson(null)).toEqual([])
  })
})

describe('catalogues — intégrité', () => {
  it('chaque colonne de la table prospection est rangée dans un groupe connu', () => {
    const groupes = new Set(GROUPES_PROSPECTION.map((g) => g.titre))
    for (const [cle, def] of Object.entries(CATALOGUE_PROSPECTION)) {
      if ('ailleurs' in def) continue
      expect(groupes.has(def.groupe), `${cle} → groupe « ${def.groupe} » absent de l'ordre`).toBe(true)
    }
  })

  it('idem pour populations et infestations', () => {
    const gp = new Set(GROUPES_POPULATION.map((g) => g.titre))
    for (const [cle, def] of Object.entries(CATALOGUE_POPULATION)) {
      if ('ailleurs' in def) continue
      expect(gp.has(def.groupe), `${cle} → « ${def.groupe} »`).toBe(true)
    }
    const gi = new Set(GROUPES_INFESTATION.map((g) => g.titre))
    for (const [cle, def] of Object.entries(CATALOGUE_INFESTATION)) {
      if ('ailleurs' in def) continue
      expect(gi.has(def.groupe), `${cle} → « ${def.groupe} »`).toBe(true)
    }
  })

  it('les colonnes « affichées ailleurs » sont exactement celles reprises par un autre élément de la page', () => {
    const ailleurs = Object.entries(CATALOGUE_PROSPECTION)
      .filter(([, def]) => 'ailleurs' in def)
      .map(([cle]) => cle)
      .sort()
    expect(ailleurs).toEqual(
      [
        'avertissements',
        'captures',
        'infestations',
        'operations_aeriennes',
        'populations',
        'prospecteur_nom',
        'validated_by_nom',
        'verified_by_nom',
      ].sort(),
    )
  })
})

describe('groupesProspection', () => {
  it('range chaque colonne dans son groupe, sans valeur calculée', () => {
    const { groupes } = groupesProspection(
      ficheVide({ hauteur_herbe_cm: 35, verdissement: 30, verdissement_pourcent: 40, surface_infestee: 12.5 }),
      ctx,
    )
    const lignes = groupes.flatMap((g) => g.lignes)
    const par = (colonne: string) => lignes.find((l) => l.colonne === colonne)
    expect(par('hauteur_herbe_cm')?.valeur).toBe('35 cm')
    // Deux colonnes distinctes : ne jamais en écraser une par l'autre.
    expect(par('verdissement')?.valeur).toBe('30')
    expect(par('verdissement_pourcent')?.valeur).toBe('40 %')
    expect(par('surface_infestee')?.valeur).toBe('12,5 ha')
    expect(par('surface_infestee')?.origine).toBe('prospection.surface_infestee')
  })

  it('résout le prospecteur par la jointure, sinon par l’annuaire', () => {
    const avecJointure = groupesProspection(ficheVide({ prospecteur_nom: 'Randria Jean' }), ctx)
    expect(
      avecJointure.groupes.flatMap((g) => g.lignes).find((l) => l.colonne === 'prospecteur_id')?.valeur,
    ).toBe('Randria Jean')
    const sansJointure = groupesProspection(ficheVide(), ctx)
    expect(
      sansJointure.groupes.flatMap((g) => g.lignes).find((l) => l.colonne === 'prospecteur_id')?.valeur,
    ).toBe('agent-u1')
  })

  it('annonce, sans les afficher, les groupes d’un autre type de fiche entièrement vides', () => {
    const { groupes, sansDonnees } = groupesProspection(ficheVide(), ctx)
    const titres = groupes.map((g) => g.titre)
    expect(titres).not.toContain('Extensif aérien — équipe & aéronef')
    expect(sansDonnees).toContain('Extensif aérien — équipe & aéronef')
    expect(sansDonnees).toContain('Signalement & validation')
  })

  it('n’écarte jamais une donnée : un groupe hors type réapparaît dès qu’une colonne est renseignée', () => {
    const { groupes, sansDonnees } = groupesProspection(ficheVide({ base: 'Base Betioky' }), ctx)
    expect(groupes.map((g) => g.titre)).toContain('Extensif aérien — base principale')
    expect(sansDonnees).not.toContain('Extensif aérien — base principale')
  })

  it('affiche tous les groupes d’une fiche extensive aérienne, même vides', () => {
    const { groupes, sansDonnees } = groupesProspection(
      ficheVide({ type_prospection: 'extensive', mode_extensif: 'aerien' }),
      ctx,
    )
    expect(groupes.map((g) => g.titre)).toContain('Extensif aérien — signatures')
    expect(sansDonnees).toEqual(['Signalement & validation'])
  })

  it('développe le JSONB `vegetation` en une ligne par clé, zéros compris', () => {
    const { groupes } = groupesProspection(
      ficheVide({ vegetation: { strates: { herbacee: { recouvrement: 0 } } } }),
      ctx,
    )
    const ligne = groupes
      .flatMap((g) => g.lignes)
      .find((l) => l.colonne === 'vegetation' && l.label.includes('recouvrement'))
    expect(ligne?.label).toBe('Végétation › strates › herbacee › recouvrement')
    expect(ligne?.valeur).toBe('0')
  })
})

describe('colonnesTable', () => {
  it('donne une colonne par colonne de la table, dans l’ordre du catalogue', () => {
    const colonnes = colonnesTable(CATALOGUE_CAPTURE, ctx)
    expect(colonnes.map((c) => c.cle)).toEqual([
      'id',
      'espece',
      'categorie',
      'sexe',
      'phase',
      'stade',
      'effectif',
    ])
  })

  it('rend les valeurs brutes de la ligne (un sexe NULL reste visible)', () => {
    const colonnes = colonnesTable(CATALOGUE_CAPTURE, ctx)
    const ligne = {
      id: 'c1',
      espece: 'LMC',
      categorie: 'imago',
      sexe: null,
      phase: 'solitaire',
      stade: 'A3',
      effectif: 7,
    } as const
    const rendu = Object.fromEntries(colonnes.map((c) => [c.cle, c.fmt(ligne)]))
    expect(rendu.sexe).toBe(TIRET)
    expect(rendu.effectif).toBe('7')
    expect(rendu.phase).toBe('Solitaire')
  })

  it('opérations : durée, températures et vents en colonnes séparées', () => {
    expect(colonnesTable(CATALOGUE_OPERATION, ctx).map((c) => c.cle)).toEqual([
      'id',
      'numero',
      'type_operation',
      'motif_divers',
      'debut_heure',
      'debut_temperature_c',
      'debut_vent_ms',
      'fin_heure',
      'fin_temperature_c',
      'fin_vent_ms',
      'duree_minutes',
    ])
  })
})

describe('entreesAudit — le journal tel qu’il est en base', () => {
  const entree = (id: string, action: AuditBdd['action'], created_at: string, details = null): AuditBdd => ({
    id,
    fiche_type: 'intensive',
    fiche_id: 'p1',
    auteur_id: 'u1',
    action,
    details,
    created_at,
  })

  it('trie de la plus ancienne à la plus récente et n’invente aucune étape', () => {
    const entrees = entreesAudit(
      [entree('b', 'validation', '2026-07-05T10:00:00Z'), entree('a', 'creation', '2026-07-01T10:00:00Z')],
      ctx.nomAgent,
    )
    expect(entrees.map((e) => e.id)).toEqual(['a', 'b'])
    expect(entrees).toHaveLength(2)
  })

  it('reprend le contenu de `details` (motif de rejet, commentaire)', () => {
    const [rejet] = entreesAudit(
      [entree('r', 'rejet', '2026-07-05T10:00:00Z', { commentaire: 'Photos manquantes' } as never)],
      ctx.nomAgent,
    )
    expect(rejet.label).toBe('Rejet')
    expect(rejet.auteur).toBe('agent-u1')
    expect(rejet.details).toEqual([{ chemin: 'commentaire', valeur: 'Photos manquantes' }])
  })

  it('journal vide : aucune entrée', () => {
    expect(entreesAudit([], ctx.nomAgent)).toEqual([])
  })
})
