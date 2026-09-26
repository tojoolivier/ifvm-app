/**
 * Fiche de prospection en tableaux (comme le PDF téléchargé) : mêmes valeurs que les PDF de
 * référence — prospection extensive « validation » 20260924-SAB-76D9 (station Geba, 3 captures LMC,
 * densité 2500/ha, essaim Vol Clair en vol) — et une fiche intensive pour les grilles de captures.
 */
import { render, screen, within } from '@testing-library/react-native';
import { FicheProspectionTableau } from '@/components/fiche/FicheProspectionTableau';
import type { PopulationRead, ProspectionRead } from '@/lib/api-client';

const POP_BASE = {
  densite_diffuse: null,
  densite_groupee: null,
  captures_nombre: null,
  temps_capture: null,
  accouplement: null,
  ponte: null,
  captures_sol: null,
  captures_trans: null,
  captures_greg: null,
  stades_imago: null,
  densites_larve: null,
  tache_larvaire: null,
  bande_larvaire: null,
  interdistance: null,
  deplacement: null,
  surface_contaminee_ha: null,
  type_cible: [],
  direction_de: null,
  direction_vers: null,
  essaim_en_vol: null,
  essaim_pose: null,
};

/** Populations du PDF extensif : LMC imago renseigné, larves à zéro, NSE imago absent. */
const POPULATIONS_PDF = [
  {
    ...POP_BASE,
    id: 'lmc-imago',
    espece: 'LMC',
    categorie: 'imago',
    densite_diffuse: 2500,
    densite_groupee: 20,
    captures_nombre: 3,
    captures_sol: 3,
    captures_trans: 0,
    captures_greg: 0,
    type_cible: ['vol_clair'],
    direction_de: 'SO',
    direction_vers: 'NE',
    essaim_en_vol: true,
    essaim_pose: false,
  },
  {
    ...POP_BASE,
    id: 'lmc-larve',
    espece: 'LMC',
    categorie: 'larve',
    captures_nombre: 0,
    captures_sol: 0,
    captures_trans: 0,
    captures_greg: 0,
    densites_larve: { L1: 0, L2: 0, L3: 0, L4: 0, L5: 0 },
    tache_larvaire: false,
    bande_larvaire: false,
    deplacement: 'repos',
  },
  {
    ...POP_BASE,
    id: 'nse-larve',
    espece: 'NSE',
    categorie: 'larve',
    captures_nombre: 0,
    captures_sol: 0,
    captures_trans: 0,
    captures_greg: 0,
    densites_larve: { L1: 0, L2: 0, L3: 0, L4: 0, L5: 0, L6: 0 },
    tache_larvaire: false,
    bande_larvaire: false,
    deplacement: 'repos',
  },
] as unknown as PopulationRead[];

function fiche(overrides: Partial<ProspectionRead> = {}): ProspectionRead {
  return {
    id: 'p1',
    type_prospection: 'extensive',
    n_fiche: '20260924-SAB-76D9',
    n_message: '20260924-SAB-76D9',
    prospecteur_nom: 'Ma Sambalahy',
    pa_code: null,
    date_prospection: '2026-09-24',
    station_id: null,
    station_libre: 'Geba',
    latitude: -23.336144,
    longitude: 43.6837044,
    altitude: null,
    biotope: [],
    surface_station: 50,
    surface_prospectee: null,
    surface_infestee: null,
    degats_cultures: 'faibles',
    verdissement_pourcent: 50,
    hauteur_herbe_cm: 150,
    derniere_pluie: '2026-09-20',
    intensite_pluie: 'faible',
    vegetation: null,
    sol: null,
    ennemis_naturels: null,
    observations: null,
    populations: POPULATIONS_PDF,
    captures: [],
    infestations: [],
    ...overrides,
  } as unknown as ProspectionRead;
}

/** Le texte d'un champ « Libellé : valeur » (le libellé en gras est un `Text` imbriqué). */
const champ = (texte: string) => screen.getByText(texte);

const cochee = (nom: string) => screen.getByRole('checkbox', { name: nom });

