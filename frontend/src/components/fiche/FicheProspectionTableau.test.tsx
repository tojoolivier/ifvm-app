import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import type { PopulationBdd, ProspectionBdd } from '@/lib/prospection-fiche-bdd'
import { CAPTURES, POPULATION_IMAGO, POPULATION_LARVE, ficheVide } from '@/test/prospection-fixtures'
import { FicheProspectionTableau } from './FicheProspectionTableau'

/** Valeurs du PDF « Prospection extensive — validation — 20260924-SAB-76D9 ». */
const POPULATIONS_PDF: PopulationBdd[] = [
  {
    ...POPULATION_IMAGO,
    id: 'lmc-imago',
    espece: 'LMC' as const,
    densite_diffuse: 2500,
    densite_groupee: 20,
    captures_nombre: 3,
    captures_sol: 3,
    captures_trans: 0,
    captures_greg: 0,
    stades_imago: null,
    type_cible: ['vol_clair' as const],
    direction_de: 'SO',
    direction_vers: 'NE',
    essaim_en_vol: true,
    essaim_pose: false,
    surface_contaminee_ha: null,
  },
  {
    ...POPULATION_LARVE,
    id: 'lmc-larve',
    espece: 'LMC' as const,
    densite_diffuse: null,
    densite_groupee: null,
    captures_nombre: 0,
    captures_sol: 0,
    captures_trans: 0,
    captures_greg: 0,
    densites_larve: { L1: 0, L2: 0, L3: 0, L4: 0, L5: 0 },
    tache_larvaire: false,
    bande_larvaire: false,
    interdistance: null,
    deplacement: 'repos' as const,
    surface_contaminee_ha: null,
  },
  {
    ...POPULATION_LARVE,
    id: 'nse-larve',
    espece: 'NSE' as const,
    densite_diffuse: null,
    densite_groupee: null,
    captures_nombre: 0,
    captures_sol: 0,
    captures_trans: 0,
    captures_greg: 0,
    densites_larve: { L1: 0, L2: 0, L3: 0, L4: 0, L5: 0, L6: 0 },
    tache_larvaire: false,
    bande_larvaire: false,
    interdistance: null,
    deplacement: 'repos' as const,
    surface_contaminee_ha: null,
  },
]

function ficheExtensive(overrides: Partial<ProspectionBdd> = {}): ProspectionBdd {
  return ficheVide({
    type_prospection: 'extensive',
    n_fiche: '20260924-SAB-76D9',
    n_message: '20260924-SAB-76D9',
    prospecteur_nom: 'Ma Sambalahy',
    date_prospection: '2026-09-24',
    station_libre: 'Geba',
    latitude: -23.336144,
    longitude: 43.6837044,
    biotope: [],
    surface_station: 50,
    degats_cultures: 'faibles',
    verdissement_pourcent: 50,
    hauteur_herbe_cm: 150,
    derniere_pluie: '2026-09-20',
    intensite_pluie: 'faible',
    populations: POPULATIONS_PDF,
    ...overrides,
  })
}

/** Le `<span><b>Libellé :</b> valeur</span>` qui porte un champ de référence. */
function info(libelle: string): HTMLElement {
  return screen.getByText(`${libelle} :`).parentElement as HTMLElement
}

function caseCochee(nom: string): boolean {
  return screen.getByRole('checkbox', { name: nom }).getAttribute('aria-checked') === 'true'
}

