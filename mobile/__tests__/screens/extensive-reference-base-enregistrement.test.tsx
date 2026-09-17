/**
 * Base principale/secondaire (mode aérien) — numéro, date d'installation et
 * coordonnées GPS des deux bases enregistrés sur « Suivant ». Fichier séparé —
 * cf. extensive-reference-base-affichage.test.tsx.
 *
 * Les coordonnées GPS des deux bases sont ici pré-saisies dans le brouillon
 * (déjà capturées lors d'une session précédente) plutôt que capturées via le
 * bouton Localiser pendant ce test : appuyer sur les DEUX boutons Localiser
 * dans un même test déclenche une corrosion connue de l'environnement de test
 * (« overlapping act() calls », deux résolutions GPS asynchrones qui se
 * chevauchent) — cf. extensive-reference-base-localiser.test.tsx pour la
 * couverture (déjà verte) d'un seul bouton Localiser pressé isolément.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
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

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)));

describe('ExtensiveReferenceScreen — Base principale/secondaire : enregistrement', () => {
  beforeEach(() => {
    jest.mocked(prospectionRepository.updateProspectionExtensiveReference).mockClear();
    jest.mocked(getCurrentPosition).mockClear();
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'extensive',
        date_prospection: '2026-09-17',
        mode_extensif: 'aerien',
        latitude: -18.9,
        longitude: 47.5,
        surface_infestee: 3.5,
        base: 'Antsirabe',
        base_latitude: -19.1111,
        base_longitude: 47.2222,
        base_secondaire_latitude: -20.3333,
        base_secondaire_longitude: 48.4444,
      } as any,
      captures: [],
    });
  });

  it('enregistre numéro, date, base secondaire et coordonnées GPS déjà capturées des deux bases sur « Suivant »', async () => {
    await render(<ExtensiveReferenceScreen />);
    // Fiche déjà localisée (latitude/longitude renseignées) : pas de nouvelle
    // capture GPS automatique au montage.
    expect(getCurrentPosition).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByTestId('aerien-field-Numéro de base'), '12');
    fireEvent.changeText(screen.getByTestId('aerien-field-Base secondaire'), 'Ambositra');
    await settle();

    fireEvent.press(screen.getByText('Suivant : Imagos ›'));

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionExtensiveReference).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({
          baseNumero: 12,
          baseLatitude: -19.1111,
          baseLongitude: 47.2222,
          baseSecondaire: 'Ambositra',
          baseSecondaireLatitude: -20.3333,
          baseSecondaireLongitude: 48.4444,
        })
      )
    );
  });
});
