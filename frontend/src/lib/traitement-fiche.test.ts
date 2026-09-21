import { describe, expect, it } from 'vitest'
import {
  AXES_RISQUE,
  ZONES_EXPOSEES,
  axesRisque,
  compteurSignatures,
  especesListees,
  formatHeure,
  formatHorodatage,
  formatSurface,
  libelleImpact,
  libelleSurfaceTraitee,
  responsableTraitement,
  resumeEspeces,
  surfaceTraiteeOuProtegee,
  surfacesParProspection,
  zonesExposeesLabels,
} from './traitement-fiche'

describe('responsableTraitement — « nom (rôle) » (prototype ligne 1441)', () => {
  it('donne la priorité au chef de base, rôle en clair entre parenthèses', () => {
    expect(
      responsableTraitement({
        aerien: { pilote: 'Jean Rakoto' },
        signatures: [
          { role: 'PILOTE', signataire_nom: 'Jean Rakoto' },
          { role: 'CHEF_DE_BASE', signataire_nom: 'Rakoto A.' },
        ],
      }),
    ).toBe('Rakoto A. (chef de base)')
  })

  it("retombe sur le chef d'équipe quand aucun chef de base n'a signé", () => {
    expect(
      responsableTraitement({
        aerien: null,
        signatures: [{ role: 'CHEF_EQUIPE', signataire_nom: 'Soa Lalao' }],
      }),
    ).toBe("Soa Lalao (chef d'équipe)")
  })

  it('ne retient le pilote qu’en dernier recours', () => {
    expect(responsableTraitement({ aerien: { pilote: 'Jean Rakoto' }, signatures: [] })).toBe(
      'Jean Rakoto (pilote)',
    )
  })

  it('affiche un tiret quand aucun responsable ne ressort', () => {
    expect(responsableTraitement({ aerien: null, signatures: [] })).toBe('—')
  })
})

describe('formatHorodatage — mono « 2026-08-12 17:04 » de la maquette', () => {
  it('coupe les secondes et le fuseau d’un ISO 8601', () => {
    expect(formatHorodatage('2026-08-12T17:04:33')).toBe('2026-08-12 17:04')
  })

  it('rend un tiret pour une valeur absente et laisse passer une valeur illisible', () => {
    expect(formatHorodatage(null)).toBe('—')
    expect(formatHorodatage('pas une date')).toBe('pas une date')
  })
})

describe('formatHeure — « 06:00:00 » → « 06:00 »', () => {
  it('retire les secondes', () => {
    expect(formatHeure('06:00:00')).toBe('06:00')
  })

  it('laisse une heure déjà courte et rend un tiret si absente', () => {
    expect(formatHeure('06:00')).toBe('06:00')
    expect(formatHeure(null)).toBe('—')
  })
})

describe('libelleImpact / resumeEspeces — lignes d’impact de la maquette', () => {
  it('rend « Non », « Oui » ou « Oui — <détail> »', () => {
    expect(libelleImpact(false)).toBe('Non')
    expect(libelleImpact(true)).toBe('Oui')
    expect(libelleImpact(true, 'Ingestion')).toBe('Oui — Ingestion')
  })

  it('accorde le résumé d’espèces au pluriel', () => {
    expect(resumeEspeces(['Oiseaux'], 'espèce non cible', 'espèces non cibles')).toBe(
      '1 espèce non cible',
    )
    expect(resumeEspeces(['Oiseaux', 'Reptiles'], 'espèce non cible', 'espèces non cibles')).toBe(
      '2 espèces non cibles',
    )
    expect(resumeEspeces([], 'famille', 'familles')).toBeNull()
  })
})

describe('compteurSignatures — « n/5 », vert si complet (prototype ligne 1452)', () => {
  it('compte les rôles signés sur les 5 rôles du backend', () => {
    const compteur = compteurSignatures([
      { role: 'PILOTE', signataire_nom: 'A' },
      { role: 'MECANICIEN', signataire_nom: 'B' },
    ])
    expect(compteur.libelle).toBe('2/5')
    expect(compteur.complet).toBe(false)
  })

  it('est complet quand les 5 rôles ont signé', () => {
    const compteur = compteurSignatures([
      { role: 'PILOTE', signataire_nom: 'A' },
      { role: 'MECANICIEN', signataire_nom: 'B' },
      { role: 'CHEF_DE_BASE', signataire_nom: 'C' },
      { role: 'CHEF_EQUIPE', signataire_nom: 'D' },
      { role: 'CONSULTANT_INTERNATIONAL', signataire_nom: 'E' },
    ])
    expect(compteur.libelle).toBe('5/5')
    expect(compteur.complet).toBe(true)
  })

  it('ignore un rôle inconnu plutôt que de dépasser le dénominateur', () => {
    expect(compteurSignatures([{ role: 'INCONNU', signataire_nom: 'X' }]).libelle).toBe('0/5')
  })
})

