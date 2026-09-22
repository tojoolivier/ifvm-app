/**
 * extensive-imagos.tsx : #confirmation-espece-sans-donnee — LMC et NSE sont
 * deux onglets d'un même écran, toujours enregistrés ensemble par « Suivant »
 * (contrairement à l'Intensif, ici les deux lignes sont sauvegardées d'un
 * coup, cf. handleContinue) : rien n'empêche de les enregistrer sans jamais
 * avoir ouvert l'un des deux onglets. Un modal avertit avant de partir si
 * l'une des deux (ou les deux) n'a strictement aucune valeur saisie.
 */
import { Alert } from 'react-native';
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

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('ExtensiveImagosScreen — confirmation avant de quitter une espèce sans donnée', () => {
  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });
  beforeEach(() => {
    jest.mocked(prospectionRepository.saveProspectionPopulation).mockClear();
    jest.mocked(prospectionRepository.getProspectionPopulation).mockResolvedValue(null);
  });

  it('avertit avant d’enregistrer si NSE n’a jamais été ouvert, alors qu’on est resté sur l’onglet LMC', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');

    await render(<ExtensiveImagosScreen />);
    await screen.findByText('📊 Type de cible');
    await settle();

    // LMC : une seule valeur suffit à ne pas être considéré comme vide.
    fireEvent.press(screen.getByText('Vol clair'));
    await settle();

    fireEvent.press(screen.getByText('Suivant : Larves ›'));
    await settle();

    expect(alertSpy).toHaveBeenCalledWith(
      'Aucune donnée saisie',
      expect.stringContaining('NSE'),
      expect.anything()
    );
    // Bloqué avant l'enregistrement : les deux lignes sont sauvegardées d'un
    // coup (LMC + NSE), jamais l'une sans l'autre.
    expect(prospectionRepository.saveProspectionPopulation).not.toHaveBeenCalled();
  });

  it('« Annuler » laisse l’agent sur l’écran, sans rien enregistrer', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_titre, _message, boutons) => {
      boutons?.find((b) => b.text === 'Annuler')?.onPress?.();
    });

    await render(<ExtensiveImagosScreen />);
    await screen.findByText('📊 Type de cible');
    await settle();

    fireEvent.press(screen.getByText('Vol clair'));
    await settle();
    fireEvent.press(screen.getByText('Suivant : Larves ›'));
    await settle();

    expect(prospectionRepository.saveProspectionPopulation).not.toHaveBeenCalled();
  });

  it('« Continuer » referme le modal et enregistre les deux espèces', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_titre, _message, boutons) => {
      boutons?.find((b) => b.text === 'Continuer')?.onPress?.();
    });

    await render(<ExtensiveImagosScreen />);
    await screen.findByText('📊 Type de cible');
    await settle();

    fireEvent.press(screen.getByText('Vol clair'));
    await settle();
    fireEvent.press(screen.getByText('Suivant : Larves ›'));

    await waitFor(() => expect(prospectionRepository.saveProspectionPopulation).toHaveBeenCalledTimes(2));
  });

  it('ne demande aucune confirmation quand LMC et NSE ont chacun une valeur', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');

    await render(<ExtensiveImagosScreen />);
    await screen.findByText('📊 Type de cible');
    await settle();

    fireEvent.press(screen.getByText('Vol clair'));
    await settle();
    fireEvent.press(screen.getByText('NSE'));
    await settle();
    fireEvent.press(screen.getByText('Dense'));
    await settle();

    fireEvent.press(screen.getByText('Suivant : Larves ›'));

    await waitFor(() => expect(prospectionRepository.saveProspectionPopulation).toHaveBeenCalledTimes(2));
    expect(alertSpy).not.toHaveBeenCalledWith('Aucune donnée saisie', expect.anything(), expect.anything());
  });
});