describe('FicheProspectionTableau — fiche extensive (comme le PDF)', () => {
  it("reprend l'en-tête et les références du PDF", () => {
    render(<FicheProspectionTableau prospection={ficheExtensive()} />)

    expect(
      screen.getByRole('heading', { name: 'Prospection extensive — validation — 20260924-SAB-76D9' }),
    ).toBeInTheDocument()
    expect(info('Prospecteur')).toHaveTextContent('Prospecteur : Ma Sambalahy')
    expect(info('PA')).toHaveTextContent('PA : —')
    expect(info('Date')).toHaveTextContent('Date : 24/09/2026')
    expect(info('N° message')).toHaveTextContent('N° message : 20260924-SAB-76D9')
    expect(info('Station')).toHaveTextContent('Station : Geba')
    expect(info('Latitude S')).toHaveTextContent('Latitude S : -23.336144')
    expect(info('Longitude E')).toHaveTextContent('Longitude E : 43.6837044')
    expect(info('Type de station (biotope)')).toHaveTextContent('Type de station (biotope) : —')
    expect(info('Surf.')).toHaveTextContent('Surf. : 50')
  })

  it('préfère le nom de station résolu à la station saisie librement', () => {
    render(<FicheProspectionTableau prospection={ficheExtensive()} stationLabel="ST-014 Ankazoabo" />)
    expect(info('Station')).toHaveTextContent('Station : ST-014 Ankazoabo')
  })

  it("retombe sur l'identifiant de station sans nom ni saisie libre", () => {
    render(
      <FicheProspectionTableau prospection={ficheExtensive({ station_libre: null, station_id: 's-42' })} />,
    )
    expect(info('Station')).toHaveTextContent('Station : s-42')
  })

  it('reproduit le bloc imagos LMC : captures, densités, essaim posé ou en vol', () => {
    render(<FicheProspectionTableau prospection={ficheExtensive()} />)
    const table = screen.getByRole('table', { name: 'Imagos LMC' })

    expect(within(table).getByText('Nbre de Captures : 3')).toBeInTheDocument()
    expect(within(table).getByText('Nbre Sol : 3')).toBeInTheDocument()
    expect(within(table).getByText('Nbre Trans : 0')).toBeInTheDocument()
    expect(within(table).getByText('Nbre Greg : 0')).toBeInTheDocument()
    expect(within(table).getByText('Pop diff D/ha : 2500')).toBeInTheDocument()
    expect(within(table).getByText('Pop group D/m² : 20')).toBeInTheDocument()
    expect(within(table).getByText(/Essaim : Vol Clair · Dir de SO vers NE/)).toBeInTheDocument()
    expect(within(table).getByRole('checkbox', { name: 'En vol' })).toHaveAttribute('aria-checked', 'true')
    expect(within(table).getByRole('checkbox', { name: 'Posé' })).toHaveAttribute('aria-checked', 'false')
    // Les cinq stades du gabarit extensif, sans valeur ici : « — » comme sur le PDF.
    expect(within(table).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(
      expect.arrayContaining(['A1', 'A2', 'A3', 'A4', 'A5']),
    )
  })

  it("laisse « — » dans le bloc d'une espèce sans population, comme le PDF pour NSE", () => {
    render(<FicheProspectionTableau prospection={ficheExtensive()} />)
    const table = screen.getByRole('table', { name: 'Imagos NSE' })

    expect(within(table).getByText('Nbre de Captures : —')).toBeInTheDocument()
    expect(within(table).getByText('Pop diff D/ha : —')).toBeInTheDocument()
    expect(within(table).getByRole('checkbox', { name: 'En vol' })).toHaveAttribute('aria-checked', 'false')
  })

  it('reproduit les blocs larves : LMC jusqu’à L5, NSE jusqu’à L6, zéros conservés', () => {
    render(<FicheProspectionTableau prospection={ficheExtensive()} />)
    const lmc = screen.getByRole('table', { name: 'Larves LMC' })
    const nse = screen.getByRole('table', { name: 'Larves NSE' })

    const entetes = (t: HTMLElement) =>
      within(t)
        .getAllByRole('columnheader')
        .map((c) => c.textContent)
        .filter((c) => /^L\d$/.test(c ?? ''))
    expect(entetes(lmc)).toEqual(['L1', 'L2', 'L3', 'L4', 'L5'])
    expect(entetes(nse)).toEqual(['L1', 'L2', 'L3', 'L4', 'L5', 'L6'])
    // Des zéros saisis restent des zéros, jamais des « — ».
    expect(within(lmc).getAllByText('0').length).toBeGreaterThanOrEqual(5)
    expect(within(lmc).getByText(/Déplacement\/Repos : repos/)).toBeInTheDocument()
    expect(within(lmc).getByText(/Interdistance : — m/)).toBeInTheDocument()
    expect(within(lmc).getByRole('checkbox', { name: 'TL' })).toHaveAttribute('aria-checked', 'false')
  })

  it('reproduit les observations : dégâts, verdissement, hauteur, dernière pluie', () => {
    render(<FicheProspectionTableau prospection={ficheExtensive()} />)

    expect(info('Dégâts sur les cultures')).toHaveTextContent('Dégâts sur les cultures : faibles')
    expect(info('% Verd strate herbeuse')).toHaveTextContent('% Verd strate herbeuse : 50')
    expect(info('H Str Herb')).toHaveTextContent('H Str Herb : 150')
    expect(info('Dernière pluie le')).toHaveTextContent('Dernière pluie le : 20/09/2026')
    expect(info('Intensité')).toHaveTextContent('Intensité : faible')
  })

  it("suit le gabarit extensif pour une fiche « validation » (revalidation)", () => {
    render(<FicheProspectionTableau prospection={ficheExtensive({ type_prospection: 'validation' })} />)
    expect(screen.getByRole('heading', { name: /Prospection extensive — validation/ })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /A\. Référence$/ })).toBeNull()
  })

  it("affiche une fiche vide sans planter : « — » partout, aucune case cochée", () => {
    render(
      <FicheProspectionTableau
        prospection={ficheVide({ type_prospection: 'extensive', date_prospection: '2026-09-24' })}
      />,
    )
    expect(info('Prospecteur')).toHaveTextContent('Prospecteur : —')
    expect(screen.getAllByRole('checkbox').every((c) => c.getAttribute('aria-checked') === 'false')).toBe(true)
  })
})

