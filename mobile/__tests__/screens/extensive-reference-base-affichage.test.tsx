/**
 * Base principale (mode aérien) : renommée « Base principale », complétée par un
 * numéro, une date d'installation et une localisation GPS capturée sur demande
 * (bouton, jamais automatique) ; Base secondaire (texte libre) avec le même
 * schéma — sa propre date d'installation et sa propre localisation GPS.
 *
 * Fichier séparé — cf. le commentaire d'extensive-reference-screen-restore.test.tsx
 * pour le pourquoi (un seul montage d'écran par fichier, contention observée sinon).
 */
import { render, screen, waitFor } from '@testing-library/react-native';
import ExtensiveReferenceScreen from '@/app/(prospection)/extensive-reference';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import * as prospectionRepository from '@/lib/prospection-repository';
import { getCurrentPosition } from '@/lib/location';

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { draftId: 'draft-123' } })
);

jest.mock('@/lib/prospection-repository', () => ({
  updateProspectionExtensiveReference: jest.fn().mockResolvedValue({
    id: 'draft-123',
    type_prospection: 'extensive',
    date_prospection: '2026-09-17',
  }),
  updateProspectionGpsPosition: jest.fn().mockResolvedValue({ id: 'draft-123' }),
  listOperationsAeriennes: jest.fn().mockResolvedValue([]),
  saveOperationsAeriennes: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/location', () => ({
  getCurrentPosition: jest.fn().mockResolvedValue({ latitude: -18.9, longitude: 47.5, altitude: null, accuracy: 5, timestamp: Date.now() }),
  reverseGeocode: jest.fn().mockResolvedValue({ region: null, district: null, commune: null }),
}));

describe('ExtensiveReferenceScreen — Base principale/secondaire : affichage', () => {
  beforeEach(() => {
    jest.mocked(prospectionRepository.updateProspectionExtensiveReference).mockClear();
    jest.mocked(getCurrentPosition).mockClear();
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'extensive',
        date_prospection: '2026-09-17',
        mode_extensif: 'aerien',
        surface_infestee: 3.5,
      } as any,
      captures: [],
    });
  });

  it('affiche Base principale/secondaire avec Numéro, Date d’installation et Localiser, sans coordonnées par défaut', async () => {
    await render(<ExtensiveReferenceScreen />);
    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalled());

    expect(await screen.findByText('Base principale')).toBeVisible();
    expect(screen.getByText('Numéro de base')).toBeVisible();
    expect(screen.getAllByText('Date d\'installation')).toHaveLength(2); // principale + secondaire
    // « Base secondaire » apparaît deux fois : le sous-titre de section et le
    // libellé du champ de saisie libre lui-même.
    expect(screen.getAllByText('Base secondaire')).toHaveLength(2);
    expect(screen.getAllByText('Coordonnées non renseignées')).toHaveLength(2);
    expect(screen.getAllByText(/📍 Localiser/)).toHaveLength(2);
  });
});
