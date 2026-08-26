/**
 * Non-régression : « Suivant » sur extensive-larves.tsx routait directement vers
 * extensive-recap.tsx, sautant entièrement extensive-observations.tsx — un écran par
 * ailleurs déjà écrit (et déjà attendu par le récapitulatif, bloc « D · Observations »)
 * mais qu'aucune navigation ne rendait atteignable.
 *
 * Non-régression : cet écran avait sa propre liste de stades locale (L1-L8 pour LMC,
 * en désaccord avec `stadesLarvairesFor` — la source canonique, L1-L5 pour LMC) — LMC
 * ne va jamais au-delà de L5.
 */
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

describe('ExtensiveLarvesScreen', () => {
  afterEach(cleanup);
  beforeEach(() => {
    mockPush.mockClear();
    jest.mocked(prospectionRepository.saveProspectionPopulation).mockClear();
    jest.mocked(prospectionRepository.getProspectionPopulation).mockResolvedValue(null);
  });

  it('« Suivant » route vers extensive-observations, pas directement vers le récapitulatif', async () => {
    await render(<ExtensiveLarvesScreen />);
    await screen.findByText('📊 Observations');

    fireEvent.press(screen.getByText('Suivant : Observations ›'));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: '/(prospection)/extensive-observations', params: { draftId: 'draft-123' } })
      )
    );
  });

  it("LMC ne propose que L1 à L5 — L6/L7/L8 n'apparaissent plus", async () => {
    await render(<ExtensiveLarvesScreen />);
    await screen.findByText('📊 Stades');

    for (const stade of ['L1', 'L2', 'L3', 'L4', 'L5']) {
      expect(screen.getByText(stade)).toBeVisible();
    }
    expect(screen.queryByText('L6')).toBeNull();
    expect(screen.queryByText('L7')).toBeNull();
    expect(screen.queryByText('L8')).toBeNull();
  });

  it('NSE conserve ses propres stades (L1 à L7), inchangés', async () => {
    await render(<ExtensiveLarvesScreen />);
    await screen.findByText('📊 Stades');
    fireEvent.press(screen.getByText('NSE'));
    await settle();

    for (const stade of ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7']) {
      expect(screen.getByText(stade)).toBeVisible();
    }
    expect(screen.queryByText('L8')).toBeNull();
  });

  it('Surface contaminée (ha) se sauvegarde avec une valeur décimale et se restaure', async () => {
    await render(<ExtensiveLarvesScreen />);
    await screen.findByText('Surface contaminée (ha)');
    await settle();

    // Interdistance (m) puis Surface contaminée (ha) sont les 2 champs vides, dans cet ordre.
    fireEvent.changeText(screen.getAllByDisplayValue('')[1], '12.75');
    await settle();
    fireEvent.press(screen.getByText('Suivant : Observations ›'));

    await waitFor(() => expect(prospectionRepository.saveProspectionPopulation).toHaveBeenCalledTimes(2));
    const [, lmcRow] = jest.mocked(prospectionRepository.saveProspectionPopulation).mock.calls[0];
    expect(lmcRow).toMatchObject({ espece: 'LMC', surface_contaminee_ha: 12.75 });
  });
});
