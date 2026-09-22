/**
 * #biotope-multi : « Type de station (biotope) » de la fiche Extensive/Validation
 * devient TOUJOURS obligatoire (au moins un sélectionné) — même règle que Biotope
 * sur reference.tsx (Intensif), désormais alignée sur l'Extensif. Fichier séparé
 * de extensive-reference-typestation.test.tsx (un seul montage d'écran par
 * fichier — même mise en garde que extensive-reference-screen-restore.test.tsx,
 * fuite de la chaîne de promesses GPS entre tests d'un même fichier).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
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

describe('ExtensiveReferenceScreen — Type de station (biotope) désormais obligatoire (#biotope-multi)', () => {
  beforeEach(() => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'extensive',
        date_prospection: '2026-08-25',
        surface_infestee: 3.5,
      } as any,
      captures: [],
    });
  });

  it('aucune sélection : refuse « Suivant » et affiche le motif, sans jamais enregistrer', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    await render(<ExtensiveReferenceScreen />);
    await waitFor(() => expect(screen.getByText('Suivant : Imagos ›')).toBeVisible());

    fireEvent.press(screen.getByText('Suivant : Imagos ›'));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('Biotope requis', expect.stringContaining('type de biotope'))
    );
    expect(prospectionRepository.updateProspectionExtensiveReference).not.toHaveBeenCalled();
  });

  it('au moins une sélection : « Suivant » fonctionne sans blocage', async () => {
    // `jest.spyOn` sur une méthode déjà espionnée (test précédent de ce fichier)
    // réutilise le même mock plutôt que d'en empiler un nouveau — `mockClear()`
    // efface l'historique d'appels hérité, sans quoi l'assertion `not.toHaveBeenCalledWith`
    // ci-dessous verrait à tort l'appel « Biotope requis » du test précédent.
    const alertSpy = jest.spyOn(Alert, 'alert').mockClear().mockImplementation(() => {});

    await render(<ExtensiveReferenceScreen />);
    await waitFor(() => expect(screen.getByText('Suivant : Imagos ›')).toBeVisible());

    fireEvent.press(screen.getByText('Xerophyle'));
    await screen.findByText('Xerophyle ✓');
    fireEvent.press(screen.getByText('Suivant : Imagos ›'));

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionExtensiveReference).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({ typeStation: JSON.stringify(['xerophyle']) })
      )
    );
    expect(alertSpy).not.toHaveBeenCalledWith('Biotope requis', expect.anything());
  });
});