describe('FicheProspectionTableau — fiche intensive (comme le PDF)', () => {
  function ficheIntensive(overrides: Partial<ProspectionBdd> = {}): ProspectionBdd {
    return ficheVide({
      type_prospection: 'intensive',
      n_fiche: 'F-INT-1',
      n_message: 'M-42',
      prospecteur_nom: 'Jean Rakoto',
      date_prospection: '2026-07-05',
      pa_code: 'PA-01',
      region: 'Atsimo-Andrefana',
      district: 'Toliary-II',
      commune: 'Betanimena',
      station_libre: 'Geba',
      latitude: -21.5,
      longitude: 47.1,
      altitude: 800,
      surface_station: 10,
      surface_prospectee: 8,
      surface_infestee: 2,
      degats_cultures: 'moyens',
      sol: { humidite: ['surface', '5_12cm'], texture: ['sable_fin'] },
      ennemis_naturels: 'Oiseaux',
      observations: 'RAS',
      captures: CAPTURES,
      populations: [
        { ...POPULATION_IMAGO, espece: 'LMC', densite_diffuse: 4, densite_groupee: 2, captures_nombre: 12, temps_capture: 15, accouplement: 'rare', ponte: 'neant' },
        { ...POPULATION_IMAGO, id: 'nse-imago', espece: 'NSE', accouplement: 'rare', ponte: 'rare' },
      ],
      ...overrides,
    })
  }

  it('reprend le titre et les références du formulaire papier intensif', () => {
    render(<FicheProspectionTableau prospection={ficheIntensive()} />)

    expect(
      screen.getByRole('heading', { name: 'FICHE DE PROSPECTION ANTIACRIDIENNE — IFVM — F-INT-1' }),
    ).toBeInTheDocument()
    expect(info('Prospecteur')).toHaveTextContent('Prospecteur : Jean Rakoto')
    expect(info('N° relevé')).toHaveTextContent('N° relevé : M-42')
    expect(info('Région')).toHaveTextContent('Région : Atsimo-Andrefana')
    expect(info('Altitude')).toHaveTextContent('Altitude : 800 m')
    expect(info('Surf. Station')).toHaveTextContent('Surf. Station : 10 ha')
    expect(info('Surf. Infestée')).toHaveTextContent('Surf. Infestée : 2 ha')
    expect(screen.getByRole('heading', { name: 'B. Locusta migratoria capito — Imagos' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'C. Nomadacris septemfasciata — Imagos' })).toBeInTheDocument()
  })

  it('remplit la grille des imagos avec les effectifs des captures, par sexe, phase et stade', () => {
    render(<FicheProspectionTableau prospection={ficheIntensive()} />)
    const table = screen.getByRole('table', { name: "Captures d'imagos LMC" })
    const lignes = within(table).getAllByRole('row')

    const stades = within(lignes[0]).getAllByRole('columnheader').map((c) => c.textContent)
    const colonneA3 = stades.indexOf('A3')
    // 1re ligne femelle : porte la cellule « Nbre de Femelles » (rowspan) en plus de la phase.
    const solitairesF = within(lignes[1]).getAllByRole('cell')
    expect(solitairesF[0]).toHaveTextContent('Nbre de Femelles')
    expect(solitairesF[colonneA3]).toHaveTextContent('4')
    // Dernière ligne mâle (Grégaires) : plus de cellule de groupe, décalage d'une colonne.
    const gregairesM = within(lignes[8]).getAllByRole('cell')
    expect(gregairesM[0]).toHaveTextContent('Grégaires')
    expect(gregairesM[stades.indexOf('A4') - 1]).toHaveTextContent('3')
  })

  it("garde la colonne « Dominant » pour LMC seulement, comme le formulaire papier", () => {
    render(<FicheProspectionTableau prospection={ficheIntensive()} />)

    const lmc = screen.getByRole('table', { name: '11. Acclt / 12. Ponte' })
    const nse = screen.getByRole('table', { name: '16. Accplt / 17. Ponte' })
    expect(within(lmc).getByText('Dominant')).toBeInTheDocument()
    expect(within(nse).queryByText('Dominant')).toBeNull()
    expect(within(lmc).getByRole('checkbox', { name: '11. Acclt — Rare' })).toHaveAttribute('aria-checked', 'true')
    expect(within(lmc).getByRole('checkbox', { name: '12. Ponte — Néant' })).toHaveAttribute('aria-checked', 'true')
  })

  it('coche les dégâts, l’humidité et la texture saisis', () => {
    render(<FicheProspectionTableau prospection={ficheIntensive()} />)

    expect(caseCochee('Moyens')).toBe(true)
    expect(caseCochee('Nuls')).toBe(false)
    expect(caseCochee('Surf.')).toBe(true)
    expect(caseCochee('5-12 cm')).toBe(true)
    expect(caseCochee('0,5 cm')).toBe(false)
    expect(caseCochee('Sable fin')).toBe(true)
    expect(info('46. Ennemis naturels observés')).toHaveTextContent('Oiseaux')
    expect(info('Observation')).toHaveTextContent('Observation : RAS')
  })

  it("accepte une humidité enregistrée comme simple texte (ancien brouillon)", () => {
    render(<FicheProspectionTableau prospection={ficheIntensive({ sol: { humidite: 'gt_30cm' } })} />)
    expect(caseCochee('>30cm')).toBe(true)
  })

  it("regroupe dense et très dense sous « Essaim » dans la description d'infestation", () => {
    render(
      <FicheProspectionTableau
        prospection={ficheIntensive({
          infestations: [
            {
              id: 'i1',
              espece: 'LMC',
              type_cible: 'tres_dense',
              taille_min: 1,
              taille_max: 5,
              taille_moy: 3,
              surface_totale: 12,
              densite_min: null,
              densite_max: null,
              densite_moy: null,
              interdistance: null,
              comportement: 'deplacement',
              direction_de: 'N',
              direction_vers: 'S',
              vent_de: 'E',
              vent_vitesse: 4,
            },
          ],
        })}
      />,
    )
    const description = screen.getByRole('table', { name: 'Infestation — description' })
    const ligneEssaim = within(description).getByText('Essaim').closest('tr') as HTMLElement
    expect(within(ligneEssaim).getByText('12')).toBeInTheDocument()

    const comportement = screen.getByRole('table', { name: 'Infestation — comportement' })
    expect(within(comportement).getByRole('checkbox', { name: 'Essaim — déplacement' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(within(comportement).getByRole('checkbox', { name: 'Essaim — repos' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })

  it('lit la végétation par strate, avec le sol nu', () => {
    render(
      <FicheProspectionTableau
        prospection={ficheIntensive({
          vegetation: { strates: { herbeuse: { surfRel: 60, hMoy: 0.4, recouvrement: 55, verdissement: 30, repousse: true, orpad: ['a'], fleur: [] } } },
          sol: { solNu: 20 },
        })}
      />,
    )
    const table = screen.getByRole('table', { name: 'Végétation' })
    expect(within(table).getByText('20%')).toBeInTheDocument()
    const herbeuse = within(table).getByText('Strate herbeuse').closest('tr') as HTMLElement
    const cellules = within(herbeuse).getAllByRole('cell').map((c) => c.textContent)
    expect(cellules).toEqual(['Strate herbeuse', '60', '0.4', '55', '30', 'Oui', 'a', '—', '—', '—', '—'])
  })
})
