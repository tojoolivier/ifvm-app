/**
 * Non-régression : « Suivant » sur extensive-larves.tsx routait directement vers
 * extensive-recap.tsx, sautant entièrement extensive-observations.tsx — un écran par
 * ailleurs déjà écrit (et déjà attendu par le récapitulatif, bloc « D · Observations »)
 * mais qu'aucune navigation ne rendait atteignable.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
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

describe('ExtensiveLarvesScreen — routage vers Observations', () => {
  beforeEach(() => {
    mockPush.mockClear();
    jest.mocked(prospectionRepository.saveProspectionPopulation).mockClear();
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
});