describe('formatSurface — mono fr-FR de la maquette (« 1 200 »)', () => {
  it('sépare les milliers par une espace insécable fine', () => {
    expect(formatSurface(1200)).toBe((1200).toLocaleString('fr-FR'))
  })

  it('rend un tiret pour une surface absente', () => {
    expect(formatSurface(null)).toBe('—')
    expect(formatSurface(undefined)).toBe('—')
  })

  it('accepte les décimaux sérialisés en chaîne par le backend (Numeric)', () => {
    expect(formatSurface('860.00')).toBe((860).toLocaleString('fr-FR'))
  })

  it('rend un tiret pour une chaîne non numérique', () => {
    expect(formatSurface('n/a')).toBe('—')
  })
})

describe('libelleSurfaceTraitee — choc traite, barrière protège (aérien)', () => {
  it('nomme « Protégée » la surface d’un aérien traité avec un produit de barrière', () => {
    expect(libelleSurfaceTraitee({ mode_traitement: 'BARRIERE', aerien: {} })).toBe('Protégée')
  })

  it('nomme « Traitée » un aérien en produit de choc, irrégulier ou sans mode', () => {
    expect(libelleSurfaceTraitee({ mode_traitement: 'TOTAL', aerien: {} })).toBe('Traitée')
    expect(libelleSurfaceTraitee({ mode_traitement: 'IRREGULIER', aerien: {} })).toBe('Traitée')
    expect(libelleSurfaceTraitee({ mode_traitement: null, aerien: {} })).toBe('Traitée')
  })

  it('reste « Traitée » pour un terrestre, même si le mode vaut BARRIERE', () => {
    expect(libelleSurfaceTraitee({ mode_traitement: 'BARRIERE', aerien: null })).toBe('Traitée')
  })
})

describe('surfaceTraiteeOuProtegee — la colonne à montrer pour une fiche', () => {
  it('lit surface_protegee_ha pour un aérien en produit de barrière', () => {
    expect(
      surfaceTraiteeOuProtegee({
        mode_traitement: 'BARRIERE',
        aerien: { surface_traitee_ha: 0, surface_protegee_ha: 320 },
      }),
    ).toBe(320)
  })

  it('lit surface_traitee_ha pour un aérien en produit de choc', () => {
    expect(
      surfaceTraiteeOuProtegee({
        mode_traitement: 'TOTAL',
        aerien: { surface_traitee_ha: 120, surface_protegee_ha: 0 },
      }),
    ).toBe(120)
  })

  it('lit surface_traitee_ha du terrestre, même en mode BARRIERE', () => {
    expect(
      surfaceTraiteeOuProtegee({
        mode_traitement: 'BARRIERE',
        aerien: null,
        terrestre: { surface_traitee_ha: 5 },
      }),
    ).toBe(5)
  })
})

describe('surfacesParProspection — colonnes « Surf. traitée » et « Surf. prot. » de la liste des prospections', () => {
  const aerien = (traitee: number | string | null, protegee: number | string | null = 0) => ({
    surface_traitee_ha: traitee,
    surface_protegee_ha: protegee,
  })

  it('lit chaque colonne du traitement : choc → traitée, barrière → protégée', () => {
    const cumul = surfacesParProspection([
      { prospection_id: 'p-choc', mode_traitement: 'TOTAL', aerien: aerien(120, 0), terrestre: null },
      { prospection_id: 'p-barriere', mode_traitement: 'BARRIERE', aerien: aerien(0, 80), terrestre: null },
    ])
    expect(cumul.get('p-choc')).toEqual({ traitee: 120, protegee: null })
    expect(cumul.get('p-barriere')).toEqual({ traitee: null, protegee: 80 })
  })

  it('cumule les traitements d’une même prospection (reprise) et sépare les deux catégories', () => {
    const cumul = surfacesParProspection([
      { prospection_id: 'p-1', mode_traitement: 'TOTAL', aerien: aerien(100, 0), terrestre: null },
      { prospection_id: 'p-1', mode_traitement: 'TOTAL', aerien: aerien(50.5, 0), terrestre: null },
      { prospection_id: 'p-1', mode_traitement: 'BARRIERE', aerien: aerien(0, 30), terrestre: null },
    ])
    expect(cumul.get('p-1')).toEqual({ traitee: 150.5, protegee: 30 })
  })

  it('range un terrestre en « traitée »', () => {
    const cumul = surfacesParProspection([
      { prospection_id: 'p-1', mode_traitement: 'BARRIERE', aerien: null, terrestre: { surface_traitee_ha: 5 } },
    ])
    expect(cumul.get('p-1')).toEqual({ traitee: 5, protegee: null })
  })

  it('n’a pas d’entrée sans surface : valeur absente, ou 0 (fiche sans rotation)', () => {
    const cumul = surfacesParProspection([
      { prospection_id: 'p-null', mode_traitement: 'TOTAL', aerien: aerien(null, null), terrestre: null },
      { prospection_id: 'p-zero', mode_traitement: 'TOTAL', aerien: aerien(0, 0), terrestre: null },
      { prospection_id: 'p-vide', mode_traitement: 'TOTAL', aerien: null, terrestre: null },
    ])
    expect(cumul.size).toBe(0)
  })

  it('accepte les décimaux sérialisés en chaîne et ignore les valeurs non numériques', () => {
    const cumul = surfacesParProspection([
      { prospection_id: 'p-1', mode_traitement: 'TOTAL', aerien: aerien('860.00', 0), terrestre: null },
      { prospection_id: 'p-1', mode_traitement: 'TOTAL', aerien: aerien('n/a', 0), terrestre: null },
    ])
    expect(cumul.get('p-1')).toEqual({ traitee: 860, protegee: null })
  })
})

