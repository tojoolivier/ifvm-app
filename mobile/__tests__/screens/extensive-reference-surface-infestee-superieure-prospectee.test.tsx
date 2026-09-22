/**
 * Cohérence relationnelle prospectée >= infestée (ADR-006), même règle que
 * reference.tsx (Intensif) — cf. extensive-reference-surface-infestee-vide.test.tsx
 * pour le contexte général de la surface infestée sur cet écran
 * (#surface-infestee-facultative). Cet écran ne collecte jamais lui-même
 * `surface_prospectee` (l'Extensif/la Validation ne connaissent que Station et
 * Infestée), mais la colonne peut déjà porter une valeur héritée d'une
 * revalidation (`demarrerRevalidation` clone TOUTES les colonnes sauf celles
 * listées dans `COLONNES_REVALIDATION_NON_CLONEES`, y compris
 * `surface_prospectee`) — sans ce contrôle, une fiche revalidée où l'agent
 * relève une surface infestée plus grande qu'avant échouait silencieusement à
 * la synchronisation (`SurfaceInfesteeSuperieureError`, backend) sans qu'aucun
 * champ visible ici n'explique pourquoi. Fichier séparé (un seul montage
 * d'écran par fichier), même mise en garde que
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

describe('ExtensiveReferenceScreen — surface infestée vs surface prospectée héritée (revalidation)', () => {
  beforeEach(() => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'validation',
        date_prospection: '2026-08-25',
        revalide_de_id: 'prospection-source',
        surface_prospectee: 5,
      } as any,
      captures: [],
    });
  });

  it('bloque « Suivant » avec une alerte quand la surface infestée dépasse la surface prospectée héritée', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    await render(<ExtensiveReferenceScreen />);
    await waitFor(() => expect(screen.getByText('Suivant : Imagos ›')).toBeVisible());

    fireEvent.changeText(screen.getByPlaceholderText('0'), '8');
    expect(await screen.findByDisplayValue('8')).toBeVisible();
    fireEvent.press(screen.getByText('Xerophyle'));
    await screen.findByText('Xerophyle ✓');
    fireEvent.press(screen.getByText('Suivant : Imagos ›'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Surface infestée invalide', expect.any(String)));
    expect(prospectionRepository.updateProspectionExtensiveReference).not.toHaveBeenCalled();
  });
});
