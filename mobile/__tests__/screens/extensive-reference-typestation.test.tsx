/**
 * #biotope-multi : « Type de station (biotope) » de la fiche Extensive/Validation
 * devient à choix multiples — reste facultatif (aucune règle « au moins un »
 * ajoutée, comportement inchangé). Un seul montage d'écran par fichier — même mise
 * en garde que extensive-reference-screen-restore.test.tsx (fuite de la chaîne de
 * promesses GPS entre tests d'un même fichier) ; cf.
 * extensive-reference-typestation-facultatif.test.tsx pour le second scénario.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ExtensiveReferenceScreen from '@/app/(prospection)/extensive-reference';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import * as prospectionRepository from '@/lib/prospection-repository';

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { draftId: 'draft-123' } })
);

jest.mock('@/lib/prospection-repository', () => ({
  updateProspectionExtensiveReference: jest.fn().mockResolvedValue({
    id: 'draft-123',
    type_prospection: 'extensive',
    date_prospection: '2026-08-25',
  }),
  listOperationsAeriennes: jest.fn().mockResolvedValue([]),
  saveOperationsAeriennes: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/location', () => ({
  getCurrentPosition: jest.fn().mockResolvedValue({ latitude: -18.9, longitude: 47.5, altitude: null, accuracy: 5, timestamp: Date.now() }),
  reverseGeocode: jest.fn().mockResolvedValue({ region: null, district: null, commune: null }),
}));

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('ExtensiveReferenceScreen — Type de station à choix multiples (#biotope-multi)', () => {
  beforeEach(() => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'extensive',
        date_prospection: '2026-08-25',
      } as any,
      captures: [],
    });
  });

  it('sélection multiple, décocher un élément — seul l’élément décoché est retiré', async () => {
    await render(<ExtensiveReferenceScreen />);
    await waitFor(() => expect(screen.getByText('Suivant : Imagos ›')).toBeVisible());

    // Sélectionne Xerophyle et Mesophyle.
    fireEvent.press(screen.getByText('Xerophyle'));
    await settle();
    fireEvent.press(screen.getByText('Mesophyle'));
    await settle();
    expect(screen.getByText(/^Xerophyle/).props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: '#fff' })])
    );

    // Décoche uniquement Xerophyle — Mesophyle reste coché.
    fireEvent.press(screen.getByText(/^Xerophyle/));
    await settle();
    fireEvent.press(screen.getByText('Suivant : Imagos ›'));

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionExtensiveReference).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({ typeStation: JSON.stringify(['mesophyle']) })
      )
    );
  });
});