describe('zonesExposeesLabels — pied de la carte « Moyens & protection »', () => {
  it('ne retient que les zones cochées, dans l’ordre du référentiel mobile', () => {
    expect(
      zonesExposeesLabels({ ruchers: true, habitations: true, cultures: false, points_eau: true }),
    ).toEqual(['Habitations', "Points d'eau", 'Ruchers'])
  })

  it('rend une liste vide quand rien n’est coché ou que le champ est absent', () => {
    expect(zonesExposeesLabels(null)).toEqual([])
    expect(zonesExposeesLabels({ ruchers: false })).toEqual([])
  })

  it('laisse passer une clé hors référentiel sans la perdre', () => {
    expect(zonesExposeesLabels({ mangrove: true })).toEqual(['mangrove'])
  })

  it('couvre les six zones du référentiel mobile', () => {
    expect(ZONES_EXPOSEES).toHaveLength(6)
  })
})

describe('axesRisque — badges de niveau de la carte « Impacts »', () => {
  it('rend les axes renseignés avec leur libellé et leur niveau', () => {
    const axes = axesRisque({ ressources_eau: 'MOYEN', abeilles: 'ELEVE' })
    expect(axes.map((a) => a.label)).toEqual(['Ressources en eau', 'Abeilles / pollinisateurs'])
    expect(axes.map((a) => a.niveau)).toEqual(['Moyen', 'Élevé'])
  })

  it('teinte le niveau : vert faible, ambre moyen, rouge élevé', () => {
    const parAxe = Object.fromEntries(
      axesRisque({ sol: 'FAIBLE', ressources_eau: 'MOYEN', abeilles: 'ELEVE' }).map((a) => [
        a.key,
        a.className,
      ]),
    )
    expect(parAxe.sol).toMatch(/green/)
    expect(parAxe.ressources_eau).toMatch(/amber/)
    expect(parAxe.abeilles).toMatch(/danger/)
  })

  it('accepte un niveau en minuscules et les accents du seed backend', () => {
    expect(axesRisque({ sol: 'faible' })[0].niveau).toBe('Faible')
    expect(axesRisque({ sol: 'Élevé' })[0].niveau).toBe('Élevé')
  })

  it('ignore les axes vides plutôt que d’afficher un badge sans niveau', () => {
    expect(axesRisque({ sol: null, ressources_eau: '' })).toEqual([])
    expect(axesRisque(null)).toEqual([])
  })

  it('couvre les quatre axes du référentiel mobile', () => {
    expect(AXES_RISQUE).toHaveLength(4)
  })
})

describe('especesListees — « Oui — 2 espèces non cibles »', () => {
  it('accepte le tableau produit par le mobile', () => {
    expect(especesListees(['Oiseaux', 'Reptiles'])).toEqual(['Oiseaux', 'Reptiles'])
  })

  it('accepte le dictionnaire typé côté Pydantic', () => {
    expect(especesListees({ oiseaux: true, reptiles: false, poissons: true })).toEqual([
      'oiseaux',
      'poissons',
    ])
  })

  it('rend une liste vide pour un champ absent', () => {
    expect(especesListees(null)).toEqual([])
  })
})
