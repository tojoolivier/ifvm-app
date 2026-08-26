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

    // LMC (espèce active par défaut) : Vol clair (par défaut) confirmé explicitement.
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

    expect(lmcRow).toMatchObject({ espece: 'LMC', type_cible: 'vol_clair' });
    expect(nseRow).toMatchObject({ espece: 'NSE', type_cible: 'dense' });
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
});
