/**
 * Prospection Extensive — écran Observations : après « Remarques », un champ
 * « Signature » affiche automatiquement le nom de l'utilisateur connecté
 * (jamais ressaisi) et capture un tracé numérique (`SignaturePad`) avec
 * VALIDER/MODIFIER — les deux modes (terrestre et aérien), contrairement aux
 * signatures Consultant FAO/Chef de Base (mode aérien uniquement, cf.
 * extensive-observations-futs-signatures-screen.test.tsx). Réutilise
 * `signature_visa_nom`/`_horodatage`/`_image`, mêmes colonnes que l'auto-
 * signature de observations.tsx (Intensif).
 *
 * Fichier séparé — même précaution que les autres suites extensive-observations-*
 * de ce dépôt (contention de ressources).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ExtensiveObservationsScreen from '@/app/(prospection)/extensive-observations';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { useAuthStore } from '@/lib/auth-store';
import * as prospectionRepository from '@/lib/prospection-repository';

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { draftId: 'draft-123' } })
);

jest.mock('@/lib/prospection-repository', () => ({
  updateProspectionExtensiveObservations: jest.fn().mockResolvedValue({ id: 'draft-123' }),
}));

jest.mock('@/lib/referentiel-db', () => ({
  listUtilisateursByRole: jest.fn().mockResolvedValue([]),
}));

/**
 * `SignaturePad` s'appuie sur `PanResponder` (gestes tactiles bruts) — hors de
 * portée d'une simulation RNTL fidèle. Même remplacement que les suites
 * extensive-observations-*-signatures-screen.test.tsx et
 * observations-signature-screen.test.tsx (Intensif).
 */
jest.mock('@/components/traitement/SignaturePad', () => {
  const React = require('react');
  const { Text, TouchableOpacity } = require('react-native');
  function SignaturePad({ value, onChange, readOnly, testID }: any) {
    if (readOnly) {
      return <Text testID={testID}>{`trace:${value}`}</Text>;
    }
    return (
      <TouchableOpacity testID={testID} onPress={() => onChange('M0 0 L1 1')}>
        <Text>dessiner</Text>
      </TouchableOpacity>
    );
  }
  return { SignaturePad };
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('ExtensiveObservationsScreen — Signature (après Remarques)', () => {
  beforeEach(() => {
    jest
      .mocked(prospectionRepository.updateProspectionExtensiveObservations)
      .mockClear()
      .mockResolvedValue({ id: 'draft-123' } as any);
    useAuthStore.setState({ user: { id: 'u1', nom: 'Rakoto', prenom: 'Jean', email: 'j@x.mg', role: 'prospecteur', actif: true } as any });
  });

  it("apparaît en mode terrestre (pas seulement en mode aérien, contrairement à Consultant FAO/Chef de Base)", async () => {
    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'extensive' } as any,
      captures: [],
    });

    await render(<ExtensiveObservationsScreen />);
    await screen.findByText('Signature');

    expect(screen.queryByText('Signatures')).toBeNull();
  });

  it("affiche automatiquement le nom de l'utilisateur connecté, jamais un champ à saisir", async () => {
    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'extensive' } as any,
      captures: [],
    });

    await render(<ExtensiveObservationsScreen />);
    expect(await screen.findByText('Jean Rakoto')).toBeVisible();
  });

  it('VALIDER persiste immédiatement la signature (nom auto + tracé + horodatage), puis bascule en lecture seule avec MODIFIER', async () => {
    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'extensive' } as any,
      captures: [],
    });

    await render(<ExtensiveObservationsScreen />);
    fireEvent.press(await screen.findByTestId('signature-pad-visa'));
    await settle();
    fireEvent.press(screen.getByText('VALIDER'));

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionExtensiveObservations).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({
          signatureVisaNom: 'Jean Rakoto',
          signatureVisaImage: 'M0 0 L1 1',
        })
      )
    );
    const [, payload] = jest.mocked(prospectionRepository.updateProspectionExtensiveObservations).mock.calls[0];
    expect(payload.signatureVisaHorodatage).not.toBeNull();

    expect(await screen.findByText('MODIFIER')).toBeVisible();
    expect(screen.getByTestId('signature-pad-visa')).toHaveTextContent('trace:M0 0 L1 1');
  });

  it('restaure une signature déjà enregistrée pour cette fiche (lecture seule + MODIFIER) dès le montage', async () => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'extensive',
        signature_visa_nom: 'Jean Rakoto',
        signature_visa_horodatage: '2026-09-22T08:00:00.000Z',
        signature_visa_image: 'M5 5 L6 6',
      } as any,
      captures: [],
    });

    await render(<ExtensiveObservationsScreen />);

    expect(await screen.findByText('MODIFIER')).toBeVisible();
    expect(screen.getByTestId('signature-pad-visa')).toHaveTextContent('trace:M5 5 L6 6');
    expect(screen.queryByText('VALIDER')).toBeNull();
  });

  it('« Suivant » renvoie la signature déjà validée sans la ressaisir', async () => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'extensive',
        signature_visa_nom: 'Jean Rakoto',
        signature_visa_horodatage: '2026-09-22T08:00:00.000Z',
        signature_visa_image: 'M5 5 L6 6',
      } as any,
      captures: [],
    });

    await render(<ExtensiveObservationsScreen />);
    await screen.findByText('MODIFIER');

    fireEvent.press(screen.getByText('Suivant : Récapitulatif ›'));

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionExtensiveObservations).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({
          signatureVisaNom: 'Jean Rakoto',
          signatureVisaHorodatage: '2026-09-22T08:00:00.000Z',
          signatureVisaImage: 'M5 5 L6 6',
        })
      )
    );
  });
});
