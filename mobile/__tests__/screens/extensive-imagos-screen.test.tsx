/**
 * extensive-imagos.tsx : chaque champ (type de cible, accouplement, ponte,
 * interdistance, état/comportement de l'essaim/direction) est porté par une ligne
 * `prospection_population` par espèce (LMC-imago, NSE-imago) — donc déjà
 * naturellement indépendant. Non-régression : « Type de capture » (Essaim/Vol clair,
 * un seul useState partagé entre LMC et NSE) est devenu « Type de cible »
 * (Vol clair/Dense/Très dense, un champ par espèce comme popDiff/popGroup) —
 * modifier LMC ne doit jamais modifier NSE, et réciproquement.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ExtensiveImagosScreen from '@/app/(prospection)/extensive-imagos';
import * as prospectionRepository from '@/lib/prospection-repository';

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { draftId: 'draft-123' } })
);

jest.mock('@/lib/prospection-repository', () => ({
  getProspectionPopulation: jest.fn().mockResolvedValue(null),
  saveProspectionPopulation: jest.fn().mockResolvedValue(undefined),
}));

/** Laisse le fetch de population (Promise.all().then(setSpeciesData(...))) se
 * résoudre avant toute interaction — sinon il écrase les choix déjà faits à l'écran. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

function activeStyle(text: ReturnType<typeof screen.getAllByText>[number]) {
  return expect.arrayContaining([expect.objectContaining({ color: '#fff' })]);
}

describe('ExtensiveImagosScreen — indépendance des champs LMC/NSE', () => {
  afterEach(cleanup);
  beforeEach(() => {
    jest.mocked(prospectionRepository.saveProspectionPopulation).mockClear();
    jest.mocked(prospectionRepository.getProspectionPopulation).mockResolvedValue(null);
  });

  it("modifier le type de cible de NSE n'affecte pas celui de LMC (et réciproquement)", async () => {
    await render(<ExtensiveImagosScreen />);
    await screen.findByText('📊 Type de cible');
    await settle();

    // LMC (espèce active par défaut) : aucune cible n'est présélectionnée
    // (#type-cible-multi-select) — on coche explicitement Vol clair.
    fireEvent.press(screen.getAllByText('Vol clair')[0]);
    await settle();

    // Bascule vers NSE puis choisit Dense — ne doit toucher que NSE.
    fireEvent.press(screen.getByText('NSE'));
    await settle();
    fireEvent.press(screen.getByText('Dense'));
    await settle();

    // Retour sur LMC : doit toujours afficher Vol clair actif, pas Dense.
    fireEvent.press(screen.getByText('LMC'));
    await waitFor(() =>
      expect(screen.getAllByText('Vol clair')[0].props.style).toEqual(activeStyle(screen.getAllByText('Vol clair')[0]))
    );

    fireEvent.press(screen.getByText('Suivant : Larves ›'));

    await waitFor(() => expect(prospectionRepository.saveProspectionPopulation).toHaveBeenCalledTimes(2));
    const [, lmcRow] = jest.mocked(prospectionRepository.saveProspectionPopulation).mock.calls[0];
    const [, nseRow] = jest.mocked(prospectionRepository.saveProspectionPopulation).mock.calls[1];

    expect(lmcRow).toMatchObject({ espece: 'LMC', type_cible: '["vol_clair"]' });
    expect(nseRow).toMatchObject({ espece: 'NSE', type_cible: '["dense"]' });
  });

  it('restaure le type de cible propre à chaque espèce depuis les lignes déjà enregistrées', async () => {
    jest.mocked(prospectionRepository.getProspectionPopulation).mockImplementation(async (_id, espece) =>
      espece === 'LMC'
        ? ({ espece: 'LMC', categorie: 'imago', type_cible: 'tres_dense', captures_nombre: 0 } as any)
        : ({ espece: 'NSE', categorie: 'imago', type_cible: 'vol_clair', captures_nombre: 0 } as any)
    );

    await render(<ExtensiveImagosScreen />);
    await settle();

    await waitFor(() =>
      expect(screen.getAllByText('Très dense')[0].props.style).toEqual(activeStyle(screen.getAllByText('Très dense')[0]))
    );

    fireEvent.press(screen.getByText('NSE'));
    await waitFor(() =>
      expect(screen.getAllByText('Vol clair')[0].props.style).toEqual(activeStyle(screen.getAllByText('Vol clair')[0]))
    );
  });

  it("l'interdistance de LMC et NSE restent indépendantes (25,5 m vs 40,75 m)", async () => {
    await render(<ExtensiveImagosScreen />);
    await screen.findByText('📊 Interdistance (m)');
    await settle();

    // popDiff, popGroup puis interdistance sont les 3 champs vides, dans cet ordre.
    fireEvent.changeText(screen.getAllByDisplayValue('')[2], '25.5');
    await settle();
    fireEvent.press(screen.getByText('NSE'));
    await settle();
    fireEvent.changeText(screen.getAllByDisplayValue('')[2], '40.75');
    await settle();

    fireEvent.press(screen.getByText('Suivant : Larves ›'));

    await waitFor(() => expect(prospectionRepository.saveProspectionPopulation).toHaveBeenCalledTimes(2));
    const [, lmcRow] = jest.mocked(prospectionRepository.saveProspectionPopulation).mock.calls[0];
    const [, nseRow] = jest.mocked(prospectionRepository.saveProspectionPopulation).mock.calls[1];

    expect(lmcRow).toMatchObject({ espece: 'LMC', interdistance: 25.5 });
    expect(nseRow).toMatchObject({ espece: 'NSE', interdistance: 40.75 });
  });

  it('Accouplement et Ponte se sauvegardent par espèce (mêmes options que la fiche Intensive)', async () => {
    await render(<ExtensiveImagosScreen />);
    await screen.findByText('📊 Accouplement');
    await settle();

    // « Dominant » apparaît deux fois (Accouplement puis Ponte, mêmes options) : le
    // premier est celui d'Accouplement.
    fireEvent.press(screen.getAllByText('Dominant')[0]);
    await settle();

    fireEvent.press(screen.getByText('Suivant : Larves ›'));

    await waitFor(() => expect(prospectionRepository.saveProspectionPopulation).toHaveBeenCalledTimes(2));
    const [, lmcRow] = jest.mocked(prospectionRepository.saveProspectionPopulation).mock.calls[0];
    expect(lmcRow).toMatchObject({ espece: 'LMC', accouplement: 'Dominant' });
  });

  it('État = Repos détermine automatiquement Comportement de l’essaim = Posé, et inversement pour Déplacement', async () => {
    await render(<ExtensiveImagosScreen />);
    await screen.findByText('📊 État');
    await settle();

    // « Posé »/« En vol » apparaissent deux fois (indicateur + récapitulatif) : le
    // premier est l'indicateur Comportement de l'essaim.
    fireEvent.press(screen.getByText('Repos'));
    await waitFor(() =>
      expect(screen.getAllByText('Posé')[0].props.style).toEqual(activeStyle(screen.getAllByText('Posé')[0]))
    );

    fireEvent.press(screen.getByText('Déplacement'));
    await waitFor(() =>
      expect(screen.getAllByText('En vol')[0].props.style).toEqual(activeStyle(screen.getAllByText('En vol')[0]))
    );

    fireEvent.press(screen.getByText('Suivant : Larves ›'));

    await waitFor(() => expect(prospectionRepository.saveProspectionPopulation).toHaveBeenCalledTimes(2));
    const [, lmcRow] = jest.mocked(prospectionRepository.saveProspectionPopulation).mock.calls[0];
    expect(lmcRow).toMatchObject({ espece: 'LMC', etat: 'deplacement', essaim_en_vol: true, essaim_pose: false });
  });

  /**
   * Non-régression explicite (#228) : « Nombre total de capture » doit rester
   * préaffiché à sa valeur enregistrée et survivre à la modification d'un autre champ
   * — sans jamais revenir à 0/vide/null/undefined. (Le faire passer directement de
   * 25 à 30 sans retoucher les phases est bloqué par la règle métier « Captures =
   * Phases », vérifiée séparément par les tests de cohérence de cet écran — ce n'est
   * pas la perte de donnée que ce test cible.)
   */
  it('modification d’une fiche existante : Nombre de captures (25) reste préaffiché et enregistré tel quel après modification d’un autre champ', async () => {
    jest.mocked(prospectionRepository.getProspectionPopulation).mockImplementation(async (_id, espece) =>
      espece === 'LMC'
        ? ({
            espece: 'LMC',
            categorie: 'imago',
            captures_nombre: 25,
            captures_sol: 10,
            captures_trans: 10,
            captures_greg: 5,
            captures_solitaro_transiens: 0,
            densite_diffuse: 4.2,
            densite_groupee: 1.1,
            accouplement: 'Beaucoup',
            ponte: 'Rare',
            interdistance: 12.5,
            type_cible: 'dense',
            etat: 'repos',
            essaim_en_vol: false,
            essaim_pose: true,
          } as any)
        : ({ espece: 'NSE', categorie: 'imago', captures_nombre: 0 } as any)
    );

    await render(<ExtensiveImagosScreen />);
    // Préaffiché avec la valeur enregistrée — jamais 0, vide, null ou undefined.
    expect(await screen.findByDisplayValue('25')).toBeVisible();
    await settle();

    // Modifie l'Accouplement (champ indépendant, non soumis à la règle Captures = Phases).
    fireEvent.press(screen.getAllByText('Peu')[0]);
    await settle();

    fireEvent.press(screen.getByText('Suivant : Larves ›'));

    await waitFor(() => expect(prospectionRepository.saveProspectionPopulation).toHaveBeenCalledTimes(2));
    const [, lmcRow] = jest.mocked(prospectionRepository.saveProspectionPopulation).mock.calls[0];
    // Nombre de captures : toujours 25, jamais réinitialisé par la modification d'Accouplement.
    expect(lmcRow).toMatchObject({ espece: 'LMC', captures_nombre: 25, accouplement: 'Peu' });
    // …et tous les autres champs déjà présents avant la modification survivent tels quels.
    expect(lmcRow).toMatchObject({
      densite_diffuse: 4.2,
      densite_groupee: 1.1,
      ponte: 'Rare',
      interdistance: 12.5,
      type_cible: '["dense"]',
      etat: 'repos',
      essaim_en_vol: false,
      essaim_pose: true,
    });
  });

  /**
   * La fiche Signalement (type_prospection = 'validation') passe par exactement le
   * même écran/mêmes fonctions que l'Extensive — cf. `getProspectionEditRoute` dans
   * `fiche-routing.ts`, qui route les deux vers `extensive-reference`. Ce test le
   * vérifie explicitement : rien dans cet écran ne dépend de `type_prospection`, donc
   * le même round-trip s'applique aux fiches Signalement.
   */
  it('fiche Signalement (validation) : même préaffichage et même persistance du Nombre de captures que l’Extensive', async () => {
    jest.mocked(prospectionRepository.getProspectionPopulation).mockImplementation(async (_id, espece) =>
      espece === 'LMC'
        ? ({ espece: 'LMC', categorie: 'imago', captures_nombre: 25, captures_sol: 25, captures_trans: 0, captures_greg: 0, densite_diffuse: 3, densite_groupee: 2 } as any)
        : ({ espece: 'NSE', categorie: 'imago', captures_nombre: 0 } as any)
    );

    await render(<ExtensiveImagosScreen />);
    expect(await screen.findByDisplayValue('25')).toBeVisible();
    await settle();

    fireEvent.press(screen.getByText('Suivant : Larves ›'));

    await waitFor(() => expect(prospectionRepository.saveProspectionPopulation).toHaveBeenCalledTimes(2));
    const [, lmcRow] = jest.mocked(prospectionRepository.saveProspectionPopulation).mock.calls[0];
    expect(lmcRow).toMatchObject({ espece: 'LMC', captures_nombre: 25 });
  });

  /** #type-cible-multi-select : aucune présélection, cochable/décochable librement,
   * plusieurs valeurs actives simultanément. */
  it('Type de cible : aucune sélection par défaut sur une nouvelle fiche', async () => {
    await render(<ExtensiveImagosScreen />);
    await screen.findByText('📊 Type de cible');
    await settle();

    fireEvent.press(screen.getByText('Suivant : Larves ›'));

    await waitFor(() => expect(prospectionRepository.saveProspectionPopulation).toHaveBeenCalledTimes(2));
    const [, lmcRow] = jest.mocked(prospectionRepository.saveProspectionPopulation).mock.calls[0];
    expect(lmcRow).toMatchObject({ espece: 'LMC', type_cible: '[]' });
  });

  it('Type de cible : Vol clair et Dense peuvent être cochés simultanément, puis décochés indépendamment', async () => {
    await render(<ExtensiveImagosScreen />);
    await screen.findByText('📊 Type de cible');
    await settle();

    fireEvent.press(screen.getByText('Vol clair'));
    await settle();
    fireEvent.press(screen.getByText('Dense'));
    await settle();

    await waitFor(() => {
      expect(screen.getByText('Vol clair').props.style).toEqual(activeStyle(screen.getByText('Vol clair')));
      expect(screen.getByText('Dense').props.style).toEqual(activeStyle(screen.getByText('Dense')));
    });

    // Décocher Vol clair ne doit pas toucher Dense.
    fireEvent.press(screen.getByText('Vol clair'));
    await settle();

    fireEvent.press(screen.getByText('Suivant : Larves ›'));

    await waitFor(() => expect(prospectionRepository.saveProspectionPopulation).toHaveBeenCalledTimes(2));
    const [, lmcRow] = jest.mocked(prospectionRepository.saveProspectionPopulation).mock.calls[0];
    expect(lmcRow).toMatchObject({ espece: 'LMC', type_cible: '["dense"]' });
  });

  /** #densite-diffuse-obligatoire : même garde que la densité groupée, bloque
   * « Suivant » tant qu'une espèce avec des captures n'a pas renseigné sa densité
   * diffuse. Phases déjà cohérentes dans la fixture (captures_sol = captures_nombre)
   * pour isoler cette règle de « Captures = Phases », vérifiée par ailleurs. */
  it('Densité diffuse (D/ha) obligatoire dès qu’il y a des captures — bloque puis débloque « Suivant »', async () => {
    jest.mocked(prospectionRepository.getProspectionPopulation).mockImplementation(async (_id, espece) =>
      espece === 'LMC'
        ? ({
            espece: 'LMC',
            categorie: 'imago',
            captures_nombre: 12,
            captures_sol: 12,
            captures_trans: 0,
            captures_greg: 0,
            densite_groupee: 3,
          } as any)
        : ({ espece: 'NSE', categorie: 'imago', captures_nombre: 0 } as any)
    );

    await render(<ExtensiveImagosScreen />);
    expect(await screen.findByDisplayValue('12')).toBeVisible();
    await settle();

    fireEvent.press(screen.getByText('Suivant : Larves ›'));
    await waitFor(() => expect(screen.getByText('La densité diffuse (D/ha) est obligatoire.')).toBeVisible());
    expect(prospectionRepository.saveProspectionPopulation).not.toHaveBeenCalled();

    // popDiff est le premier champ vide (popGroup est déjà rempli par la fixture).
    fireEvent.changeText(screen.getAllByDisplayValue('')[0], '8');
    await settle();

    fireEvent.press(screen.getByText('Suivant : Larves ›'));
    await waitFor(() => expect(prospectionRepository.saveProspectionPopulation).toHaveBeenCalledTimes(2));
    const [, lmcRow] = jest.mocked(prospectionRepository.saveProspectionPopulation).mock.calls[0];
    expect(lmcRow).toMatchObject({ espece: 'LMC', densite_diffuse: 8, densite_groupee: 3 });
  });

  /**
   * Parcours interactif complet, fiche neuve (#nombre-de-capture-fiable) : taper le
   * « Nombre total de captures », distribuer les phases via les compteurs +/- (pas de
   * ligne déjà enregistrée injectée par le mock, contrairement aux autres tests de ce
   * fichier) — vérifie que la saisie réelle à l'écran produit bien captures_nombre
   * dans la ligne sauvegardée, pas seulement que la ré-ouverture d'une ligne déjà
   * correcte s'affiche correctement (déjà couvert par le test #228 ci-dessus).
   */
  it('saisie interactive : taper 5 dans « Nombre total de captures » puis distribuer les phases sauvegarde captures_nombre = 5', async () => {
    await render(<ExtensiveImagosScreen />);
    await screen.findByText('📝 Nombre total de captures');
    await settle();

    fireEvent.changeText(screen.getByDisplayValue('0'), '5');
    await settle();

    // Active la phase « Solitaire » puis clique 5 fois sur « + ».
    fireEvent.press(screen.getByText('Solitaire'));
    await settle();
    for (let i = 0; i < 5; i++) {
      // Le premier « + » de l'écran est celui de la phase active (Solitaire) — la
      // section Phases précède la section Stades dans le rendu.
      fireEvent.press(screen.getAllByText('+')[0]);
       
      await settle();
    }
    expect(screen.getAllByText('5 ✅').length).toBeGreaterThan(0);

    // Densités obligatoires dès que les captures sont > 0 (#densite-diffuse-obligatoire) :
    // les deux seuls champs encore vides à ce stade sont Population diffuse et groupée.
    const densiteInputs = screen.getAllByDisplayValue('');
    fireEvent.changeText(densiteInputs[0], '4');
    fireEvent.changeText(densiteInputs[1], '2');
    await settle();

    fireEvent.press(screen.getByText('Suivant : Larves ›'));

    await waitFor(() => expect(prospectionRepository.saveProspectionPopulation).toHaveBeenCalledTimes(2));
    const [, lmcRow] = jest.mocked(prospectionRepository.saveProspectionPopulation).mock.calls[0];
    expect(lmcRow).toMatchObject({
      espece: 'LMC',
      captures_nombre: 5,
      captures_sol: 5,
      captures_trans: 0,
      captures_greg: 0,
      densite_diffuse: 4,
      densite_groupee: 2,
    });
  });
});
