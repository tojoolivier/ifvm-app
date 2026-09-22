/**
 * Surface infestée (ha) facultative — s'applique aussi aux fiches de
 * « prospection de validation » (vérification d'un signalement), qui passent
 * par le même écran extensive-reference.tsx que l'extensive
 * (#surface-infestee-facultative). Enregistrée à 0 (pas `null`) quand laissée
 * vide (#cible-terrestre-extensif-validation), même règle que reference.tsx
 * (Intensif) et l'extensive (cf. extensive-reference-surface-infestee-vide.test.tsx).
 * Fichier séparé (un seul montage d'écran par fichier), même mise en garde que
 * extensive-reference-screen-restore.test.tsx.
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
  // `date_prospection` doit être présent dans la valeur résolue : `setDraft(updated)`
  // republie le brouillon après l'enregistrement, et une valeur incomplète ici fait
  // planter `generateNumeroMessage` sur un remontage ultérieur (cf.
  // extensive-reference-surface-infestee-positive.test.tsx, même précaution).
  updateProspectionExtensiveReference: jest.fn().mockResolvedValue({
    id: 'draft-123',
    type_prospection: 'validation',
    date_prospection: '2026-08-25',
  }),
  listOperationsAeriennes: jest.fn().mockResolvedValue([]),
  saveOperationsAeriennes: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/location', () => ({
  getCurrentPosition: jest.fn().mockResolvedValue({ latitude: -18.9, longitude: 47.5, altitude: null, accuracy: 5, timestamp: Date.now() }),
}));

describe('ExtensiveReferenceScreen — surface infestée facultative (prospection de validation)', () => {
  beforeEach(() => {
    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'validation', date_prospection: '2026-08-25' } as any,
      captures: [],
    });
  });

  it('laisse passer « Suivant » sans alerte quand la surface infestée est vide, et l’enregistre à 0', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    await render(<ExtensiveReferenceScreen />);
    await waitFor(() => expect(screen.getByText('Suivant : Imagos ›')).toBeVisible());

    // #biotope-multi : désormais obligatoire (au moins un sélectionné), non
    // testé ici — hors sujet de ce test (surface infestée).
    fireEvent.press(screen.getByText('Xerophyle'));
    await screen.findByText('Xerophyle ✓');
    fireEvent.press(screen.getByText('Suivant : Imagos ›'));

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionExtensiveReference).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({ surfaceInfestee: 0 })
      )
    );
    expect(alertSpy).not.toHaveBeenCalledWith('Surface infestée requise', expect.any(String));
  });
});
