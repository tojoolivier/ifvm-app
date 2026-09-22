/**
 * extensive-larves.tsx : #confirmation-espece-sans-donnee — même garde-fou que
 * côté Imagos (extensive-imagos-confirmation-espece-vide.test.tsx) : LMC et
 * NSE sont enregistrés d'un coup par « Suivant », rien n'empêche de le faire
 * sans jamais avoir ouvert l'un des deux onglets.
 */
import { Alert } from 'react-native';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ExtensiveLarvesScreen from '@/app/(prospection)/extensive-larves';
import * as prospectionRepository from '@/lib/prospection-repository';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({ draftId: 'draft-123' }),
}));

jest.mock('@/lib/prospection-repository', () => ({
  getProspectionPopulation: jest.fn().mockResolvedValue(null),
  saveProspectionPopulation: jest.fn().mockResolvedValue(undefined),
}));

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('ExtensiveLarvesScreen — confirmation avant de quitter une espèce sans donnée', () => {
  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });
  beforeEach(() => {
    mockPush.mockClear();
    jest.mocked(prospectionRepository.saveProspectionPopulation).mockClear();
    jest.mocked(prospectionRepository.getProspectionPopulation).mockResolvedValue(null);
  });

  it('avertit avant d’enregistrer si NSE n’a jamais été ouvert, alors qu’on est resté sur l’onglet LMC', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');

    await render(<ExtensiveLarvesScreen />);
    await screen.findByTestId('interdistance-input');
    await settle();

    // LMC : une seule valeur suffit à ne pas être considéré comme vide.
    fireEvent.changeText(screen.getByTestId('interdistance-input'), '5');
    await settle();

    fireEvent.press(screen.getByText('Suivant : Observations ›'));
    await settle();

    expect(alertSpy).toHaveBeenCalledWith(
      'Aucune donnée saisie',
      expect.stringContaining('NSE'),
      expect.anything()
    );
    expect(prospectionRepository.saveProspectionPopulation).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('« Annuler » laisse l’agent sur l’écran, sans rien enregistrer', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_titre, _message, boutons) => {
      boutons?.find((b) => b.text === 'Annuler')?.onPress?.();
    });

    await render(<ExtensiveLarvesScreen />);
    await screen.findByTestId('interdistance-input');
    await settle();

    fireEvent.changeText(screen.getByTestId('interdistance-input'), '5');
    await settle();
    fireEvent.press(screen.getByText('Suivant : Observations ›'));
    await settle();

    expect(prospectionRepository.saveProspectionPopulation).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('« Continuer » referme le modal et poursuit vers l’écran suivant', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_titre, _message, boutons) => {
      boutons?.find((b) => b.text === 'Continuer')?.onPress?.();
    });

    await render(<ExtensiveLarvesScreen />);
    await screen.findByTestId('interdistance-input');
    await settle();

    fireEvent.changeText(screen.getByTestId('interdistance-input'), '5');
    await settle();
    fireEvent.press(screen.getByText('Suivant : Observations ›'));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: '/(prospection)/extensive-observations' })
      )
    );
  });

  it('ne demande aucune confirmation quand LMC et NSE ont chacun une valeur', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');

    await render(<ExtensiveLarvesScreen />);
    await screen.findByTestId('interdistance-input');
    await settle();

    fireEvent.changeText(screen.getByTestId('interdistance-input'), '5');
    await settle();
    fireEvent.press(screen.getByText('NSE'));
    await settle();
    fireEvent.changeText(screen.getByTestId('interdistance-input'), '3');
    await settle();

    fireEvent.press(screen.getByText('Suivant : Observations ›'));

    await waitFor(() => expect(mockPush).toHaveBeenCalled());
    expect(alertSpy).not.toHaveBeenCalledWith('Aucune donnée saisie', expect.anything(), expect.anything());
  });
});