describe('FicheProspectionTableau — fiche extensive (comme le PDF)', () => {
  it("reprend l'en-tête et les références du PDF", async () => {
    await render(<FicheProspectionTableau prospection={fiche()} />);

    expect(
      screen.getByRole('header', { name: 'Prospection extensive — validation — 20260924-SAB-76D9' })
    ).toBeOnTheScreen();
    expect(champ('Prospecteur : Ma Sambalahy')).toBeOnTheScreen();
    expect(champ('PA : —')).toBeOnTheScreen();
    expect(champ('Date : 24/09/2026')).toBeOnTheScreen();
    expect(champ('N° message : 20260924-SAB-76D9')).toBeOnTheScreen();
    expect(champ('Station : Geba')).toBeOnTheScreen();
    expect(champ('Latitude S : -23.336144')).toBeOnTheScreen();
    expect(champ('Longitude E : 43.6837044')).toBeOnTheScreen();
    expect(champ('Type de station (biotope) : —')).toBeOnTheScreen();
    expect(champ('Surf. : 50')).toBeOnTheScreen();
  });

  it('préfère le nom de station résolu à la station saisie librement', async () => {
    await render(<FicheProspectionTableau prospection={fiche()} stationLabel="ST-014 Ankazoabo" />);
    expect(champ('Station : ST-014 Ankazoabo')).toBeOnTheScreen();
  });

  it("retombe sur l'identifiant de station sans nom ni saisie libre", async () => {
    await render(
      <FicheProspectionTableau prospection={fiche({ station_libre: null, station_id: 's-42' })} />
    );
    expect(champ('Station : s-42')).toBeOnTheScreen();
  });

  it('reproduit le bloc imagos LMC : captures, densités, essaim en vol', async () => {
    await render(<FicheProspectionTableau prospection={fiche()} />);
    const table = within(screen.getByLabelText('Imagos LMC'));

    expect(table.getByText('Nbre de Captures : 3')).toBeOnTheScreen();
    expect(table.getByText('Nbre Sol : 3')).toBeOnTheScreen();
    expect(table.getByText('Nbre Trans : 0')).toBeOnTheScreen();
    expect(table.getByText('Nbre Greg : 0')).toBeOnTheScreen();
    expect(table.getByText('Pop diff D/ha : 2500')).toBeOnTheScreen();
    expect(table.getByText('Pop group D/m² : 20')).toBeOnTheScreen();
    expect(table.getByText(/Essaim : Vol Clair · Dir de SO vers NE/)).toBeOnTheScreen();
    expect(table.getByRole('checkbox', { name: 'En vol' })).toBeChecked();
    expect(table.getByRole('checkbox', { name: 'Posé' })).not.toBeChecked();
    for (const stade of ['A1', 'A2', 'A3', 'A4', 'A5']) {
      expect(table.getAllByText(stade).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("laisse « — » dans le bloc d'une espèce sans population, comme le PDF pour NSE", async () => {
    await render(<FicheProspectionTableau prospection={fiche()} />);
    const table = within(screen.getByLabelText('Imagos NSE'));

    expect(table.getByText('Nbre de Captures : —')).toBeOnTheScreen();
    expect(table.getByText('Pop diff D/ha : —')).toBeOnTheScreen();
    expect(table.getByRole('checkbox', { name: 'En vol' })).not.toBeChecked();
  });

  it('reproduit les blocs larves : LMC jusqu’à L5, NSE jusqu’à L6, zéros conservés', async () => {
    await render(<FicheProspectionTableau prospection={fiche()} />);
    const lmc = within(screen.getByLabelText('Larves LMC'));
    const nse = within(screen.getByLabelText('Larves NSE'));

    expect(lmc.queryByText('L5')).toBeOnTheScreen();
    expect(lmc.queryByText('L6')).toBeNull();
    expect(nse.queryByText('L6')).toBeOnTheScreen();
    expect(nse.queryByText('L7')).toBeNull();
    // Des zéros saisis restent des zéros, jamais des « — ».
    expect(lmc.getAllByText('0').length).toBeGreaterThanOrEqual(5);
    expect(lmc.getByText(/Déplacement\/Repos : repos/)).toBeOnTheScreen();
    expect(lmc.getByText(/Interdistance : — m/)).toBeOnTheScreen();
    expect(lmc.getByRole('checkbox', { name: 'TL' })).not.toBeChecked();
  });

  it('reproduit les observations : dégâts, verdissement, hauteur, dernière pluie', async () => {
    await render(<FicheProspectionTableau prospection={fiche()} />);

    expect(champ('Dégâts sur les cultures : faibles')).toBeOnTheScreen();
    expect(champ('% Verd strate herbeuse : 50')).toBeOnTheScreen();
    expect(champ('H Str Herb : 150')).toBeOnTheScreen();
    expect(champ('Dernière pluie le : 20/09/2026')).toBeOnTheScreen();
    expect(champ('Intensité : faible')).toBeOnTheScreen();
  });

  it('suit le gabarit extensif pour une fiche « validation » (revalidation)', async () => {
    await render(<FicheProspectionTableau prospection={fiche({ type_prospection: 'validation' })} />);
    expect(screen.getByRole('header', { name: /Prospection extensive — validation/ })).toBeOnTheScreen();
  });

  it('affiche une fiche vide sans planter : « — » partout, aucune case cochée', async () => {
    await render(
      <FicheProspectionTableau
        prospection={fiche({
          prospecteur_nom: null,
          populations: [],
          station_libre: null,
          latitude: null,
          longitude: null,
        })}
      />
    );
    expect(champ('Prospecteur : —')).toBeOnTheScreen();
    for (const c of screen.getAllByRole('checkbox')) expect(c).not.toBeChecked();
  });
});

describe('FicheProspectionTableau — fiche intensive (comme le PDF)', () => {
  const CAPTURES = [
    { id: 'c1', espece: 'LMC', categorie: 'imago', sexe: 'F', phase: 'solitaire', stade: 'A3', effectif: 4 },
    { id: 'c2', espece: 'LMC', categorie: 'imago', sexe: 'M', phase: 'gregaire', stade: 'A4', effectif: 3 },
  ];

  function intensive(overrides: Partial<ProspectionRead> = {}): ProspectionRead {
    return fiche({
      type_prospection: 'intensive',
      n_fiche: 'F-INT-1',
      n_message: 'M-42',
      prospecteur_nom: 'Jean Rakoto',
      date_prospection: '2026-07-05',
      region: 'Atsimo-Andrefana',
      altitude: 800,
      surface_station: 10,
      degats_cultures: 'moyens',
      sol: { humidite: ['surface', '5_12cm'], texture: ['sable_fin'] },
      ennemis_naturels: 'Oiseaux',
      observations: 'RAS',
      captures: CAPTURES as unknown as ProspectionRead['captures'],
      populations: [
        { ...POP_BASE, id: 'l', espece: 'LMC', categorie: 'imago', accouplement: 'rare', ponte: 'neant' },
        { ...POP_BASE, id: 'n', espece: 'NSE', categorie: 'imago', accouplement: 'rare', ponte: 'rare' },
      ] as unknown as PopulationRead[],
      ...overrides,
    });
  }

  it('reprend le titre et les références du formulaire papier intensif', async () => {
    await render(<FicheProspectionTableau prospection={intensive()} />);

    expect(
      screen.getByRole('header', { name: 'FICHE DE PROSPECTION ANTIACRIDIENNE — IFVM — F-INT-1' })
    ).toBeOnTheScreen();
    expect(champ('Prospecteur : Jean Rakoto')).toBeOnTheScreen();
    expect(champ('N° relevé : M-42')).toBeOnTheScreen();
    expect(champ('Région : Atsimo-Andrefana')).toBeOnTheScreen();
    expect(champ('Altitude : 800 m')).toBeOnTheScreen();
    expect(screen.getByText('B. Locusta migratoria capito — Imagos')).toBeOnTheScreen();
    expect(screen.getByText('C. Nomadacris septemfasciata — Imagos')).toBeOnTheScreen();
  });

  it('remplit la grille des imagos avec les effectifs des captures, par sexe, phase et stade', async () => {
    await render(<FicheProspectionTableau prospection={intensive()} />);
    const grille = within(screen.getByLabelText("Captures d'imagos LMC"));

    // Femelles / Solitaires / A3 = 4 ; Mâles / Grégaires / A4 = 3 ; les autres cases restent vides.
    expect(grille.getByText('4')).toBeOnTheScreen();
    expect(grille.getByText('3')).toBeOnTheScreen();
    expect(grille.getByText('Nbre de Femelles')).toBeOnTheScreen();
    expect(grille.getByText('Nbre de Mâles')).toBeOnTheScreen();
    expect(grille.getAllByText('Grégaires')).toHaveLength(2);
  });

  it('garde la colonne « Dominant » pour LMC seulement, comme le formulaire papier', async () => {
    await render(<FicheProspectionTableau prospection={intensive()} />);
    const lmc = within(screen.getByLabelText('11. Acclt / 12. Ponte'));
    const nse = within(screen.getByLabelText('16. Accplt / 17. Ponte'));

    expect(lmc.getByText('Dominant')).toBeOnTheScreen();
    expect(nse.queryByText('Dominant')).toBeNull();
    expect(lmc.getByRole('checkbox', { name: '11. Acclt — Rare' })).toBeChecked();
    expect(lmc.getByRole('checkbox', { name: '12. Ponte — Néant' })).toBeChecked();
  });

  it('coche les dégâts, l’humidité et la texture saisis', async () => {
    await render(<FicheProspectionTableau prospection={intensive()} />);

    expect(cochee('Moyens')).toBeChecked();
    expect(cochee('Nuls')).not.toBeChecked();
    expect(cochee('Surf.')).toBeChecked();
    expect(cochee('5-12 cm')).toBeChecked();
    expect(cochee('0,5 cm')).not.toBeChecked();
    expect(cochee('Sable fin')).toBeChecked();
    expect(champ('46. Ennemis naturels observés : Oiseaux')).toBeOnTheScreen();
    expect(champ('Observation : RAS')).toBeOnTheScreen();
  });

  it('accepte une humidité enregistrée comme simple texte (ancien brouillon)', async () => {
    await render(<FicheProspectionTableau prospection={intensive({ sol: { humidite: 'gt_30cm' } })} />);
    expect(cochee('>30cm')).toBeChecked();
  });

  it("regroupe dense et très dense sous « Essaim » dans la description d'infestation", async () => {
    await render(
      <FicheProspectionTableau
        prospection={intensive({
          infestations: [
            {
              id: 'i1',
              espece: 'LMC',
              type_cible: 'tres_dense',
              surface_totale: 12,
              comportement: 'deplacement',
              direction_de: 'N',
              direction_vers: 'S',
              vent_de: 'E',
              vent_vitesse: 4,
            },
          ] as unknown as ProspectionRead['infestations'],
        })}
      />
    );
    expect(within(screen.getByLabelText('Infestation — description')).getByText('12')).toBeOnTheScreen();
    const comportement = within(screen.getByLabelText('Infestation — comportement'));
    expect(comportement.getByRole('checkbox', { name: 'Essaim — déplacement' })).toBeChecked();
    expect(comportement.getByRole('checkbox', { name: 'Essaim — repos' })).not.toBeChecked();
  });

  it('lit la végétation par strate, avec le sol nu', async () => {
    await render(
      <FicheProspectionTableau
        prospection={intensive({
          vegetation: {
            strates: {
              herbeuse: { surfRel: 60, hMoy: 0.4, recouvrement: 55, verdissement: 30, repousse: true, orpad: ['a'], fleur: [] },
            },
          },
          sol: { solNu: 20 },
        })}
      />
    );
    const table = within(screen.getByLabelText('Végétation'));
    expect(table.getByText('20%')).toBeOnTheScreen();
    expect(table.getByText('Strate herbeuse')).toBeOnTheScreen();
    expect(table.getByText('60')).toBeOnTheScreen();
    expect(table.getByText('0.4')).toBeOnTheScreen();
    expect(table.getByText('Oui')).toBeOnTheScreen();
  });
});
