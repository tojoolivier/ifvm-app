/**
 * extensive-imagos.tsx : #direction-sous-etat — la section « Direction du
 * déplacement » (visible seulement en État = Déplacement) s'affiche désormais
 * SOUS « État », plus au-dessus, dans l'ordre de rendu — même changement que
 * côté Intensif (intensive-imagos-direction-sous-etat.test.tsx).
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import ExtensiveImagosScreen from '@/app/(prospection)/extensive-imagos';

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { draftId: 'draft-123' } })
);

jest.mock('@/lib/prospection-repository', () => ({
  getProspectionPopulation: jest.fn().mockResolvedValue(null),
  saveProspectionPopulation: jest.fn().mockResolvedValue(undefined),
}));

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('ExtensiveImagosScreen — Direction du déplacement sous État', () => {
  afterEach(cleanup);

  it('affiche « 📊 Direction du déplacement » après « 📊 État » une fois Déplacement sélectionné', async () => {
    await render(<ExtensiveImagosScreen />);
    await screen.findByText('📊 État');
    await settle();

    fireEvent.press(screen.getByText('Déplacement'));
    await settle();

    const ordreTextes = screen
      .getAllByText(/^📊 (État|Direction du déplacement)$/)
      .map((el) => el.props.children);
    expect(ordreTextes).toEqual(['📊 État', '📊 Direction du déplacement']);
  });
});
