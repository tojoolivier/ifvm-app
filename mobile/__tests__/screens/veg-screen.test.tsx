/**
 * Non-régression #201 : en réouvrant une fiche intensive déjà enregistrée (brouillon
 * en attente de synchro ou déjà synchronisée), les strates de végétation ainsi que
 * l'humidité/texture du sol précédemment saisies ne doivent pas disparaître.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import VegetationScreen from '@/app/(prospection)/veg';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import * as prospectionRepository from '@/lib/prospection-repository';

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { draftId: 'draft-123' } })
);

jest.mock('@/lib/prospection-repository', () => ({
  updateProspectionVegetation: jest.fn().mockResolvedValue({ id: 'draft-123' }),
}));

describe('VegetationScreen', () => {
  afterEach(cleanup);
  beforeEach(() => {
    jest.mocked(prospectionRepository.updateProspectionVegetation).mockClear();
  });

  it('recharge et réenregistre les strates, l’humidité et la texture déjà enregistrées lors de la réouverture d’une fiche (#201)', async () => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'intensive',
        vegetation: JSON.stringify({
          strates: {
            arboree: { surfRel: 50, hMoy: 8, recouvrement: 40, verdissement: 60, repousse: null, orpad: ['Fleur'], solNu: 10 },
          },
        }),
        sol: JSON.stringify({ humidite: 'surface', texture: ['argileuse'] }),
      } as any,
      captures: [],
    });

    await render(<VegetationScreen />);

    expect(await screen.findByText('Strate arborée')).toBeVisible();
    // Le recouvrement restauré (40%) doit s'afficher, pas 0%.
    expect(await screen.findByText('40%')).toBeVisible();

    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionVegetation).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({
          vegetation: expect.stringContaining('"recouvrement":40'),
          sol: JSON.stringify({ humidite: 'surface', texture: ['argileuse'] }),
        })
      )
    );
  });

  it('accepte une saisie décimale libre (virgule) pour H. moy/Verdissement/Repousse/Sol nu, sans arrondi au pas de 5', async () => {
    // Régression : ces 4 champs étaient arrondis au multiple de 5 le plus proche
    // (clampTo5), comme le stepper Recouvrement — qui, lui, garde ce comportement.
    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'intensive', vegetation: null, sol: null } as any,
      captures: [],
    });

    await render(<VegetationScreen />);
    fireEvent.press(await screen.findByText('Strate arborée'));
    await waitFor(() => expect(screen.getByText('Recouvrement')).toBeVisible());

    // Une seule strate dépliée : H. moy est le 2e des 5 champs décimaux vides (Surf. rel. %,
    // H. moy, % Verdissement, % Repousse, Sol nu %) — on retape après chaque frappe, l'index
    // des champs encore vides se décalant à mesure qu'ils se remplissent.
    fireEvent.changeText(screen.getAllByDisplayValue('')[1], '2,75');
    expect(await screen.findByDisplayValue('2,75')).toBeVisible();

    fireEvent.changeText(screen.getAllByDisplayValue('')[0], '33,5');
    expect(await screen.findByDisplayValue('33,5')).toBeVisible();

    fireEvent.changeText(screen.getAllByDisplayValue('')[0], '12,25');
    expect(await screen.findByDisplayValue('12,25')).toBeVisible();

    fireEvent.changeText(screen.getAllByDisplayValue('')[0], '5,5');
    // Aucun de ces 4 champs n'est arrondi à un multiple de 5 (contrairement à
    // Recouvrement) : les quatre valeurs décimales saisies restent visibles telles quelles.
    expect(await screen.findByDisplayValue('5,5')).toBeVisible();
    expect(screen.getByDisplayValue('2,75')).toBeVisible();
    expect(screen.getByDisplayValue('33,5')).toBeVisible();
    expect(screen.getByDisplayValue('12,25')).toBeVisible();
  });
});
