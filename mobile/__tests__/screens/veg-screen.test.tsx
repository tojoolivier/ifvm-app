/**
 * Non-régression #201 : en réouvrant une fiche intensive déjà enregistrée (brouillon
 * en attente de synchro ou déjà synchronisée), les strates de végétation ainsi que
 * l'humidité/texture du sol précédemment saisies ne doivent pas disparaître.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
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
});
