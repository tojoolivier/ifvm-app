/**
 * extensive-imagos.tsx : #interdistance-obligatoire-si-accouplement-ou-ponte —
 * même règle que côté Intensif (intensive-imagos-interdistance-obligatoire.test.tsx),
 * appliquée aussi ici (donc aux fiches Signalement, même écran) : contrairement
 * aux choix obligatoires d'#accouplement-ponte-cible-etat-obligatoires (Intensif
 * seulement), cette règle ne se déclenche que si l'agent a activement signalé un
 * accouplement ou une ponte — jamais sur une fiche qui ne touche pas ces champs,
 * donc pas de risque de reproduire le blocage de sync déjà corrigé pour la
 * densité diffuse.
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

describe('ExtensiveImagosScreen — interdistance obligatoire dès un accouplement/ponte actif', () => {
  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });
  beforeEach(() => {
    jest.mocked(prospectionRepository.saveProspectionPopulation).mockClear();
    jest.mocked(prospectionRepository.getProspectionPopulation).mockResolvedValue(null);
  });

  it('bloque « Suivant » tant que l’interdistance manque pour l’espèce concernée', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');

    await render(<ExtensiveImagosScreen />);
    await screen.findByText('📊 Accouplement');
    await settle();

    fireEvent.press(screen.getAllByText('Beaucoup')[0]);
    await settle();
    expect(screen.getByTestId('interdistance-input')).toBeVisible();

    fireEvent.press(screen.getByText('Suivant : Larves ›'));
    await settle();

    expect(alertSpy).toHaveBeenCalledWith('Interdistance requise', expect.stringContaining('LMC'));
    expect(prospectionRepository.saveProspectionPopulation).not.toHaveBeenCalled();
  });

  it('laisse passer « Suivant » une fois l’interdistance renseignée', async () => {
    // #confirmation-espece-sans-donnee : NSE reste entièrement vide dans ce
    // scénario (seul LMC est visé) — confirme automatiquement ce modal, sans
    // rapport avec l'interdistance testée ici.
    jest.spyOn(Alert, 'alert').mockImplementation((_titre, _message, boutons) => {
      boutons?.find((b) => b.text === 'Continuer')?.onPress?.();
    });

    await render(<ExtensiveImagosScreen />);
    await screen.findByText('📊 Accouplement');
    await settle();

    fireEvent.press(screen.getAllByText('Beaucoup')[0]);
    await settle();
    fireEvent.changeText(screen.getByTestId('interdistance-input'), '6');
    await settle();

    fireEvent.press(screen.getByText('Suivant : Larves ›'));

    await waitFor(() => expect(prospectionRepository.saveProspectionPopulation).toHaveBeenCalledTimes(2));
    const [, lmcRow] = jest.mocked(prospectionRepository.saveProspectionPopulation).mock.calls[0];
    expect(lmcRow).toMatchObject({ espece: 'LMC', accouplement: 'Beaucoup', interdistance: 6 });
  });

  it('n’exige pas l’interdistance quand accouplement et ponte restent Néant/non renseignés', async () => {
    // #confirmation-espece-sans-donnee : ni LMC ni NSE ne portent de valeur dans ce
    // scénario (précisément son objet) — confirme automatiquement ce modal, sans
    // rapport avec l'interdistance visée ici.
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_titre, _message, boutons) => {
      boutons?.find((b) => b.text === 'Continuer')?.onPress?.();
    });

    await render(<ExtensiveImagosScreen />);
    await screen.findByText('📊 Type de cible');
    await settle();

    expect(screen.queryByTestId('interdistance-input')).toBeNull();

    fireEvent.press(screen.getByText('Suivant : Larves ›'));

    await waitFor(() => expect(prospectionRepository.saveProspectionPopulation).toHaveBeenCalledTimes(2));
    expect(alertSpy).not.toHaveBeenCalledWith('Interdistance requise', expect.anything());
  });
});
