/**
 * Mode aérien — Quantité de pesticide disponible/reçue : mêmes champs
 * "decimal-pad" francophones que « H STR HERB (m) », même bug
 * (#saisie-decimale-virgule) — `parseFloat("12,5")` vaut 12 (s'arrête à la
 * virgule), une perte plus discrète ici (partie entière non nulle) mais bien
 * réelle.
 *
 * Fichier séparé des autres scénarios de cet écran — cf. le commentaire
 * d'extensive-observations-pesticides-signatures-screen.test.tsx pour le
 * pourquoi (accumuler les montages dans un même fichier provoque des timeouts).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ExtensiveObservationsScreen from '@/app/(prospection)/extensive-observations';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import * as prospectionRepository from '@/lib/prospection-repository';

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { draftId: 'draft-123' } })
);

jest.mock('@/lib/prospection-repository', () => ({
  updateProspectionExtensiveObservations: jest.fn().mockResolvedValue({ id: 'draft-123', mode_extensif: 'aerien' }),
  normalizeBoolean: (value: unknown) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    return null;
  },
}));

jest.mock('@/lib/referentiel-db', () => ({
  listUtilisateursByRole: jest.fn().mockResolvedValue([]),
}));

describe('ExtensiveObservationsScreen — quantité de pesticide saisie à la virgule', () => {
  beforeEach(() => {
    jest.mocked(prospectionRepository.updateProspectionExtensiveObservations).mockClear().mockResolvedValue({
      id: 'draft-123',
      mode_extensif: 'aerien',
    } as any);
    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'extensive', mode_extensif: 'aerien' } as any,
      captures: [],
    });
  });

  it('enregistre 12,5 L (virgule) comme 12.5, jamais 12', async () => {
    await render(<ExtensiveObservationsScreen />);
    await screen.findByText('Pesticides Embarqués');

    fireEvent.press(screen.getByText('Oui'));
    expect(await screen.findByText('Nom Commercial')).toBeVisible();

    fireEvent.changeText(screen.getByTestId('pesticide-quantite-disponible-input'), '12,5');
    fireEvent.changeText(screen.getByTestId('pesticide-quantite-recue-input'), '8,25');
    expect(await screen.findByDisplayValue('12,5')).toBeVisible();

    fireEvent.press(screen.getByText('Suivant : Récapitulatif ›'));

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionExtensiveObservations).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({
          pesticideQuantiteDisponible: 12.5,
          pesticideQuantiteRecue: 8.25,
        })
      )
    );
  });
});
